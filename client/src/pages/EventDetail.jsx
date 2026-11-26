import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarCheck, CalendarDays, CalendarPlus, Check, Sparkles, Clock, Facebook, Flag, Globe, Heart, Instagram, MapPin, MessageCircle,
  Navigation, Phone, Share2, Star, Ticket, Users, Eye, Mic2, AlertTriangle, Pencil, QrCode, ChevronRight,
} from 'lucide-react';
import { api, track } from '../api';
import { useCredits, creditFor } from '../lib/credits';
import { useApp, useRequireLogin } from '../context/AppContext';
import { EventCard, imgOf } from '../components/EventCard';
import { MapView } from '../components/MapView';
import { ShareModal, ReportModal, QrModal } from '../components/Modals';
import { Avatar, Countdown, EmptyState, Stars, StarsInput, StatusBadge, prefersReducedMotion } from '../components/ui';
import {
  availability, catStyle, dateChip, downloadIcs, fmt, googleCalendarLink, hora12, longDate, mapsLink, relativeDay,
  shortCat, timeAgo, waLink, wazeLink,
} from '../lib/format';

function RatingForm({ ev, onDone }) {
  const { toast } = useApp();
  const [p, setP] = useState(0);
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/events/${ev.id}/ratings`, { puntuacion: p, comentario: c });
      toast('¡Gracias por tu valoración!');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="card card-pad stack" style={{ background: 'var(--surface-2)' }}>
      <h3>¿Cómo estuvo el evento?</h3>
      <StarsInput value={p} onChange={setP} />
      <textarea className="textarea" style={{ minHeight: 80 }} maxLength={2000} value={c} onChange={(e) => setC(e.target.value)} placeholder="Cuéntanos tu experiencia (opcional)" />
      <div><button className="btn btn-primary" disabled={!p || busy} onClick={send}>Publicar valoración</button></div>
    </div>
  );
}

// Esqueleto con la misma forma de la página; aparece solo si la carga tarda (evita parpadeos)
function DetailSkeleton() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 250); return () => clearTimeout(t); }, []);
  if (!show) return <div style={{ minHeight: '100vh' }} />;
  return (
    <div aria-busy="true" aria-label="Cargando evento">
      <div className="detail-band">
        <div className="container">
          <div className="crumbs"><span className="skel on-dark" style={{ width: 220, height: 14 }} /></div>
          <div className="detail-hero skel on-dark" />
        </div>
      </div>
      <div className="container">
        <div className="detail-grid">
          <div className="stack">
            <div className="skel" style={{ width: 160, height: 26, borderRadius: 99 }} />
            <div className="skel" style={{ width: '80%', height: 44 }} />
            <div className="skel" style={{ width: '45%', height: 16 }} />
            <div className="facts"><div className="skel" style={{ height: 110 }} /><div className="skel" style={{ height: 110 }} /></div>
            <div className="skel" style={{ height: 14 }} /><div className="skel" style={{ height: 14, width: '92%' }} /><div className="skel" style={{ height: 14, width: '70%' }} />
          </div>
          <div className="card card-pad stack"><div className="skel" style={{ height: 70 }} /><div className="skel" style={{ height: 12 }} /><div className="skel" style={{ height: 58, borderRadius: 99 }} /></div>
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#2f4fe0', '#7c3aed', '#ff6a13', '#16a34a', '#e11d48', '#f59e0b'];
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const dist = 70 + (i % 4) * 22;
    return {
      '--x': `${Math.cos(angle) * dist}px`, '--y': `${Math.sin(angle) * dist - 30}px`,
      '--r': `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`, '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    };
  });
  return <span className="confetti" aria-hidden="true">{pieces.map((s, i) => <i key={i} style={s} />)}</span>;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user, toast } = useApp();
  const requireLogin = useRequireLogin();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const credits = useCredits();

  const load = useCallback(() => api.get(`/events/${id}`).then(setData).catch((e) => setError(e)), [id]);
  useEffect(() => { setData(null); setError(null); load(); track(id, 'VISUALIZACION'); }, [id, load]); // RF43
  useEffect(() => { if (data) document.title = `${data.evento.nombre} · Eventia`; return () => { document.title = 'Eventia · Descubre · Conecta · Vive'; }; }, [data]);
  // Paralaje suave del fondo difuminado: se mueve más lento que la página
  const bgRef = useRef(null);
  useEffect(() => {
    if (!data || prefersReducedMotion()) return undefined;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${Math.min(window.scrollY, 900) * 0.3}px, 0)`;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [data]);

  if (error) return (
    <div className="container section"><EmptyState icon={AlertTriangle} title="Evento no disponible" text={error.message}
      action={<Link to="/explorar" className="btn btn-primary">Explorar eventos</Link>} /></div>
  );
  if (!data) return <DetailSkeleton />;
  const ev = data.evento;
  const c = ev.contacto || {};
  const chip = dateChip(ev.fecha);
  const av = availability(ev);
  const { Icon: CatIcon, color } = catStyle(ev.categoria);
  const activo = ['PUBLICADO', 'AGOTADO'].includes(ev.estado) && !ev.pasado;
  const pct = ev.capacidad > 0 ? Math.round((ev.entradas_disponibles / ev.capacidad) * 100) : 100;
  const msg = `Hola, vi "${ev.nombre}" en Eventia y quisiera más información.`;

  const patch = (fn) => setData((d) => ({ ...d, evento: { ...d.evento, ...fn(d.evento) } }));

  const setFav = async (next, { silent } = {}) => {
    patch((e) => ({ es_favorito: next, total_favoritos: Math.max(0, (e.total_favoritos || 0) + (next ? 1 : -1)) }));
    if (next) navigator.vibrate?.(12);
    try {
      await (next ? api.post(`/events/${ev.id}/favorite`) : api.del(`/events/${ev.id}/favorite`));
      if (silent) return;
      if (next) toast('Guardado en favoritos. Te recordaremos antes del evento.');
      else toast('Quitado de favoritos', 'info', { action: { label: 'Deshacer', onClick: () => setFav(true, { silent: true }) } });
    } catch (e) { toast(e.message, 'error'); load(); }
  };
  const toggleFav = () => requireLogin('Inicia sesión para guardar eventos.') && setFav(!ev.es_favorito);

  // Asistencia optimista: el botón cambia al instante; si el servidor rechaza, se recarga el estado real
  const toggleAttend = async () => {
    if (!requireLogin('Inicia sesión para confirmar tu asistencia.')) return;
    const next = !ev.asistire;
    setBusy(true);
    patch((e) => ({ asistire: next, total_asistencias: Math.max(0, (e.total_asistencias || 0) + (next ? 1 : -1)) }));
    if (next) { navigator.vibrate?.([10, 40, 18]); if (!prefersReducedMotion()) setCelebrate((c) => c + 1); }
    try {
      const r = next ? await api.post(`/events/${ev.id}/attend`) : await api.del(`/events/${ev.id}/attend`);
      if (r.asistire) toast('¡Listo! Te recordaremos antes del evento.', 'success', { action: { label: 'Agregar al calendario', onClick: () => downloadIcs(ev) } });
      else toast('Cancelaste tu asistencia', 'info');
      load();
    } catch (e) { toast(e.message, 'error'); load(); } finally { setBusy(false); }
  };
  const report = () => requireLogin('Inicia sesión para reportar un evento.') && setModal('report');
  // En celulares se abre el menú nativo de compartir (menos pasos); en escritorio, nuestras opciones
  const share = async () => {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: ev.nombre, text: `¡Mira este evento en Eventia! ${ev.nombre}`, url: `${location.origin}/evento/${ev.id}` }); track(ev.id, 'COMPARTIDO'); } catch { /* cancelado */ }
      return;
    }
    setModal('share');
  };

  const ContactButtons = ({ compact }) => (
    <div className={compact ? 'row' : 'contact-grid'} style={compact ? { gap: 8 } : undefined}>
      {c.whatsapp && (
        <a className="btn btn-whatsapp" href={waLink(c.whatsapp, msg)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_WHATSAPP')}>
          <MessageCircle size={18} /> WhatsApp
        </a>
      )}
      {(c.telefono || c.whatsapp) && (
        <a className="btn btn-light" href={`tel:${c.telefono || c.whatsapp}`} onClick={() => track(ev.id, 'CLIC_LLAMADA')}>
          <Phone size={17} /> Llamar
        </a>
      )}
    </div>
  );

  return (
    <div className={activo ? 'has-mobile-cta' : ''}>
      {/* Banda de portada a todo el ancho con el afiche grande */}
      <div className="detail-band">
        <div className="bg" ref={bgRef} style={{ backgroundImage: `url("${imgOf(ev)}")` }} aria-hidden="true" />
        <div className="container">
          <nav className="crumbs" aria-label="Ruta">
            <Link to="/">Inicio</Link><ChevronRight size={15} />
            <Link to={`/explorar?categoria=${ev.id_categoria}`}>{shortCat(ev.categoria)}</Link><ChevronRight size={15} />
            <span className="clamp-1">{ev.nombre}</span>
          </nav>
          <div className="detail-top">
          <div className={`detail-hero ${portrait ? 'portrait' : ''}`}>
            {/* Afiches verticales se muestran completos; fotos horizontales llenan el espacio */}
            <img src={imgOf(ev)} alt={`Afiche de ${ev.nombre}`} onLoad={(e) => setPortrait(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 0.8)} />
            {!activo && <div className="hero-actions">
              <button className="icon-btn" onClick={toggleFav} aria-label={ev.es_favorito ? 'Quitar de favoritos' : 'Guardar'} style={{ color: ev.es_favorito ? 'var(--red)' : undefined }}>
                <Heart size={21} fill={ev.es_favorito ? 'currentColor' : 'none'} />
              </button>
              <button className="icon-btn" onClick={share} aria-label="Compartir"><Share2 size={21} /></button>
            </div>}
          </div>
          <header className="detail-head">
            <div className="row-wrap" style={{ gap: 8 }}>
              <span className="badge badge-glass"><CatIcon size={14} /> {shortCat(ev.categoria)}</span>
              {ev.destacado && <span className="badge badge-glass-violet"><Sparkles size={13} /> Destacado</span>}
              {relativeDay(ev.fecha) && activo && <span className="badge badge-glass-orange">{relativeDay(ev.fecha)}</span>}
              {!activo && <StatusBadge estado={ev.pasado && ev.estado !== 'ARCHIVADO' ? 'FINALIZADO' : ev.estado} />}
            </div>
            <h1 className="detail-title">{ev.nombre}</h1>
            <ul className="dh-facts">
              <li><CalendarDays size={20} /><span><b>{longDate(ev.fecha)}</b><small>{hora12(ev.hora)} · hora de Perú</small></span></li>
              <li><MapPin size={20} /><span><b>{ev.lugar}</b><small>{ev.direccion}, {ev.ciudad}</small></span></li>
            </ul>
            {ev.total_asistencias > 0 && (
              <p className="dh-going"><Users size={16} /> {fmt(ev.total_asistencias)} {ev.total_asistencias === 1 ? 'persona asistirá' : 'personas asistirán'}
                {ev.rating && <span className="rating"><Star size={14} fill="currentColor" /> {ev.rating}</span>}</p>
            )}
            {activo && (
              <div className="dh-cta">
                <button className={`btn btn-lg attend-btn ${ev.asistire ? 'btn-active' : 'btn-primary'}`} onClick={toggleAttend} disabled={busy} aria-pressed={!!ev.asistire}>
                  {ev.asistire ? <><Check size={19} /> Asistirás</> : <><CalendarCheck size={19} /> Asistiré</>}
                  {celebrate > 0 && ev.asistire && <Confetti key={`h${celebrate}`} />}
                </button>
                <button className="icon-btn glass-btn" onClick={toggleFav} aria-pressed={!!ev.es_favorito} aria-label={ev.es_favorito ? 'Quitar de favoritos' : 'Guardar'} title="Guardar">
                  <Heart size={20} fill={ev.es_favorito ? 'currentColor' : 'none'} style={{ color: ev.es_favorito ? '#fb7185' : undefined }} />
                </button>
                <button className="icon-btn glass-btn" onClick={share} aria-label="Compartir" title="Compartir"><Share2 size={20} /></button>
              </div>
            )}
          </header>
          </div>
          {creditFor(credits, ev.imagen) && (() => {
            const cr = creditFor(credits, ev.imagen);
            return (
              <p className="photo-credit">
                Foto: <a href={cr.fuente} target="_blank" rel="noopener noreferrer">{cr.autor}</a> ·{' '}
                <a href={cr.licencia_url} target="_blank" rel="noopener noreferrer">{cr.licencia}</a> · imagen ilustrativa
              </p>
            );
          })()}
        </div>
      </div>

      <div className="container">
      {(ev.es_propietario || user?.rol === 'ADMINISTRADOR') && (
        <div className="form-note row between mt-3" style={{ flexWrap: 'wrap' }}>
          <span className="row"><StatusBadge estado={ev.estado} /> {ev.es_propietario ? 'Eres el organizador de este evento.' : 'Vista de administrador.'}</span>
          <span className="row">
            <button className="btn btn-light btn-sm" onClick={() => setModal('qr')}><QrCode size={16} /> QR</button>
            <Link to={`/organizador/eventos/${ev.id}/editar`} className="btn btn-primary btn-sm"><Pencil size={16} /> Editar</Link>
          </span>
        </div>
      )}

      <div className="detail-grid">
        <article>

          <div className="facts">
            <div className="fact">
              <div className="cal-tile"><div className="m">{chip.mes}</div><div className="d">{chip.num}</div></div>
              <div>
                <h4>{longDate(ev.fecha)}</h4>
                <p className="muted small">{hora12(ev.hora)} · hora de Perú</p>
                <div className="links">
                  <a className="link row" style={{ gap: 4 }} href={googleCalendarLink(ev)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={14} /> Google Calendar</a>
                  <button className="link" onClick={() => downloadIcs(ev)}>Descargar .ics</button>
                </div>
              </div>
            </div>
            <div className="fact">
              <div className="fact-ic"><MapPin size={24} /></div>
              <div className="grow">
                <h4>{ev.lugar}</h4>
                <p className="muted small">{ev.direccion}, {ev.ciudad}</p>
                <div className="links">
                  <a className="link row" style={{ gap: 4 }} href={mapsLink(ev)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_MAPA')}><Navigation size={14} /> Cómo llegar</a>
                  <a className="link" href={wazeLink(ev)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_MAPA')}>Waze</a>
                </div>
              </div>
            </div>
          </div>

          <section className="detail-section">
            <h2>Acerca del evento</h2>
            <p className="prose">{ev.descripcion}</p>
          </section>

          {ev.artistas && (
            <section className="detail-section">
              <h2>Artistas y participantes</h2>
              <div className="row-wrap">
                {ev.artistas.split(/,|\n/).map((a) => a.trim()).filter(Boolean).map((a) => (
                  <span key={a} className="chip" style={{ cursor: 'default' }}><Mic2 size={15} color="var(--violet)" /> {a}</span>
                ))}
              </div>
            </section>
          )}

          <section className="detail-section">
            <h2>Ubicación</h2>
            {ev.latitud != null ? <MapView lat={ev.latitud} lng={ev.longitud} label={ev.lugar} color={color} />
              : <p className="muted">El organizador no marcó el punto exacto en el mapa.</p>}
            <div className="row-wrap mt-2">
              <a className="btn btn-light btn-sm" href={mapsLink(ev)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_MAPA')}><Navigation size={15} /> Abrir en Google Maps</a>
              <a className="btn btn-light btn-sm" href={wazeLink(ev)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_MAPA')}>Abrir en Waze</a>
            </div>
          </section>

          <section className="detail-section">
            <h2>Organizado por</h2>
            <div className="card card-pad">
              <div className="org-card">
                <Avatar name={ev.organizador} large />
                <div className="grow">
                  <h3>{ev.organizador}</h3>
                  <p className="muted small">{c.total_eventos} {c.total_eventos === 1 ? 'evento publicado' : 'eventos publicados'} en Eventia</p>
                  <div className="row mt-1" style={{ gap: 4 }}>
                    {c.facebook && <a className="icon-btn bordered" href={c.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={17} /></a>}
                    {c.instagram && <a className="icon-btn bordered" href={c.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={17} /></a>}
                    {c.otras_redes && /^https?:/.test(c.otras_redes) && <a className="icon-btn bordered" href={c.otras_redes} target="_blank" rel="noopener noreferrer" aria-label="Otra red"><Globe size={17} /></a>}
                  </div>
                </div>
              </div>
              <hr className="divider" />
              <p className="small muted mb-2">¿Dudas sobre entradas, precios o acceso? Escribe directamente al organizador.</p>
              <ContactButtons />
              {c.whatsapp && c.telefono && c.whatsapp !== c.telefono && (
                <p className="tiny muted mt-1">WhatsApp: {c.whatsapp} · Llamadas: {c.telefono}</p>
              )}
            </div>
          </section>

          <section className="detail-section">
            <div className="row between mb-2">
              <h2 style={{ margin: 0 }}>Valoraciones</h2>
              {ev.rating && <span className="row"><Stars value={ev.rating} /> <b>{ev.rating}</b> <span className="muted small">({ev.total_valoraciones})</span></span>}
            </div>
            {ev.puede_valorar && <RatingForm ev={ev} onDone={load} />}
            {ev.mi_valoracion && <div className="form-note mb-2">Tu valoración: {ev.mi_valoracion.puntuacion} ★ {ev.mi_valoracion.comentario ? `— “${ev.mi_valoracion.comentario}”` : ''}</div>}
            {ev.valoraciones.length === 0 ? (
              <p className="muted small">{ev.pasado ? 'Aún no hay valoraciones.' : 'Las valoraciones se habilitan después del evento para quienes marcaron “Asistiré”.'}</p>
            ) : ev.valoraciones.map((r) => (
              <div className="review" key={r.id}>
                <Avatar name={r.nombre} />
                <div>
                  <div className="row" style={{ gap: 8 }}><b className="small">{r.nombre}</b><Stars value={r.puntuacion} size={13} /><span className="tiny muted">{timeAgo(r.fecha)}</span></div>
                  {r.comentario && <p className="small mt-1">{r.comentario}</p>}
                </div>
              </div>
            ))}
          </section>

          <div className="detail-section">
            <button className="btn btn-ghost btn-sm" onClick={report}><Flag size={15} /> Reportar este evento</button>
          </div>
        </article>

        {/* Panel de acción fijo (escritorio) */}
        <aside className="side-card">
          <div className="card">
            <div className="card-pad">
              {activo ? <>
                <div>
                  <span className="tiny bold muted" style={{ letterSpacing: '.08em' }}>FALTAN</span>
                  <div className="mt-1"><Countdown fecha={ev.fecha} hora={ev.hora} /></div>
                </div>
                <div>
                  <div className="row between small"><b className="row" style={{ gap: 6 }}><Ticket size={16} /> Disponibilidad</b><span className={`badge badge-${av.tone}`}>{av.label}</span></div>
                  {ev.capacidad > 0 && (
                    <>
                      <div className={`meter mt-1 ${pct === 0 ? 'out' : pct <= 20 ? 'low' : ''}`}><span style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                      <p className="tiny muted mt-1">{fmt(ev.entradas_disponibles)} de {fmt(ev.capacidad)} cupos disponibles</p>
                    </>
                  )}
                </div>
                <button className={`btn btn-lg btn-block attend-btn ${ev.asistire ? 'btn-active' : 'btn-grad'}`} onClick={toggleAttend} disabled={busy}
                  aria-pressed={!!ev.asistire}>
                  {ev.asistire ? <><Check size={19} /> Asistirás</> : <><CalendarCheck size={19} /> Asistiré</>}
                  {celebrate > 0 && ev.asistire && <Confetti key={celebrate} />}
                </button>
                {ev.asistire && (
                  <p className="tiny muted center" style={{ marginTop: -6 }}>
                    <button className="link" onClick={() => downloadIcs(ev)}>Agregar al calendario</button> · <button className="link" onClick={toggleAttend} disabled={busy}>Ya no asistiré</button>
                  </p>
                )}
                <div className="contact-grid">
                  <button className={`btn btn-light ${ev.es_favorito ? 'fav-on' : ''}`} onClick={toggleFav} aria-pressed={!!ev.es_favorito} style={{ color: ev.es_favorito ? 'var(--red)' : undefined }}>
                    <Heart size={17} fill={ev.es_favorito ? 'currentColor' : 'none'} /> {ev.es_favorito ? 'Guardado' : 'Guardar'}
                  </button>
                  <button className="btn btn-light" onClick={share}><Share2 size={17} /> Compartir</button>
                </div>
                <hr className="divider" style={{ margin: '4px 0' }} />
                <span className="small bold">Contactar al organizador</span>
                <ContactButtons />
                {ev.total_asistencias > 0 && (
                  <p className="tiny muted row" style={{ gap: 6 }}><Users size={14} /> {fmt(ev.total_asistencias)} {ev.total_asistencias === 1 ? 'persona asistirá' : 'personas asistirán'}</p>
                )}
              </> : (
                <>
                  <StatusBadge estado={ev.pasado && ev.estado !== 'ARCHIVADO' ? 'FINALIZADO' : ev.estado} />
                  <h3>{ev.pasado ? 'Este evento ya se realizó' : 'Este evento no está disponible'}</h3>
                  <p className="muted small">{ev.pasado ? 'Puedes ver su información y las valoraciones de quienes asistieron.' : 'Pronto podría publicarse.'}</p>
                  <Link to="/explorar" className="btn btn-primary">Ver eventos próximos</Link>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {data.del_organizador.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Más de {ev.organizador}</h2></div>
          <div className="ev-grid">{data.del_organizador.map((e) => <EventCard key={e.id} ev={e} />)}</div>
        </section>
      )}
      {data.similares.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>También te puede interesar</h2><Link to={`/explorar?categoria=${ev.id_categoria}`} className="see-all">Ver más</Link></div>
          <div className="ev-grid">{data.similares.map((e) => <EventCard key={e.id} ev={e} />)}</div>
        </section>
      )}

      {/* Barra de acción fija (móvil) */}
      {activo && (
        <div className="mobile-cta">
          <button className="icon-btn bordered" onClick={toggleFav} aria-label="Guardar" style={{ color: ev.es_favorito ? 'var(--red)' : undefined, width: 52, height: 52 }}>
            <Heart size={19} fill={ev.es_favorito ? 'currentColor' : 'none'} />
          </button>
          {c.whatsapp && (
            <a className="btn btn-whatsapp" style={{ height: 52, width: 56, padding: 0 }} href={waLink(c.whatsapp, msg)} target="_blank" rel="noopener noreferrer" onClick={() => track(ev.id, 'CLIC_WHATSAPP')} aria-label="WhatsApp">
              <MessageCircle size={19} />
            </a>
          )}
          {ev.asistire ? (
            <>
              <button className="icon-btn bordered" style={{ width: 52, height: 52 }} onClick={() => downloadIcs(ev)} aria-label="Agregar al calendario"><CalendarPlus size={19} /></button>
              <button className="btn btn-active attend-btn grow" style={{ height: 52 }} onClick={toggleAttend} disabled={busy} aria-pressed="true" aria-label="Asistirás. Toca para cancelar">
                <Check size={18} /> Asistirás
                {celebrate > 0 && <Confetti key={celebrate} />}
              </button>
            </>
          ) : (
            <button className="btn grow btn-grad attend-btn" style={{ height: 52 }} onClick={toggleAttend} disabled={busy} aria-pressed="false">
              <CalendarCheck size={18} /> Asistiré
            </button>
          )}
        </div>
      )}

      {modal === 'share' && <ShareModal ev={ev} onClose={() => setModal(null)} />}
      {modal === 'report' && <ReportModal ev={ev} onClose={() => setModal(null)} />}
      {modal === 'qr' && <QrModal ev={ev} onClose={() => setModal(null)} />}
      </div>
    </div>
  );
}
