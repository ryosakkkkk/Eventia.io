import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Star, X } from 'lucide-react';
import { ESTADOS, eventDate, fmt, initials } from '../lib/format';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = () => {
    if (prefersReducedMotion()) return onClose();
    setClosing(true);
    setTimeout(() => closeRef.current(), 160);
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const opener = document.activeElement;
    const box = ref.current;
    (box.querySelector('[autofocus]') || box.querySelector(FOCUSABLE) || box).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); requestCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener && opener.focus) opener.focus();
    };
  }, []);
  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={ref} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={requestClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Menú "Más acciones" para filas de tablas: mantiene a la vista solo las acciones principales.
// items: [{ label, icon, onClick, to, danger, hidden }]
export function RowMenu({ items, label = 'Más acciones' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const pop = useRef(null);
  const btn = useRef(null);
  const visible = items.filter((i) => !i.hidden);
  // Posición fija calculada desde el botón: las tablas con desplazamiento horizontal recortarían un menú absoluto
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    const up = r.bottom + 8 + visible.length * 42 > window.innerHeight;
    setPos(up ? { bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right } : { top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    pop.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    const onDown = (e) => !ref.current?.contains(e.target) && !pop.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...pop.current.querySelectorAll('[role="menuitem"]')];
        const i = els.indexOf(document.activeElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  if (!visible.length) return null;
  return (
    <div className="row-menu" ref={ref}>
      <button ref={btn} type="button" className="icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}
        onClick={toggle}><MoreHorizontal size={18} /></button>
      {/* En un portal: la columna de acciones es sticky (contexto de apilamiento propio) y las filas de abajo lo taparían */}
      {open && createPortal(
        <div className="row-menu-pop" role="menu" style={pos} ref={pop}>
          {visible.map(({ label: l, icon: Icon, onClick, to, danger }) => {
            const cls = `row-menu-item ${danger ? 'danger' : ''}`;
            const content = <>{Icon && <Icon size={16} />}{l}</>;
            return to
              ? <Link key={l} role="menuitem" className={cls} to={to} onClick={() => setOpen(false)}>{content}</Link>
              : <button key={l} role="menuitem" type="button" className={cls} onClick={() => { setOpen(false); onClick(); }}>{content}</button>;
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// Aparición al hacer scroll (una sola vez). Los hijos entran escalonados con --i.
export function useReveal(ref) {
  const [shown, setShown] = useState(() => prefersReducedMotion() || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      // El orden se asigna al aparecer: así también cuenta para el contenido que llegó después de cargar
      [...el.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10)));
      setShown(true);
      io.disconnect();
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, ref]);
  return shown;
}

export function Reveal({ className = '', children, ...rest }) {
  const ref = useRef(null);
  const shown = useReveal(ref);
  return <div ref={ref} className={`${className} reveal ${shown ? 'in' : ''}`} {...rest}>{children}</div>;
}

// Imagen que aparece suavemente al cargar (evita el "salto" de imágenes a medio dibujar)
export function Img({ className = '', onLoad, ...props }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img {...props} className={`fade-img ${loaded ? 'loaded' : ''} ${className}`}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }} onError={() => setLoaded(true)} />
  );
}

// Número que cuenta hasta su valor al aparecer (KPIs)
export function CountUp({ value, duration = 700 }) {
  const n = Number(value) || 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? n : 0));
  const current = useRef(shown);
  useEffect(() => {
    if (prefersReducedMotion()) { current.current = n; setShown(n); return undefined; }
    // Parte del valor visible (no de cero) para que al cambiar un filtro la cifra se desplace con suavidad
    const from = current.current;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      current.current = Math.round(from + (n - from) * (1 - (1 - p) ** 3));
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, duration]);
  return <>{fmt(shown)}</>;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="ic"><Icon size={30} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export const Loader = () => <div className="page-loader"><div className="spinner" aria-label="Cargando" /></div>;

export function StatusBadge({ estado }) {
  const [label, tone] = ESTADOS[estado] || [estado, 'gray'];
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function Stars({ value = 0, size = 15 }) {
  return (
    <span className="stars" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={2} />
      ))}
    </span>
  );
}

export function StarsInput({ value, onChange }) {
  return (
    <div className="stars-input row" role="radiogroup" aria-label="Puntuación">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} className={i <= value ? 'on' : ''} onClick={() => onChange(i)} aria-label={`${i} estrellas`}>
          <Star size={30} fill={i <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export const Avatar = ({ name, large }) => <span className={`avatar ${large ? 'avatar-lg' : ''}`}>{initials(name)}</span>;

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="ev-grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="ev-card" aria-hidden="true">
          <div className="skel" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
          <div style={{ padding: 16 }} className="stack">
            <div className="skel" style={{ height: 12, width: '40%' }} />
            <div className="skel" style={{ height: 18, width: '90%' }} />
            <div className="skel" style={{ height: 12, width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// RF41 / HU28 – contador regresivo (se actualiza solo y se detiene al iniciar el evento)
export function useCountdown(fecha, hora) {
  const target = fecha ? eventDate(fecha, hora).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const diff = target - now;
  if (!target || diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400e3),
    h: Math.floor((diff % 86400e3) / 3600e3),
    m: Math.floor((diff % 3600e3) / 60e3),
    s: Math.floor((diff % 60e3) / 1000),
  };
}

export function Countdown({ fecha, hora, light }) {
  const c = useCountdown(fecha, hora);
  if (!c) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    // Los segundos solo aparecen el último día: antes distraen sin aportar. role="timer" no se anuncia a cada tic.
    <div className={`countdown ${light ? 'light' : ''}`} role="timer"
      aria-label={c.d > 0 ? `Faltan ${c.d} ${c.d === 1 ? 'día' : 'días'} y ${c.h} horas` : `Faltan ${c.h} horas y ${c.m} minutos`}>
      {/* Cada cifra entra deslizándose al cambiar (la clave nueva reinicia la animación) */}
      {c.d > 0 && <div aria-hidden="true"><b><span key={c.d} className="roll">{c.d}</span></b><span>{c.d === 1 ? 'día' : 'días'}</span></div>}
      <div aria-hidden="true"><b><span key={c.h} className="roll">{pad(c.h)}</span></b><span>horas</span></div>
      <div aria-hidden="true"><b><span key={c.m} className="roll">{pad(c.m)}</span></b><span>min</span></div>
      {c.d === 0 && <div aria-hidden="true"><b><span key={c.s} className="roll">{pad(c.s)}</span></b><span>seg</span></div>}
    </div>
  );
}

export function Confirm({ title, text, confirmLabel = 'Confirmar', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>
          {confirmLabel}
        </button>
      </>}>
      {text && <p className="muted">{text}</p>}
      {children}
    </Modal>
  );
}
