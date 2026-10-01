import React, { useMemo } from 'react';
import { ShieldAlert, Check, BellRing } from 'lucide-react';
import { Panel, Badge, EmptyState } from '../components/primitives';
import { relativeTime, severityMeta, statusClass } from '../lib/siem';

const AlertsView = ({ alerts, statusFilter, onStatusFilter, onSelect, selectedId, onUpdate }) => {
  const counts = useMemo(() => ({
    '': alerts.length,
    open: alerts.filter((a) => a.status === 'open').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    closed: alerts.filter((a) => a.status === 'closed').length,
  }), [alerts]);

  const visible = useMemo(
    () => (statusFilter ? alerts.filter((a) => a.status === statusFilter) : alerts),
    [alerts, statusFilter]
  );

  const options = [
    { id: '', label: `All ${counts['']}` },
    { id: 'open', label: `Open ${counts.open}` },
    { id: 'acknowledged', label: `Acked ${counts.acknowledged}` },
    { id: 'closed', label: `Closed ${counts.closed}` },
  ];

  return (
    <div className="view">
      <Panel
        title="Alert triage"
        icon={<ShieldAlert size={14} color="var(--sev-critical)" />}
        meta={`${visible.length} shown`}
        flush
        actions={
          <div className="segmented" role="group" aria-label="Filter by status">
            {options.map((opt) => (
              <button
                key={opt.id || 'all'}
                type="button"
                className="segmented__item"
                aria-pressed={statusFilter === opt.id}
                onClick={() => onStatusFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState icon={BellRing} title={statusFilter ? `No ${statusFilter} alerts` : 'No alerts'}>
            {statusFilter
              ? 'Try a different status filter.'
              : 'Detection rules raise alerts here when threats are identified.'}
          </EmptyState>
        ) : (
          <div className="queue">
            {visible.map((alert) => {
              const sev = severityMeta(alert.severity);
              return (
                <div
                  key={alert.id}
                  className="queue__item"
                  data-selected={alert.id === selectedId}
                  style={{ '--sev-color': sev.c }}
                >
                  <button
                    type="button"
                    className="queue__open"
                    onClick={() => onSelect(alert)}
                    aria-label={`Open alert: ${alert.title}`}
                  >
                    <div className="queue__main">
                      <div className="queue__meta" style={{ marginBottom: 2 }}>
                        <Badge className={statusClass(alert.status)}>{alert.status}</Badge>
                        <Badge className={sev.badge}>{alert.severity}</Badge>
                      </div>
                      <span className="queue__title">{alert.title}</span>
                      {alert.description && <span className="queue__desc">{alert.description}</span>}
                      <div className="queue__meta">
                        <span>Host: <b>{alert.hostname || 'N/A'}</b></span>
                        <span>{relativeTime(alert.created_at)}</span>
                      </div>
                    </div>
                  </button>

                  <div className="queue__side">
                    {alert.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => onUpdate(alert.id, 'acknowledged')}
                      >
                        Ack
                      </button>
                    )}
                    {alert.status !== 'closed' && (
                      <button
                        type="button"
                        className="btn btn--sm btn--success"
                        onClick={() => onUpdate(alert.id, 'closed')}
                        title="Close alert"
                        aria-label={`Close alert: ${alert.title}`}
                      >
                        <Check size={12} />
                      </button>
                    )}
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

export default AlertsView;
