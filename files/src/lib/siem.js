/**
 * Shared presentation helpers for the SIEM console.
 * Kept free of React so they can be imported anywhere.
 */

/* ── Severity ─────────────────────────────────────────────────────────────
   Every severity maps to three CSS custom properties: a solid line/accent
   colour, a translucent background, and a border tint. Defined per theme in
   siem.css, so components never hardcode a hex value. */

export const SEVERITIES = ['critical', 'warning', 'info'];

export const severityMeta = (severity) => {
  switch (severity) {
    case 'critical':
      return { key: 'critical', label: 'Critical', c: 'var(--sev-critical)', soft: 'var(--sev-critical-soft)', line: 'var(--sev-critical-line)', badge: 'badge--critical' };
    case 'warning':
      return { key: 'warning', label: 'Warning', c: 'var(--sev-warning)', soft: 'var(--sev-warning-soft)', line: 'var(--sev-warning-line)', badge: 'badge--warning' };
    case 'info':
      return { key: 'info', label: 'Info', c: 'var(--sev-info)', soft: 'var(--sev-info-soft)', line: 'var(--sev-info-line)', badge: 'badge--info' };
    default:
      return { key: 'neutral', label: severity || 'Unknown', c: 'var(--sev-neutral)', soft: 'var(--sev-neutral-soft)', line: 'var(--sev-neutral-line)', badge: 'badge--neutral' };
  }
};

/* Charts need concrete colours: SVG presentation attributes (stroke, fill,
   stopColor) do not reliably accept var() references. These mirror the dark
   theme tokens and are used only for chart marks. */
export const CHART = {
  critical: '#fb7185',
  warning:  '#fbbf24',
  info:     '#34d399',
  neutral:  '#5b6577',
  accent:   '#22d3ee',
  blue:     '#60a5fa',
};

export const severityHex = (severity) => CHART[severity] || CHART.neutral;

export const statusClass = (status) => {
  switch (status) {
    case 'open':         return 'badge--critical';
    case 'acknowledged': return 'badge--accent';
    case 'closed':       return 'badge--info';
    default:             return 'badge--neutral';
  }
};

/* ── Time ───────────────────────────────────────────────────────────────── */

export const relativeTime = (ts) => {
  if (!ts) return '—';
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return '—';

  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 0) return 'now';
  if (secs < 5) return 'now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

export const absoluteTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

/** HH:MM:SS — the format analysts actually read log lines in. */
export const clockTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatNumber = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString();
};

export const titleCase = (s) => (s ? String(s).replace(/_/g, ' ') : '');

/* ── Aggregation ────────────────────────────────────────────────────────── */

export const RANGES = [
  { id: '15m', label: '15m', ms: 15 * 60 * 1000, buckets: 15 },
  { id: '1h',  label: '1h',  ms: 60 * 60 * 1000, buckets: 12 },
  { id: '6h',  label: '6h',  ms: 6 * 60 * 60 * 1000, buckets: 12 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000, buckets: 12 },
];

/**
 * Bucket events into a fixed number of time slots, split by severity.
 * Returns oldest-slot-first so charts read left to right.
 */
export const bucketBySeverity = (events, range) => {
  const slots = Array.from({ length: range.buckets }, () => ({
    critical: 0, warning: 0, info: 0, total: 0, ts: 0,
  }));

  const now = Date.now();
  const width = range.ms / range.buckets;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t)) continue;

    const age = now - t;
    if (age < 0 || age > range.ms) continue;

    const idx = range.buckets - 1 - Math.min(range.buckets - 1, Math.floor(age / width));
    const slot = slots[idx];
    if (!slot) continue;

    slot.total += 1;
    if (slot[ e.severity ] !== undefined) slot[e.severity] += 1;
  }

  slots.forEach((slot, i) => {
    slot.ts = now - (range.buckets - 1 - i) * width;
  });

  return slots;
};

/** Group events by hostname, descending by volume. */
export const topTalkers = (events, limit = 6) => {
  const counts = new Map();
  for (const e of events) {
    const host = e.hostname || 'unknown';
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};

/**
 * Events per second across the loaded window. Approximate by design — the
 * event list is capped, so this is a rate over what the client can see.
 */
export const eventsPerSecond = (events, windowMs = 60_000) => {
  const cutoff = Date.now() - windowMs;
  const recent = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
  return recent / (windowMs / 1000);
};
