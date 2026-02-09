'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, AlertTriangle, Activity, Eye, Database, Network, CheckCircle, Clock, TrendingUp, Server, Cpu, Wifi, WifiOff, RefreshCw, Zap, Search, X } from 'lucide-react';
import siemApi from './api/siemApi';
import { useWebSocket, ConnectionState } from './hooks/useWebSocket';

// ── Inline SVG Chart Components ─────────────────────────────────────────────

const Sparkline = ({ data, color = '#22d3ee', width = 120, height = 32 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#sp-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const DonutChart = ({ segments, size = 80, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const rot = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(${rot} ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        );
      })}
    </svg>
  );
};

const MiniBarChart = ({ data, width = 160, height = 48 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const barW = Math.max(4, (width / data.length) - 3);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / max) * (height - 4));
        const x = i * (barW + 3) + 1;
        return (
          <rect
            key={i}
            x={x}
            y={height - barH - 2}
            width={barW}
            height={barH}
            rx={2}
            fill={d.color || '#22d3ee'}
            opacity={0.85}
            style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
          />
        );
      })}
    </svg>
  );
};

// ── Color tokens ────────────────────────────────────────────────────────────

const c = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceHover: '#1c2333',
  border: '#21262d',
  text: '#e6edf3',
  textMuted: '#7d8590',
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  accent: '#3b82f6',
};

const card = {
  background: c.surface,
  border: `1px solid ${c.border}`,
  borderRadius: '12px',
  padding: '20px',
};

// ── Main Component ──────────────────────────────────────────────────────────

