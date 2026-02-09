# Mini SIEM - Security Information and Event Management System

A production-ready Security Information and Event Management (SIEM) system built with Node.js, React, and SQLite. This system provides real-time log collection, threat detection, and security monitoring capabilities.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Components](#components)
  - [Backend Server](#backend-server)
  - [Frontend Dashboard](#frontend-dashboard)
  - [Linux Agent](#linux-agent)
  - [Windows Agent](#windows-agent)
  - [Detection Engine](#detection-engine)
- [API Reference](#api-reference)
- [Detection Rules](#detection-rules)
- [WebSocket Events](#websocket-events)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

Mini SIEM transforms security log data into actionable intelligence. It collects logs from multiple endpoints (Linux and Windows), parses them into a normalized format, runs them through a detection engine with customizable rules, and presents everything through a real-time dashboard.

**Key Capabilities:**
- Real-time log collection from Linux and Windows systems
- Automatic parsing of syslog, auth.log, and Windows Security events
- Rule-based threat detection (signature, threshold, and correlation)
- WebSocket-powered real-time dashboard updates
- Alert management with status tracking
- Endpoint health monitoring

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│              (Dashboard, Event Viewer, Alerts)              │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API + WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                  Backend Server (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ REST API     │  │ WebSocket    │  │ Detection    │      │
│  │ (Express)    │  │ Server       │  │ Engine       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   SQLite    │                         │
│                    │  Database   │                         │
│                    └─────────────┘                         │
└─────────────────────────▲───────────────────────────────────┘
                          │ HTTP POST /api/ingest
┌─────────────────────────┴───────────────────────────────────┐
│                    Log Collectors                           │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Linux Agent  │  │ Windows      │                        │
│  │ (Node.js)    │  │ Agent (PS1)  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Log Collection
- **Multi-platform support**: Linux (syslog, auth.log) and Windows (Security Event Log)
- **Real-time tailing**: Agents watch log files and send new entries immediately
- **Batch processing**: Events are batched for efficient network transmission
- **Automatic reconnection**: Agents reconnect if the server becomes unavailable

### Log Parsing
- **Syslog Parser**: RFC 3164 compliant parsing with facility/severity extraction
- **Auth Log Parser**: Extracts SSH, sudo, su, and PAM authentication details
- **Windows Event Parser**: Processes Security Event Log entries (logon, process, service events)

### Threat Detection
- **Signature-based**: Pattern matching against known threat indicators
- **Threshold-based**: Detects anomalies like brute force attacks (X events in Y seconds)
- **Correlation-based**: Identifies attack patterns across multiple events

### Real-time Dashboard
- **Live updates**: WebSocket-powered instant event and alert notifications
- **Event browser**: Searchable, filterable event log with detailed views
- **Alert management**: Track, acknowledge, and close security alerts
- **Endpoint monitoring**: View connected agents and their health status
- **Analytics**: Visual breakdowns of events by type and severity

---

## Installation

### Prerequisites

- Node.js 18+ (for backend and Linux agent)
- npm or yarn
- PowerShell 5.1+ (for Windows agent)
- Administrator/root access (for reading system logs)

### Clone and Setup

```bash
# Clone and navigate to project directory
git clone https://github.com/YOUR_USERNAME/mini-siem.git
cd mini-siem

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../files
npm install
```

---

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm start
```

The server will start on `http://localhost:3001` with the following output:

```
╔═══════════════════════════════════════════════════════════╗
║                    MINI SIEM BACKEND                      ║
║  Server running on http://localhost:3001                  ║
║  WebSocket on ws://localhost:3001/ws                      ║
╚═══════════════════════════════════════════════════════════╝
```

### 2. Start the Frontend Dashboard

```bash
cd files
npm start
```

The dashboard will open at `http://localhost:3000`

### 3. Generate Test Events

Click the **"TEST EVENTS"** button in the dashboard header to generate sample security events and see the detection engine in action.

### 4. (Optional) Start Log Collection Agents

**Linux:**
```bash
sudo node agents/linux/agent.js
```

**Windows (PowerShell as Administrator):**
```powershell
.\agents\windows\agent.ps1 -ServerHost localhost -ServerPort 3001
```

---

## Components

### Backend Server

**Location:** `/backend/`

The backend is an Express.js server that provides:

| File | Description |
|------|-------------|
| `server.js` | Main entry point, sets up Express and WebSocket |
| `database/init.js` | SQLite database initialization and operations |
| `database/schema.sql` | Database schema (events, alerts, endpoints, rules) |
| `routes/events.js` | Event listing and statistics endpoints |
| `routes/alerts.js` | Alert management endpoints |
| `routes/endpoints.js` | Endpoint registration and status |
| `routes/rules.js` | Detection rule management |
| `routes/ingest.js` | Log ingestion from agents |
| `services/detectionEngine.js` | Rule-based threat detection |
| `services/websocketService.js` | Real-time event broadcasting |
| `parsers/*.js` | Log format parsers |

**Environment Variables:**
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

### Frontend Dashboard

**Location:** `/files/`

A React 18 single-page application with:

| File | Description |
|------|-------------|
| `src/App.jsx` | Main dashboard component |
| `src/api/siemApi.js` | REST API client |
| `src/hooks/useWebSocket.js` | WebSocket connection hook |

**Dashboard Tabs:**
- **Dashboard**: Overview stats and critical events
- **Event Log**: Full event list with filtering
- **Alerts**: Security alerts with status management
- **Endpoints**: Connected agents and their status
- **Analytics**: Event distribution charts and rule statistics

### Linux Agent

**Location:** `/agents/linux/`

A Node.js agent that monitors Linux log files:

```bash
# Start with default configuration
sudo node agent.js

# Start with custom configuration
sudo node agent.js --config /path/to/config.json
```

**Default Log Sources:**
- `/var/log/syslog` - System messages
- `/var/log/auth.log` - Authentication events
- `/var/log/kern.log` - Kernel messages

**Configuration (`config.json`):**
```json
{
  "server": {
    "host": "localhost",
    "port": 3001,
    "ssl": false
  },
  "log_sources": [
    { "path": "/var/log/syslog", "type": "syslog" },
    { "path": "/var/log/auth.log", "type": "auth" }
  ],
  "batch_size": 50,
  "batch_interval_ms": 5000,
  "heartbeat_interval_ms": 30000
}
```

### Windows Agent

**Location:** `/agents/windows/`

A PowerShell script that collects Windows Security Event Log entries:

```powershell
# Basic usage (requires Administrator)
.\agent.ps1

# With custom server
.\agent.ps1 -ServerHost 192.168.1.100 -ServerPort 3001

# All parameters
.\agent.ps1 -ServerHost localhost -ServerPort 3001 -BatchSize 50 -PollIntervalSeconds 5
```

**Collected Event IDs:**
| Event ID | Description |
|----------|-------------|
| 4624 | Successful logon |
| 4625 | Failed logon |
| 4634/4647 | Logoff |
| 4672 | Special privileges assigned |
| 4688/4689 | Process creation/exit |
| 4697/7045 | Service installation |
| 4720-4740 | Account management |
| 4698-4702 | Scheduled tasks |
| 1102 | Audit log cleared |

### Detection Engine

**Location:** `/backend/services/detectionEngine.js`

The detection engine processes every incoming event against enabled rules:

**Rule Types:**

1. **Signature** - Direct pattern matching
   ```json
   {
     "rule_type": "signature",
     "conditions": {
       "field": "parsed_data.event_id",
       "equals": 1102
     }
   }
   ```

2. **Threshold** - Count-based detection
   ```json
   {
     "rule_type": "threshold",
     "conditions": {
       "field": "parsed_data.auth_result",
       "equals": "failure",
       "threshold": 5,
       "window_seconds": 60,
       "group_by": "parsed_data.source_ip"
     }
   }
   ```

3. **Correlation** - Multi-event pattern detection
   ```json
   {
     "rule_type": "correlation",
     "conditions": {
       "sequence": [
         { "count": 3, "match": { "field": "auth_result", "equals": "failure" } },
         { "match": { "field": "auth_result", "equals": "success" } }
       ],
       "group_by": "parsed_data.source_ip"
     }
   }
   ```

---

## API Reference

### Health Check
```
GET /health
```
Returns server status and uptime.

### Events

```
GET /api/events
```
List events with pagination and filtering.

**Query Parameters:**
- `limit` (int) - Max events to return (default: 100, max: 1000)
- `offset` (int) - Pagination offset
- `severity` (string) - Filter by severity (info, warning, critical)
- `type` (string) - Filter by event type
- `endpoint` (string) - Filter by endpoint ID
- `source` (string) - Filter by source (syslog, auth, windows)
- `since` (ISO date) - Events after this timestamp

```
GET /api/events/stats
```
Get event statistics (counts by severity and type).

```
GET /api/events/:id
```
Get single event by ID.

### Alerts

```
GET /api/alerts
```
List alerts with pagination.

**Query Parameters:**
- `limit` (int) - Max alerts to return (default: 50)
- `offset` (int) - Pagination offset
- `status` (string) - Filter by status (open, acknowledged, closed)

```
PATCH /api/alerts/:id
```
Update alert status.

**Body:**
```json
{
  "status": "closed",
  "notes": "False positive - authorized admin activity"
}
```

### Endpoints

```
GET /api/endpoints
```
List all registered endpoints/agents.

```
POST /api/endpoints/register
```
Register a new agent.

**Body:**
```json
{
  "hostname": "web-server-01",
  "ip_address": "192.168.1.10",
  "os": "Linux",
  "os_version": "Ubuntu 22.04",
  "agent_version": "1.0.0"
}
```

### Rules

```
GET /api/rules
```
List all detection rules.

**Query Parameters:**
- `enabled` (boolean) - Filter by enabled status

```
PATCH /api/rules/:id
```
Enable/disable a rule.

**Body:**
```json
{
  "enabled": false
}
```

### Ingestion

```
POST /api/ingest/batch
```
Receive events from agents.

**Body:**
```json
{
  "endpoint_id": "linux-webserver-abc123",
  "source": "auth",
  "events": [
    { "log": "Jan 18 10:30:45 server sshd[1234]: Failed password for root from 192.168.1.100", "timestamp": "2024-01-18T10:30:45Z" }
  ]
}
```

```
POST /api/ingest/heartbeat
```
Agent health check.

**Body:**
```json
{
  "endpoint_id": "linux-webserver-abc123",
  "stats": { "queue_size": 0, "uptime": 3600 }
}
```

```
POST /api/ingest/test
```
Generate test events (for demo/testing purposes).

---

## Detection Rules

Default rules are stored in `/rules/default-rules.json`:

| Rule ID | Name | Type | Severity | Description |
|---------|------|------|----------|-------------|
| brute-force-ssh | SSH Brute Force Detection | Threshold | Critical | 5+ failed SSH logins in 60 seconds |
| login-after-failures | Successful Login After Failures | Correlation | Critical | Success after 3+ failures |
| privilege-escalation-sudo | Sudo to Root | Signature | Warning | Privilege escalation to root |
| new-service-installed | New Service Installation | Signature | Warning | Windows Event 7045/4697 |
| process-from-temp | Process from Temp Directory | Signature | Warning | Malware indicator |
| audit-log-cleared | Security Audit Log Cleared | Signature | Critical | Event ID 1102 |
| external-ssh-login | SSH Login from External IP | Signature | Warning | Non-RFC1918 source IPs |
| failed-login-burst | Failed Login Burst | Threshold | Warning | 10+ failures in 5 minutes |

### Creating Custom Rules

Add rules to `/rules/default-rules.json`:

```json
{
  "id": "custom-rule-id",
  "name": "My Custom Rule",
  "description": "Detects something suspicious",
  "enabled": true,
  "severity": "warning",
  "rule_type": "signature",
  "conditions": {
    "field": "description",
    "contains": "suspicious keyword"
  },
  "actions": { "alert": true }
}
```

**Condition Operators:**
- `equals` - Exact match
- `contains` - Substring match (case-insensitive)
- `contains_any` - Match any of multiple substrings
- `matches` - Regular expression match
- `not` - Negate a condition
- `any` - OR logic (match any sub-condition)
- `all` - AND logic (match all sub-conditions)
- `additional` - Additional condition (AND)

---

## WebSocket Events

Connect to `ws://localhost:3001/ws` for real-time updates.

### Subscribe to Channels

```json
{ "action": "subscribe", "channels": ["events", "alerts", "endpoints"] }
```

### Available Channels

- `events` - New security events
- `alerts` - New alerts from detection engine
- `endpoints` - Agent heartbeats and status changes
- `stats` - Periodic statistics updates

### Message Format

```json
{
  "channel": "events",
  "type": "new_events",
  "count": 5,
  "events": [...],
  "timestamp": "2024-01-18T10:30:45Z"
}
```

---

## Configuration

### Backend Configuration

Environment variables in `/backend/.env`:
```
PORT=3001
NODE_ENV=development
```

### Frontend Configuration

Environment variables in `/files/.env`:
```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001/ws
```

### Agent Configuration

Linux agent config at `/agents/linux/config.json`:
```json
{
  "server": { "host": "localhost", "port": 3001, "ssl": false },
  "log_sources": [
    { "path": "/var/log/syslog", "type": "syslog" },
    { "path": "/var/log/auth.log", "type": "auth" }
  ],
  "batch_size": 50,
  "batch_interval_ms": 5000,
  "heartbeat_interval_ms": 30000
}
```

---

## Testing

### Generate Test Events

**Via API:**
```bash
curl -X POST http://localhost:3001/api/ingest/test
```

**Via Dashboard:**
Click the "TEST EVENTS" button in the header.

### Simulate SSH Brute Force

```bash
# Generate failed SSH log entries (requires logger)
for i in {1..6}; do
  logger -t sshd "Failed password for root from 192.168.1.100 port 22 ssh2"
  sleep 1
done
```

This will trigger the "SSH Brute Force Detection" rule and generate an alert.

### Test Single Event Ingestion

```bash
curl -X POST http://localhost:3001/api/ingest/single \
  -H "Content-Type: application/json" \
  -d '{
    "source": "auth",
    "log": "Jan 18 10:30:45 server sudo: admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/bin/bash"
  }'
```

---

## Troubleshooting

### Backend won't start

**Error:** `Cannot find module 'better-sqlite3'`
```bash
cd backend && npm install
```

**Error:** `EADDRINUSE: address already in use`
```bash
# Find and kill process using port 3001
lsof -i :3001
kill -9 <PID>
```

### Agent can't connect

1. Verify backend is running: `curl http://localhost:3001/health`
2. Check firewall allows port 3001
3. Verify agent config has correct server address

### No events appearing

1. Check agent logs for errors
2. Verify log files exist and are readable
3. Run agent with sudo (required for system logs)
4. Check WebSocket connection status in dashboard header

### Detection rules not triggering

1. Verify rules are enabled: `GET /api/rules`
2. Check rule conditions match event data
3. For threshold rules, ensure enough events in time window
4. Check backend logs for detection engine errors

---

## File Structure

```
mini-siem/
├── README.md                       # This file
├── backend/                        # Backend server
│   ├── server.js                   # Express + WebSocket server
│   ├── package.json
│   ├── database/
│   │   ├── init.js                 # DB initialization
│   │   ├── schema.sql              # SQLite schema
│   │   └── siem.db                 # SQLite database (created on start)
│   ├── routes/
│   │   ├── events.js               # /api/events
│   │   ├── alerts.js               # /api/alerts
│   │   ├── endpoints.js            # /api/endpoints
│   │   ├── rules.js                # /api/rules
│   │   └── ingest.js               # /api/ingest
│   ├── services/
│   │   ├── detectionEngine.js      # Rule-based detection
│   │   └── websocketService.js     # Real-time broadcasting
│   └── parsers/
│       ├── syslogParser.js         # RFC 3164 syslog
│       ├── authLogParser.js        # Linux auth events
│       └── windowsEventParser.js   # Windows Security events
├── files/                          # Frontend React app
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── App.jsx                 # Main dashboard
│       ├── api/
│       │   └── siemApi.js          # API client
│       └── hooks/
│           └── useWebSocket.js     # WebSocket hook
├── agents/                         # Log collection agents
│   ├── linux/
│   │   ├── agent.js                # Node.js agent
│   │   └── config.json             # Agent configuration
│   └── windows/
│       └── agent.ps1               # PowerShell agent
└── rules/
    └── default-rules.json          # Detection rules
```

---

## License

This project is for educational and authorized security testing purposes.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## Database Schema

The SQLite database (`backend/database/siem.db`) contains four tables:

### Events Table
```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    received_at TEXT DEFAULT (datetime('now')),
    source TEXT NOT NULL,           -- syslog, auth, windows
    event_type TEXT NOT NULL,       -- authentication, network, process, etc.
    severity TEXT DEFAULT 'info',   -- info, warning, critical
    endpoint_id TEXT,
    hostname TEXT,
    ip_address TEXT,
    user TEXT,
    description TEXT NOT NULL,
    raw_log TEXT,
    parsed_data TEXT                -- JSON
);
```

### Alerts Table
```sql
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    event_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open',     -- open, acknowledged, closed
    title TEXT NOT NULL,
    description TEXT,
    endpoint_id TEXT,
    assigned_to TEXT,
    notes TEXT
);
```

### Endpoints Table
```sql
CREATE TABLE endpoints (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    ip_address TEXT,
    os TEXT,
    os_version TEXT,
    agent_version TEXT,
    status TEXT DEFAULT 'unknown',  -- healthy, degraded, offline, compromised
    first_seen TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now')),
    config TEXT                     -- JSON
);
```

### Rules Table
```sql
CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER DEFAULT 1,
    severity TEXT DEFAULT 'warning',
    rule_type TEXT NOT NULL,        -- signature, threshold, correlation
    conditions TEXT NOT NULL,       -- JSON
    actions TEXT,                   -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    match_count INTEGER DEFAULT 0,
    last_match TEXT
);
```

---

## API Response Examples

### GET /api/events
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-18T10:30:45.000Z",
      "source": "auth",
      "event_type": "authentication",
      "severity": "warning",
      "hostname": "web-server-01",
      "ip_address": "192.168.1.10",
      "user": "root",
      "description": "SSH failed login for root from 192.168.1.100",
      "parsed_data": {
        "auth_type": "ssh",
        "auth_result": "failure",
        "source_ip": "192.168.1.100",
        "source_port": 22
      }
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 1
  }
}
```

### GET /api/alerts
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "created_at": "2024-01-18T10:31:00.000Z",
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "rule_id": "brute-force-ssh",
      "severity": "critical",
      "status": "open",
      "title": "SSH Brute Force Detection",
      "description": "5+ failed SSH logins in 60 seconds",
      "hostname": "web-server-01"
    }
  ],
  "openCount": 1,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

### GET /api/events/stats
```json
{
  "total": 150,
  "bySeverity": {
    "info": 100,
    "warning": 35,
    "critical": 15
  },
  "byType": {
    "authentication": 80,
    "system": 40,
    "process": 20,
    "privilege": 10
  }
}
```

---

## Security Considerations

### Production Deployment

1. **Enable HTTPS/WSS**
   - Use a reverse proxy (nginx, Apache) with SSL certificates
   - Update agent configs to use `ssl: true`

2. **Authentication**
   - The current implementation has no authentication
   - Add JWT or session-based auth for production
   - Protect the `/api/ingest` endpoints with API keys

3. **Network Security**
   - Run backend on internal network only
   - Use firewall rules to restrict access to port 3001
   - Consider VPN for remote agents

4. **Database**
   - SQLite is suitable for small deployments
   - Migrate to PostgreSQL for high-volume environments
   - Implement regular backups

5. **Rate Limiting**
   - Add rate limiting to prevent DoS attacks
   - Implement request throttling on ingestion endpoints

6. **Log Retention**
   - Implement log rotation/archival
   - Set up automated cleanup of old events

### Agent Security

- Agents require root/admin access to read system logs
- Store agent credentials securely
- Use encrypted connections in production
- Validate agent identity on registration

---

## Changelog

### Version 1.0.0 (Initial Release)
- Backend server with Express and WebSocket
- SQLite database with events, alerts, endpoints, rules tables
- Log parsers for syslog, auth.log, and Windows Security events
- Detection engine with signature, threshold, and correlation rules
- 8 default detection rules
- React dashboard with real-time updates
- Linux agent (Node.js)
- Windows agent (PowerShell)

---

## Support

For issues and feature requests, please check the troubleshooting section or open an issue in the project repository.
