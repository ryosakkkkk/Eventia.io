import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MapPin, Star, Users, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useApp, useRequireLogin } from '../context/AppContext';
import { Img } from './ui';
import { availability, catStyle, relativeDay, shortCat, shortDate, hora12, fmt } from '../lib/format';

const FALLBACK = (ev) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${catStyle(ev.categoria).color}"/><stop offset="1" stop-color="#0b1d35"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>`
  )}`;
export const imgOf = (ev) => ev.imagen || FALLBACK(ev);

// Imagen del evento o, si no tiene, una portada diseñada con el color e ícono de su categoría
export function EventMedia({ ev, eager }) {
  if (ev.imagen) return <Img src={ev.imagen} alt="" loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined} decoding="async" />;
  const { Icon, color } = catStyle(ev.categoria);
  return (
    <span className="ev-poster" style={{ '--c': color }} aria-hidden="true">
      <Icon size={40} strokeWidth={1.6} />
    </span>
  );
}

// "Hoy · 8:30 p. m." / "Sáb 13 Dic · 10:00 a. m."
export const whenLabel = (ev) => `${relativeDay(ev.fecha) || shortDate(ev.fecha)} · ${hora12(ev.hora)}`;

export function FavButton({ ev, onChange, className = 'fav-btn' }) {
  const [on, setOn] = useState(!!ev.es_favorito);
  const [burst, setBurst] = useState(0);
  const { toast } = useApp();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();

  // Actualización optimista: el corazón cambia al instante y se revierte si el servidor falla
  const persist = async (next, { silent } = {}) => {
    setOn(next);
    if (next) { setBurst((b) => b + 1); navigator.vibrate?.(12); }
    try {
      if (next) await api.post(`/events/${ev.id}/favorite`);
      else await api.del(`/events/${ev.id}/favorite`);
      onChange?.(next);
      if (silent) return;
      if (next) toast('Guardado en tus favoritos', 'success', { action: { label: 'Ver', onClick: () => navigate('/cuenta/favoritos') } });
      else toast('Quitado de favoritos', 'info', { action: { label: 'Deshacer', onClick: () => persist(true, { silent: true }) } });
    } catch (err) {
      setOn(!next);
      toast(err.message, 'error');
    }
  };
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireLogin('Inicia sesión para guardar eventos en favoritos.')) return;
    persist(!on);
  };
  return (
    <button className={`${className} ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on}
      aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'} title={on ? 'Quitar de favoritos' : 'Guardar'}>
      <Heart size={21} />
      {burst > 0 && on && <span key={burst} className="burst" aria-hidden="true" />}
    </button>
  );
}

function Badges({ ev }) {
  const av = availability(ev);
  return (
    <div className="ev-badges">
      {ev.destacado && <span className="badge badge-dark"><Sparkles size={12} /> Destacado</span>}
      {(ev.disponibilidad === 'AGOTADO' || ev.disponibilidad === 'ULTIMOS' || ev.disponibilidad === 'LIBRE') && (
        <span className={`badge badge-${av.tone === 'blue' ? 'white' : av.tone}`}>{ev.disponibilidad === 'ULTIMOS' ? 'Últimos cupos' : av.label}</span>
      )}
    </div>
  );
}

function Going({ ev }) {
  if (!ev.total_asistencias) return <span className="muted">Sé el primero en asistir</span>;
  const tints = ['#dbe4ff', '#ffe4d1', '#dcf5e6'].slice(0, Math.min(3, ev.total_asistencias));
  return (
    <span className="going">
      <span className="avatars" aria-hidden="true">
        {tints.map((bg, i) => <span key={i} className="avatar" style={{ background: bg }}><Users size={12} /></span>)}
      </span>
      {fmt(ev.total_asistencias)} {ev.total_asistencias === 1 ? 'asistirá' : 'asistirán'}
    </span>
  );
}

// Tarjeta a todo el ancho: fecha destacada en una línea (patrón Eventbrite/DICE), sin sello que reste espacio al título
export function EventCard({ ev, onFav, eager }) {
  const { Icon, color } = catStyle(ev.categoria);
  const social = ev.total_asistencias > 0 || ev.rating;
  return (
    <Link to={`/evento/${ev.id}`} className="ev-card" style={{ '--c': color }}>
      <div className="ev-media">
        <EventMedia ev={ev} eager={eager} />
        <Badges ev={ev} />
        <FavButton ev={ev} onChange={onFav} />
      </div>
      <div className="ev-body">
        <span className="ev-when">{ev.sinFecha ? 'Elige la fecha' : whenLabel(ev)}</span>
        <h3 className="ev-title clamp-2">{ev.nombre}</h3>
        <span className="ev-meta clamp-1"><MapPin size={15} /> <span className="clamp-1">{ev.lugar} · {ev.ciudad}</span></span>
        <span className="ev-cat" style={{ color }}><Icon size={14} /> {shortCat(ev.categoria)}</span>
      </div>
      {social && (
        <div className="ev-foot">
          {ev.total_asistencias > 0 ? <Going ev={ev} /> : <span />}
          {ev.rating ? <span className="rating"><Star size={16} fill="currentColor" /> {ev.rating}</span> : null}
        </div>
      )}
    </Link>
  );
}

// Fila de lista: el título es el enlace y se estira sobre toda la fila; los botones de la derecha quedan
// fuera del enlace (un botón dentro de un <a> es HTML inválido y confunde al teclado y lectores de pantalla)
export function EventRow({ ev, right, eager }) {
  const { Icon, color } = catStyle(ev.categoria);
  const av = availability(ev);
  return (
    <div className="ev-row" style={{ '--c': color }}>
      <div className="ev-media"><EventMedia ev={ev} eager={eager} /></div>
      <div className="stack" style={{ gap: 5, minWidth: 0 }}>
        <span className="when">{whenLabel(ev)}</span>
        <h3 className="clamp-2"><Link to={`/evento/${ev.id}`} className="stretched">{ev.nombre}</Link></h3>
        <span className="ev-meta"><MapPin size={16} /> <span className="clamp-1">{ev.lugar} · {ev.ciudad}</span></span>
        <div className="row-wrap" style={{ gap: 8 }}>
          <span className="ev-cat" style={{ color }}><Icon size={15} /> {shortCat(ev.categoria)}</span>
          <span className={`badge badge-${av.tone}`}>{av.label}</span>
          {ev.total_asistencias > 0 && <span className="tiny muted row" style={{ gap: 4 }}><Users size={15} /> {fmt(ev.total_asistencias)} {ev.total_asistencias === 1 ? 'asistirá' : 'asistirán'}</span>}
        </div>
      </div>
      <div className="row ev-row-actions">{right || <FavButton ev={ev} className="icon-btn bordered" />}</div>
    </div>
  );
}

export function RankCard({ ev, n }) {
  return (
    <Link to={`/evento/${ev.id}`} className="rank-item">
      <span className="rank-num">{n}</span>
      <div className="ev-media" style={{ '--c': catStyle(ev.categoria).color }}><EventMedia ev={ev} /></div>
      <div className="info">
        <span className="tiny bold" style={{ color: 'var(--orange-strong)' }}>{relativeDay(ev.fecha) || shortDate(ev.fecha)} · {hora12(ev.hora)}</span>
        <h3 className="clamp-2" style={{ fontSize: 15 }}>{ev.nombre}</h3>
        <span className="tiny muted clamp-1">{ev.lugar}</span>
      </div>
    </Link>
  );
}
