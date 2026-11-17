import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { ESTADOS, eventDate, initials } from '../lib/format';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
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
    <div className={`countdown ${light ? 'light' : ''}`} aria-label="Tiempo restante">
      <div><b>{c.d}</b><span>días</span></div>
      <div><b>{pad(c.h)}</b><span>horas</span></div>
      <div><b>{pad(c.m)}</b><span>min</span></div>
      <div><b>{pad(c.s)}</b><span>seg</span></div>
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
