import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Clock, Star, Users, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useApp, useRequireLogin } from '../context/AppContext';
import { availability, catStyle, dateChip, relativeDay, shortCat, shortDate, hora12, fmt } from '../lib/format';

const FALLBACK = (ev) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${catStyle(ev.categoria).color}"/><stop offset="1" stop-color="#0b1d35"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>`
  )}`;
export const imgOf = (ev) => ev.imagen || FALLBACK(ev);

export function FavButton({ ev, onChange, className = 'fav-btn' }) {
  const [on, setOn] = useState(!!ev.es_favorito);
  const { toast } = useApp();
  const requireLogin = useRequireLogin();
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireLogin('Inicia sesión para guardar eventos en favoritos.')) return;
    const next = !on;
    setOn(next);
    try {
      if (next) await api.post(`/events/${ev.id}/favorite`);
      else await api.del(`/events/${ev.id}/favorite`);
      toast(next ? 'Guardado en tus favoritos' : 'Quitado de favoritos', next ? 'success' : 'info');
      onChange?.(next);
    } catch (err) {
      setOn(!next);
      toast(err.message, 'error');
    }
  };
  return (
    <button className={`${className} ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on}
      aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'} title={on ? 'Quitar de favoritos' : 'Guardar'}>
      <Heart size={21} />
    </button>
  );
}

function Badges({ ev }) {
  const rel = relativeDay(ev.fecha);
  const av = availability(ev);
  return (
    <div className="ev-badges">
      {ev.destacado && <span className="badge badge-dark"><Sparkles size={12} /> Destacado</span>}
      {rel && <span className="badge badge-white" style={{ color: '#c2410c' }}>{rel}</span>}
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
      {fmt(ev.total_asistencias)} asistirán
    </span>
  );
}

export function EventCard({ ev, onFav }) {
  const chip = dateChip(ev.fecha);
  const { Icon, color } = catStyle(ev.categoria);
  return (
    <Link to={`/evento/${ev.id}`} className="ev-card">
      <div className="ev-media">
        <img src={imgOf(ev)} alt="" loading="lazy" />
        <Badges ev={ev} />
        <FavButton ev={ev} onChange={onFav} />
      </div>
      <div style={{ position: 'relative' }}>
        <div className="date-chip" aria-label={shortDate(ev.fecha)}>
          <div className="m">{chip.mes}</div>
          <div className="d">{chip.num}</div>
          <div className="w">{chip.dia}</div>
        </div>
      </div>
      <div className="ev-body">
        <span className="ev-cat" style={{ color }}><Icon size={15} /> {shortCat(ev.categoria)}</span>
        <h3 className="ev-title clamp-2">{ev.nombre}</h3>
        <span className="ev-meta"><Clock size={16} /> {hora12(ev.hora)}</span>
        <span className="ev-meta clamp-1"><MapPin size={16} /> <span className="clamp-1">{ev.lugar} · {ev.ciudad}</span></span>
      </div>
      <div className="ev-foot">
        <Going ev={ev} />
        {ev.rating ? <span className="rating"><Star size={16} fill="currentColor" /> {ev.rating}</span> : null}
      </div>
    </Link>
  );
}

export function EventRow({ ev, right }) {
  const { Icon, color } = catStyle(ev.categoria);
  const av = availability(ev);
  return (
    <Link to={`/evento/${ev.id}`} className="ev-row">
      <div className="ev-media"><img src={imgOf(ev)} alt="" loading="lazy" /></div>
      <div className="stack" style={{ gap: 5, minWidth: 0 }}>
        <span className="when">{relativeDay(ev.fecha) || shortDate(ev.fecha)} · {hora12(ev.hora)}</span>
        <h3 className="clamp-2">{ev.nombre}</h3>
        <span className="ev-meta"><MapPin size={16} /> <span className="clamp-1">{ev.lugar} · {ev.ciudad}</span></span>
        <div className="row-wrap" style={{ gap: 8 }}>
          <span className="ev-cat" style={{ color }}><Icon size={15} /> {shortCat(ev.categoria)}</span>
          <span className={`badge badge-${av.tone}`}>{av.label}</span>
          {ev.total_asistencias > 0 && <span className="tiny muted row" style={{ gap: 4 }}><Users size={15} /> {fmt(ev.total_asistencias)} asistirán</span>}
        </div>
      </div>
      <div className="row" onClick={(e) => right && e.preventDefault()}>{right || <FavButton ev={ev} className="icon-btn bordered" />}</div>
    </Link>
  );
}

export function RankCard({ ev, n }) {
  return (
    <Link to={`/evento/${ev.id}`} className="rank-item">
      <span className="rank-num">{n}</span>
      <div className="ev-media"><img src={imgOf(ev)} alt="" loading="lazy" /></div>
      <div className="info">
        <span className="tiny bold" style={{ color: 'var(--orange)' }}>{relativeDay(ev.fecha) || shortDate(ev.fecha)} · {hora12(ev.hora)}</span>
        <h3 className="clamp-2" style={{ fontSize: 15 }}>{ev.nombre}</h3>
        <span className="tiny muted clamp-1">{ev.lugar}</span>
      </div>
    </Link>
  );
}
