import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Right-hand detail panel.
 *
 * Deliberately has no scrim on desktop: during triage you want to click
 * straight from one row to the next without dismissing anything, and a dimmed
 * backdrop would hide the list you are working through. On narrow screens it
 * covers the viewport, so a scrim and a scroll lock come back.
 */
const SlideOver = ({ title, subtitle, icon, onClose, children, footer }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    const isNarrow = window.matchMedia('(max-width: 860px)').matches;
    const previous = document.body.style.overflow;
    if (isNarrow) document.body.style.overflow = 'hidden';

    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <>
      <button className="slideover-scrim" aria-label="Close details" onClick={onClose} />
      <aside
        className="slideover"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        <header className="slideover__head">
          {icon}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="slideover__title">{title}</div>
            {subtitle && <div className="slideover__sub">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <X size={16} />
          </button>
        </header>

        <div className="slideover__body">{children}</div>

        {footer && <footer className="slideover__foot">{footer}</footer>}
      </aside>
    </>
  );
};

export default SlideOver;
