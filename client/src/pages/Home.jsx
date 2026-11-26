import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Pause, Play, Search, Sparkles, Flame,
  BarChart3, QrCode, MessageCircle, BellRing, PartyPopper, Tag, Ticket,
} from 'lucide-react';
import { api, qs } from '../api';
import { useApp } from '../context/AppContext';
import { EventCard, EventMedia, RankCard, imgOf } from '../components/EventCard';
import { Rail } from '../components/Rail';
import { Countdown, CountUp, EmptyState, Reveal, SkeletonGrid, prefersReducedMotion } from '../components/ui';
import { CITIES_FALLBACK } from '../components/Layout';
import { catStyle, shortCat, longDate, shortDate, hora12, relativeDay, fmt } from '../lib/format';

const SLIDE_MS = 6500;

/* ---------- Láminas destacadas: escenario principal de la portada ----------
   Zoom lento (Ken Burns), texto que entra por capas, segmentos tipo historias, arrastre con mouse o dedo
   y flechas del teclado. El avance lo marca la animación del segmento activo: al pausar se detiene todo. */
function Showcase({ eventos, onActive }) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const drag = useRef(null);
  const dragged = useRef(false);
  const reduced = prefersReducedMotion();
  const n = eventos.length;
  const paused = hover || pressed || userPaused || reduced;
  const go = useCallback((k) => setI(((k % n) + n) % n), [n]);
  useEffect(() => { onActive?.(eventos[i]); }, [i, eventos, onActive]);

  if (!n) return (
    <div className="showcase"><div className="slider skel on-dark" /><div className="thumbs-wrap"><div className="thumbs">{[0, 1, 2, 3].map((k) => <div key={k} className="thumb-tile skel on-dark" />)}</div></div></div>
  );

  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; dragged.current = false; setPressed(true); };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x) > 10 && Math.abs(e.clientX - drag.current.x) > Math.abs(e.clientY - drag.current.y)) dragged.current = true;
  };
  const endDrag = (e) => {
    const d = drag.current;
    drag.current = null;
    setPressed(false);
    if (!d) return;
    const dx = e.clientX - d.x;
    if (dragged.current && Math.abs(dx) > 48) go(i + (dx < 0 ? 1 : -1));
  };
  // Si hubo arrastre, el clic no abre el evento
  const onClickCapture = (e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; } };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
  };

  return (
    <div className={`showcase ${paused ? 'is-paused' : ''}`} style={{ '--dur': `${SLIDE_MS}ms` }}>
      <div className="slider" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPressed(false); drag.current = null; }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={() => { drag.current = null; setPressed(false); }}
        onClickCapture={onClickCapture} onKeyDown={onKeyDown} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        aria-roledescription="carrusel" aria-label="Eventos destacados" role="region">
        <div className="slider-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {eventos.map((ev, k) => {
            const rel = relativeDay(ev.fecha);
            return (
              <Link key={ev.id} to={`/evento/${ev.id}`} className={`slide ${k === i ? 'active' : ''}`} aria-hidden={k !== i} tabIndex={k === i ? 0 : -1}
                aria-roledescription="lámina" aria-label={`${k + 1} de ${n}: ${ev.nombre}`} draggable="false">
                <div className="slide-media" style={{ '--c': catStyle(ev.categoria).color }}>{ev.imagen ? <img src={ev.imagen} alt="" loading={k === 0 ? 'eager' : 'lazy'} draggable="false" /> : <EventMedia ev={ev} />}</div>
                <div className="slide-info">
                  <div className="row-wrap slide-badges" style={{ gap: 8 }}>
                    {ev.destacado && <span className="badge badge-glass-violet"><Sparkles size={13} /> Destacado</span>}
                    <span className="badge badge-glass">{shortCat(ev.categoria)}</span>
                    {rel && <span className="badge badge-glass-orange">{rel}</span>}
                    {ev.disponibilidad === 'LIBRE' && <span className="badge badge-glass">Entrada libre</span>}
                    {ev.disponibilidad === 'ULTIMOS' && <span className="badge badge-glass-orange">Últimos cupos</span>}
                    {ev.disponibilidad === 'AGOTADO' && <span className="badge badge-glass">Agotado</span>}
                  </div>
                  <h3>{ev.nombre}</h3>
                  <div className="slide-meta">
                    <span><CalendarDays size={17} /> {longDate(ev.fecha)}</span>
                    <span><Clock size={17} /> {hora12(ev.hora)}</span>
                    <span><MapPin size={17} /> {ev.lugar} · {ev.ciudad}</span>
                  </div>
                  <div className="slide-cta">
                    <span className="btn btn-orange">Ver evento <ArrowRight size={17} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="segments" role="group" aria-label="Láminas">
          {eventos.map((ev, k) => (
            <button key={ev.id} type="button" className={k < i ? 'done' : k === i ? 'active' : ''} onClick={() => go(k)}
              aria-label={`Ir a la lámina ${k + 1} de ${n}`} aria-current={k === i ? 'true' : undefined}>
              <i key={k === i ? `on-${i}` : 'off'} onAnimationEnd={k === i && !reduced ? (e) => e.animationName === 'seg-fill' && go(i + 1) : undefined} />
            </button>
          ))}
        </div>
        <div className="slider-ctrl">
          <button className="ctrl-arrow" onClick={() => go(i - 1)} aria-label="Anterior"><ChevronLeft size={22} /></button>
          {!reduced && (
            <button onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'Reanudar' : 'Pausar'}>{userPaused ? <Play size={17} /> : <Pause size={17} />}</button>
          )}
          <button className="ctrl-arrow" onClick={() => go(i + 1)} aria-label="Siguiente"><ChevronRight size={22} /></button>
        </div>
      </div>

      <div className="thumbs-wrap">
      <div className="thumbs" aria-label="Otras láminas">
        {eventos.map((ev, k) => (
          <button key={ev.id} className={`thumb-tile ${k === i ? 'active' : ''}`} onClick={() => go(k)} aria-label={`Ver ${ev.nombre}`}>
            <span className="tt-media" style={{ '--c': catStyle(ev.categoria).color }}>{ev.imagen ? <img src={ev.imagen} alt="" loading="lazy" /> : <EventMedia ev={ev} />}</span>
            <span className="tt">
              <small>{relativeDay(ev.fecha) || shortDate(ev.fecha)} · {hora12(ev.hora)}</small>
              <b className="clamp-2">{ev.nombre}</b>
              <span className="clamp-1">{ev.lugar}</span>
            </span>
            <i className="bar" key={`${k}-${i}`} />
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

function SearchCard() {
  const { categorias } = useApp();
  const navigate = useNavigate();
  const [f, setF] = useState({ q: '', categoria: '', cuando: '', ciudad: 'Abancay' });
  const submit = (e) => { e.preventDefault(); navigate(`/explorar${qs(f)}`); };
  return (
    <form className="search-card" onSubmit={submit} role="search" aria-label="Buscar eventos">
      <div className="sc-field sc-q">
        <Search size={22} />
        <div><label htmlFor="sc-q">¿Qué buscas?</label>
          <input id="sc-q" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Concierto, feria, artista…" /></div>
      </div>
      <div className="sc-field">
        <Tag size={22} />
        <div><label htmlFor="sc-cat">Categoría</label>
          <select id="sc-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{shortCat(c.nombre)}</option>)}
          </select></div>
      </div>
      <div className="sc-field">
        <CalendarDays size={22} />
        <div><label htmlFor="sc-when">Cuándo</label>
          <select id="sc-when" value={f.cuando} onChange={(e) => setF({ ...f, cuando: e.target.value })}>
            <option value="">Cualquier fecha</option>
            <option value="hoy">Hoy</option>
            <option value="manana">Mañana</option>
            <option value="finde">Este fin de semana</option>
            <option value="semana">Próximos 7 días</option>
            <option value="mes">Próximos 30 días</option>
          </select></div>
      </div>
      <div className="sc-field sc-city">
        <MapPin size={22} />
        <div><label htmlFor="sc-city">Dónde</label>
          <select id="sc-city" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })}>
            {CITIES_FALLBACK.map((c) => <option key={c}>{c}</option>)}
            <option value="">Toda la región</option>
          </select></div>
      </div>
      <button className="btn btn-grad"><Search size={20} /> Buscar</button>
    </form>
  );
}

