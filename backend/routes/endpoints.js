const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { endpointOps } = require('../database/init');

// GET /api/endpoints - List all endpoints
router.get('/', (req, res) => {
    try {
        const endpoints = endpointOps.getAll();
        res.json({
            endpoints,
            count: endpoints.length
        });
    } catch (err) {
        console.error('[ENDPOINTS] Error fetching endpoints:', err);
        res.status(500).json({ error: 'Failed to fetch endpoints' });
    }
});

// GET /api/endpoints/:id - Get single endpoint
router.get('/:id', (req, res) => {
    try {
        const endpoint = endpointOps.getById(req.params.id);
        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }
        res.json(endpoint);
    } catch (err) {
        console.error('[ENDPOINTS] Error fetching endpoint:', err);
        res.status(500).json({ error: 'Failed to fetch endpoint' });
    }
});

// POST /api/endpoints/register - Register new agent
router.post('/register', (req, res) => {
    try {
        const { hostname, ip_address, os, os_version, agent_version, config } = req.body;

        if (!hostname) {
            return res.status(400).json({ error: 'Hostname is required' });
        }

        const id = req.body.id || uuidv4();

        endpointOps.upsert({
            id,
            hostname,
            ip_address,
            os,
            os_version,
            agent_version,
            status: 'healthy',
            config
        });

        console.log(`[ENDPOINTS] Agent registered: ${hostname} (${id})`);
        res.status(201).json({
            id,
            hostname,
            status: 'registered',
            message: 'Agent registered successfully'
        });
    } catch (err) {
        console.error('[ENDPOINTS] Error registering endpoint:', err);
        res.status(500).json({ error: 'Failed to register endpoint' });
    }
});

// PATCH /api/endpoints/:id/status - Update endpoint status
router.patch('/:id/status', (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['healthy', 'degraded', 'offline', 'compromised'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = endpointOps.updateStatus(req.params.id, status);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }

        res.json({ success: true, status });
    } catch (err) {
        console.error('[ENDPOINTS] Error updating endpoint status:', err);
        res.status(500).json({ error: 'Failed to update endpoint status' });
    }
});

module.exports = router;
