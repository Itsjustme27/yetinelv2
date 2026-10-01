'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Database } from 'lucide-react';
import siemApi from './api/siemApi';
import { useWebSocket } from './hooks/useWebSocket';
import { useTheme } from './hooks/useTheme';
import { RANGES, clockTime, absoluteTime, relativeTime, titleCase, severityMeta, statusClass } from './lib/siem';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import SlideOver from './components/SlideOver';
import CommandPalette from './components/CommandPalette';
import { LoadingState, Badge, Def, Section } from './components/primitives';

import Overview from './views/Overview';
import EventsView from './views/EventsView';
import AlertsView from './views/AlertsView';
import EndpointsView from './views/EndpointsView';
import AnalyticsView from './views/AnalyticsView';

import './styles/siem.css';

const VIEWS = {
  overview:  { title: 'Overview',  sub: 'Live security posture' },
  events:    { title: 'Events',    sub: 'Normalised log stream' },
  alerts:    { title: 'Alerts',    sub: 'Detection rule matches' },
  endpoints: { title: 'Endpoints', sub: 'Monitored hosts' },
  analytics: { title: 'Analytics', sub: 'Trends and rule effectiveness' },
};

const useDebounced = (value, delay = 320) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const MiniSIEM = () => {
  const { theme, toggle: toggleTheme } = useTheme();

  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState({ total: 0, bySeverity: {}, byType: {} });

  const [view, setView] = useState('overview');
  const [range, setRange] = useState('1h');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [alertStatus, setAlertStatus] = useState('open');

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Event filters
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);

  const debouncedQuery = useDebounced(query);
  const hasFilters = Boolean(debouncedQuery || severity || source);

  const showToast = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const handleEventMessage = useCallback((message) => {
    if (message.type === 'new_events' || message.type === 'new_event') {
      const incoming = message.events || [message.event];
      setEvents((prev) => [...incoming, ...prev].slice(0, 200));
    }
  }, []);

  const handleAlertMessage = useCallback((message) => {
    if (message.type === 'new_alerts' && Array.isArray(message.alerts)) {
      setAlerts((prev) => [...message.alerts, ...prev].slice(0, 100));
      setOpenAlertCount((prev) => prev + message.alerts.length);
    }
  }, []);

  const handleEndpointMessage = useCallback((message) => {
    if (message.type === 'heartbeat') {
      setEndpoints((prev) => prev.map((ep) => (
        ep.id === message.endpoint_id
          ? { ...ep, status: 'healthy', last_seen: message.timestamp }
          : ep
      )));
    }
  }, []);

  const wsChannels = useMemo(() => ['events', 'alerts', 'endpoints'], []);

  const { connectionState, isConnected } = useWebSocket({
    channels: wsChannels,
    onEvent: handleEventMessage,
    onAlert: handleAlertMessage,
    onEndpoint: handleEndpointMessage,
    autoReconnect: true,
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [eventsRes, alertsRes, endpointsRes, rulesRes, statsRes] = await Promise.all([
        siemApi.getEvents({ limit: 200 }),
        siemApi.getAlerts({ limit: 100 }),
        siemApi.getEndpoints(),
        siemApi.getRules(),
        siemApi.getEventStats(),
      ]);

      setEvents(eventsRes.events || []);
      setAlerts(alertsRes.alerts || []);
      setOpenAlertCount(alertsRes.openCount || 0);
      setEndpoints(endpointsRes.endpoints || []);
      setRules(rulesRes.rules || []);
      setStats(statsRes || { total: 0, bySeverity: {}, byType: {} });
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      siemApi.getEventStats().then(setStats).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Server-side search whenever a filter is active.
  useEffect(() => {
    if (!hasFilters) {
      setFilteredEvents([]);
      setIsFiltering(false);
      return undefined;
    }

    let cancelled = false;
    setIsFiltering(true);

    siemApi
      .getEvents({
        limit: 500,
        search: debouncedQuery || undefined,
        severity: severity || undefined,
        source: source || undefined,
      })
      .then((res) => { if (!cancelled) setFilteredEvents(res.events || []); })
      .catch((err) => {
        if (!cancelled) {
          console.error('Search failed:', err);
          showToast('Search failed', 'error');
        }
      })
      .finally(() => { if (!cancelled) setIsFiltering(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery, severity, source, hasFilters, showToast]);

  // ── Keyboard: ⌘K / Ctrl+K ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const generateTestEvents = async () => {
    try {
      const res = await siemApi.ingestTestEvents();
      showToast(`Generated ${res.events} events · ${res.alerts} alerts`);
      fetchData({ silent: true });
    } catch (err) {
      console.error(err);
      showToast('Could not generate test events', 'error');
    }
  };

  const updateAlert = async (alertId, status) => {
    try {
      const updated = await siemApi.updateAlertStatus(alertId, status);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, ...updated } : a)));
      setSelectedAlert((prev) => (prev && prev.id === alertId ? { ...prev, ...updated } : prev));

      // Recompute instead of decrementing — the server is the authority.
      const res = await siemApi.getAlerts({ limit: 1, status: 'open' });
      setOpenAlertCount(res.openCount ?? 0);

      showToast(status === 'closed' ? 'Alert closed' : 'Alert acknowledged');
    } catch (err) {
      console.error(err);
      showToast('Could not update alert', 'error');
    }
  };

  const openEventFromPalette = useCallback((event) => {
    setView('events');
    setSelectedEvent(event);
  }, []);

  const openAlertFromPalette = useCallback((alert) => {
    setView('alerts');
    setSelectedAlert(alert);
  }, []);

  const clearFilters = () => {
    setQuery('');
    setSeverity('');
    setSource('');
  };

  const visibleEvents = hasFilters ? filteredEvents : events;

  const sources = useMemo(
    () => [...new Set(events.map((e) => e.source).filter(Boolean))].sort(),
    [events]
  );

  const rangeDef = RANGES.find((r) => r.id === range) || RANGES[1];
  const meta = VIEWS[view];

  const subtitle = view === 'overview'
    ? `${events.length.toLocaleString()} events loaded · last ${rangeDef.label}`
    : meta.sub;

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app">
        <div className="app__main">
          <LoadingState label="Connecting to SIEM backend…" />
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="app">
        <div className="app__main">
          <div className="state state--full">
            <div className="state__icon state__icon--danger"><AlertTriangle size={21} /></div>
            <div>
              <div className="state__title">Connection error</div>
              <div className="state__text" style={{ marginTop: 6 }}>{error}</div>
            </div>
            <pre className="code" style={{ textAlign: 'left' }}>cd backend &amp;&amp; npm install &amp;&amp; npm start</pre>
            <button type="button" className="btn btn--accent" onClick={() => fetchData()}>
              Retry connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={setView}
        open={railOpen}
        onClose={() => setRailOpen(false)}
        alertCount={openAlertCount}
        endpointCount={endpoints.length}
        eventCount={events.length}
        isConnected={isConnected}
        connectionState={connectionState}
        refreshing={refreshing}
        onRefresh={() => fetchData({ silent: true })}
        onTestEvents={generateTestEvents}
      />

      <div className="app__main">
        <TopBar
          title={meta.title}
          subtitle={subtitle}
          onMenu={() => setRailOpen(true)}
          range={range}
          onRange={setRange}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        {refreshing && <div className="loadbar" role="status" aria-label="Refreshing" />}

        <main className="app__content">
          {view === 'overview' && (
            <Overview
              stats={stats}
              events={events}
              alerts={alerts}
              openAlertCount={openAlertCount}
              range={range}
              onNavigate={setView}
              onSelectEvent={setSelectedEvent}
              onSelectAlert={setSelectedAlert}
            />
          )}

          {view === 'events' && (
            <EventsView
              events={visibleEvents}
              query={query}
              onQuery={setQuery}
              severity={severity}
              onSeverity={setSeverity}
              source={source}
              onSource={setSource}
              sources={sources}
              onSelect={setSelectedEvent}
              selectedId={selectedEvent?.id}
              isFiltering={isFiltering}
              hasFilters={hasFilters}
              onClear={clearFilters}
            />
          )}

          {view === 'alerts' && (
            <AlertsView
              alerts={alerts}
              statusFilter={alertStatus}
              onStatusFilter={setAlertStatus}
              onSelect={setSelectedAlert}
              selectedId={selectedAlert?.id}
              onUpdate={updateAlert}
            />
          )}

          {view === 'endpoints' && <EndpointsView endpoints={endpoints} />}

          {view === 'analytics' && (
            <AnalyticsView stats={stats} events={events} rules={rules} range={range} />
          )}
        </main>
      </div>

      {/* ── Event detail ─────────────────────────────────────────────────── */}
      {selectedEvent && (
        <SlideOver
          title="Event detail"
          subtitle={`${selectedEvent.hostname || 'unknown'} · ${relativeTime(selectedEvent.timestamp)}`}
          icon={<Database size={16} color="var(--accent)" />}
          onClose={() => setSelectedEvent(null)}
          footer={
            <button type="button" className="btn btn--accent" onClick={() => setSelectedEvent(null)}>
              Close
            </button>
          }
        >
          <div>
            <Badge className={statusClass(selectedEvent.severity)}>{selectedEvent.severity}</Badge>
          </div>

          <div className="defs">
            <Def label="Event ID" value={selectedEvent.id} variant="id" />
            <Def label="Timestamp" value={absoluteTime(selectedEvent.timestamp)} />
            <Def label="Clock" value={clockTime(selectedEvent.timestamp)} />
            <Def label="Source" value={selectedEvent.source || '—'} />
            <Def label="Type" value={titleCase(selectedEvent.event_type) || '—'} />
            <Def label="Description" value={selectedEvent.description} />
            {selectedEvent.user && <Def label="User" value={selectedEvent.user} variant="id" />}
          </div>

          <Section label="Endpoint">
            <div className="defs">
              <Def label="Hostname" value={selectedEvent.hostname || 'N/A'} variant="host" />
              <Def label="IP address" value={selectedEvent.ip_address || 'N/A'} />
            </div>
          </Section>

          {selectedEvent.parsed_data && Object.keys(selectedEvent.parsed_data).length > 0 && (
            <Section label="Parsed data">
              <pre className="code">{JSON.stringify(selectedEvent.parsed_data, null, 2)}</pre>
            </Section>
          )}

          {selectedEvent.raw_log && (
            <Section label="Raw log">
              <pre className="code">{selectedEvent.raw_log}</pre>
            </Section>
          )}
        </SlideOver>
      )}

      {/* ── Alert detail ─────────────────────────────────────────────────── */}
      {selectedAlert && (
        <SlideOver
          title="Alert detail"
          subtitle={selectedAlert.title}
          icon={
            <ShieldAlert
              size={16}
              color={selectedAlert.status === 'open' ? 'var(--sev-critical)' : 'var(--sev-info)'}
            />
          }
          onClose={() => setSelectedAlert(null)}
          footer={
            <>
              {selectedAlert.status === 'open' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => updateAlert(selectedAlert.id, 'acknowledged')}
                >
                  Acknowledge
                </button>
              )}
              {selectedAlert.status !== 'closed' && (
                <button
                  type="button"
                  className="btn btn--success"
                  onClick={() => updateAlert(selectedAlert.id, 'closed')}
                >
                  Close alert
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedAlert(null)}>
                Dismiss
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge className={statusClass(selectedAlert.status)}>{selectedAlert.status}</Badge>
            <Badge className={severityMeta(selectedAlert.severity).badge}>
              {selectedAlert.severity}
            </Badge>
          </div>

          <div className="defs">
            <Def label="Alert ID" value={selectedAlert.id} variant="id" />
            <Def label="Rule ID" value={selectedAlert.rule_id || '—'} variant="host" />
            <Def label="Created" value={absoluteTime(selectedAlert.created_at)} />
            <Def label="Updated" value={absoluteTime(selectedAlert.updated_at)} />
          </div>

          {selectedAlert.description && (
            <Section label="Description">
              <pre className="code" style={{ fontFamily: 'var(--font)', fontSize: 12.5 }}>
                {selectedAlert.description}
              </pre>
            </Section>
          )}

          <Section label="Related event">
            <div className="defs">
              <Def label="Event ID" value={selectedAlert.event_id || 'N/A'} variant="id" />
              <Def label="Hostname" value={selectedAlert.hostname || 'N/A'} variant="host" />
              <Def label="IP address" value={selectedAlert.ip_address || 'N/A'} />
              {selectedAlert.event_description && (
                <Def label="Event" value={selectedAlert.event_description} />
              )}
            </div>
          </Section>

          {selectedAlert.notes && (
            <Section label="Notes">
              <p style={{ fontSize: 12.5 }}>{selectedAlert.notes}</p>
            </Section>
          )}
        </SlideOver>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setView}
        events={events}
        alerts={alerts}
        endpoints={endpoints}
        onSelectEvent={openEventFromPalette}
        onSelectAlert={openAlertFromPalette}
      />

      {toast && (
        <div className={`toast ${toast.tone === 'error' ? 'toast--error' : 'toast--ok'}`} role="status">
          {toast.tone === 'error'
            ? <AlertTriangle size={14} />
            : <CheckCircle size={14} color="var(--sev-info)" />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default MiniSIEM;
