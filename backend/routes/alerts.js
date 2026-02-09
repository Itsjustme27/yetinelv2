const express = require('express');
const router = express.Router();
const { alertOps } = require('../database/init');

// GET /api/alerts - List alerts with pagination
router.get('/', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status || null;

        const alerts = alertOps.getRecent(limit, offset, status);
        const openCount = alertOps.getOpenCount();

        res.json({
            alerts,
            openCount,
            pagination: {
                limit,
                offset,
                count: alerts.length
            }
        });
    } catch (err) {
        console.error('[ALERTS] Error fetching alerts:', err);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// GET /api/alerts/:id - Get single alert
router.get('/:id', (req, res) => {
    try {
        const alert = alertOps.getById(req.params.id);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        res.json(alert);
    } catch (err) {
        console.error('[ALERTS] Error fetching alert:', err);
        res.status(500).json({ error: 'Failed to fetch alert' });
    }
});

// PATCH /api/alerts/:id - Update alert status
router.patch('/:id', (req, res) => {
    try {
        const { status, notes } = req.body;

        if (!status || !['open', 'acknowledged', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: open, acknowledged, or closed' });
        }

        const result = alertOps.updateStatus(req.params.id, status, notes);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const updated = alertOps.getById(req.params.id);
        res.json(updated);
    } catch (err) {
        console.error('[ALERTS] Error updating alert:', err);
        res.status(500).json({ error: 'Failed to update alert' });
    }
});

module.exports = router;
