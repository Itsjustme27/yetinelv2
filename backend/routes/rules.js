const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { ruleOps } = require('../database/init');

// GET /api/rules - List all rules
router.get('/', (req, res) => {
    try {
        const enabledOnly = req.query.enabled === 'true';
        const rules = enabledOnly ? ruleOps.getEnabled() : ruleOps.getAll();
        res.json({
            rules,
            count: rules.length
        });
    } catch (err) {
        console.error('[RULES] Error fetching rules:', err);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

// POST /api/rules - Create new rule
router.post('/', (req, res) => {
    try {
        const { name, description, severity, rule_type, conditions, actions, enabled } = req.body;

        if (!name || !rule_type || !conditions) {
            return res.status(400).json({ error: 'Name, rule_type, and conditions are required' });
        }

        if (!['signature', 'threshold', 'correlation'].includes(rule_type)) {
            return res.status(400).json({ error: 'Invalid rule_type. Must be: signature, threshold, or correlation' });
        }

        const id = uuidv4();
        ruleOps.insert({
            id,
            name,
            description,
            severity: severity || 'warning',
            rule_type,
            conditions,
            actions,
            enabled: enabled !== false
        });

        console.log(`[RULES] Rule created: ${name} (${id})`);
        res.status(201).json({
            id,
            name,
            status: 'created'
        });
    } catch (err) {
        console.error('[RULES] Error creating rule:', err);
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

// PATCH /api/rules/:id - Toggle rule enabled/disabled
router.patch('/:id', (req, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be a boolean' });
        }

        const result = ruleOps.toggleEnabled(req.params.id, enabled);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }

        res.json({ success: true, enabled });
    } catch (err) {
        console.error('[RULES] Error updating rule:', err);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

module.exports = router;
