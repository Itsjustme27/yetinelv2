import React from 'react';
import { RefreshCw } from 'lucide-react';

export const Badge = ({ children, className = 'badge--neutral', dot = false, title }) => (
  <span className={`badge ${className}`} title={title}>
    {dot && <span className="dot" />}
    {children}
  </span>
);

export const StatusPill = ({ state, label }) => {
  const cls =
    state === 'connecting' ? 'status--connecting'
    : state === 'live' ? 'status--live'
    : 'status--down';
  return (
    <span className={`status ${cls}`} role="status" aria-live="polite">
      <span className="dot" />
      {label}
    </span>
  );
};

export const Panel = ({ title, icon, meta, actions, children, flush = false, className = '' }) => (
  <section className={`panel ${className}`}>
    {(title || actions) && (
      <header className="panel__head">
        {title && (
          <h3 className="panel__title">
            {icon}
            {title}
          </h3>
        )}
        {meta && <span className="panel__meta">{meta}</span>}
        <span className="panel__spacer" />
        {actions}
      </header>
    )}
    <div className={flush ? '' : 'panel__body'}>{children}</div>
  </section>
);

export const EmptyState = ({ icon: Icon, title, children, tone = '' }) => (
  <div className="state">
    {Icon && (
      <div className={`state__icon ${tone ? `state__icon--${tone}` : ''}`}>
        <Icon size={21} />
      </div>
    )}
    <div>
      <div className="state__title">{title}</div>
      {children && <div className="state__text" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  </div>
);

export const LoadingState = ({ label = 'Loading' }) => (
  <div className="state state--full">
    <RefreshCw size={26} className="spin" color="var(--accent)" />
    <div className="state__title">{label}</div>
  </div>
);

export const Skeleton = ({ w = '100%', h = 12, r }) => (
  <span className="skel" style={{ display: 'block', width: w, height: h, borderRadius: r }} />
);

export const Segmented = ({ options, value, onChange, ariaLabel }) => (
  <div className="segmented" role="group" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        className="segmented__item"
        aria-pressed={value === opt.id}
        onClick={() => onChange(opt.id)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/** A definition row used throughout the slide-over detail panels. */
export const Def = ({ label, value, variant }) => (
  <div className="def">
    <span className="def__key">{label}</span>
    <span className={`def__val ${variant ? `def__val--${variant}` : ''}`}>{value}</span>
  </div>
);

export const Section = ({ label, children }) => (
  <div className="section">
    <span className="section__label">{label}</span>
    {children}
  </div>
);
