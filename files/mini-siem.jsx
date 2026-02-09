'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, AlertTriangle, Activity, Eye, Database, Network, CheckCircle, Clock, TrendingUp, Server, Cpu, X } from 'lucide-react';

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
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
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

const MiniBarChart = ({ data, barColor = '#22d3ee', width = 160, height = 48 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const barW = Math.max(4, (width / data.length) - 3);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 4);
        const x = i * (barW + 3) + 1;
        return (
          <rect
            key={i}
            x={x}
            y={height - barH - 2}
            width={barW}
            height={barH}
            rx={2}
            fill={d.color || barColor}
            opacity={0.85}
            style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
          />
        );
      })}
    </svg>
  );
};

// ── Mock data generators ────────────────────────────────────────────────────

const generateEndpoint = (id) => ({
  id: `EP-${String(id).padStart(4, '0')}`,
  hostname: ['web-server-01', 'db-prod-02', 'app-node-03', 'jump-host-04', 'dev-workstation-05'][id % 5],
  ip: `192.168.${Math.floor(id / 256)}.${id % 256}`,
  os: ['Windows 10', 'Ubuntu 22.04', 'CentOS 7', 'macOS 13'][id % 4],
  status: Math.random() > 0.1 ? 'healthy' : 'compromised',
  lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString()
});

const eventTypes = [
  { type: 'authentication', severity: 'info', description: 'Successful login' },
  { type: 'authentication', severity: 'warning', description: 'Failed login attempt' },
  { type: 'network', severity: 'critical', description: 'Suspicious outbound connection' },
  { type: 'file_integrity', severity: 'warning', description: 'Critical file modified' },
  { type: 'process', severity: 'critical', description: 'Unauthorized process detected' },
  { type: 'malware', severity: 'critical', description: 'Malware signature detected' },
  { type: 'privilege', severity: 'warning', description: 'Privilege escalation attempt' },
  { type: 'data_exfil', severity: 'critical', description: 'Large data transfer detected' },
];

const generateEvent = (id) => {
  const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  return {
    id: `EVT-${Date.now()}-${id}`,
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    endpoint: generateEndpoint(Math.floor(Math.random() * 5)),
    ...event,
    details: `Event detected on ${event.type} subsystem`,
    user: ['admin', 'root', 'user1', 'service_account'][Math.floor(Math.random() * 4)]
  };
};

// ── Shared styles ───────────────────────────────────────────────────────────

const colors = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceHover: '#1c2333',
  border: '#21262d',
  borderSubtle: 'rgba(99,110,123,0.25)',
  text: '#e6edf3',
  textMuted: '#7d8590',
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  accent: '#3b82f6',
};

const card = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  padding: '20px',
};

// ── Main Component ──────────────────────────────────────────────────────────

