const express = require('express');
const router = express.Router();
const { eventOps } = require('../database/init');

// GET /api/events - List events with pagination and filters
router.get('/', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const offset = parseInt(req.query.offset) || 0;
        const filters = {};

        if (req.query.severity) filters.severity = req.query.severity;
        if (req.query.type) filters.event_type = req.query.type;
        if (req.query.endpoint) filters.endpoint_id = req.query.endpoint;
        if (req.query.source) filters.source = req.query.source;
        if (req.query.since) filters.since = req.query.since;
        if (req.query.search) filters.search = req.query.search;

        const events = eventOps.getRecent(limit, offset, filters);
        res.json({
            events,
            pagination: {
                limit,
                offset,
                count: events.length
            }
        });
    } catch (err) {
        console.error('[EVENTS] Error fetching events:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// GET /api/events/stats - Event statistics
router.get('/stats', (req, res) => {
    try {
        const since = req.query.since || null;
        const stats = eventOps.getStats(since);
        res.json(stats);
    } catch (err) {
        console.error('[EVENTS] Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET /api/events/:id - Get single event
router.get('/:id', (req, res) => {
    try {
        const event = eventOps.getById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (err) {
        console.error('[EVENTS] Error fetching event:', err);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

module.exports = router;
