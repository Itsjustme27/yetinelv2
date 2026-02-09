const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { eventOps, endpointOps } = require('../database/init');
const { processEvent } = require('../services/detectionEngine');
const { broadcast } = require('../services/websocketService');
const syslogParser = require('../parsers/syslogParser');
const authLogParser = require('../parsers/authLogParser');
const windowsEventParser = require('../parsers/windowsEventParser');

// Parser selection based on source
const PARSERS = {
    syslog: syslogParser,
    auth: authLogParser,
    windows: windowsEventParser
};

// POST /api/ingest/batch - Receive batch of events from agents
router.post('/batch', async (req, res) => {
    try {
        const { endpoint_id, source, events: rawEvents } = req.body;

        if (!endpoint_id || !source || !Array.isArray(rawEvents)) {
            return res.status(400).json({
                error: 'Invalid request. Required: endpoint_id, source, events[]'
            });
        }

        const parser = PARSERS[source] || syslogParser;
        const endpoint = endpointOps.getById(endpoint_id);

        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not registered' });
        }

        // Update endpoint last seen
        endpointOps.heartbeat(endpoint_id);

        // Parse and process events
        const parsedEvents = [];
        const alerts = [];

        for (const rawEvent of rawEvents) {
            try {
                // Parse the raw log
                const parsed = parser.parse(rawEvent.log || rawEvent, {
                    hostname: endpoint.hostname,
                    ip_address: endpoint.ip_address
                });

                // Assign ID and endpoint info
                const event = {
                    id: uuidv4(),
                    ...parsed,
                    endpoint_id,
                    hostname: parsed.hostname || endpoint.hostname,
                    ip_address: parsed.ip_address || endpoint.ip_address,
                    timestamp: rawEvent.timestamp || parsed.timestamp
                };

                parsedEvents.push(event);

                // Run through detection engine
                const detectionResult = processEvent(event);
                if (detectionResult.alerts.length > 0) {
                    alerts.push(...detectionResult.alerts);
                }
            } catch (parseErr) {
                console.error('[INGEST] Parse error:', parseErr.message);
            }
        }

        // Batch insert events
        if (parsedEvents.length > 0) {
            eventOps.insertBatch(parsedEvents);

            // Broadcast new events to WebSocket clients
            broadcast('events', {
                type: 'new_events',
                count: parsedEvents.length,
                events: parsedEvents.slice(0, 10) // Send first 10 for UI update
            });
        }

        // Broadcast alerts
        if (alerts.length > 0) {
            broadcast('alerts', {
                type: 'new_alerts',
                count: alerts.length,
                alerts
            });
        }

        console.log(`[INGEST] Received ${rawEvents.length} events from ${endpoint.hostname}, parsed ${parsedEvents.length}, alerts: ${alerts.length}`);

        res.json({
            success: true,
            received: rawEvents.length,
            processed: parsedEvents.length,
            alerts: alerts.length
        });
    } catch (err) {
        console.error('[INGEST] Error processing batch:', err);
        res.status(500).json({ error: 'Failed to process events' });
    }
});

// POST /api/ingest/single - Receive single event (for testing)
router.post('/single', (req, res) => {
    try {
        const { endpoint_id, source, log, timestamp } = req.body;

        if (!log) {
            return res.status(400).json({ error: 'log is required' });
        }

        const parser = PARSERS[source] || syslogParser;
        const endpoint = endpoint_id ? endpointOps.getById(endpoint_id) : null;

        const parsed = parser.parse(log, {
            hostname: endpoint?.hostname || 'test',
            ip_address: endpoint?.ip_address
        });

        const event = {
            id: uuidv4(),
            ...parsed,
            endpoint_id: endpoint_id || null,
            hostname: parsed.hostname || endpoint?.hostname || 'test',
            timestamp: timestamp || parsed.timestamp
        };

        eventOps.insert(event);

        // Run detection
        const detectionResult = processEvent(event);

        // Broadcast
        broadcast('events', { type: 'new_event', event });

        if (detectionResult.alerts.length > 0) {
            broadcast('alerts', { type: 'new_alerts', alerts: detectionResult.alerts });
        }

        res.json({
            success: true,
            event,
            alerts: detectionResult.alerts
        });
    } catch (err) {
        console.error('[INGEST] Error processing single event:', err);
        res.status(500).json({ error: 'Failed to process event' });
    }
});

// POST /api/ingest/heartbeat - Agent heartbeat
router.post('/heartbeat', (req, res) => {
    try {
        const { endpoint_id, stats } = req.body;

        if (!endpoint_id) {
            return res.status(400).json({ error: 'endpoint_id is required' });
        }

        const result = endpointOps.heartbeat(endpoint_id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Endpoint not registered' });
        }

        // Broadcast endpoint status update
        broadcast('endpoints', {
            type: 'heartbeat',
            endpoint_id,
            stats
        });

        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[INGEST] Heartbeat error:', err);
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
});

// POST /api/ingest/test - Generate test events
router.post('/test', (req, res) => {
    try {
        const testEvents = [
            { source: 'syslog', log: '<13>Jan 18 10:30:45 web-server-01 sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2' },
            { source: 'syslog', log: '<13>Jan 18 10:30:46 web-server-01 sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2' },
            { source: 'syslog', log: '<13>Jan 18 10:30:47 web-server-01 sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2' },
            { source: 'syslog', log: '<13>Jan 18 10:30:48 web-server-01 sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2' },
            { source: 'syslog', log: '<13>Jan 18 10:30:49 web-server-01 sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2' },
            { source: 'auth', log: '<38>Jan 18 10:31:00 db-server sudo: admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/bin/bash' },
            { source: 'syslog', log: '<11>Jan 18 10:31:30 app-server kernel: [12345.678] Possible SYN flood from 10.0.0.50' }
        ];

        const parsedEvents = [];
        const alerts = [];

        for (const { source, log } of testEvents) {
            const parser = PARSERS[source] || syslogParser;
            const parsed = parser.parse(log, { hostname: 'test-server' });
            const event = {
                id: uuidv4(),
                ...parsed
            };
            eventOps.insert(event);
            parsedEvents.push(event);

            const result = processEvent(event);
            alerts.push(...result.alerts);
        }

        broadcast('events', { type: 'new_events', events: parsedEvents });
        if (alerts.length > 0) {
            broadcast('alerts', { type: 'new_alerts', alerts });
        }

        res.json({
            success: true,
            events: parsedEvents.length,
            alerts: alerts.length,
            message: 'Test events generated'
        });
    } catch (err) {
        console.error('[INGEST] Test error:', err);
        res.status(500).json({ error: 'Failed to generate test events' });
    }
});

module.exports = router;
