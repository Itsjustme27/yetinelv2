// Load backend/.env before anything reads process.env (PORT, AGENT_API_KEY).
// This was previously missing, so .env was never actually read.
require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { initDatabase, endpointOps } = require('./database/init');
const { initWebSocket } = require('./services/websocketService');
const { loadDefaultRules } = require('./services/detectionEngine');
const agentAuth = require('./middleware/agentAuth');
const rateLimit = require('./middleware/rateLimit');

// Routes
const eventsRouter = require('./routes/events');
const alertsRouter = require('./routes/alerts');
const endpointsRouter = require('./routes/endpoints');
const rulesRouter = require('./routes/rules');
const ingestRouter = require('./routes/ingest');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDatabase();

// Load default detection rules
loadDefaultRules();

if (!process.env.AGENT_API_KEY) {
    console.warn('[SECURITY] AGENT_API_KEY is not set — every /api/ingest request will be refused with 503.');
    console.warn('[SECURITY] Set it in backend/.env, then set SIEM_AGENT_KEY in each agent.');
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow frontend to connect
}));
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/events', eventsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/endpoints', endpointsRouter);
app.use('/api/rules', rulesRouter);

// Agent ingest gets two protections:
//   1. a per-IP rate limit, so one source cannot flood the DB
//   2. a shared secret (X-Agent-Key), so events cannot be forged
// The dashboard's "Test events" button calls /api/ingest/test from the browser,
// which cannot hold the agent key. That single route is exempt — but only
// outside production, where it falls through to agentAuth like everything else.
app.use('/api/ingest', rateLimit({ windowMs: 60_000, max: 240, keyPrefix: 'ingest' }));
app.use('/api/ingest', (req, res, next) => {
    const isDevTestRoute = req.path === '/test' && process.env.NODE_ENV !== 'production';
    return isDevTestRoute ? next() : agentAuth(req, res, next);
});
app.use('/api/ingest', ingestRouter);

// Error handling
// Express only recognises a middleware as an error handler when it declares
// four parameters. With three it registers as a normal (req, res, next) — which
// made this run on every unmatched route, log a bogus [ERROR], and then throw
// on `res.status` (res was really `next`). That also shadowed the 404 below.
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket
initWebSocket(server);

// Periodic endpoint status check (mark offline if no heartbeat)
setInterval(() => {
    endpointOps.markStale(2); // Mark offline if no heartbeat for 2 minutes
}, 60000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received, shutting down...');
    server.close(() => {
        console.log('[SERVER] Server closed');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    MINI SIEM BACKEND                      ║
║                                                           ║
║  Server running on http://localhost:${PORT}                 ║
║  WebSocket on ws://localhost:${PORT}/ws                     ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /health           - Health check                  ║
║    GET  /api/events       - List events                   ║
║    GET  /api/events/stats - Event statistics              ║
║    GET  /api/alerts       - List alerts                   ║
║    PATCH /api/alerts/:id  - Update alert                  ║
║    GET  /api/endpoints    - List endpoints                ║
║    POST /api/endpoints/register - Register agent          ║
║    GET  /api/rules        - List rules                    ║
║    POST /api/ingest/batch - Receive events                ║
║    POST /api/ingest/heartbeat - Agent heartbeat           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server };
