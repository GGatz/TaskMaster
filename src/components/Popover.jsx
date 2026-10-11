import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Floating panel anchored to an element rect (or a DOMRect-like object), rendered in a portal.
 * Flips above the anchor when there is no room below and clamps to the viewport.
 * Closes on outside mousedown and Escape.
 */
export default function Popover({ anchor, onClose, children, className = '', align = 'left', offset = 4, width, maxHeight = 420, closeOnOutside = true, autoFocus = false }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  // Measured after every render on purpose; the functional setState bails out when nothing moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    const rect = anchor?.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    if (!el || !rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === 'right' ? rect.right - w : rect.left;
    let top = rect.bottom + offset;
    if (top + h > vh - 8 && rect.top - h - offset > 8) top = rect.top - h - offset;
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
  });

  useEffect(() => {
    if (!closeOnOutside) return undefined;
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.(e);
    };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(e); }
    };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose, closeOnOutside]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      style={{ left: pos.left, top: pos.top, width, maxHeight }}
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Centered modal with a dimmed backdrop. */
export function Modal({ onClose, children, className = '', top = '12vh' }) {
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ paddingTop: top }}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true">{children}</div>
    </div>,
    document.body,
  );
}

/** A list of menu rows. Items: { label, icon, onClick, danger, hint, divider, submenu } */
export function MenuItem({ icon, children, hint, danger, onClick, active, disabled, right }) {
  return (
    <button type="button" className={`menu-item${danger ? ' danger' : ''}${active ? ' active' : ''}`} onClick={onClick} disabled={disabled}>
      {icon != null && <span className="menu-icon">{icon}</span>}
      <span className="menu-label">{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
      {right}
    </button>
  );
}