const TABS = [['todo', 'Todo'], ['parati', 'Para ti'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['finde', 'Este fin de semana'], ['libre', 'Entrada libre']];

function DiscoverTabs() {
  const { user } = useApp();
  const [tab, setTab] = useState('todo');
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    let req;
    if (tab === 'parati') {
      if (!user) { setData({ needLogin: true, eventos: [] }); return; }
      req = api.get('/events/for-you?size=6');
    } else if (tab === 'libre') req = api.get('/events?size=6&disponibilidad=libre');
    else req = api.get(`/events${qs({ size: 6, cuando: tab === 'todo' ? '' : tab })}`);
    req.then(setData).catch(() => setData({ eventos: [] }));
  }, [tab, user]);
  const moreLink = tab === 'parati' ? '/cuenta/intereses' : tab === 'libre' ? '/explorar?disponibilidad=libre' : `/explorar${qs({ cuando: tab === 'todo' ? '' : tab })}`;
  return (
    <section className="section container">
      <div className="section-head">
        <div><h2>Descubre qué hacer</h2><p>Eventos próximos en Abancay y alrededores</p></div>
        <Link to={moreLink} className="see-all">Ver todos <ArrowRight size={17} /></Link>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {k === 'parati' && <Sparkles size={16} />}{label}
          </button>
        ))}
      </div>
      {!data ? <SkeletonGrid n={3} /> : data.needLogin ? (
        <EmptyState icon={Sparkles} title="Recomendaciones hechas para ti"
          text="Inicia sesión y elige tus intereses: te mostraremos los eventos que más van contigo."
          action={<Link to="/ingresar?next=/cuenta/intereses" className="btn btn-primary">Iniciar sesión</Link>} />
      ) : data.eventos.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No hay eventos para esta selección"
          text="Prueba con otra fecha o explora todo el catálogo." action={<Link to="/explorar" className="btn btn-light">Explorar eventos</Link>} />
      ) : (
        <>
          {tab === 'parati' && !data.personalizado && (
            <div className="form-note mb-2">Aún no conocemos tus gustos. <Link className="link" to="/cuenta/intereses">Elige tus intereses</Link> para mejorar estas recomendaciones.</div>
          )}
          <Reveal className="ev-grid">{data.eventos.map((ev) => <EventCard key={ev.id} ev={ev} />)}</Reveal>
        </>
      )}
    </section>
  );
}

