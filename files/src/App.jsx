import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, AlertTriangle, Activity, Eye, Database, Network, CheckCircle, Clock, TrendingUp, Server, Cpu, Wifi, WifiOff, RefreshCw, Zap, Search } from 'lucide-react';
import siemApi from './api/siemApi';
import { useWebSocket, ConnectionState } from './hooks/useWebSocket';

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

  // Memoize channels to prevent WebSocket reconnection loops
  const wsChannels = useMemo(() => ['events', 'alerts', 'endpoints'], []);

  // WebSocket connection
  const {
    connectionState,
    isConnected,
    error: wsError
  } = useWebSocket({
    channels: wsChannels,
    onEvent: handleEventMessage,
    onAlert: handleAlertMessage,
    onEndpoint: handleEndpointMessage,
    autoReconnect: true
  });

  // Fetch initial data
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
    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      siemApi.getEventStats().then(setStats).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const generateTestEvents = async () => {
    try {
      const result = await siemApi.ingestTestEvents();
      console.log('Test events generated:', result);
    } catch (err) {
      console.error('Failed to generate test events:', err);
    }
  };

  const closeAlert = async (alertId) => {
    try {
      await siemApi.updateAlertStatus(alertId, 'closed');
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'closed' } : a
      ));
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
      case 'critical': return '#ff0040';
      case 'warning': return '#ffa500';
      case 'info': return '#00ff88';
      default: return '#888';
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ff88'
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '20px', fontSize: '18px' }}>Connecting to SIEM Backend...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ff0040'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
          <AlertTriangle size={48} />
          <h2 style={{ marginTop: '20px' }}>Connection Error</h2>
          <p style={{ color: '#888', marginBottom: '30px' }}>{error}</p>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Make sure the backend server is running:<br />
            <code style={{ color: '#00ff88' }}>cd backend && npm install && npm start</code>
          </p>
          <button
            onClick={fetchData}
            style={{
              marginTop: '30px',
              padding: '12px 24px',
              background: 'rgba(0, 255, 136, 0.2)',
              border: '2px solid #00ff88',
              borderRadius: '4px',
              color: '#00ff88',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#e0e0e0',
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      overflow: 'hidden'
    }}>
      {/* Animated background grid */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
        pointerEvents: 'none'
      }} />

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(0, 255, 136, 0.5), 0 0 10px rgba(0, 255, 136, 0.3); }
          50% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.8), 0 0 20px rgba(0, 255, 136, 0.5); }
        }
        .event-row:hover {
          background: rgba(0, 255, 136, 0.1) !important;
          transform: translateX(5px);
          transition: all 0.2s ease;
        }
        .stat-card {
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'rgba(10, 14, 26, 0.95)',
        borderBottom: '2px solid #00ff88',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 10,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Shield size={36} color="#00ff88" style={{ animation: 'glow 2s infinite' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#00ff88', fontWeight: 700, letterSpacing: '2px' }}>
              RookSIEM
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#888', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Security Information & Event Management
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: isConnected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 0, 64, 0.1)',
            border: `1px solid ${isConnected ? '#00ff88' : '#ff0040'}`,
            borderRadius: '4px'
          }}>
            {isConnected ? <Wifi size={16} color="#00ff88" /> : <WifiOff size={16} color="#ff0040" />}
            <span style={{ fontSize: '12px', color: isConnected ? '#00ff88' : '#ff0040', fontWeight: 600 }}>
              {connectionState === ConnectionState.CONNECTING ? 'CONNECTING...' :
               isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Generate Test Events Button */}
          <button
            onClick={generateTestEvents}
            style={{
              padding: '10px 20px',
              background: 'rgba(0, 168, 255, 0.2)',
              border: '2px solid #00a8ff',
              borderRadius: '4px',
              color: '#00a8ff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Zap size={16} />
            TEST EVENTS
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            style={{
              padding: '10px 20px',
              background: 'rgba(0, 255, 136, 0.2)',
              border: '2px solid #00ff88',
              borderRadius: '4px',
              color: '#00ff88',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={16} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        padding: '0 40px',
        background: 'rgba(20, 25, 40, 0.8)',
        borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
        display: 'flex',
        gap: '5px',
        position: 'relative',
        zIndex: 5
      }}>
        {[
          { id: 'dashboard', icon: Activity, label: 'Dashboard' },
          { id: 'events', icon: Database, label: 'Event Log' },
          { id: 'alerts', icon: AlertTriangle, label: `Alerts${openAlertCount > 0 ? ` (${openAlertCount})` : ''}` },
          { id: 'endpoints', icon: Server, label: `Endpoints (${endpoints.length})` },
          { id: 'analytics', icon: TrendingUp, label: 'Analytics' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            style={{
              padding: '15px 25px',
              background: selectedTab === tab.id ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: selectedTab === tab.id ? '3px solid #00ff88' : '3px solid transparent',
              color: selectedTab === tab.id ? '#00ff88' : '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '1px',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px 40px', position: 'relative', zIndex: 1 }}>
        {selectedTab === 'dashboard' && (
          <div>
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {[
                { label: 'Total Events', value: displayStats.total, icon: Database, color: '#00a8ff', tab: 'events' },
                { label: 'Critical', value: displayStats.critical, icon: AlertTriangle, color: '#ff0040', tab: 'events' },
                { label: 'Warnings', value: displayStats.warning, icon: Eye, color: '#ffa500', tab: 'events' },
                { label: 'Open Alerts', value: displayStats.openAlerts, icon: Shield, color: '#ff0040', tab: 'alerts' },
                { label: 'Info', value: displayStats.info, icon: CheckCircle, color: '#00ff88', tab: 'events' }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="stat-card"
                  onClick={() => setSelectedTab(stat.tab)}
                  style={{
                    background: 'rgba(20, 25, 40, 0.9)',
                    border: `1px solid ${stat.color}40`,
                    borderRadius: '8px',
                    padding: '20px',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                    animation: `slideIn 0.5s ease ${idx * 0.1}s backwards`,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '11px',
                        color: '#888',
                        letterSpacing: '1.5px',
                        textTransform: 'uppercase'
                      }}>
                        {stat.label}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '36px',
                        fontWeight: 700,
                        color: stat.color,
                        lineHeight: 1
                      }}>
                        {stat.value}
                      </p>
                    </div>
                    <stat.icon size={32} color={stat.color} style={{ opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Critical Events */}
            <div style={{
              background: 'rgba(20, 25, 40, 0.9)',
              border: '1px solid rgba(255, 0, 64, 0.3)',
              borderRadius: '8px',
              padding: '25px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
            }}>
              <h2
                onClick={() => setSelectedTab('events')}
                style={{
                  margin: '0 0 20px 0',
                  fontSize: '18px',
                  color: '#ff0040',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                <AlertTriangle size={20} />
                CRITICAL EVENTS - RECENT
              </h2>

              {events.filter(e => e.severity === 'critical').length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No critical events detected
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {events.filter(e => e.severity === 'critical').slice(0, 5).map(event => (
                    <div
                      key={event.id}
                      className="event-row"
                      onClick={() => setSelectedEvent(event)}
                      style={{
                        background: 'rgba(255, 0, 64, 0.05)',
                        border: '1px solid rgba(255, 0, 64, 0.2)',
                        borderRadius: '4px',
                        padding: '15px',
                        cursor: 'pointer',
                        display: 'grid',
                        gridTemplateColumns: '140px 150px 1fr 100px',
                        gap: '15px',
                        alignItems: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ color: '#888' }}>
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span style={{ color: '#00ff88', fontWeight: 600 }}>
                        {event.hostname || 'unknown'}
                      </span>
                      <span style={{ color: '#e0e0e0' }}>
                        {event.description}
                      </span>
                      <span style={{
                        color: '#ff0040',
                        fontWeight: 700,
                        textAlign: 'right',
                        textTransform: 'uppercase',
                        fontSize: '10px',
                        letterSpacing: '1px'
                      }}>
                        CRITICAL
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'events' && (
          <div style={{
            background: 'rgba(20, 25, 40, 0.9)',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            borderRadius: '8px',
            padding: '25px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '15px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                color: '#00ff88',
                letterSpacing: '1px'
              }}>
                SECURITY EVENT LOG ({isSearching ? filteredEvents.length : events.length} events)
              </h2>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search Input */}
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#888'
                  }} />
                  <input
                    type="text"
                    placeholder="Search ID, hostname, description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchEvents()}
                    style={{
                      padding: '10px 12px 10px 38px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      borderRadius: '4px',
                      color: '#e0e0e0',
                      fontSize: '13px',
                      width: '280px',
                      fontFamily: 'inherit',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    borderRadius: '4px',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>

                {/* Search Button */}
                <button
                  onClick={searchEvents}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(0, 255, 136, 0.2)',
                    border: '1px solid #00ff88',
                    borderRadius: '4px',
                    color: '#00ff88',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Search size={14} />
                  Search
                </button>

                {/* Clear Button */}
                {isSearching && (
                  <button
                    onClick={clearSearch}
                    style={{
                      padding: '10px 20px',
                      background: 'rgba(255, 0, 64, 0.2)',
                      border: '1px solid #ff0040',
                      borderRadius: '4px',
                      color: '#ff0040',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'inherit'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              padding: '15px',
              marginBottom: '15px',
              display: 'grid',
              gridTemplateColumns: '180px 150px 1fr 100px 80px',
              gap: '15px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <span>Timestamp</span>
              <span>Hostname</span>
              <span>Description</span>
              <span>Source</span>
              <span>Severity</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
              {(isSearching ? filteredEvents : events).length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                  {isSearching ? 'No events match your search criteria.' : 'No events recorded. Start an agent or generate test events.'}
                </p>
              ) : (
                (isSearching ? filteredEvents : events).map(event => (
                  <div
                    key={event.id}
                    className="event-row"
                    onClick={() => setSelectedEvent(event)}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: `1px solid ${getSeverityColor(event.severity)}40`,
                      borderRadius: '4px',
                      padding: '12px 15px',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: '180px 150px 1fr 100px 80px',
                      gap: '15px',
                      alignItems: 'center',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ color: '#888' }}>{formatTimestamp(event.timestamp)}</span>
                    <span style={{ color: '#00ff88' }}>{event.hostname || 'unknown'}</span>
                    <span style={{ color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.description}
                    </span>
                    <span style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase' }}>
                      {event.source}
                    </span>
                    <span style={{
                      color: getSeverityColor(event.severity),
                      fontWeight: 700,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {event.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'alerts' && (
          <div style={{
            background: 'rgba(20, 25, 40, 0.9)',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            borderRadius: '8px',
            padding: '25px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              color: '#ffa500',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={20} />
              SECURITY ALERTS ({alerts.length})
            </h2>

            {alerts.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                No alerts generated. Detection rules will create alerts when threats are detected.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className="event-row"
                    style={{
                      background: alert.status === 'open'
                        ? 'rgba(255, 0, 64, 0.1)'
                        : 'rgba(0, 255, 136, 0.05)',
                      border: `1px solid ${alert.status === 'open' ? '#ff0040' : '#00ff88'}40`,
                      borderRadius: '4px',
                      padding: '20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{
                          color: alert.status === 'open' ? '#ff0040' : '#00ff88',
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '4px 8px',
                          background: alert.status === 'open'
                            ? 'rgba(255, 0, 64, 0.2)'
                            : 'rgba(0, 255, 136, 0.2)',
                          borderRadius: '3px',
                          textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}>
                          {alert.status}
                        </span>
                        <span style={{
                          color: getSeverityColor(alert.severity),
                          fontWeight: 700,
                          fontSize: '11px',
                          textTransform: 'uppercase'
                        }}>
                          {alert.severity}
                        </span>
                      </div>

                      <p style={{ margin: '5px 0', fontSize: '14px', color: '#e0e0e0', fontWeight: 600 }}>
                        {alert.title}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#888' }}>
                        {alert.description}
                      </p>

                      <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '12px', color: '#888' }}>
                        <span>
                          Hostname: <span style={{ color: '#00ff88' }}>{alert.hostname || 'N/A'}</span>
                        </span>
                        <span>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {formatTimestamp(alert.created_at)}
                        </span>
                      </div>
                    </div>

                    {alert.status === 'open' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeAlert(alert.id);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(0, 255, 136, 0.2)',
                          border: '1px solid #00ff88',
                          borderRadius: '4px',
                          color: '#00ff88',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          fontFamily: 'inherit'
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

        {selectedTab === 'endpoints' && (
          <div style={{
            background: 'rgba(20, 25, 40, 0.9)',
            border: '1px solid rgba(0, 168, 255, 0.3)',
            borderRadius: '8px',
            padding: '25px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              color: '#00a8ff',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Server size={20} />
              MONITORED ENDPOINTS ({endpoints.length})
            </h2>

            {endpoints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  No endpoints registered. Start an agent to begin monitoring.
                </p>
                <div style={{ color: '#888', fontSize: '14px' }}>
                  <p>Linux: <code style={{ color: '#00ff88' }}>sudo node agents/linux/agent.js</code></p>
                  <p>Windows: <code style={{ color: '#00ff88' }}>.\agents\windows\agent.ps1</code></p>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '20px'
              }}>
                {endpoints.map(endpoint => (
                  <div
                    key={endpoint.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: `2px solid ${endpoint.status === 'healthy' ? '#00ff88' : endpoint.status === 'offline' ? '#888' : '#ff0040'}40`,
                      borderRadius: '6px',
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ color: '#00a8ff', fontWeight: 700, fontSize: '13px' }}>
                        {endpoint.hostname}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        background: endpoint.status === 'healthy'
                          ? 'rgba(0, 255, 136, 0.2)'
                          : endpoint.status === 'offline'
                            ? 'rgba(136, 136, 136, 0.2)'
                            : 'rgba(255, 0, 64, 0.2)',
                        border: `1px solid ${endpoint.status === 'healthy' ? '#00ff88' : endpoint.status === 'offline' ? '#888' : '#ff0040'}`,
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: endpoint.status === 'healthy' ? '#00ff88' : endpoint.status === 'offline' ? '#888' : '#ff0040',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {endpoint.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#e0e0e0', marginBottom: '5px' }}>
                      <Network size={14} style={{ display: 'inline', marginRight: '8px', color: '#888' }} />
                      {endpoint.ip_address || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>
                      <Cpu size={14} style={{ display: 'inline', marginRight: '8px' }} />
                      {endpoint.os} {endpoint.os_version}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '10px' }}>
                      Last seen: {formatTimestamp(endpoint.last_seen)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'analytics' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'rgba(20, 25, 40, 0.9)',
                border: '1px solid rgba(0, 255, 136, 0.2)',
                borderRadius: '8px',
                padding: '25px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#00ff88', fontSize: '16px', letterSpacing: '1px' }}>
                  EVENTS BY TYPE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(stats.byType || {}).map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
                        <span style={{ color: '#e0e0e0', textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                        <span style={{ color: '#00a8ff', fontWeight: 700 }}>{count}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min((count / Math.max(...Object.values(stats.byType || {}), 1)) * 100, 100)}%`,
                          height: '100%',
                          background: '#00a8ff',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.byType || {}).length === 0 && (
                    <p style={{ color: '#666', textAlign: 'center' }}>No data available</p>
                  )}
                </div>
              </div>

              <div style={{
                background: 'rgba(20, 25, 40, 0.9)',
                border: '1px solid rgba(0, 168, 255, 0.2)',
                borderRadius: '8px',
                padding: '25px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#00a8ff', fontSize: '16px', letterSpacing: '1px' }}>
                  EVENTS BY SEVERITY
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['critical', 'warning', 'info'].map(severity => {
                    const count = stats.bySeverity?.[severity] || 0;
                    const maxCount = Math.max(...Object.values(stats.bySeverity || {}), 1);
                    return (
                      <div key={severity}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
                          <span style={{ color: getSeverityColor(severity), textTransform: 'uppercase' }}>{severity}</span>
                          <span style={{ color: getSeverityColor(severity), fontWeight: 700 }}>{count}</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(count / maxCount) * 100}%`,
                            height: '100%',
                            background: getSeverityColor(severity),
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(20, 25, 40, 0.9)',
              border: '1px solid rgba(255, 165, 0, 0.2)',
              borderRadius: '8px',
              padding: '25px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#ffa500', fontSize: '16px', letterSpacing: '1px' }}>
                DETECTION RULES STATUS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                {rules.map(rule => (
                  <div key={rule.id} style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${rule.enabled ? '#00ff88' : '#888'}40`,
                    borderRadius: '4px',
                    padding: '15px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 600 }}>
                        {rule.name}
                      </span>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: rule.enabled ? '#00ff88' : '#888'
                      }} />
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: rule.enabled ? getSeverityColor(rule.severity) : '#888' }}>
                      {rule.match_count || 0}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      matches
                    </div>
                  </div>
                ))}
                {rules.length === 0 && (
                  <p style={{ color: '#666', gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                    No detection rules loaded
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(5px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(20, 25, 40, 0.98)',
              border: `2px solid ${getSeverityColor(selectedEvent.severity)}`,
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              color: getSeverityColor(selectedEvent.severity),
              fontSize: '20px',
              letterSpacing: '1px'
            }}>
              EVENT DETAILS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Event ID:</span>
                <span style={{ color: '#00a8ff', fontWeight: 600, wordBreak: 'break-all' }}>{selectedEvent.id}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Timestamp:</span>
                <span style={{ color: '#e0e0e0' }}>{formatTimestamp(selectedEvent.timestamp)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Severity:</span>
                <span style={{
                  color: getSeverityColor(selectedEvent.severity),
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {selectedEvent.severity}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Source:</span>
                <span style={{ color: '#e0e0e0', textTransform: 'uppercase' }}>{selectedEvent.source}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Type:</span>
                <span style={{ color: '#e0e0e0', textTransform: 'capitalize' }}>{selectedEvent.event_type?.replace('_', ' ')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Description:</span>
                <span style={{ color: '#e0e0e0' }}>{selectedEvent.description}</span>
              </div>

              {selectedEvent.user && (
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                  <span style={{ color: '#888' }}>User:</span>
                  <span style={{ color: '#00a8ff', fontWeight: 600 }}>{selectedEvent.user}</span>
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                <div style={{ color: '#888', marginBottom: '10px' }}>Endpoint Information:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                  <span style={{ color: '#888' }}>Hostname:</span>
                  <span style={{ color: '#00ff88', fontWeight: 600 }}>{selectedEvent.hostname || 'N/A'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#888' }}>IP Address:</span>
                  <span style={{ color: '#e0e0e0' }}>{selectedEvent.ip_address || 'N/A'}</span>
                </div>
              </div>

              {selectedEvent.parsed_data && Object.keys(selectedEvent.parsed_data).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                  <div style={{ color: '#888', marginBottom: '10px' }}>Parsed Data:</div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '11px',
                    color: '#e0e0e0'
                  }}>
                    {JSON.stringify(selectedEvent.parsed_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.raw_log && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                  <div style={{ color: '#888', marginBottom: '10px' }}>Raw Log:</div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '11px',
                    color: '#888',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {selectedEvent.raw_log}
                  </pre>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                marginTop: '25px',
                padding: '12px 24px',
                background: 'rgba(0, 255, 136, 0.2)',
                border: '2px solid #00ff88',
                borderRadius: '4px',
                color: '#00ff88',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                width: '100%',
                fontFamily: 'inherit'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div
          onClick={() => setSelectedAlert(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(5px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(20, 25, 40, 0.98)',
              border: `2px solid ${selectedAlert.status === 'open' ? '#ff0040' : '#00ff88'}`,
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              color: selectedAlert.status === 'open' ? '#ff0040' : '#00ff88',
              fontSize: '20px',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={24} />
              ALERT DETAILS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Alert ID:</span>
                <span style={{ color: '#00a8ff', fontWeight: 600, wordBreak: 'break-all' }}>{selectedAlert.id}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Status:</span>
                <span style={{
                  color: selectedAlert.status === 'open' ? '#ff0040' : '#00ff88',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {selectedAlert.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Severity:</span>
                <span style={{
                  color: getSeverityColor(selectedAlert.severity),
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {selectedAlert.severity}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Title:</span>
                <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{selectedAlert.title}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Rule ID:</span>
                <span style={{ color: '#ffa500' }}>{selectedAlert.rule_id}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Created:</span>
                <span style={{ color: '#e0e0e0' }}>{formatTimestamp(selectedAlert.created_at)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Updated:</span>
                <span style={{ color: '#e0e0e0' }}>{formatTimestamp(selectedAlert.updated_at)}</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                <div style={{ color: '#888', marginBottom: '10px' }}>Description:</div>
                <pre style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '15px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px',
                  color: '#e0e0e0',
                  whiteSpace: 'pre-wrap',
                  margin: 0
                }}>
                  {selectedAlert.description}
                </pre>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                <div style={{ color: '#888', marginBottom: '10px' }}>Related Event Information:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                  <span style={{ color: '#888' }}>Event ID:</span>
                  <span style={{ color: '#00a8ff', wordBreak: 'break-all' }}>{selectedAlert.event_id || 'N/A'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#888' }}>Hostname:</span>
                  <span style={{ color: '#00ff88', fontWeight: 600 }}>{selectedAlert.hostname || 'N/A'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#888' }}>IP Address:</span>
                  <span style={{ color: '#e0e0e0' }}>{selectedAlert.ip_address || 'N/A'}</span>
                </div>
                {selectedAlert.event_description && (
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                    <span style={{ color: '#888' }}>Event:</span>
                    <span style={{ color: '#e0e0e0' }}>{selectedAlert.event_description}</span>
                  </div>
                )}
              </div>

              {selectedAlert.notes && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                  <div style={{ color: '#888', marginBottom: '10px' }}>Notes:</div>
                  <p style={{ color: '#e0e0e0', margin: 0 }}>{selectedAlert.notes}</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
              {selectedAlert.status === 'open' && (
                <button
                  onClick={() => {
                    closeAlert(selectedAlert.id);
                    setSelectedAlert({ ...selectedAlert, status: 'closed' });
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: 'rgba(0, 255, 136, 0.2)',
                    border: '2px solid #00ff88',
                    borderRadius: '4px',
                    color: '#00ff88',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontFamily: 'inherit'
                  }}
                >
                  Close Alert
                </button>
              )}
              <button
                onClick={() => setSelectedAlert(null)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'rgba(136, 136, 136, 0.2)',
                  border: '2px solid #888',
                  borderRadius: '4px',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniSIEM;
