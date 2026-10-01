const crypto = require('crypto');

/**
 * Constant-time string comparison.
 *
 * crypto.timingSafeEqual throws when the buffers differ in length, and that
 * throw would itself leak the expected key's length, so both sides are hashed
 * to a fixed 32 bytes first.
 */
function timingSafeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/**
 * Shared-secret authentication for the agent ingest API.
 *
 * Agents present their key in the `X-Agent-Key` header; the expected value is
 * read from AGENT_API_KEY. Without this, anything that can reach the port can
 * forge events for any endpoint_id and poison the detection engine.
 *
 * Fails *closed* when the secret is not configured. Failing open would make
 * the whole mechanism decorative — a missing env var would silently restore
 * unauthenticated writes.
 */
function agentAuth(req, res, next) {
    const expected = process.env.AGENT_API_KEY;

    if (!expected) {
        console.error('[AUTH] AGENT_API_KEY is not set — refusing ingest request');
        return res.status(503).json({
            error: 'Ingest API is not configured',
            hint: 'Set AGENT_API_KEY in backend/.env and in each agent (SIEM_AGENT_KEY)'
        });
    }

    const provided = req.get('X-Agent-Key');

    if (!provided || !timingSafeEqual(provided, expected)) {
        console.warn(`[AUTH] Rejected ingest request from ${req.ip} (bad or missing X-Agent-Key)`);
        return res.status(401).json({ error: 'Invalid or missing agent key' });
    }

    return next();
}

module.exports = agentAuth;