const MiniSIEM = () => {
  const [events, setEvents] = useState(Array.from({ length: 20 }, (_, i) => generateEvent(i)));
  const [alerts, setAlerts] = useState([]);
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      const newEvent = generateEvent(Date.now());
      setEvents(prev => [newEvent, ...prev].slice(0, 100));
      if (newEvent.severity === 'critical') {
        setAlerts(prev => [{
          id: `ALT-${Date.now()}`,
          event: newEvent,
          status: 'open',
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 50));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isMonitoring]);

  const stats = {
    total: events.length,
    critical: events.filter(e => e.severity === 'critical').length,
    warning: events.filter(e => e.severity === 'warning').length,
    info: events.filter(e => e.severity === 'info').length,
    openAlerts: alerts.filter(a => a.status === 'open').length
  };

  // Generate sparkline data from events timeline
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
    { value: stats.critical, color: colors.danger },
    { value: stats.warning, color: colors.warning },
    { value: stats.info, color: colors.success },
  ], [stats.critical, stats.warning, stats.info]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return colors.danger;
      case 'warning': return colors.warning;
      case 'info': return colors.success;
      default: return colors.textMuted;
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

  const closeAlert = (alertId) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'closed' } : a
    ));
  };

  const tabs = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard' },
    { id: 'events', icon: Database, label: 'Events' },
    { id: 'alerts', icon: AlertTriangle, label: 'Alerts' },
    { id: 'endpoints', icon: Server, label: 'Endpoints' },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      color: colors.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .siem-row { transition: background 0.15s ease; cursor: pointer; }
        .siem-row:hover { background: ${colors.surfaceHover} !important; }
        .siem-tab { transition: all 0.2s ease; position: relative; }
        .siem-tab:hover { color: ${colors.text} !important; }
        .siem-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .siem-card:hover { border-color: ${colors.primary}40 !important; box-shadow: 0 0 0 1px ${colors.primary}20; }
        .siem-btn { transition: all 0.15s ease; }
        .siem-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
      `}</style>

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <header style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px', color: colors.text }}>
            RookSIEM
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: isMonitoring ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isMonitoring ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: isMonitoring ? colors.success : colors.danger,
              boxShadow: isMonitoring ? `0 0 6px ${colors.success}` : 'none',
            }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: isMonitoring ? colors.success : colors.danger }}>
              {isMonitoring ? 'Live' : 'Paused'}
            </span>
          </div>

          <button
            className="siem-btn"
            onClick={() => setIsMonitoring(!isMonitoring)}
            style={{
              padding: '7px 16px',
              background: isMonitoring ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${isMonitoring ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              borderRadius: '8px',
              color: isMonitoring ? colors.danger : colors.success,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isMonitoring ? 'Pause' : 'Resume'}
          </button>
        </div>
      </header>

      {/* ─── Tab Navigation ────────────────────────────────────────────── */}
      <nav style={{
        padding: '0 32px',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '2px',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className="siem-tab"
            onClick={() => setSelectedTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${selectedTab === tab.id ? colors.primary : 'transparent'}`,
              color: selectedTab === tab.id ? colors.text : colors.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: selectedTab === tab.id ? 600 : 400,
            }}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.id === 'alerts' && stats.openAlerts > 0 && (
              <span style={{
                background: colors.danger,
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
                minWidth: '18px',
                textAlign: 'center',
              }}>
                {stats.openAlerts}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ─── Main Content ──────────────────────────────────────────────── */}
      <main style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Dashboard Tab ──────────────────────────────────────────── */}
        {selectedTab === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Stat Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total Events', value: stats.total, icon: Database, color: colors.primary },
                { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: colors.danger },
                { label: 'Warnings', value: stats.warning, icon: Eye, color: colors.warning },
                { label: 'Open Alerts', value: stats.openAlerts, icon: Shield, color: colors.danger },
                { label: 'Info', value: stats.info, icon: CheckCircle, color: colors.success },
              ].map((stat, idx) => (
                <div key={idx} className="siem-card" style={{
                  ...card,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  animation: `fadeIn 0.3s ease ${idx * 0.05}s backwards`,
                }} onClick={() => setSelectedTab(stat.label === 'Open Alerts' ? 'alerts' : 'events')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: colors.textMuted, fontWeight: 500 }}>{stat.label}</span>
                    <stat.icon size={16} color={stat.color} style={{ opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Event Timeline Sparkline */}
              <div className="siem-card" style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>Event Timeline</span>
                  <span style={{ fontSize: '11px', color: colors.textMuted }}>Last 60 min</span>
                </div>
                <Sparkline data={sparkData} color={colors.primary} width={320} height={48} />
              </div>

              {/* Severity Donut */}
              <div className="siem-card" style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px' }}>
                <DonutChart segments={severityDistribution} size={72} strokeWidth={10} />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, display: 'block', marginBottom: '8px' }}>Severity</span>
                  {[
                    { label: 'Critical', value: stats.critical, color: colors.danger },
                    { label: 'Warning', value: stats.warning, color: colors.warning },
                    { label: 'Info', value: stats.info, color: colors.success },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>{item.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: colors.text, marginLeft: 'auto' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Type Mini Bars */}
              <div className="siem-card" style={card}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text, display: 'block', marginBottom: '12px' }}>By Type</span>
                <MiniBarChart
                  data={Object.entries(
                    events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {})
                  ).map(([, v]) => ({ value: v, color: colors.primary }))}
                  width={260}
                  height={48}
                />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(
                    events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {})
                  ).slice(0, 4).map(([type, count]) => (
                    <span key={type} style={{ fontSize: '11px', color: colors.textMuted }}>
                      {type.replace('_', ' ')}: <span style={{ color: colors.text, fontWeight: 600 }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Critical Events */}
            <div style={card}>
              <h2 style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                fontWeight: 600,
                color: colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertTriangle size={16} color={colors.danger} />
                Recent Critical Events
              </h2>

              {events.filter(e => e.severity === 'critical').length === 0 ? (
                <p style={{ color: colors.textMuted, textAlign: 'center', padding: '24px', fontSize: '13px' }}>
                  No critical events detected
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.filter(e => e.severity === 'critical').slice(0, 5).map(event => (
                    <div
                      key={event.id}
                      className="siem-row"
                      onClick={() => setSelectedEvent(event)}
                      style={{
                        background: 'rgba(239,68,68,0.04)',
                        border: `1px solid rgba(239,68,68,0.12)`,
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'grid',
                        gridTemplateColumns: '130px 140px 1fr 80px',
                        gap: '12px',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span style={{ color: colors.primary, fontWeight: 500 }}>
                        {event.endpoint.hostname}
                      </span>
                      <span style={{ color: colors.text }}>{event.description}</span>
                      <span style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: colors.danger,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                      }}>
                        Critical
                      </span>
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
            <h2 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: colors.text }}>
              Security Event Log
            </h2>

            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '110px 130px 140px 1fr 100px 80px',
              gap: '12px',
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              marginBottom: '8px',
              fontSize: '11px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <span>Event ID</span>
              <span>Timestamp</span>
              <span>Endpoint</span>
              <span>Description</span>
              <span>Type</span>
              <span>Severity</span>
            </div>

            {/* Table Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '600px', overflowY: 'auto' }}>
              {events.map(event => (
                <div
                  key={event.id}
                  className="siem-row"
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 130px 140px 1fr 100px 80px',
                    gap: '12px',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    alignItems: 'center',
                    borderLeft: `3px solid ${getSeverityColor(event.severity)}20`,
                  }}
                >
                  <span style={{ color: colors.accent, fontWeight: 500, fontSize: '11px' }}>{event.id.slice(0, 16)}...</span>
                  <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: colors.primary, fontWeight: 500 }}>{event.endpoint.hostname}</span>
                  <span style={{ color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.description}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: '11px', textTransform: 'capitalize' }}>
                    {event.type.replace('_', ' ')}
                  </span>
                  <span style={{
                    background: getSeverityBg(event.severity),
                    color: getSeverityColor(event.severity),
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'center',
                    textTransform: 'capitalize',
                  }}>
                    {event.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Alerts Tab ─────────────────────────────────────────────── */}
        {selectedTab === 'alerts' && (
          <div style={{ ...card, animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertTriangle size={16} color={colors.warning} />
              Security Alerts
            </h2>

            {alerts.length === 0 ? (
              <p style={{ color: colors.textMuted, textAlign: 'center', padding: '40px', fontSize: '13px' }}>
                No alerts generated yet. Critical events will trigger alerts automatically.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alerts.slice(0, 20).map(alert => (
                  <div
                    key={alert.id}
                    style={{
                      background: alert.status === 'open' ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.03)',
                      border: `1px solid ${alert.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                      borderRadius: '10px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: alert.status === 'open' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                          color: alert.status === 'open' ? colors.danger : colors.success,
                        }}>
                          {alert.status}
                        </span>
                        <span style={{ fontSize: '12px', color: colors.textMuted }}>{alert.id}</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: colors.text, fontWeight: 500 }}>
                        {alert.event.description}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: colors.textMuted }}>
                        <span>
                          Endpoint: <span style={{ color: colors.primary }}>{alert.event.endpoint.hostname}</span>
                        </span>
                        <span>
                          User: <span style={{ color: colors.accent }}>{alert.event.user}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {alert.status === 'open' && (
                      <button
                        className="siem-btn"
                        onClick={() => closeAlert(alert.id)}
                        style={{
                          padding: '7px 14px',
                          background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: '6px',
                          color: colors.success,
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          marginLeft: '16px',
                        }}
                      >
                        Close
                      </button>
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
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color={colors.accent} />
                Monitored Endpoints
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 8 }, (_, i) => generateEndpoint(i)).map(endpoint => (
                <div key={endpoint.id} className="siem-card" style={{
                  ...card,
                  borderLeft: `3px solid ${endpoint.status === 'healthy' ? colors.success : colors.danger}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>{endpoint.hostname}</span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: endpoint.status === 'healthy' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: endpoint.status === 'healthy' ? colors.success : colors.danger,
                    }}>
                      {endpoint.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: colors.textMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Network size={13} /> {endpoint.ip}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Cpu size={13} /> {endpoint.os}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} /> ID: {endpoint.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Analytics Tab ──────────────────────────────────────────── */}
        {selectedTab === 'analytics' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Threat Distribution */}
              <div className="siem-card" style={card}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: colors.text }}>
                  Threat Distribution
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { type: 'Malware', count: 23, color: colors.danger },
                    { type: 'Network Anomaly', count: 18, color: colors.warning },
                    { type: 'Authentication', count: 45, color: colors.accent },
                    { type: 'Privilege Escalation', count: 12, color: colors.danger },
                    { type: 'Data Exfiltration', count: 8, color: colors.primary }
                  ].map(item => (
                    <div key={item.type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span style={{ color: colors.textMuted }}>{item.type}</span>
                        <span style={{ color: item.color, fontWeight: 600 }}>{item.count}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(item.count / 45) * 100}%`,
                          height: '100%',
                          background: item.color,
                          borderRadius: '3px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Targeted Endpoints */}
              <div className="siem-card" style={card}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: colors.text }}>
                  Top Targeted Endpoints
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const ep = generateEndpoint(i);
                    const eventCount = Math.floor(Math.random() * 50) + 10;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', color: colors.text, fontWeight: 500 }}>{ep.hostname}</div>
                          <div style={{ fontSize: '11px', color: colors.textMuted }}>{ep.ip}</div>
                        </div>
                        <span style={{
                          padding: '4px 10px',
                          background: 'rgba(239,68,68,0.1)',
                          borderRadius: '6px',
                          color: colors.danger,
                          fontWeight: 600,
                          fontSize: '12px',
                        }}>
                          {eventCount} events
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detection Rules */}
            <div className="siem-card" style={card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: colors.text }}>
                Detection Rules
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { name: 'Brute Force Detection', active: true, matches: 156 },
                  { name: 'Lateral Movement', active: true, matches: 23 },
                  { name: 'Data Exfil Pattern', active: true, matches: 8 },
                  { name: 'Malware Signature', active: true, matches: 45 },
                  { name: 'Port Scan Detection', active: false, matches: 0 },
                  { name: 'Privilege Abuse', active: true, matches: 34 }
                ].map((rule, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: colors.text, fontWeight: 500 }}>{rule.name}</span>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: rule.active ? colors.success : colors.textMuted,
                      }} />
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: rule.active ? colors.primary : colors.textMuted }}>
                      {rule.matches}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>matches today</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Event Detail Modal ────────────────────────────────────────── */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '560px',
              width: '90%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.text }}>
                Event Details
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  color: colors.textMuted,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '4px',
              background: getSeverityBg(selectedEvent.severity),
              color: getSeverityColor(selectedEvent.severity),
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}>
              {selectedEvent.severity}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              {[
                ['Event ID', selectedEvent.id, colors.accent],
                ['Timestamp', new Date(selectedEvent.timestamp).toLocaleString(), null],
                ['Type', selectedEvent.type.replace('_', ' '), null],
                ['Description', selectedEvent.description, null],
                ['User', selectedEvent.user, colors.accent],
              ].map(([label, val, clr]) => (
                <div key={label} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', flexShrink: 0, color: colors.textMuted }}>{label}</span>
                  <span style={{ color: clr || colors.text, fontWeight: clr ? 500 : 400, wordBreak: 'break-all' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: '16px', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px', display: 'block' }}>
                Endpoint
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', color: colors.textMuted }}>Hostname</span>
                  <span style={{ color: colors.primary, fontWeight: 500 }}>{selectedEvent.endpoint.hostname}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', color: colors.textMuted }}>IP Address</span>
                  <span style={{ color: colors.text }}>{selectedEvent.endpoint.ip}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '100px', color: colors.textMuted }}>OS</span>
                  <span style={{ color: colors.text }}>{selectedEvent.endpoint.os}</span>
                </div>
              </div>
            </div>

            <button
              className="siem-btn"
              onClick={() => setSelectedEvent(null)}
              style={{
                marginTop: '20px',
                padding: '10px',
                width: '100%',
                background: `rgba(34,211,238,0.1)`,
                border: `1px solid rgba(34,211,238,0.3)`,
                borderRadius: '8px',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniSIEM;

