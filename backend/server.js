require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { initDatabase, endpointOps } = require('./database/init');
const { initWebSocket } = require('./services/websocketService');
const { loadDefaultRules } = require('./services/detectionEngine');

// Routes
const eventsRouter = require('./routes/events');
const alertsRouter = require('./routes/alerts');
const endpointsRouter = require('./routes/endpoints');
const rulesRouter = require('./routes/rules');
const ingestRouter = require('./routes/ingest');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDatabase();

// Load default detection rules
loadDefaultRules();

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
app.use('/api/ingest', ingestRouter);
app.use('/api/auth', authRouter)

// Error handling
app.use((err, req, res) => {
    console.error('[ERROR]', err);
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
