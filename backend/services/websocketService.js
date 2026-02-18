const WebSocket = require('ws');

let wss = null;

// Client subscriptions: Map<ws, Set<channel>>
const subscriptions = new Map();

// Available channels
const CHANNELS = ['events', 'alerts', 'endpoints', 'stats'];

function initWebSocket(server) {
    wss = new WebSocket.Server({
        server,
        path: '/ws'
    });

    wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        console.log(`[WS] Client connected from ${clientIp}`);

        // Initialize empty subscription set
        subscriptions.set(ws, new Set());

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to Mini SIEM WebSocket',
            channels: CHANNELS,
            timestamp: new Date().toISOString()
        }));

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                handleMessage(ws, message);
            } catch (_) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid JSON message'
                }));
            }
        });

        ws.on('close', () => {
            subscriptions.delete(ws);
            console.log(`[WS] Client disconnected from ${clientIp}`);
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error from ${clientIp}:`, err.message);
            subscriptions.delete(ws);
        });

        // Ping/pong for keepalive
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
    });

    // Heartbeat to detect dead connections
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                subscriptions.delete(ws);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(heartbeatInterval);
    });

    console.log('[WS] WebSocket server initialized on /ws');
}

function handleMessage(ws, message) {
    const { action, channel, channels } = message;
    const clientSubs = subscriptions.get(ws);

    if (!clientSubs) return;

    switch (action) {
        case 'subscribe':
            if (channel && CHANNELS.includes(channel)) {
                clientSubs.add(channel);
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    channel,
                    timestamp: new Date().toISOString()
                }));
                console.log(`[WS] Client subscribed to ${channel}`);
            } else if (channels && Array.isArray(channels)) {
                const subscribed = [];
                for (const ch of channels) {
                    if (CHANNELS.includes(ch)) {
                        clientSubs.add(ch);
                        subscribed.push(ch);
                    }
                }
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    channels: subscribed,
                    timestamp: new Date().toISOString()
                }));
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Invalid channel. Available: ${CHANNELS.join(', ')}`
                }));
            }
            break;

        case 'unsubscribe':
            if (channel) {
                clientSubs.delete(channel);
                ws.send(JSON.stringify({
                    type: 'unsubscribed',
                    channel,
                    timestamp: new Date().toISOString()
                }));
            } else if (channels && Array.isArray(channels)) {
                for (const ch of channels) {
                    clientSubs.delete(ch);
                }
                ws.send(JSON.stringify({
                    type: 'unsubscribed',
                    channels,
                    timestamp: new Date().toISOString()
                }));
            }
            break;

        case 'subscribe_all':
            for (const ch of CHANNELS) {
                clientSubs.add(ch);
            }
            ws.send(JSON.stringify({
                type: 'subscribed',
                channels: CHANNELS,
                timestamp: new Date().toISOString()
            }));
            break;

        case 'unsubscribe_all':
            clientSubs.clear();
            ws.send(JSON.stringify({
                type: 'unsubscribed',
                channels: 'all',
                timestamp: new Date().toISOString()
            }));
            break;

        case 'ping':
            ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
            }));
            break;

        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown action. Available: subscribe, unsubscribe, subscribe_all, unsubscribe_all, ping'
            }));
    }
}

// Broadcast message to all clients subscribed to a channel
function broadcast(channel, data) {
    if (!wss) return;

    const message = JSON.stringify({
        channel,
        ...data,
        timestamp: new Date().toISOString()
    });

    let sentCount = 0;

    wss.clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const clientSubs = subscriptions.get(ws);
        if (clientSubs && clientSubs.has(channel)) {
            ws.send(message);
            sentCount++;
        }
    });

    if (sentCount > 0) {
        console.log(`[WS] Broadcast to ${sentCount} clients on channel: ${channel}`);
    }
}

// Get connected client count
function getClientCount() {
    return wss ? wss.clients.size : 0;
}

// Get subscription stats
function getStats() {
    const stats = {
        clients: getClientCount(),
        channels: {}
    };

    for (const channel of CHANNELS) {
        stats.channels[channel] = 0;
    }

    for (const [, subs] of subscriptions.entries()) {
        for (const channel of subs) {
            stats.channels[channel]++;
        }
    }

    return stats;
}

module.exports = {
    initWebSocket,
    broadcast,
    getClientCount,
    getStats
};
