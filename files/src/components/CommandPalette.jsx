import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, LayoutDashboard, ScrollText, ShieldAlert, Server, BarChart3, CornerDownLeft,
} from 'lucide-react';
import { clockTime, relativeTime, titleCase } from '../lib/siem';

const VIEW_ITEMS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'events',    label: 'Events',    icon: ScrollText },
  { id: 'alerts',    label: 'Alerts',    icon: ShieldAlert },
  { id: 'endpoints', label: 'Endpoints', icon: Server },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const matches = (haystack, needle) =>
  String(haystack || '').toLowerCase().includes(needle);

const CommandPalette = ({
  open,
  onClose,
  onNavigate,
  events = [],
  alerts = [],
  endpoints = [],
  onSelectEvent,
  onSelectAlert,
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after paint so the caret lands reliably.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();

    const nav = VIEW_ITEMS.filter((v) => !q || matches(v.label, q)).map((v) => ({
      group: 'Navigate',
      id: `nav-${v.id}`,
      icon: v.icon,
      text: v.label,
      hint: 'Jump to view',
      run: () => onNavigate(v.id),
    }));

    if (!q) return nav;

    const evts = events
      .filter((e) => matches(e.description, q) || matches(e.hostname, q) || matches(e.source, q))
      .slice(0, 6)
      .map((e) => ({
        group: 'Events',
        id: `evt-${e.id}`,
        icon: ScrollText,
        text: e.description || '(no description)',
        hint: `${e.hostname || 'unknown'} · ${clockTime(e.timestamp)}`,
        run: () => onSelectEvent(e),
      }));

    const alrts = alerts
      .filter((a) => matches(a.title, q) || matches(a.hostname, q))
      .slice(0, 4)
      .map((a) => ({
        group: 'Alerts',
        id: `alr-${a.id}`,
        icon: ShieldAlert,
        text: a.title,
        hint: `${a.status} · ${relativeTime(a.created_at)}`,
        run: () => onSelectAlert(a),
      }));

    const eps = endpoints
      .filter((ep) => matches(ep.hostname, q) || matches(ep.ip_address, q))
      .slice(0, 4)
      .map((ep) => ({
        group: 'Endpoints',
        id: `ep-${ep.id}`,
        icon: Server,
        text: ep.hostname,
        hint: ep.ip_address || 'no address',
        run: () => onNavigate('endpoints'),
      }));

    return [...nav, ...evts, ...alrts, ...eps];
  }, [query, events, alerts, endpoints, onNavigate, onSelectEvent, onSelectAlert]);

  useEffect(() => { setActive(0); }, [query]);

  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item) {
        item.run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = null;

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette__field">
          <Search size={17} color="var(--fg-subtle)" />
          <input
            ref={inputRef}
            className="palette__input"
            placeholder="Search events, alerts, endpoints…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div className="palette__list" ref={listRef}>
          {items.length === 0 ? (
            <div className="palette__empty">No matches for “{query}”</div>
          ) : (
            items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {header && <div className="palette__group">{header}</div>}
                  <button
                    type="button"
                    className="palette__item"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => { item.run(); onClose(); }}
                  >
                    <item.icon size={15} />
                    <span className="palette__item-text">{titleCase(item.text)}</span>
                    <span className="palette__item-hint">{item.hint}</span>
                    {i === active && <CornerDownLeft size={13} />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
