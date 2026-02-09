import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Terminal, Eye, Database, Network, Lock, Unlock, CheckCircle, XCircle, Clock, TrendingUp, FileText, Server, Cpu, HardDrive } from 'lucide-react';

// Mock data generators for realistic SIEM simulation
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

const MiniSIEM = () => {
  const [events, setEvents] = useState(Array.from({ length: 20 }, (_, i) => generateEvent(i)));
  const [alerts, setAlerts] = useState([]);
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Simulate real-time event ingestion
  useEffect(() => {
    if (!isMonitoring) return;
    
    const interval = setInterval(() => {
      const newEvent = generateEvent(Date.now());
      setEvents(prev => [newEvent, ...prev].slice(0, 100));
      
      // Generate alert for critical events
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ff0040';
      case 'warning': return '#ffa500';
      case 'info': return '#00ff88';
      default: return '#888';
    }
  };

  const closeAlert = (alertId) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: 'closed' } : a
    ));
  };

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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(0, 255, 136, 0.1)',
            border: '1px solid #00ff88',
            borderRadius: '4px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isMonitoring ? '#00ff88' : '#ff0040',
              animation: isMonitoring ? 'pulse 1s infinite' : 'none'
            }} />
            <span style={{ fontSize: '12px', color: '#00ff88', fontWeight: 600 }}>
              {isMonitoring ? 'MONITORING ACTIVE' : 'MONITORING PAUSED'}
            </span>
          </div>
          
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            style={{
              padding: '10px 20px',
              background: isMonitoring ? 'rgba(255, 0, 64, 0.2)' : 'rgba(0, 255, 136, 0.2)',
              border: `2px solid ${isMonitoring ? '#ff0040' : '#00ff88'}`,
              borderRadius: '4px',
              color: isMonitoring ? '#ff0040' : '#00ff88',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '1px',
              transition: 'all 0.3s ease'
            }}
          >
            {isMonitoring ? 'PAUSE' : 'RESUME'}
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
          { id: 'alerts', icon: AlertTriangle, label: 'Alerts' },
          { id: 'endpoints', icon: Server, label: 'Endpoints' },
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
                { label: 'Total Events', value: stats.total, icon: Database, color: '#00a8ff' },
                { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#ff0040' },
                { label: 'Warnings', value: stats.warning, icon: Eye, color: '#ffa500' },
                { label: 'Open Alerts', value: stats.openAlerts, icon: Shield, color: '#ff0040' },
                { label: 'Info', value: stats.info, icon: CheckCircle, color: '#00ff88' }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="stat-card"
                  style={{
                    background: 'rgba(20, 25, 40, 0.9)',
                    border: `1px solid ${stat.color}40`,
                    borderRadius: '8px',
                    padding: '20px',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                    animation: `slideIn 0.5s ease ${idx * 0.1}s backwards`
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
              <h2 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '18px', 
                color: '#ff0040',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                letterSpacing: '1px'
              }}>
                <AlertTriangle size={20} />
                CRITICAL EVENTS - LAST HOUR
              </h2>
              
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
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ 
                      color: '#00ff88',
                      fontWeight: 600
                    }}>
                      {event.endpoint.hostname}
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
            <h2 style={{ 
              margin: '0 0 20px 0', 
              fontSize: '18px', 
              color: '#00ff88',
              letterSpacing: '1px'
            }}>
              SECURITY EVENT LOG
            </h2>
            
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              padding: '15px',
              marginBottom: '15px',
              display: 'grid',
              gridTemplateColumns: '120px 140px 150px 1fr 100px 80px',
              gap: '15px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <span>Event ID</span>
              <span>Timestamp</span>
              <span>Endpoint</span>
              <span>Description</span>
              <span>Type</span>
              <span>Severity</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
              {events.map(event => (
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
                    gridTemplateColumns: '120px 140px 150px 1fr 100px 80px',
                    gap: '15px',
                    alignItems: 'center',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ color: '#00a8ff', fontWeight: 600 }}>{event.id}</span>
                  <span style={{ color: '#888' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: '#00ff88' }}>{event.endpoint.hostname}</span>
                  <span style={{ color: '#e0e0e0' }}>{event.description}</span>
                  <span style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase' }}>
                    {event.type}
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
              ))}
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
              SECURITY ALERTS
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {alerts.slice(0, 20).map(alert => (
                <div
                  key={alert.id}
                  style={{
                    background: alert.status === 'open' 
                      ? 'rgba(255, 0, 64, 0.1)' 
                      : 'rgba(0, 255, 136, 0.05)',
                    border: `1px solid ${alert.status === 'open' ? '#ff0040' : '#00ff88'}40`,
                    borderRadius: '4px',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
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
                      <span style={{ color: '#00a8ff', fontWeight: 600, fontSize: '12px' }}>
                        {alert.id}
                      </span>
                    </div>
                    
                    <p style={{ margin: '5px 0', fontSize: '14px', color: '#e0e0e0', fontWeight: 600 }}>
                      {alert.event.description}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '12px', color: '#888' }}>
                      <span>
                        Endpoint: <span style={{ color: '#00ff88' }}>{alert.event.endpoint.hostname}</span>
                      </span>
                      <span>
                        User: <span style={{ color: '#00a8ff' }}>{alert.event.user}</span>
                      </span>
                      <span>
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {alert.status === 'open' && (
                    <button
                      onClick={() => closeAlert(alert.id)}
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
              MONITORED ENDPOINTS
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {Array.from({ length: 8 }, (_, i) => generateEndpoint(i)).map(endpoint => (
                <div
                  key={endpoint.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: `2px solid ${endpoint.status === 'healthy' ? '#00ff88' : '#ff0040'}40`,
                    borderRadius: '6px',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ color: '#00a8ff', fontWeight: 700, fontSize: '13px' }}>
                      {endpoint.id}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      background: endpoint.status === 'healthy' 
                        ? 'rgba(0, 255, 136, 0.2)' 
                        : 'rgba(255, 0, 64, 0.2)',
                      border: `1px solid ${endpoint.status === 'healthy' ? '#00ff88' : '#ff0040'}`,
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: endpoint.status === 'healthy' ? '#00ff88' : '#ff0040',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {endpoint.status}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#e0e0e0', marginBottom: '5px' }}>
                    <Server size={14} style={{ display: 'inline', marginRight: '8px', color: '#888' }} />
                    {endpoint.hostname}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>
                    <Network size={14} style={{ display: 'inline', marginRight: '8px' }} />
                    {endpoint.ip}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    <Cpu size={14} style={{ display: 'inline', marginRight: '8px' }} />
                    {endpoint.os}
                  </div>
                </div>
              ))}
            </div>
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
                  THREAT DISTRIBUTION
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { type: 'Malware', count: 23, color: '#ff0040' },
                    { type: 'Network Anomaly', count: 18, color: '#ffa500' },
                    { type: 'Authentication', count: 45, color: '#00a8ff' },
                    { type: 'Privilege Escalation', count: 12, color: '#ff0040' },
                    { type: 'Data Exfiltration', count: 8, color: '#ff0040' }
                  ].map(item => (
                    <div key={item.type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
                        <span style={{ color: '#e0e0e0' }}>{item.type}</span>
                        <span style={{ color: item.color, fontWeight: 700 }}>{item.count}</span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(item.count / 45) * 100}%`,
                          height: '100%',
                          background: item.color,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  ))}
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
                  TOP TARGETED ENDPOINTS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const ep = generateEndpoint(i);
                    const eventCount = Math.floor(Math.random() * 50) + 10;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 600 }}>
                            {ep.hostname}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888' }}>
                            {ep.ip}
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 12px',
                          background: 'rgba(255, 0, 64, 0.2)',
                          border: '1px solid #ff0040',
                          borderRadius: '4px',
                          color: '#ff0040',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          {eventCount} events
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {[
                  { name: 'Brute Force Detection', active: true, matches: 156 },
                  { name: 'Lateral Movement', active: true, matches: 23 },
                  { name: 'Data Exfil Pattern', active: true, matches: 8 },
                  { name: 'Malware Signature', active: true, matches: 45 },
                  { name: 'Port Scan Detection', active: false, matches: 0 },
                  { name: 'Privilege Abuse', active: true, matches: 34 }
                ].map((rule, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${rule.active ? '#00ff88' : '#888'}40`,
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
                        background: rule.active ? '#00ff88' : '#888'
                      }} />
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: rule.active ? '#00ff88' : '#888' }}>
                      {rule.matches}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      matches today
                    </div>
                  </div>
                ))}
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
              maxWidth: '600px',
              width: '90%',
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
                <span style={{ color: '#00a8ff', fontWeight: 600 }}>{selectedEvent.id}</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Timestamp:</span>
                <span style={{ color: '#e0e0e0' }}>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
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
                <span style={{ color: '#888' }}>Type:</span>
                <span style={{ color: '#e0e0e0', textTransform: 'uppercase' }}>{selectedEvent.type}</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>Description:</span>
                <span style={{ color: '#e0e0e0' }}>{selectedEvent.description}</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <span style={{ color: '#888' }}>User:</span>
                <span style={{ color: '#00a8ff', fontWeight: 600 }}>{selectedEvent.user}</span>
              </div>
              
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '10px' }}>
                <div style={{ color: '#888', marginBottom: '10px' }}>Endpoint Information:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                  <span style={{ color: '#888' }}>Hostname:</span>
                  <span style={{ color: '#00ff88', fontWeight: 600 }}>{selectedEvent.endpoint.hostname}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#888' }}>IP Address:</span>
                  <span style={{ color: '#e0e0e0' }}>{selectedEvent.endpoint.ip}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#888' }}>Operating System:</span>
                  <span style={{ color: '#e0e0e0' }}>{selectedEvent.endpoint.os}</span>
                </div>
              </div>
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
    </div>
  );
};

export default MiniSIEM;
