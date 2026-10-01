import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CHART } from '../lib/siem';

/**
 * Track an element's rendered width so charts can draw at true pixel size.
 * Stretching a fixed viewBox (preserveAspectRatio="none") would distort both
 * the stroke weight and any text, which is what made the old charts look soft.
 */
export const useMeasure = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    setWidth(Math.round(node.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, []);

  return [ref, width];
};

/** Round a max up to a readable axis bound (1, 2, 5, 10 × 10ⁿ). */
const niceMax = (value) => {
  if (value <= 0) return 4;
  const exp = Math.floor(Math.log10(value));
  const pow = Math.pow(10, exp);
  const frac = value / pow;
  const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return step * pow;
};

const Tooltip = ({ x, y, children }) => (
  <div className="chart-tip" style={{ left: x, top: y }}>{children}</div>
);

/* ── Sparkline ───────────────────────────────────────────────────────────── */

export const Sparkline = ({ data, color = CHART.accent, height = 26, width = 92 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => [
    i * step,
    height - 3 - ((v - min) / range) * (height - 8),
  ]);

  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${line} ${width},${height} 0,${height}`;
  const gid = `sp-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ── Area chart — single series with axes and hover ──────────────────────── */

export const AreaChart = ({ data, labels = [], color = CHART.accent, height = 190, unit = '' }) => {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState(null);

  const pad = { top: 12, right: 10, bottom: 22, left: 38 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const max = useMemo(() => niceMax(Math.max(...(data || [0]), 1)), [data]);
  const n = data?.length || 0;

  const xAt = (i) => (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yAt = (v) => innerH - (v / max) * innerH;

  if (!width || n < 2) return <div ref={ref} style={{ height }} />;

  const line = data.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
  const area = `0,${innerH} ${line} ${innerW},${innerH}`;
  const gid = 'area-grad';

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  // Show a readable subset of x labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="chart-host" ref={ref}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Event volume over time">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="chart__grid" x1="0" x2={innerW} y1={yAt(t)} y2={yAt(t)} />
              <text className="chart__axis" x="-8" y={yAt(t)} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}

          <polygon points={area} fill={`url(#${gid})`} />
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {labels.length > 0 &&
            labels.map((lbl, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text
                  key={i}
                  className="chart__axis"
                  x={xAt(i)}
                  y={innerH + 15}
                  textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                >
                  {lbl}
                </text>
              ) : null
            )}

          {hover !== null && (
            <>
              <line
                className="chart__grid"
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={0}
                y2={innerH}
                stroke={color}
                strokeOpacity="0.5"
              />
              <circle
                className="chart__dot"
                cx={xAt(hover)}
                cy={yAt(data[hover])}
                r="3.5"
                fill={color}
                strokeWidth="2"
              />
            </>
          )}

          {/* Invisible hover targets, one per bucket */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={xAt(i) - innerW / (2 * Math.max(1, n - 1))}
              y={0}
              width={innerW / Math.max(1, n - 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
      </svg>

      {hover !== null && (
        <Tooltip x={pad.left + xAt(hover)} y={pad.top + yAt(data[hover])}>
          <div className="chart-tip__row">
            <span style={{ color: 'var(--fg-subtle)' }}>{labels[hover] || `#${hover + 1}`}</span>
            <span className="chart-tip__val">{data[hover]}{unit}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

/* ── Stacked severity bars ───────────────────────────────────────────────── */

export const SeverityBars = ({ slots, labels = [], height = 190 }) => {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState(null);

  const pad = { top: 12, right: 10, bottom: 22, left: 38 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const max = useMemo(
    () => niceMax(Math.max(...(slots || []).map((s) => s.total), 1)),
    [slots]
  );

  const n = slots?.length || 0;

  if (!width || n === 0) return <div ref={ref} style={{ height }} />;

  const slotW = innerW / n;
  const barW = Math.max(4, slotW - Math.max(3, slotW * 0.28));
  const yAt = (v) => innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="chart-host" ref={ref}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Events by severity over time">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="chart__grid" x1="0" x2={innerW} y1={yAt(t)} y2={yAt(t)} />
              <text className="chart__axis" x="-8" y={yAt(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}

          {slots.map((slot, i) => {
            const cx = i * slotW + slotW / 2;
            let cursor = innerH;
            const order = [
              ['info', CHART.info],
              ['warning', CHART.warning],
              ['critical', CHART.critical],
            ];

            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
                {order.map(([key, fill]) => {
                  const v = slot[key];
                  if (!v) return null;
                  const h = Math.max(1.5, (v / max) * innerH);
                  cursor -= h;
                  return (
                    <rect
                      key={key}
                      x={cx - barW / 2}
                      y={cursor}
                      width={barW}
                      height={h}
                      rx="2"
                      fill={fill}
                    />
                  );
                })}
              </g>
            );
          })}

          {labels.map((lbl, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text
                key={i}
                className="chart__axis"
                x={i * slotW + slotW / 2}
                y={innerH + 15}
                textAnchor="middle"
              >
                {lbl}
              </text>
            ) : null
          )}

          {slots.map((_, i) => (
            <rect
              key={i}
              x={i * slotW}
              y={0}
              width={slotW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
      </svg>

      {hover !== null && slots[hover] && (
        <Tooltip x={pad.left + hover * slotW + slotW / 2} y={pad.top + yAt(slots[hover].total)}>
          <div style={{ color: 'var(--fg-subtle)', marginBottom: 4 }}>{labels[hover]}</div>
          {[
            ['Critical', slots[hover].critical, CHART.critical],
            ['Warning', slots[hover].warning, CHART.warning],
            ['Info', slots[hover].info, CHART.info],
          ].map(([label, v, c]) => (
            <div className="chart-tip__row" key={label}>
              <span className="legend__swatch" style={{ background: c }} />
              <span>{label}</span>
              <span className="chart-tip__val">{v}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
};

/* ── Donut ───────────────────────────────────────────────────────────────── */

export const Donut = ({ segments, size = 104, thickness = 13 }) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle className="donut__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const rot = (offset / total) * 360 - 90;
        offset += seg.value;
        if (!seg.value) return null;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(${rot} ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: 'var(--fg)', fontSize: 19, fontWeight: 700, fontFamily: 'var(--mono)' }}
      >
        {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
      </text>
    </svg>
  );
};

/* ── Horizontal bar list (top talkers, event types) ──────────────────────── */

export const BarList = ({ items, color = CHART.accent, emptyLabel = 'No data yet' }) => {
  if (!items || items.length === 0) {
    return <p style={{ fontSize: 12.5, color: 'var(--fg-subtle)', padding: '8px 0' }}>{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.name}>
          <span className="bar-row__name" title={item.name}>{item.name}</span>
          <span className="bar-row__track">
            <span
              className="bar-row__fill"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color || color }}
            />
          </span>
          <span className="bar-row__val">{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Legend ──────────────────────────────────────────────────────────────── */

export const Legend = ({ items }) => (
  <div className="legend">
    {items.map((item) => (
      <div className="legend__row" key={item.label}>
        <span className="legend__swatch" style={{ background: item.color }} />
        <span className="legend__label">{item.label}</span>
        <span className="legend__value">{item.value.toLocaleString()}</span>
      </div>
    ))}
  </div>
);