const MiniSIEM = () => {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState({ total: 0, bySeverity: {}, byType: {} });
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // WebSocket handlers
  const handleEventMessage = useCallback((message) => {
    if (message.type === 'new_events' || message.type === 'new_event') {
      const newEvents = message.events || [message.event];
      setEvents(prev => [...newEvents, ...prev].slice(0, 100));
    }
  }, []);

  const handleAlertMessage = useCallback((message) => {
    if (message.type === 'new_alerts') {
      setAlerts(prev => [...message.alerts, ...prev].slice(0, 50));
      setOpenAlertCount(prev => prev + message.alerts.length);
    }
  }, []);

  const handleEndpointMessage = useCallback((message) => {
    if (message.type === 'heartbeat') {
      setEndpoints(prev => prev.map(ep =>
        ep.id === message.endpoint_id
          ? { ...ep, status: 'healthy', last_seen: message.timestamp }
          : ep
      ));
    }
  }, []);

  const wsChannels = useMemo(() => ['events', 'alerts', 'endpoints'], []);

  const { connectionState, isConnected } = useWebSocket({
    channels: wsChannels,
    onEvent: handleEventMessage,
    onAlert: handleAlertMessage,
    onEndpoint: handleEndpointMessage,
    autoReconnect: true
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, alertsRes, endpointsRes, rulesRes, statsRes] = await Promise.all([
        siemApi.getEvents({ limit: 100 }),
        siemApi.getAlerts({ limit: 50 }),
        siemApi.getEndpoints(),
        siemApi.getRules(),
        siemApi.getEventStats()
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
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      siemApi.getEventStats().then(setStats).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const generateTestEvents = async () => {
    try {
      await siemApi.ingestTestEvents();
    } catch (err) {
      console.error('Failed to generate test events:', err);
    }
  };

  const closeAlert = async (alertId) => {
    try {
      await siemApi.updateAlertStatus(alertId, 'closed');
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'closed' } : a));
      setOpenAlertCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to close alert:', err);
    }
  };

  const searchEvents = async () => {
    if (!searchQuery && !severityFilter) {
      setFilteredEvents([]);
      setIsSearching(false);
      return;
    }
    try {
      setIsSearching(true);
      const result = await siemApi.getEvents({
        limit: 500,
        search: searchQuery || undefined,
        severity: severityFilter || undefined
      });
      setFilteredEvents(result.events || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSeverityFilter('');
    setFilteredEvents([]);
    setIsSearching(false);
  };

  const displayStats = {
    total: stats.total || events.length,
    critical: stats.bySeverity?.critical || events.filter(e => e.severity === 'critical').length,
    warning: stats.bySeverity?.warning || events.filter(e => e.severity === 'warning').length,
    info: stats.bySeverity?.info || events.filter(e => e.severity === 'info').length,
    openAlerts: openAlertCount
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return c.danger;
      case 'warning': return c.warning;
      case 'info': return c.success;
      default: return c.textMuted;
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'critical': return 'rgba(239,68,68,0.1)';
      case 'warning': return 'rgba(245,158,11,0.1)';
      case 'info': return 'rgba(34,197,94,0.1)';
      default: return 'rgba(125,133,144,0.1)';
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  // Sparkline data from events timeline
  const sparkData = useMemo(() => {
    const buckets = Array(12).fill(0);
    events.forEach(e => {
      const mins = (Date.now() - new Date(e.timestamp).getTime()) / 60000;
      const idx = Math.min(11, Math.floor(mins / 5));
      buckets[11 - idx]++;
    });
    return buckets;
  }, [events]);

  const severityDistribution = useMemo(() => [
    { value: displayStats.critical, color: c.danger },
    { value: displayStats.warning, color: c.warning },
    { value: displayStats.info, color: c.success },
  ], [displayStats.critical, displayStats.warning, displayStats.info]);

  const tabs = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard' },
    { id: 'events', icon: Database, label: 'Events' },
    { id: 'alerts', icon: AlertTriangle, label: `Alerts` },
    { id: 'endpoints', icon: Server, label: `Endpoints` },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics' }
  ];

  // ── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: c.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: c.primary,
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', fontSize: '15px', color: c.textMuted }}>Connecting to SIEM Backend...</p>
          <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
        </div>
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────────
  if (error && events.length === 0) {
    return (
      <div style={{
        minHeight: '100vh', background: c.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '440px', padding: '40px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(239,68,68,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <AlertTriangle size={28} color={c.danger} />
          </div>
          <h2 style={{ color: c.text, fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Connection Error</h2>
          <p style={{ color: c.textMuted, marginBottom: '20px', fontSize: '14px', lineHeight: 1.5 }}>{error}</p>
          <p style={{ color: c.textMuted, fontSize: '13px', marginBottom: '24px' }}>
            Make sure the backend server is running:<br />
            <code style={{ color: c.primary, background: 'rgba(34,211,238,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
              cd backend && npm install && npm start
            </code>
          </p>
          <button
            onClick={fetchData}
            style={{
              padding: '10px 24px', background: 'rgba(34,211,238,0.1)',
              border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
              color: c.primary, cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: c.bg, color: c.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .siem-row { transition: background 0.15s ease; cursor: pointer; }
        .siem-row:hover { background: ${c.surfaceHover} !important; }
        .siem-tab { transition: all 0.2s ease; }
        .siem-tab:hover { color: ${c.text} !important; }
        .siem-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .siem-card:hover { border-color: ${c.primary}40 !important; box-shadow: 0 0 0 1px ${c.primary}20; }
        .siem-btn { transition: all 0.15s ease; }
        .siem-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .siem-input:focus { border-color: ${c.primary} !important; outline: none; box-shadow: 0 0 0 2px ${c.primary}30; }
      `}</style>

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header style={{
        background: c.surface, borderBottom: `1px solid ${c.border}`,
        padding: '0 32px', height: '60px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '8px',
            background: `linear-gradient(135deg, ${c.primary}, ${c.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px', color: c.text }}>
            Yetinel
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Connection Status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '20px',
            background: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {isConnected
              ? <Wifi size={13} color={c.success} />
              : <WifiOff size={13} color={c.danger} />
            }
            <span style={{
              fontSize: '12px', fontWeight: 500,
              color: isConnected ? c.success : c.danger,
            }}>
              {connectionState === ConnectionState.CONNECTING ? 'Connecting...' : isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button className="siem-btn" onClick={generateTestEvents} style={{
            padding: '7px 14px', background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px',
            color: c.accent, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Zap size={14} /> Test Events
          </button>

          <button className="siem-btn" onClick={fetchData} style={{
            padding: '7px 14px', background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
            color: c.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {/* ─── Tab Navigation ──────────────────────────────────────────── */}
      <nav style={{
        padding: '0 32px', background: c.surface,
        borderBottom: `1px solid ${c.border}`, display: 'flex', gap: '2px',
      }}>
        {tabs.map(tab => (
          <button key={tab.id} className="siem-tab" onClick={() => setSelectedTab(tab.id)} style={{
            padding: '12px 20px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${selectedTab === tab.id ? c.primary : 'transparent'}`,
            color: selectedTab === tab.id ? c.text : c.textMuted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: selectedTab === tab.id ? 600 : 400,
          }}>
            <tab.icon size={15} />
            {tab.label}
            {tab.id === 'alerts' && openAlertCount > 0 && (
              <span style={{
                background: c.danger, color: '#fff', fontSize: '10px', fontWeight: 700,
                padding: '1px 6px', borderRadius: '10px', minWidth: '18px', textAlign: 'center',
              }}>{openAlertCount}</span>
            )}
            {tab.id === 'endpoints' && endpoints.length > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.08)', color: c.textMuted,
                fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px',
              }}>{endpoints.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <main style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Dashboard ──────────────────────────────────────────────── */}
        {selectedTab === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total Events', value: displayStats.total, icon: Database, color: c.primary, tab: 'events' },
                { label: 'Critical', value: displayStats.critical, icon: AlertTriangle, color: c.danger, tab: 'events' },
                { label: 'Warnings', value: displayStats.warning, icon: Eye, color: c.warning, tab: 'events' },
                { label: 'Open Alerts', value: displayStats.openAlerts, icon: Shield, color: c.danger, tab: 'alerts' },
                { label: 'Info', value: displayStats.info, icon: CheckCircle, color: c.success, tab: 'events' },
              ].map((stat, idx) => (
                <div key={idx} className="siem-card" onClick={() => setSelectedTab(stat.tab)} style={{
                  ...card, padding: '16px 20px', cursor: 'pointer',
                  animation: `fadeIn 0.3s ease ${idx * 0.05}s backwards`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: 500 }}>{stat.label}</span>
                    <stat.icon size={16} color={stat.color} style={{ opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: c.text, lineHeight: 1 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="siem-card" style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: c.text }}>Event Timeline</span>
                  <span style={{ fontSize: '11px', color: c.textMuted }}>Last 60 min</span>
                </div>
                <Sparkline data={sparkData} color={c.primary} width={320} height={48} />
              </div>

              <div className="siem-card" style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px' }}>
                <DonutChart segments={severityDistribution} size={72} strokeWidth={10} />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: c.text, display: 'block', marginBottom: '8px' }}>Severity Split</span>
                  {[
                    { label: 'Critical', value: displayStats.critical, color: c.danger },
                    { label: 'Warning', value: displayStats.warning, color: c.warning },
                    { label: 'Info', value: displayStats.info, color: c.success },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                      <span style={{ fontSize: '12px', color: c.textMuted }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: c.text, marginLeft: 'auto' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="siem-card" style={card}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: c.text, display: 'block', marginBottom: '12px' }}>Events by Type</span>
                <MiniBarChart
                  data={Object.entries(stats.byType || {}).map(([, v]) => ({ value: v, color: c.primary }))}
                  width={260}
                  height={48}
                />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(stats.byType || {}).slice(0, 4).map(([type, count]) => (
                    <span key={type} style={{ fontSize: '11px', color: c.textMuted }}>
                      {type.replace('_', ' ')}: <span style={{ color: c.text, fontWeight: 600 }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Critical Events */}
            <div style={card}>
              <h2 onClick={() => setSelectedTab('events')} style={{
                margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: c.text,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              }}>
                <AlertTriangle size={16} color={c.danger} />
                Recent Critical Events
              </h2>

              {events.filter(e => e.severity === 'critical').length === 0 ? (
                <p style={{ color: c.textMuted, textAlign: 'center', padding: '24px', fontSize: '13px' }}>
                  No critical events detected
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.filter(e => e.severity === 'critical').slice(0, 5).map(event => (
                    <div key={event.id} className="siem-row" onClick={() => setSelectedEvent(event)} style={{
                      background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)',
                      borderRadius: '8px', padding: '12px 16px',
                      display: 'grid', gridTemplateColumns: '140px 140px 1fr 80px',
                      gap: '12px', alignItems: 'center', fontSize: '13px',
                    }}>
                      <span style={{ color: c.textMuted, fontSize: '12px' }}>{formatTimestamp(event.timestamp)}</span>
                      <span style={{ color: c.primary, fontWeight: 500 }}>{event.hostname || 'unknown'}</span>
                      <span style={{ color: c.text }}>{event.description}</span>
                      <span style={{
                        background: 'rgba(239,68,68,0.15)', color: c.danger,
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
                        fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                      }}>Critical</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Events Tab ─────────────────────────────────────────────── */}
        {selectedTab === 'events' && (
          <div style={{ ...card, animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '16px', flexWrap: 'wrap', gap: '12px',
            }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: c.text }}>
                Security Event Log ({isSearching ? filteredEvents.length : events.length} events)
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
                  <input
                    className="siem-input"
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchEvents()}
                    style={{
                      padding: '8px 10px 8px 32px', background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${c.border}`, borderRadius: '8px',
                      color: c.text, fontSize: '13px', width: '220px',
                    }}
                  />
                </div>
                <select
                  className="siem-input"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  style={{
                    padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${c.border}`, borderRadius: '8px',
                    color: c.text, fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
                <button className="siem-btn" onClick={searchEvents} style={{
                  padding: '8px 14px', background: 'rgba(34,211,238,0.1)',
                  border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px',
                  color: c.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Search size={13} /> Search
                </button>
                {isSearching && (
                  <button className="siem-btn" onClick={clearSearch} style={{
                    padding: '8px 14px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                    color: c.danger, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  }}>Clear</button>
                )}
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '160px 140px 1fr 90px 80px',
              gap: '12px', padding: '10px 16px', background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px', marginBottom: '8px', fontSize: '11px', fontWeight: 600,
              color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              <span>Timestamp</span>
              <span>Hostname</span>
              <span>Description</span>
              <span>Source</span>
              <span>Severity</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '600px', overflowY: 'auto' }}>
              {(isSearching ? filteredEvents : events).length === 0 ? (
                <p style={{ color: c.textMuted, textAlign: 'center', padding: '40px', fontSize: '13px' }}>
                  {isSearching ? 'No events match your search criteria.' : 'No events recorded. Start an agent or generate test events.'}
                </p>
              ) : (
                (isSearching ? filteredEvents : events).map(event => (
                  <div key={event.id} className="siem-row" onClick={() => setSelectedEvent(event)} style={{
                    display: 'grid', gridTemplateColumns: '160px 140px 1fr 90px 80px',
                    gap: '12px', padding: '10px 16px', borderRadius: '6px', fontSize: '13px',
                    alignItems: 'center', borderLeft: `3px solid ${getSeverityColor(event.severity)}20`,
                  }}>
                    <span style={{ color: c.textMuted, fontSize: '12px' }}>{formatTimestamp(event.timestamp)}</span>
                    <span style={{ color: c.primary, fontWeight: 500 }}>{event.hostname || 'unknown'}</span>
                    <span style={{ color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.description}
                    </span>
                    <span style={{ color: c.textMuted, fontSize: '11px', textTransform: 'capitalize' }}>{event.source}</span>
                    <span style={{
                      background: getSeverityBg(event.severity), color: getSeverityColor(event.severity),
                      padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      textAlign: 'center', textTransform: 'capitalize',
                    }}>{event.severity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Alerts Tab ─────────────────────────────────────────────── */}
        {selectedTab === 'alerts' && (
          <div style={{ ...card, animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{
              margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: c.text,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertTriangle size={16} color={c.warning} />
              Security Alerts ({alerts.length})
            </h2>

            {alerts.length === 0 ? (
              <p style={{ color: c.textMuted, textAlign: 'center', padding: '40px', fontSize: '13px' }}>
                No alerts generated. Detection rules will create alerts when threats are detected.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alerts.map(alert => (
                  <div key={alert.id} className="siem-row" onClick={() => setSelectedAlert(alert)} style={{
                    background: alert.status === 'open' ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.03)',
                    border: `1px solid ${alert.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                    borderRadius: '10px', padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: alert.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                          color: alert.status === 'open' ? c.danger : c.success,
                        }}>{alert.status}</span>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: getSeverityBg(alert.severity),
                          color: getSeverityColor(alert.severity),
                        }}>{alert.severity}</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: c.text, fontWeight: 500 }}>{alert.title}</p>
                      <p style={{ margin: '2px 0', fontSize: '12px', color: c.textMuted }}>{alert.description}</p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: c.textMuted }}>
                        <span>Hostname: <span style={{ color: c.primary }}>{alert.hostname || 'N/A'}</span></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} /> {formatTimestamp(alert.created_at)}
                        </span>
                      </div>
                    </div>
                    {alert.status === 'open' && (
                      <button className="siem-btn" onClick={(e) => { e.stopPropagation(); closeAlert(alert.id); }} style={{
                        padding: '7px 14px', background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px',
                        color: c.success, cursor: 'pointer', fontSize: '12px', fontWeight: 500, marginLeft: '16px',
                      }}>Close</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Endpoints Tab ──────────────────────────────────────────── */}
        {selectedTab === 'endpoints' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color={c.accent} />
                Monitored Endpoints ({endpoints.length})
              </h2>
            </div>

            {endpoints.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
                <p style={{ color: c.textMuted, marginBottom: '16px', fontSize: '14px' }}>
                  No endpoints registered. Start an agent to begin monitoring.
                </p>
                <div style={{ color: c.textMuted, fontSize: '13px' }}>
                  <p>Linux: <code style={{ color: c.primary, background: 'rgba(34,211,238,0.08)', padding: '2px 6px', borderRadius: '4px' }}>sudo node agents/linux/agent.js</code></p>
                  <p>Windows: <code style={{ color: c.primary, background: 'rgba(34,211,238,0.08)', padding: '2px 6px', borderRadius: '4px' }}>{'agents\\windows\\agent.ps1'}</code></p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {endpoints.map(endpoint => (
                  <div key={endpoint.id} className="siem-card" style={{
                    ...card,
                    borderLeft: `3px solid ${
                      endpoint.status === 'healthy' ? c.success
                      : endpoint.status === 'offline' ? c.textMuted
                      : c.danger
                    }`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: c.text }}>{endpoint.hostname}</span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: endpoint.status === 'healthy' ? 'rgba(34,197,94,0.1)'
                          : endpoint.status === 'offline' ? 'rgba(125,133,144,0.1)' : 'rgba(239,68,68,0.1)',
                        color: endpoint.status === 'healthy' ? c.success
                          : endpoint.status === 'offline' ? c.textMuted : c.danger,
                      }}>{endpoint.status}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: c.textMuted }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Network size={13} /> {endpoint.ip_address || 'N/A'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={13} /> {endpoint.os} {endpoint.os_version}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} /> Last seen: {formatTimestamp(endpoint.last_seen)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ──────────────────────────────────────────── */}
        {selectedTab === 'analytics' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="siem-card" style={card}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: c.text }}>Events by Type</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(stats.byType || {}).map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span style={{ color: c.textMuted, textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                        <span style={{ color: c.accent, fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min((count / Math.max(...Object.values(stats.byType || {}), 1)) * 100, 100)}%`,
                          height: '100%', background: c.accent, borderRadius: '3px', transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.byType || {}).length === 0 && (
                    <p style={{ color: c.textMuted, textAlign: 'center', fontSize: '13px' }}>No data available</p>
                  )}
                </div>
              </div>

              <div className="siem-card" style={card}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: c.text }}>Events by Severity</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['critical', 'warning', 'info'].map(severity => {
                    const count = stats.bySeverity?.[severity] || 0;
                    const maxCount = Math.max(...Object.values(stats.bySeverity || {}), 1);
                    return (
                      <div key={severity}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                          <span style={{ color: getSeverityColor(severity), textTransform: 'capitalize' }}>{severity}</span>
                          <span style={{ color: getSeverityColor(severity), fontWeight: 600 }}>{count}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(count / maxCount) * 100}%`, height: '100%',
                            background: getSeverityColor(severity), borderRadius: '3px', transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="siem-card" style={card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: c.text }}>Detection Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {rules.map(rule => (
                  <div key={rule.id} style={{
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.border}`,
                    borderRadius: '8px', padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: c.text, fontWeight: 500 }}>{rule.name}</span>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: rule.enabled ? c.success : c.textMuted,
                      }} />
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: rule.enabled ? getSeverityColor(rule.severity) : c.textMuted }}>
                      {rule.match_count || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px' }}>matches</div>
                  </div>
                ))}
                {rules.length === 0 && (
                  <p style={{ color: c.textMuted, gridColumn: '1 / -1', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
                    No detection rules loaded
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Event Detail Modal ────────────────────────────────────────── */}
      {selectedEvent && (
        <div onClick={() => setSelectedEvent(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.surface, border: `1px solid ${c.border}`, borderRadius: '16px',
            padding: '28px', maxWidth: '620px', width: '90%', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: c.text }}>Event Details</h2>
              <button onClick={() => setSelectedEvent(null)} style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px',
                padding: '6px', cursor: 'pointer', display: 'flex', color: c.textMuted,
              }}><X size={18} /></button>
            </div>

            <div style={{
              display: 'inline-block', padding: '4px 10px', borderRadius: '4px',
              background: getSeverityBg(selectedEvent.severity),
              color: getSeverityColor(selectedEvent.severity),
              fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '16px',
            }}>{selectedEvent.severity}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              {[
                ['Event ID', selectedEvent.id, c.accent],
                ['Timestamp', formatTimestamp(selectedEvent.timestamp), null],
                ['Source', selectedEvent.source, null],
                ['Type', selectedEvent.event_type?.replace('_', ' '), null],
                ['Description', selectedEvent.description, null],
                ...(selectedEvent.user ? [['User', selectedEvent.user, c.accent]] : []),
              ].map(([label, val, clr]) => (
                <div key={label} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', flexShrink: 0, color: c.textMuted }}>{label}</span>
                  <span style={{ color: clr || c.text, fontWeight: clr ? 500 : 400, wordBreak: 'break-all' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Endpoint</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {[
                  ['Hostname', selectedEvent.hostname || 'N/A', c.primary],
                  ['IP Address', selectedEvent.ip_address || 'N/A', null],
                ].map(([label, val, clr]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ width: '100px', color: c.textMuted }}>{label}</span>
                    <span style={{ color: clr || c.text, fontWeight: clr ? 500 : 400 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedEvent.parsed_data && Object.keys(selectedEvent.parsed_data).length > 0 && (
              <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Parsed Data</span>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px',
                  overflow: 'auto', fontSize: '11px', color: c.text, margin: 0,
                }}>{JSON.stringify(selectedEvent.parsed_data, null, 2)}</pre>
              </div>
            )}

            {selectedEvent.raw_log && (
              <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Raw Log</span>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px',
                  overflow: 'auto', fontSize: '11px', color: c.textMuted, whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all', margin: 0,
                }}>{selectedEvent.raw_log}</pre>
              </div>
            )}

            <button className="siem-btn" onClick={() => setSelectedEvent(null)} style={{
              marginTop: '20px', padding: '10px', width: '100%',
              background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: '8px', color: c.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            }}>Close</button>
          </div>
        </div>
      )}

      {/* ─── Alert Detail Modal ────────────────────────────────────────── */}
      {selectedAlert && (
        <div onClick={() => setSelectedAlert(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.surface, border: `1px solid ${c.border}`, borderRadius: '16px',
            padding: '28px', maxWidth: '620px', width: '90%', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color={selectedAlert.status === 'open' ? c.danger : c.success} />
                Alert Details
              </h2>
              <button onClick={() => setSelectedAlert(null)} style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px',
                padding: '6px', cursor: 'pointer', display: 'flex', color: c.textMuted,
              }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <span style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase',
                background: selectedAlert.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                color: selectedAlert.status === 'open' ? c.danger : c.success,
              }}>{selectedAlert.status}</span>
              <span style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase',
                background: getSeverityBg(selectedAlert.severity),
                color: getSeverityColor(selectedAlert.severity),
              }}>{selectedAlert.severity}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              {[
                ['Alert ID', selectedAlert.id, c.accent],
                ['Title', selectedAlert.title, null],
                ['Rule ID', selectedAlert.rule_id, c.warning],
                ['Created', formatTimestamp(selectedAlert.created_at), null],
                ['Updated', formatTimestamp(selectedAlert.updated_at), null],
              ].map(([label, val, clr]) => (
                <div key={label} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', flexShrink: 0, color: c.textMuted }}>{label}</span>
                  <span style={{ color: clr || c.text, fontWeight: clr ? 500 : 400, wordBreak: 'break-all' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Description</span>
              <pre style={{
                background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px',
                overflow: 'auto', fontSize: '12px', color: c.text, whiteSpace: 'pre-wrap', margin: 0,
              }}>{selectedAlert.description}</pre>
            </div>

            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Related Event</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {[
                  ['Event ID', selectedAlert.event_id || 'N/A', c.accent],
                  ['Hostname', selectedAlert.hostname || 'N/A', c.primary],
                  ['IP Address', selectedAlert.ip_address || 'N/A', null],
                  ...(selectedAlert.event_description ? [['Event', selectedAlert.event_description, null]] : []),
                ].map(([label, val, clr]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ width: '100px', color: c.textMuted }}>{label}</span>
                    <span style={{ color: clr || c.text, fontWeight: clr ? 500 : 400 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedAlert.notes && (
              <div style={{ borderTop: `1px solid ${c.border}`, marginTop: '16px', paddingTop: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: c.textMuted, marginBottom: '8px', display: 'block' }}>Notes</span>
                <p style={{ color: c.text, margin: 0, fontSize: '13px' }}>{selectedAlert.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {selectedAlert.status === 'open' && (
                <button className="siem-btn" onClick={() => {
                  closeAlert(selectedAlert.id);
                  setSelectedAlert({ ...selectedAlert, status: 'closed' });
                }} style={{
                  flex: 1, padding: '10px', background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px',
                  color: c.success, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                }}>Close Alert</button>
              )}
              <button className="siem-btn" onClick={() => setSelectedAlert(null)} style={{
                flex: 1, padding: '10px', background: 'rgba(125,133,144,0.1)',
                border: `1px solid ${c.border}`, borderRadius: '8px',
                color: c.textMuted, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniSIEM;

