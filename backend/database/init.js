const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'siem.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');


let db = null;

function initDatabase() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    seedAdmin(db);

    console.log('[DB] Database initialized at', DB_PATH);
    return db;
}

function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('[DB] Database connection closed');
    }
}


// TRYING: RBAC ADMIN

async function seedAdmin(db) {
  const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');

  if(!adminExists) {
    const hash = await bcrypt.hash('Password123!', 10);
    db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?,?,?,?)')
      .run(uuidv4(), 'admin', hash, 'admin');

    console.log("Default admin user created: admin / Password123!");
  }
}






// Event operations
const eventOps = {
    insert: (event) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO events (id, timestamp, source, event_type, severity, endpoint_id,
                hostname, ip_address, user, description, raw_log, parsed_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            event.id,
            event.timestamp,
            event.source,
            event.event_type,
            event.severity,
            event.endpoint_id,
            event.hostname,
            event.ip_address,
            event.user,
            event.description,
            event.raw_log,
            JSON.stringify(event.parsed_data || {})
        );
    },

    insertBatch: (events) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO events (id, timestamp, source, event_type, severity, endpoint_id,
                hostname, ip_address, user, description, raw_log, parsed_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = getDatabase().transaction((evts) => {
            for (const event of evts) {
                stmt.run(
                    event.id,
                    event.timestamp,
                    event.source,
                    event.event_type,
                    event.severity,
                    event.endpoint_id,
                    event.hostname,
                    event.ip_address,
                    event.user,
                    event.description,
                    event.raw_log,
                    JSON.stringify(event.parsed_data || {})
                );
            }
        });
        return insertMany(events);
    },

    getRecent: (limit = 100, offset = 0, filters = {}) => {
        let query = 'SELECT * FROM events';
        const conditions = [];
        const params = [];

        if (filters.severity) {
            conditions.push('severity = ?');
            params.push(filters.severity);
        }
        if (filters.event_type) {
            conditions.push('event_type = ?');
            params.push(filters.event_type);
        }
        if (filters.endpoint_id) {
            conditions.push('endpoint_id = ?');
            params.push(filters.endpoint_id);
        }
        if (filters.source) {
            conditions.push('source = ?');
            params.push(filters.source);
        }
        if (filters.since) {
            conditions.push('timestamp >= ?');
            params.push(filters.since);
        }
        if (filters.search) {
            conditions.push('(id LIKE ? OR hostname LIKE ? OR description LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const stmt = getDatabase().prepare(query);
        return stmt.all(...params).map(row => ({
            ...row,
            parsed_data: JSON.parse(row.parsed_data || '{}')
        }));
    },

    getStats: (since) => {
        const db = getDatabase();
        const sinceClause = since ? 'WHERE timestamp >= ?' : '';
        const params = since ? [since] : [];

        const total = db.prepare(`SELECT COUNT(*) as count FROM events ${sinceClause}`).get(...params);
        const bySeverity = db.prepare(`
            SELECT severity, COUNT(*) as count FROM events ${sinceClause} GROUP BY severity
        `).all(...params);
        const byType = db.prepare(`
            SELECT event_type, COUNT(*) as count FROM events ${sinceClause} GROUP BY event_type
        `).all(...params);

        return {
            total: total.count,
            bySeverity: bySeverity.reduce((acc, r) => ({ ...acc, [r.severity]: r.count }), {}),
            byType: byType.reduce((acc, r) => ({ ...acc, [r.event_type]: r.count }), {})
        };
    },

    getById: (id) => {
        const stmt = getDatabase().prepare('SELECT * FROM events WHERE id = ?');
        const row = stmt.get(id);
        if (row) {
            row.parsed_data = JSON.parse(row.parsed_data || '{}');
        }
        return row;
    }
};

// Alert operations
const alertOps = {
    insert: (alert) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO alerts (id, event_id, rule_id, severity, status, title, description, endpoint_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            alert.id,
            alert.event_id,
            alert.rule_id,
            alert.severity,
            alert.status || 'open',
            alert.title,
            alert.description,
            alert.endpoint_id
        );
    },

    getRecent: (limit = 50, offset = 0, status = null) => {
        let query = 'SELECT a.*, e.hostname, e.ip_address, e.description as event_description FROM alerts a LEFT JOIN events e ON a.event_id = e.id';
        const params = [];

        if (status) {
            query += ' WHERE a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return getDatabase().prepare(query).all(...params);
    },

    updateStatus: (id, status, notes = null) => {
        const stmt = getDatabase().prepare(`
            UPDATE alerts SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
            WHERE id = ?
        `);
        return stmt.run(status, notes, id);
    },

    getOpenCount: () => {
        return getDatabase().prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'open'").get().count;
    },

    getById: (id) => {
        return getDatabase().prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    }
};

// Endpoint operations
const endpointOps = {
    upsert: (endpoint) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO endpoints (id, hostname, ip_address, os, os_version, agent_version, status, config)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                hostname = excluded.hostname,
                ip_address = excluded.ip_address,
                os = COALESCE(excluded.os, os),
                os_version = COALESCE(excluded.os_version, os_version),
                agent_version = COALESCE(excluded.agent_version, agent_version),
                status = excluded.status,
                last_seen = datetime('now'),
                config = COALESCE(excluded.config, config)
        `);
        return stmt.run(
            endpoint.id,
            endpoint.hostname,
            endpoint.ip_address,
            endpoint.os,
            endpoint.os_version,
            endpoint.agent_version,
            endpoint.status || 'healthy',
            JSON.stringify(endpoint.config || {})
        );
    },

    getAll: () => {
        return getDatabase().prepare('SELECT * FROM endpoints ORDER BY last_seen DESC').all().map(row => ({
            ...row,
            config: JSON.parse(row.config || '{}')
        }));
    },

    getById: (id) => {
        const row = getDatabase().prepare('SELECT * FROM endpoints WHERE id = ?').get(id);
        if (row) {
            row.config = JSON.parse(row.config || '{}');
        }
        return row;
    },

    updateStatus: (id, status) => {
        return getDatabase().prepare('UPDATE endpoints SET status = ?, last_seen = datetime(\'now\') WHERE id = ?').run(status, id);
    },

    heartbeat: (id) => {
        return getDatabase().prepare('UPDATE endpoints SET last_seen = datetime(\'now\'), status = \'healthy\' WHERE id = ?').run(id);
    },

    markStale: (thresholdMinutes = 5) => {
        return getDatabase().prepare(`
            UPDATE endpoints SET status = 'offline'
            WHERE datetime(last_seen) < datetime('now', '-' || ? || ' minutes')
            AND status != 'offline'
        `).run(thresholdMinutes);
    }
};

// Rule operations
const ruleOps = {
    insert: (rule) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO rules (id, name, description, enabled, severity, rule_type, conditions, actions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            rule.id,
            rule.name,
            rule.description,
            rule.enabled ? 1 : 0,
            rule.severity,
            rule.rule_type,
            JSON.stringify(rule.conditions),
            JSON.stringify(rule.actions || {})
        );
    },

    upsert: (rule) => {
        const stmt = getDatabase().prepare(`
            INSERT INTO rules (id, name, description, enabled, severity, rule_type, conditions, actions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                enabled = excluded.enabled,
                severity = excluded.severity,
                rule_type = excluded.rule_type,
                conditions = excluded.conditions,
                actions = excluded.actions,
                updated_at = datetime('now')
        `);
        return stmt.run(
            rule.id,
            rule.name,
            rule.description,
            rule.enabled ? 1 : 0,
            rule.severity,
            rule.rule_type,
            JSON.stringify(rule.conditions),
            JSON.stringify(rule.actions || {})
        );
    },

    getEnabled: () => {
        return getDatabase().prepare('SELECT * FROM rules WHERE enabled = 1').all().map(row => ({
            ...row,
            enabled: !!row.enabled,
            conditions: JSON.parse(row.conditions),
            actions: JSON.parse(row.actions || '{}')
        }));
    },

    getAll: () => {
        return getDatabase().prepare('SELECT * FROM rules ORDER BY name').all().map(row => ({
            ...row,
            enabled: !!row.enabled,
            conditions: JSON.parse(row.conditions),
            actions: JSON.parse(row.actions || '{}')
        }));
    },

    incrementMatchCount: (id) => {
        return getDatabase().prepare(`
            UPDATE rules SET match_count = match_count + 1, last_match = datetime('now') WHERE id = ?
        `).run(id);
    },

    toggleEnabled: (id, enabled) => {
        return getDatabase().prepare('UPDATE rules SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(enabled ? 1 : 0, id);
    }
};

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase,
    eventOps,
    alertOps,
    endpointOps,
    ruleOps
};
