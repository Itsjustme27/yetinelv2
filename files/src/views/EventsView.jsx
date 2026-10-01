import React, { useEffect, useRef } from 'react';
import { Search, X, ScrollText, Inbox } from 'lucide-react';
import { Panel, Badge, EmptyState } from '../components/primitives';
import { clockTime, relativeTime, severityMeta, statusClass } from '../lib/siem';

const SEV_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
];

const EventsView = ({
  events,
  query,
  onQuery,
  severity,
  onSeverity,
  source,
  onSource,
  sources,
  onSelect,
  selectedId,
  isFiltering,
  hasFilters,
  onClear,
}) => {
  const bodyRef = useRef(null);

  // Keep the selected row visible when arrowing through the list.
  useEffect(() => {
    if (!selectedId) return;
    bodyRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = events.findIndex((ev) => ev.id === selectedId);
    const next = e.key === 'ArrowDown'
      ? Math.min(idx + 1, events.length - 1)
      : Math.max(idx - 1, 0);
    if (events[next]) onSelect(events[next]);
  };

  const toolbar = (
    <div className="toolbar">
      <div className="field">
        <span className="field__icon"><Search size={14} /></span>
        <input
          className="input input--icon"
          type="search"
          placeholder="Search description, host, source…"
          aria-label="Search events"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          style={{ minWidth: 240 }}
        />
      </div>

      <div className="segmented" role="group" aria-label="Filter by severity">
        {SEV_OPTIONS.map((opt) => (
          <button
            key={opt.id || 'all'}
            type="button"
            className="segmented__item"
            aria-pressed={severity === opt.id}
            onClick={() => onSeverity(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {sources.length > 1 && (
        <select
          className="select"
          aria-label="Filter by source"
          value={source}
          onChange={(e) => onSource(e.target.value)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button type="button" className="btn btn--sm" onClick={onClear}>
          <X size={12} /> Clear
        </button>
      )}

      <span className="toolbar__spacer" />
      {isFiltering && <span className="panel__meta">searching…</span>}
    </div>
  );

  return (
    <div className="view">
      <Panel
        title="Security event log"
        icon={<ScrollText size={14} color="var(--accent)" />}
        meta={`${events.length.toLocaleString()} shown`}
        flush
      >
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
          {toolbar}
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={hasFilters ? Search : Inbox}
            title={hasFilters ? 'No matching events' : 'No events recorded'}
          >
            {hasFilters
              ? 'Try a different term, or widen the time range.'
              : 'Start an agent, or generate test events from the sidebar.'}
          </EmptyState>
        ) : (
          <div className="tbl">
            <div className="tbl__head cols-events" aria-hidden="true">
              <span>Time</span>
              <span>Hostname</span>
              <span>Description</span>
              <span>Source</span>
              <span>Severity</span>
            </div>

            <div
              className="tbl__body"
              ref={bodyRef}
              onKeyDown={onKeyDown}
              style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', overscrollBehavior: 'contain' }}
            >
              {events.map((event) => {
                const sev = severityMeta(event.severity);
                return (
                  <button
                    type="button"
                    key={event.id}
                    className="tbl__row cols-events"
                    data-selected={event.id === selectedId}
                    style={{ borderLeftColor: sev.c }}
                    onClick={() => onSelect(event)}
                    title={`${event.description} — ${relativeTime(event.timestamp)}`}
                  >
                    <span className="tbl__time">{clockTime(event.timestamp)}</span>
                    <span className="tbl__host">{event.hostname || 'unknown'}</span>
                    <span className="tbl__desc">{event.description}</span>
                    <span className="tbl__src">{event.source}</span>
                    <span className="tbl__sev">
                      <Badge className={statusClass(event.severity)}>{event.severity}</Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default EventsView;
