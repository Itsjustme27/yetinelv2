#!/usr/bin/env node

/**
 * Mini SIEM Linux Agent
 * Collects logs from Linux systems and sends them to the SIEM backend
 *
 * Usage: sudo node agent.js [--config config.json]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

// Default configuration
const DEFAULT_CONFIG = {
    server: {
        host: 'localhost',
        port: 3001,
        ssl: false
    },
    agent_id: null, // Will be generated
    log_sources: [
        { path: '/var/log/syslog', type: 'syslog' },
        { path: '/var/log/auth.log', type: 'auth' },
        { path: '/var/log/secure', type: 'auth' }  // RHEL/CentOS
    ],
    batch_size: 50,
    batch_interval_ms: 5000,
    heartbeat_interval_ms: 30000,
    retry_delay_ms: 5000,
    max_retries: 3
};

class LinuxAgent {
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.agentId = this.config.agent_id || this.generateAgentId();
        this.hostname = os.hostname();
        this.ipAddress = this.getLocalIP();
        this.eventQueue = [];
        this.watchers = new Map();
        this.filePositions = new Map();
        this.isRunning = false;
        this.registered = false;
    }

    generateAgentId() {
        const hostname = os.hostname();
        const mac = this.getMacAddress();
        return `linux-${hostname}-${mac}`.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 64);
    }

    getMacAddress() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    return iface.mac.replace(/:/g, '');
                }
            }
        }
        return 'unknown';
    }

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (!iface.internal && iface.family === 'IPv4') {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const { host, port, ssl } = this.config.server;
            const protocol = ssl ? https : http;

            const options = {
                hostname: host,
                port: port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `MiniSIEM-LinuxAgent/1.0`
                }
            };

            const req = protocol.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${json.error || body}`));
                        }
                    } catch (e) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(body);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                        }
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async register() {
        try {
            const response = await this.makeRequest('POST', '/api/endpoints/register', {
                id: this.agentId,
                hostname: this.hostname,
                ip_address: this.ipAddress,
                os: 'Linux',
                os_version: os.release(),
                agent_version: '1.0.0',
                config: {
                    log_sources: this.config.log_sources.map(s => s.path)
                }
            });

            this.registered = true;
            this.log('info', `Agent registered: ${response.hostname} (${response.id})`);
            return true;
        } catch (err) {
            this.log('error', `Registration failed: ${err.message}`);
            return false;
        }
    }

    async sendHeartbeat() {
        try {
            await this.makeRequest('POST', '/api/ingest/heartbeat', {
                endpoint_id: this.agentId,
                stats: {
                    queue_size: this.eventQueue.length,
                    uptime: process.uptime(),
                    memory: process.memoryUsage().heapUsed
                }
            });
        } catch (err) {
            this.log('warn', `Heartbeat failed: ${err.message}`);
        }
    }

    async sendBatch() {
        if (this.eventQueue.length === 0) return;

        const batch = this.eventQueue.splice(0, this.config.batch_size);

        // Group by source type
        const bySource = {};
        for (const event of batch) {
            const source = event.source || 'syslog';
            if (!bySource[source]) {
                bySource[source] = [];
            }
            bySource[source].push(event);
        }

        for (const [source, events] of Object.entries(bySource)) {
            try {
                const response = await this.makeRequest('POST', '/api/ingest/batch', {
                    endpoint_id: this.agentId,
                    source: source,
                    events: events.map(e => ({
                        log: e.log,
                        timestamp: e.timestamp
                    }))
                });

                this.log('info', `Sent ${events.length} ${source} events, alerts: ${response.alerts || 0}`);
            } catch (err) {
                this.log('error', `Failed to send batch: ${err.message}`);
                // Put events back in queue
                this.eventQueue.unshift(...events);
            }
        }
    }

    queueEvent(log, source) {
        this.eventQueue.push({
            log: log.trim(),
            source,
            timestamp: new Date().toISOString()
        });
    }

    async tailFile(filePath, source) {
        // Get file size for initial position
        try {
            const stats = fs.statSync(filePath);
            this.filePositions.set(filePath, stats.size);
        } catch (err) {
            this.log('warn', `Cannot access ${filePath}: ${err.message}`);
            return;
        }

        this.log('info', `Tailing ${filePath} (${source})`);

        // Watch for changes
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                this.readNewLines(filePath, source);
            }
        });

        this.watchers.set(filePath, watcher);
    }

    async readNewLines(filePath, source) {
        try {
            const stats = fs.statSync(filePath);
            const currentPos = this.filePositions.get(filePath) || 0;

            // File was truncated (log rotation)
            if (stats.size < currentPos) {
                this.log('info', `Log rotation detected for ${filePath}`);
                this.filePositions.set(filePath, 0);
                return;
            }

            if (stats.size === currentPos) {
                return; // No new data
            }

            // Read new content
            const stream = createReadStream(filePath, {
                start: currentPos,
                end: stats.size
            });

            const rl = createInterface({
                input: stream,
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                if (line.trim()) {
                    this.queueEvent(line, source);
                }
            }

            this.filePositions.set(filePath, stats.size);
        } catch (err) {
            this.log('error', `Error reading ${filePath}: ${err.message}`);
        }
    }

    async start() {
        this.log('info', '========================================');
        this.log('info', 'Mini SIEM Linux Agent Starting');
        this.log('info', `Host: ${this.hostname} (${this.ipAddress})`);
        this.log('info', `Agent ID: ${this.agentId}`);
        this.log('info', `Server: ${this.config.server.host}:${this.config.server.port}`);
        this.log('info', '========================================');

        // Register with server
        let retries = 0;
        while (!this.registered && retries < this.config.max_retries) {
            if (await this.register()) {
                break;
            }
            retries++;
            this.log('info', `Retrying registration in ${this.config.retry_delay_ms}ms...`);
            await new Promise(r => setTimeout(r, this.config.retry_delay_ms));
        }

        if (!this.registered) {
            this.log('error', 'Failed to register after max retries. Exiting.');
            process.exit(1);
        }

        this.isRunning = true;

        // Start tailing log files
        for (const source of this.config.log_sources) {
            if (fs.existsSync(source.path)) {
                await this.tailFile(source.path, source.type);
            } else {
                this.log('warn', `Log file not found: ${source.path}`);
            }
        }

        // Batch sender interval
        this.batchInterval = setInterval(() => {
            this.sendBatch();
        }, this.config.batch_interval_ms);

        // Heartbeat interval
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeat_interval_ms);

        this.log('info', 'Agent started successfully. Monitoring logs...');
    }

    stop() {
        this.log('info', 'Stopping agent...');
        this.isRunning = false;

        // Clear intervals
        if (this.batchInterval) clearInterval(this.batchInterval);
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        // Close file watchers
        for (const [path, watcher] of this.watchers.entries()) {
            watcher.close();
            this.log('info', `Stopped watching ${path}`);
        }

        // Send remaining events
        if (this.eventQueue.length > 0) {
            this.log('info', `Flushing ${this.eventQueue.length} remaining events...`);
            this.sendBatch().finally(() => {
                this.log('info', 'Agent stopped');
                process.exit(0);
            });
        } else {
            this.log('info', 'Agent stopped');
            process.exit(0);
        }
    }
}

// Load configuration
function loadConfig() {
    const args = process.argv.slice(2);
    const configIndex = args.indexOf('--config');

    if (configIndex !== -1 && args[configIndex + 1]) {
        const configPath = args[configIndex + 1];
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`Loaded configuration from ${configPath}`);
            return config;
        } catch (err) {
            console.error(`Failed to load config from ${configPath}: ${err.message}`);
        }
    }

    // Check for default config file
    const defaultConfigPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(defaultConfigPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
            console.log('Loaded configuration from config.json');
            return config;
        } catch (err) {
            console.error(`Failed to load default config: ${err.message}`);
        }
    }

    return {};
}

// Main
const config = loadConfig();
const agent = new LinuxAgent(config);

// Handle signals
process.on('SIGINT', () => agent.stop());
process.on('SIGTERM', () => agent.stop());

// Start agent
agent.start().catch(err => {
    console.error('Failed to start agent:', err);
    process.exit(1);
});