// "No te lo pierdas": próximo evento guardado o con asistencia confirmada
function DontMiss() {
  const { user } = useApp();
  const [ev, setEv] = useState(null);
  useEffect(() => {
    if (!user) { setEv(null); return; }
    Promise.all([api.get('/me/attendances'), api.get('/me/favorites')]).then(([a, f]) => {
      const all = [...a.eventos, ...f.eventos].filter((e) => !e.pasado && ['PUBLICADO', 'AGOTADO'].includes(e.estado));
      all.sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
      setEv(all[0] || null);
    }).catch(() => {});
  }, [user]);
  if (!ev) return null;
  return (
    <section className="section container">
      <Link to={`/evento/${ev.id}`} className="card card-pad dontmiss">
        <img src={imgOf(ev)} alt="" />
        <div>
          <span className="badge badge-orange"><BellRing size={14} /> No te lo pierdas</span>
          <h3 className="mt-1" style={{ fontSize: 24 }}>{ev.nombre}</h3>
          <p className="muted mt-1">{longDate(ev.fecha)} · {hora12(ev.hora)} · {ev.lugar}</p>
          <span className="see-all mt-2">Ver detalles <ArrowRight size={16} /></span>
        </div>
        <Countdown fecha={ev.fecha} hora={ev.hora} />
      </Link>
    </section>
  );
}

const railSkeleton = () => [0, 1, 2, 3].map((k) => <div key={k} className="skel" style={{ aspectRatio: '4/3.4' }} />);

