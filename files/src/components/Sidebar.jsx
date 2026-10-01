import React from 'react';
import {
  LayoutDashboard, ScrollText, ShieldAlert, Server, BarChart3,
  Zap, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import logo from '../assets/logo2.png';

const NAV = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'events',    label: 'Events',    icon: ScrollText },
  { id: 'alerts',    label: 'Alerts',    icon: ShieldAlert },
  { id: 'endpoints', label: 'Endpoints', icon: Server },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const Sidebar = ({
  view,
  onNavigate,
  open,
  onClose,
  alertCount,
  endpointCount,
  eventCount,
  isConnected,
  connectionState,
  refreshing,
  onRefresh,
  onTestEvents,
}) => {
  const counts = {
    events: eventCount,
    alerts: alertCount,
    endpoints: endpointCount,
  };

  return (
    <>
      {open && <button className="rail__scrim" aria-label="Close navigation" onClick={onClose} />}

      <aside className="rail" data-open={open} aria-label="Primary">
        <div className="rail__brand">
          <img src={logo} alt="" className="rail__logo" />
          <div className="rail__brand-text">
            <div className="rail__title">Yetinel</div>
            <div className="rail__sub">Mini SIEM</div>
          </div>
        </div>

        <nav className="rail__nav">
          <div className="rail__label">Monitor</div>
          {NAV.map((item) => {
            const active = view === item.id;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                className="rail__item"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  onClose?.();
                }}
                title={item.label}
              >
                <item.icon size={16} />
                <span className="rail__item-text">{item.label}</span>
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="rail__count rail__count--alert">{alertCount}</span>
                )}
                {item.id !== 'alerts' && count > 0 && (
                  <span className="rail__count">{count > 999 ? '999+' : count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="rail__foot">
          <span
            className={`status ${
              connectionState === 'connecting' ? 'status--connecting'
              : isConnected ? 'status--live'
              : 'status--down'
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="dot" />
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>
              {connectionState === 'connecting' ? 'Connecting' : isConnected ? 'Live' : 'Offline'}
            </span>
          </span>

          <button type="button" className="btn btn--sm btn--block" onClick={onTestEvents}>
            <Zap size={13} />
            <span>Test events</span>
          </button>

          <button
            type="button"
            className="btn btn--sm btn--block"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : undefined} />
            <span>Refresh</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
