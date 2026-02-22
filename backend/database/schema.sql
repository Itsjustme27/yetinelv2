-- Mini SIEM Database Schema


-- New Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'analyst', 'engineer')) NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Update Alerts table to track who handled the alert
-- Note: In SQLite, adding a column is safer than a full refactor
-- ALTER TABLE alerts ADD COLUMN assigned_to_id TEXT;



-- Events table - stores all security events
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL,                    -- syslog, auth, windows, etc.
    event_type TEXT NOT NULL,                -- authentication, network, process, etc.
    severity TEXT NOT NULL DEFAULT 'info',   -- info, warning, critical
    endpoint_id TEXT,
    hostname TEXT,
    ip_address TEXT,
    user TEXT,
    description TEXT NOT NULL,
    raw_log TEXT,                            -- Original log line
    parsed_data TEXT,                        -- JSON of parsed fields
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
);

-- Alerts table - stores generated alerts
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',     -- open, acknowledged, closed
    title TEXT NOT NULL,
    description TEXT,
    endpoint_id TEXT,
    assigned_to TEXT,
    notes TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (rule_id) REFERENCES rules(id),
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
);

-- Endpoints table - registered monitored endpoints
CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    ip_address TEXT,
    os TEXT,
    os_version TEXT,
    agent_version TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',  -- healthy, degraded, offline, compromised
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    config TEXT                              -- JSON configuration
);

-- Rules table - detection rules
CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'warning',
    rule_type TEXT NOT NULL,                 -- signature, threshold, correlation
    conditions TEXT NOT NULL,                -- JSON rule conditions
    actions TEXT,                            -- JSON actions to take
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    match_count INTEGER DEFAULT 0,
    last_match TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_endpoint ON events(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoints(status);
CREATE INDEX IF NOT EXISTS idx_endpoints_hostname ON endpoints(hostname);

CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
