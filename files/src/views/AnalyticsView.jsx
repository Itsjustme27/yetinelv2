import React, { useMemo } from 'react';
import { BarChart3, Layers, ShieldCheck, Activity } from 'lucide-react';
import { Panel, EmptyState, Badge } from '../components/primitives';
import { SeverityBars, BarList } from '../components/charts';
import { CHART, RANGES, bucketBySeverity, clockTime, titleCase, severityMeta } from '../lib/siem';

const Meter = ({ label, value, max, color }) => (
  <div className="meter">
    <div className="meter__head">
      <span className="meter__label">{label}</span>
      <span className="meter__value" style={{ color }}>{value.toLocaleString()}</span>
    </div>
    <div
      className="meter__track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${label}: ${value}`}
    >
      <div
        className="meter__fill"
        style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, background: color }}
      />
    </div>
  </div>
);

const AnalyticsView = ({ stats, events, rules, range }) => {
  const rangeDef = RANGES.find((r) => r.id === range) || RANGES[1];

  const slots = useMemo(() => bucketBySeverity(events, rangeDef), [events, rangeDef]);
  const labels = useMemo(() => slots.map((s) => clockTime(s.ts).slice(0, 5)), [slots]);

  const byType = useMemo(
    () => Object.entries(stats.byType || {})
      .map(([name, value]) => ({ name: titleCase(name), value }))
      .sort((a, b) => b.value - a.value),
    [stats.byType]
  );

  const sevCounts = {
    critical: stats.bySeverity?.critical || 0,
    warning: stats.bySeverity?.warning || 0,
    info: stats.bySeverity?.info || 0,
  };
  const sevMax = Math.max(...Object.values(sevCounts), 1);
  const typeMax = Math.max(...byType.map((t) => t.value), 1);

  const enabledRules = rules.filter((r) => r.enabled);
  const totalMatches = rules.reduce((sum, r) => sum + (r.match_count || 0), 0);

  const talkers = useMemo(() => {
    const counts = new Map();
    for (const e of events) {
      const h = e.hostname || 'unknown';
      counts.set(h, (counts.get(h) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  return (
    <div className="view">
      <div className="grid-overview">
        <Panel
          title="Severity over time"
          icon={<Activity size={14} color="var(--accent)" />}
          meta={`last ${rangeDef.label}`}
        >
          {slots.some((s) => s.total > 0) ? (
            <SeverityBars slots={slots} labels={labels} height={220} />
          ) : (
            <EmptyState icon={Activity} title="No events in this window">
              Widen the time range to see a distribution.
            </EmptyState>
          )}
        </Panel>

        <Panel
          title="Rule effectiveness"
          icon={<ShieldCheck size={14} color="var(--accent)" />}
          meta={`${enabledRules.length}/${rules.length} enabled`}
        >
          <div className="stack-sm">
            <Meter label="Total matches" value={totalMatches} max={Math.max(totalMatches, 1)} color={CHART.accent} />
            <Meter label="Critical rules" value={rules.filter((r) => r.severity === 'critical').length} max={Math.max(rules.length, 1)} color={CHART.critical} />
            <Meter label="Warning rules" value={rules.filter((r) => r.severity === 'warning').length} max={Math.max(rules.length, 1)} color={CHART.warning} />
            <Meter label="Disabled" value={rules.length - enabledRules.length} max={Math.max(rules.length, 1)} color={CHART.neutral} />
          </div>
        </Panel>
      </div>

      <div className="grid-3">
        <Panel title="Events by type" icon={<Layers size={14} color="var(--accent)" />}>
          {byType.length === 0 ? (
            <p className="state__text">No data available.</p>
          ) : (
            <div className="stack-sm">
              {byType.map((t) => (
                <Meter key={t.name} label={t.name} value={t.value} max={typeMax} color={CHART.blue} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Events by severity" icon={<BarChart3 size={14} color="var(--accent)" />}>
          <div className="stack-sm">
            {['critical', 'warning', 'info'].map((sev) => (
              <Meter
                key={sev}
                label={sev}
                value={sevCounts[sev]}
                max={sevMax}
                color={severityMeta(sev).c}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Top talkers" icon={<Layers size={14} color="var(--accent)" />}>
          <BarList items={talkers} emptyLabel="No host activity in this window." />
        </Panel>
      </div>

      <Panel
        title="Detection rules"
        icon={<ShieldCheck size={14} color="var(--accent)" />}
        meta={`${rules.length} loaded`}
      >
        {rules.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No detection rules loaded">
            Rules are seeded from rules/default-rules.json on startup.
          </EmptyState>
        ) : (
          <div className="grid-rules">
            {rules.map((rule) => {
              const sev = severityMeta(rule.severity);
              return (
                <div className="rule" key={rule.id}>
                  <div className="rule__head">
                    <span className="rule__name">{rule.name}</span>
                    <span
                      className="rule__dot"
                      style={{ background: rule.enabled ? 'var(--sev-info)' : 'var(--fg-faint)' }}
                      title={rule.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </div>
                  <div
                    className="rule__count"
                    style={{ color: rule.enabled ? sev.c : 'var(--fg-subtle)' }}
                  >
                    {(rule.match_count || 0).toLocaleString()}
                  </div>
                  <div className="rule__foot">
                    matches · <Badge className={sev.badge}>{rule.severity}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AnalyticsView;
