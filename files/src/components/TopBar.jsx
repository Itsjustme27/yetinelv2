import React from 'react';
import { Menu, Search, Sun, Moon } from 'lucide-react';
import { Segmented } from './primitives';
import { RANGES } from '../lib/siem';

const TopBar = ({ title, subtitle, onMenu, range, onRange, theme, onToggleTheme, onOpenPalette }) => (
  <header className="topbar">
    <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation">
      <Menu size={17} />
    </button>

    <div className="topbar__heading">
      <h1 className="topbar__title">{title}</h1>
      {subtitle && <span className="topbar__sub">{subtitle}</span>}
    </div>

    <span className="topbar__spacer" />

    <div className="topbar__actions">
      <button
        type="button"
        className="search-trigger"
        onClick={onOpenPalette}
        aria-label="Search events and jump to a view"
      >
        <Search size={14} />
        <span className="search-trigger__text">Search events…</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <Segmented
        ariaLabel="Time range"
        value={range}
        onChange={onRange}
        options={RANGES.map((r) => ({ id: r.id, label: r.label }))}
      />

      <button
        type="button"
        className="icon-btn"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  </header>
);

export default TopBar;
