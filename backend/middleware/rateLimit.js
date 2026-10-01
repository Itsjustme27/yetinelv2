/**
 * Minimal dependency-free fixed-window rate limiter.
 *
 * Deliberately in-process: this backend is a single Node process. If it ever
 * runs as more than one instance the window state needs to move to a shared
 * store, since each process would otherwise track its own counters.
 *
 * Note on req.ip: it reflects the socket address unless `trust proxy` is set
 * on the app. Behind a reverse proxy every request would share one bucket
 * until that is configured.
 */
function rateLimit({ windowMs = 60_000, max = 120, keyPrefix = 'rl' } = {}) {
    const hits = new Map(); // key -> { count, resetAt }

    // Sweep expired windows so the map cannot grow without bound as new IPs
    // appear. unref() keeps this timer from holding the process open.
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs);
    if (typeof sweep.unref === 'function') sweep.unref();

    return function rateLimiter(req, res, next) {
        const key = `${keyPrefix}:${req.ip}`;
        const now = Date.now();

        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        entry.count++;

        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.set('RateLimit-Limit', String(max));
        res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
        res.set('RateLimit-Reset', String(retryAfter));

        if (entry.count > max) {
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: 'Too many requests',
                retry_after_seconds: retryAfter
            });
        }

        return next();
    };
}

module.exports = rateLimit;
