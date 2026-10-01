import React, { useMemo } from 'react';
import {
  Database, AlertTriangle, ShieldAlert, Gauge, ArrowUpRight,
  Activity, Server, PieChart as PieIcon, Layers,
} from 'lucide-react';
import { Panel, Badge, EmptyState } from '../components/primitives';
import { AreaChart, SeverityBars, Donut, BarList, Legend, Sparkline } from '../components/charts';
import {
  CHART, RANGES, bucketBySeverity, topTalkers, eventsPerSecond,
  clockTime, relativeTime, titleCase, statusClass, severityMeta,
} from '../lib/siem';

const StatTile = ({ label, value, icon: Icon, color, series, onClick, trend }) => (
  <button type="button" className="stat" style={{ '--stat-color': color }} onClick={onClick}>
    <div className="stat__top">
      <span className="stat__label">{label}</span>
      <span className="stat__icon"><Icon size={15} /></span>
    </div>

    <div className="stat__value">{value}</div>

    <div className="stat__foot">
      {series ? <Sparkline data={series} color={color} /> : <span />}
      {trend && <span className="stat__trend stat__trend--up">{trend}</span>}
    </div>
  </button>
);

const Overview = ({
  stats,
  events,
  alerts,
  openAlertCount,
  range,
  onNavigate,
  onSelectEvent,
  onSelectAlert,
}) => {
  const rangeDef = RANGES.find((r) => r.id === range) || RANGES[1];

  const slots = useMemo(() => bucketBySeverity(events, rangeDef), [events, rangeDef]);
  const labels = useMemo(() => slots.map((s) => clockTime(s.ts).slice(0, 5)), [slots]);

  const totals = slots.map((s) => s.total);
  const criticalSeries = slots.map((s) => s.critical);

  const eps = useMemo(() => eventsPerSecond(events), [events]);
  const talkers = useMemo(() => topTalkers(events, 6), [events]);

  const typeItems = useMemo(
    () =>
      Object.entries(stats.byType || {})
        .map(([name, value]) => ({ name: titleCase(name), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [stats.byType]
  );

  const critical = stats.bySeverity?.critical ?? events.filter((e) => e.severity === 'critical').length;
  const warning = stats.bySeverity?.warning ?? events.filter((e) => e.severity === 'warning').length;
  const info = stats.bySeverity?.info ?? events.filter((e) => e.severity === 'info').length;
  const total = stats.total ?? events.length;

  const openQueue = useMemo(
    () => alerts.filter((a) => a.status === 'open').slice(0, 6),
    [alerts]
  );

  return (
    <div className="view">
      <div className="grid-stats">
        <StatTile
          label="Events"
          value={total.toLocaleString()}
          icon={Database}
          color={CHART.accent}
          series={totals}
          onClick={() => onNavigate('events')}
        />
        <StatTile
          label="Critical"
          value={critical.toLocaleString()}
          icon={AlertTriangle}
          color={CHART.critical}
          series={criticalSeries}
          onClick={() => onNavigate('events')}
          trend={critical > 0 ? 'Needs triage' : null}
        />
        <StatTile
          label="Open alerts"
          value={openAlertCount.toLocaleString()}
          icon={ShieldAlert}
          color={openAlertCount > 0 ? CHART.critical : CHART.info}
          onClick={() => onNavigate('alerts')}
        />
        <StatTile
          label="Events / sec"
          value={eps.toFixed(1)}
          icon={Gauge}
          color={CHART.blue}
          series={totals}
          onClick={() => onNavigate('analytics')}
        />
      </div>

      <div className="grid-overview">
        <Panel
          title="Event volume"
          icon={<Activity size={14} color="var(--accent)" />}
          meta={`last ${rangeDef.label}`}
        >
          {totals.some((v) => v > 0) ? (
            <>
              <AreaChart data={totals} labels={labels} height={196} />
              <div style={{ marginTop: 18 }}>
                <span className="section__label" style={{ marginBottom: 10 }}>By severity</span>
                <SeverityBars slots={slots} labels={labels} height={150} />
              </div>
            </>
          ) : (
            <EmptyState icon={Activity} title="No events in this window">
              Widen the time range, or generate test events from the sidebar.
            </EmptyState>
          )}
        </Panel>

        <Panel
          title="Alert queue"
          icon={<ShieldAlert size={14} color="var(--sev-critical)" />}
          meta={openAlertCount > 0 ? `${openAlertCount} open` : 'clear'}
          flush
          actions={
            alerts.length > 0 && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('alerts')}>
                View all <ArrowUpRight size={12} />
              </button>
            )
          }
        >
          {openQueue.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No open alerts">
              Detection rules will raise alerts here.
            </EmptyState>
          ) : (
            <div className="queue">
              {openQueue.map((alert) => {
                const sev = severityMeta(alert.severity);
                return (
                  <div
                    className="queue__item"
                    key={alert.id}
                    style={{ '--sev-color': sev.c }}
                  >
                    <button
                      type="button"
                      className="queue__open"
                      onClick={() => onSelectAlert(alert)}
                      aria-label={`Open alert: ${alert.title}`}
                    >
                      <div className="queue__main">
                        <span className="queue__title">{alert.title}</span>
                        <span className="queue__desc">{alert.description}</span>
                        <div className="queue__meta">
                          <span>Host: <b>{alert.hostname || 'N/A'}</b></span>
                          <span>{relativeTime(alert.created_at)}</span>
                        </div>
                      </div>
                    </button>
                    <div className="queue__side">
                      <Badge className={sev.badge}>{alert.severity}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid-3">
        <Panel title="Severity split" icon={<PieIcon size={14} color="var(--accent)" />}>
          <div className="donut-wrap">
            <Donut
              segments={[
                { value: critical, color: CHART.critical },
                { value: warning, color: CHART.warning },
                { value: info, color: CHART.info },
              ]}
            />
            <Legend
              items={[
                { label: 'Critical', value: critical, color: CHART.critical },
                { label: 'Warning', value: warning, color: CHART.warning },
                { label: 'Info', value: info, color: CHART.info },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Top talkers" icon={<Server size={14} color="var(--accent)" />} meta="by volume">
          <BarList items={talkers} emptyLabel="No host activity in this window." />
        </Panel>

        <Panel title="Event types" icon={<Layers size={14} color="var(--accent)" />}>
          <BarList items={typeItems} color={CHART.blue} emptyLabel="No event type data yet." />
        </Panel>
      </div>

      {/* Recent critical — the fast path into triage */}
      {events.some((e) => e.severity === 'critical') && (
        <Panel
          title="Recent critical events"
          icon={<AlertTriangle size={14} color="var(--sev-critical)" />}
          flush
        >
          <div className="queue">
            {events
              .filter((e) => e.severity === 'critical')
              .slice(0, 5)
              .map((event) => (
                <div
                  className="queue__item"
                  key={event.id}
                  style={{ '--sev-color': 'var(--sev-critical)' }}
                >
                  <button
                    type="button"
                    className="queue__open"
                    onClick={() => onSelectEvent(event)}
                    aria-label={`Open event: ${event.description}`}
                  >
                    <div className="queue__main">
                      <span className="queue__title">{event.description}</span>
                      <div className="queue__meta">
                        <span>Host: <b>{event.hostname || 'unknown'}</b></span>
                        <span className="mono">{clockTime(event.timestamp)}</span>
                        <span>{relativeTime(event.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="queue__side">
                    <Badge className={statusClass(event.severity)}>{event.severity}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default Overview;