export default function Home() {
  const { categorias } = useApp();
  const [featured, setFeatured] = useState([]);
  const [active, setActive] = useState(null);
  const [top, setTop] = useState(null);
  const [week, setWeek] = useState(null);
  const [catRails, setCatRails] = useState([]);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/events/featured'), api.get('/events?size=8&orden=popular')]).then(([f, p]) => {
      // Mínimo 5 láminas: destacados primero y luego los más populares
      const ids = new Set(f.eventos.map((e) => e.id));
      setFeatured([...f.eventos, ...p.eventos.filter((e) => !ids.has(e.id))].slice(0, 5));
    });
    api.get('/events/top').then((r) => setTop(r.eventos));
    api.get('/events?size=12&cuando=semana').then((r) => setWeek(r.eventos));
    api.get('/events?size=1').then((r) => setTotal(r.total));
  }, []);

  // Filas por categoría: las dos categorías con más eventos próximos
  useEffect(() => {
    const best = [...categorias].filter((c) => c.proximos > 0).sort((a, b) => b.proximos - a.proximos).slice(0, 2);
    Promise.all(best.map((c) => api.get(`/events?size=10&categoria=${c.id_categoria}`).then((r) => ({ cat: c, eventos: r.eventos }))))
      .then(setCatRails).catch(() => {});
  }, [categorias]);

  return (
    <>
      <section className="hero2">
        <div className="hero2-bg" style={active ? { backgroundImage: `url("${imgOf(active)}")` } : undefined} aria-hidden="true" />
        {/* Aurora con los colores del logo: se mueve lento (12–20 s) solo con transform */}
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="container">
          <div className="hero2-top">
            <div className="hero-rise" style={{ '--d': '0ms' }}>
              <span className="hero-eyebrow"><MapPin size={15} /> Abancay · Apurímac{total ? <> · <CountUp value={total} duration={900} /> {total === 1 ? 'evento próximo' : 'eventos próximos'}</> : null}</span>
              <h1>Encuentra tu próximo <span className="accent">gran momento</span></h1>
            </div>
          </div>
          <div className="hero-rise" style={{ '--d': '200ms' }}><SearchCard /></div>
          <div className="hero-rise" style={{ '--d': '300ms' }}><Showcase eventos={featured} onActive={setActive} /></div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head"><div><h2>Explora por categoría</h2><p>Encuentra algo que vaya contigo</p></div>
          <Link to="/explorar" className="see-all">Todo el catálogo <ArrowRight size={17} /></Link></div>
        <Reveal className="cat-row">
          {categorias.map((c) => {
            const { Icon, color } = catStyle(c.nombre);
            return (
              <Link key={c.id_categoria} to={`/explorar?categoria=${c.id_categoria}`} className="cat-item" style={{ '--c': color }}>
                <span className="cat-tile"><Icon size={30} strokeWidth={1.75} /></span>
                {shortCat(c.nombre)}
                <small>{c.proximos} {c.proximos === 1 ? 'evento' : 'eventos'}</small>
              </Link>
            );
          })}
        </Reveal>
      </section>

      <DontMiss />
      <DiscoverTabs />

      {(top === null || top.length > 0) && (
        <Rail title={top && top.length < 10 ? 'Lo más popular esta semana' : 'Top 10 en Abancay esta semana'} subtitle="Los eventos con más interés de la comunidad" link="/explorar?orden=popular" linkLabel="Ver ranking"
          icon={<Flame size={24} color="var(--orange)" style={{ verticalAlign: '-3px', marginRight: 6 }} />}>
          {top === null ? railSkeleton() : top.map((ev, k) => <RankCard key={ev.id} ev={ev} n={k + 1} />)}
        </Rail>
      )}

      {(week === null || week.length > 0) && (
        <Rail title="Esta semana" subtitle="Lo que pasa en los próximos 7 días" link="/explorar?cuando=semana">
          {week === null ? railSkeleton() : week.map((ev) => <EventCard key={ev.id} ev={ev} />)}
        </Rail>
      )}

      {catRails.map(({ cat, eventos }) => {
        const { Icon, color } = catStyle(cat.nombre);
        return (
          <Rail key={cat.id_categoria} title={cat.nombre} subtitle={cat.descripcion} link={`/explorar?categoria=${cat.id_categoria}`} wide
            icon={<Icon size={24} color={color} style={{ verticalAlign: '-3px', marginRight: 8 }} />}>
            {eventos.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </Rail>
        );
      })}

      <div className="container">
        <div className="cta-band">
          <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
          <div>
            <span className="hero-eyebrow"><PartyPopper size={15} /> Para organizadores</span>
            <h2 className="mt-1">¿Organizas eventos en Apurímac? Publícalos gratis</h2>
            <p>Llega a más personas, recibe consultas directas por WhatsApp y mide el impacto de tu evento con estadísticas en tiempo real.</p>
            <div className="row-wrap mt-3">
              <Link to="/publicar" className="btn btn-orange btn-lg">Publicar mi evento <ArrowRight size={19} /></Link>
              <Link to="/explorar" className="btn btn-lg btn-outline-white">Ver eventos</Link>
            </div>
          </div>
          <ul>
            <li><MessageCircle size={22} /> Contacto directo por WhatsApp y llamada</li>
            <li><BarChart3 size={22} /> Panel de marketing: vistas, guardados, clics</li>
            <li><QrCode size={22} /> Código QR único para tus afiches</li>
            <li><BellRing size={22} /> Recordatorios automáticos a tus asistentes</li>
          </ul>
        </div>
      </div>
      {total ? <p className="center tiny muted mt-3">{fmt(total)} eventos publicados y verificados por Eventia</p> : null}
    </>
  );
}
