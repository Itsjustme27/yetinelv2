import React, { useMemo, useState } from 'react';
import { Server, Network, Cpu, Clock, Terminal } from 'lucide-react';
import { Panel, Badge, EmptyState } from '../components/primitives';
import { relativeTime, absoluteTime } from '../lib/siem';

const statusBadge = (status) => {
  switch (status) {
    case 'healthy':     return 'badge--info';
    case 'offline':     return 'badge--neutral';
    case 'compromised': return 'badge--critical';
    default:            return 'badge--warning';
  }
};

const statusColor = (status) => {
  switch (status) {
    case 'healthy':     return 'var(--sev-info)';
    case 'offline':     return 'var(--sev-neutral)';
    case 'compromised': return 'var(--sev-critical)';
    default:            return 'var(--sev-warning)';
  }
};

const EndpointsView = ({ endpoints }) => {
  const [filter, setFilter] = useState('');

  const counts = useMemo(() => ({
    '': endpoints.length,
    healthy: endpoints.filter((e) => e.status === 'healthy').length,
    offline: endpoints.filter((e) => e.status === 'offline').length,
    degraded: endpoints.filter((e) => e.status !== 'healthy' && e.status !== 'offline').length,
  }), [endpoints]);

  const visible = useMemo(
    () => (filter ? endpoints.filter((e) => (filter === 'degraded'
      ? e.status !== 'healthy' && e.status !== 'offline'
      : e.status === filter)) : endpoints),
    [endpoints, filter]
  );

  const options = [
    { id: '', label: `All ${counts['']}` },
    { id: 'healthy', label: `Healthy ${counts.healthy}` },
    { id: 'degraded', label: `Degraded ${counts.degraded}` },
    { id: 'offline', label: `Offline ${counts.offline}` },
  ];

  return (
    <div className="view">
      <Panel
        title="Monitored endpoints"
        icon={<Server size={14} color="var(--accent)" />}
        meta={`${visible.length} shown`}
        actions={
          endpoints.length > 0 && (
            <div className="segmented" role="group" aria-label="Filter by status">
              {options.map((opt) => (
                <button
                  key={opt.id || 'all'}
                  type="button"
                  className="segmented__item"
                  aria-pressed={filter === opt.id}
                  onClick={() => setFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )
        }
      >
        {endpoints.length === 0 ? (
          <EmptyState icon={Server} title="No endpoints registered">
            Start an agent on a host to begin collecting telemetry.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon={Server} title={`No ${filter} endpoints`}>
            Try a different filter.
          </EmptyState>
        ) : (
          <div className="grid-endpoints">
            {visible.map((endpoint) => (
              <div
                className="endpoint"
                key={endpoint.id}
                style={{ borderLeft: `3px solid ${statusColor(endpoint.status)}` }}
              >
                <div className="endpoint__head">
                  <span className="endpoint__name" title={endpoint.hostname}>{endpoint.hostname}</span>
                  <Badge className={statusBadge(endpoint.status)}>{endpoint.status}</Badge>
                </div>

                <div className="endpoint__facts">
                  <div className="fact">
                    <Network size={13} />
                    <b>{endpoint.ip_address || 'N/A'}</b>
                  </div>
                  <div className="fact">
                    <Cpu size={13} />
                    <span>{[endpoint.os, endpoint.os_version].filter(Boolean).join(' ') || 'Unknown OS'}</span>
                  </div>
                  <div className="fact" title={absoluteTime(endpoint.last_seen)}>
                    <Clock size={13} />
                    <span>seen {relativeTime(endpoint.last_seen)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {endpoints.length === 0 && (
        <Panel title="Register an agent" icon={<Terminal size={14} color="var(--accent)" />}>
          <p className="state__text" style={{ maxWidth: 'none', marginBottom: 12 }}>
            The agent key matches <code className="mono">AGENT_API_KEY</code> in{' '}
            <code className="mono">backend/.env</code>. Put it in{' '}
            <code className="mono">config.local.json</code> (gitignored) rather than the
            shell — <code className="mono">sudo</code> drops exported variables.
          </p>
          <div className="stack-sm">
            <span className="section__label" style={{ marginBottom: 0 }}>1 · write the key</span>
            <pre className="code">echo {'{"agent_api_key":"<your-key>"}'} &gt; agents/linux/config.local.json</pre>
            <span className="section__label" style={{ marginBottom: 0, marginTop: 8 }}>2 · start the agent</span>
            <pre className="code">sudo node agents/linux/agent.js</pre>
            <span className="section__label" style={{ marginBottom: 0, marginTop: 8 }}>Windows</span>
            <pre className="code">$env:SIEM_AGENT_KEY="&lt;your-key&gt;"; .\agents\windows\agent.ps1</pre>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default EndpointsView;
