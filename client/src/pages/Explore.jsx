import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, List, Map as MapIcon, SlidersHorizontal, X, SearchX, Search, MapPin, Loader2, CalendarDays } from 'lucide-react';
import { api, qs } from '../api';
import { useApp } from '../context/AppContext';
import { EventCard, EventRow } from '../components/EventCard';
import { EventsMap } from '../components/MapView';
import { EmptyState, SkeletonGrid } from '../components/ui';
import { catStyle, shortCat } from '../lib/format';
import { CITIES_FALLBACK } from '../components/Layout';

const WHEN = [['', 'Cualquier fecha'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['finde', 'Este fin de semana'], ['semana', 'Próximos 7 días'], ['mes', 'Próximos 30 días']];
const AVAIL = [['', 'Todos'], ['con_cupos', 'Con cupos disponibles'], ['libre', 'Entrada libre']];
const ORDER = [['fecha', 'Más próximos'], ['popular', 'Más populares'], ['recientes', 'Recién publicados']];
// Atajos de un toque, visibles también en móvil (sin abrir el cajón de filtros)
const QUICK = [['cuando', 'hoy', 'Hoy'], ['cuando', 'manana', 'Mañana'], ['cuando', 'finde', 'Fin de semana'], ['cuando', 'semana', '7 días'], ['disponibilidad', 'libre', 'Entrada libre'], ['disponibilidad', 'con_cupos', 'Con cupos']];

function QuickFilters({ params, set, lead }) {
  return (
    <div className="quick-filters" role="group" aria-label="Filtros rápidos">
      {lead}
      {QUICK.map(([k, v, label]) => {
        const on = params.get(k) === v;
        return (
          <button key={v} className={`qchip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set(k, on ? '' : v)}>
            {label}{on && <X size={13} aria-hidden="true" />}
          </button>
        );
      })}
      <Link to="/calendario" className="qchip"><CalendarDays size={15} /> Calendario</Link>
    </div>
  );
}

function KeywordSearch({ params, set, className = '' }) {
  const [q, setQ] = useState(params.get('q') || '');
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setQ(params.get('q') || ''); }, [params]);
  useEffect(() => {
    if (!typing.current) return undefined;
    const t = setTimeout(() => { typing.current = false; set('q', q.trim(), { replace: true }); }, 380);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className={className} role="search" onSubmit={(e) => { e.preventDefault(); typing.current = false; set('q', q.trim()); }}>
      <div className="input-icon"><Search size={17} />
        <input className="input" type="search" value={q} onChange={(e) => { typing.current = true; setQ(e.target.value); }}
          placeholder="Buscar evento, artista o lugar…" aria-label="Buscar eventos" enterKeyHint="search" />
      </div>
    </form>
  );
}

function Filters({ params, set, categorias, withOrder }) {
  const [q, setQ] = useState(params.get('q') || '');
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setQ(params.get('q') || ''); }, [params]);
  // Búsqueda en vivo: aplica la palabra clave al dejar de teclear, sin tener que pulsar Enter
  useEffect(() => {
    if (!typing.current) return undefined;
    const t = setTimeout(() => { typing.current = false; set('q', q.trim(), { replace: true }); }, 380);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const Opt = ({ k, v, label, count, icon }) => {
    const on = (params.get(k) || '') === v;
    return (
      <button className={`filter-opt ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => set(k, v)}>
        {icon}{label}{count !== undefined && <span className="count">{count}</span>}
      </button>
    );
  };
  return (
    <>
      {!withOrder && (
      <form onSubmit={(e) => { e.preventDefault(); typing.current = false; set('q', q.trim()); }}>
        <div className="input-icon"><Search size={17} />
          <input className="input" type="search" value={q} onChange={(e) => { typing.current = true; setQ(e.target.value); }}
            placeholder="Palabra clave, artista…" aria-label="Palabra clave" enterKeyHint="search" />
        </div>
      </form>
      )}
      <div>
        <h4>Fecha</h4>
        <div className="filter-list">{WHEN.map(([v, l]) => <Opt key={v} k="cuando" v={v} label={l} />)}</div>
        <div className="grid-2 mt-1" style={{ gap: 8 }}>
          <label className="field"><small>Desde</small><input type="date" className="input" style={{ height: 46 }} value={params.get('desde') || ''} onChange={(e) => set('desde', e.target.value)} /></label>
          <label className="field"><small>Hasta</small><input type="date" className="input" style={{ height: 46 }} value={params.get('hasta') || ''} onChange={(e) => set('hasta', e.target.value)} /></label>
        </div>
      </div>
      <div>
        <h4>Categoría</h4>
        <div className="filter-list">
          <Opt k="categoria" v="" label="Todas las categorías" />
          {categorias.map((c) => {
            const { Icon, color } = catStyle(c.nombre);
            return <Opt key={c.id_categoria} k="categoria" v={String(c.id_categoria)} label={shortCat(c.nombre)} count={c.proximos} icon={<Icon size={16} color={color} />} />;
          })}
        </div>
      </div>
      {withOrder && (
        <div>
          <h4>Ordenar por</h4>
          <div className="filter-list">{ORDER.map(([v, l]) => <Opt key={v} k="orden" v={v === 'fecha' ? '' : v} label={l} />)}</div>
        </div>
      )}
      <div>
        <h4>Disponibilidad</h4>
        <div className="filter-list">{AVAIL.map(([v, l]) => <Opt key={v} k="disponibilidad" v={v} label={l} />)}</div>
      </div>
    </>
  );
}

export default function Explore() {
  const { categorias } = useApp();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem('eventia_view') || 'grid');
  const [drawer, setDrawer] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const reqId = useRef(0);
  const sentinel = useRef(null);
  const key = params.toString();

  const set = (k, v, { replace = false } = {}) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    if (k === 'cuando') { p.delete('desde'); p.delete('hasta'); }
    if (k === 'desde' || k === 'hasta') p.delete('cuando');
    setParams(p, { replace });
  };

  // Al cambiar filtros se mantienen los resultados anteriores (atenuados) hasta que llegan los nuevos
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const size = view === 'map' ? 60 : 12;
    api.get(`/events${qs({ ...Object.fromEntries(params), size, page: 1 })}`)
      .then((r) => { if (id !== reqId.current) return; setData(r); setItems(r.eventos); setPage(1); })
      .catch(() => { if (id === reqId.current) setData((d) => d || { total: 0, eventos: [] }); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [key, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = !!data && view !== 'map' && items.length < data.total;
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const next = page + 1;
      const r = await api.get(`/events${qs({ ...Object.fromEntries(params), size: 12, page: next })}`);
      if (id !== reqId.current) return;
      setItems((x) => [...x, ...r.eventos]);
      setPage(next);
    } finally { setLoadingMore(false); }
  };
  // Carga continua: al acercarse al final de la lista se piden más eventos
  useEffect(() => {
    if (!hasMore || loading || !sentinel.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '600px 0px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const changeView = (v) => { setView(v); localStorage.setItem('eventia_view', v); };
  const closeDrawer = () => {
    setDrawerClosing(true);
    setTimeout(() => { setDrawer(false); setDrawerClosing(false); }, 200);
  };
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [drawer]);

  const catName = categorias.find((c) => String(c.id_categoria) === params.get('categoria'))?.nombre;
  const chips = useMemo(() => {
    const c = [];
    if (params.get('q')) c.push(['q', `“${params.get('q')}”`]);
    if (catName) c.push(['categoria', shortCat(catName)]);
    if (params.get('cuando')) c.push(['cuando', WHEN.find((w) => w[0] === params.get('cuando'))?.[1]]);
    if (params.get('desde')) c.push(['desde', `Desde ${params.get('desde')}`]);
    if (params.get('hasta')) c.push(['hasta', `Hasta ${params.get('hasta')}`]);
    if (params.get('disponibilidad')) c.push(['disponibilidad', AVAIL.find((w) => w[0] === params.get('disponibilidad'))?.[1]]);
    return c;
  }, [params, catName]);
  const ciudad = params.get('ciudad') || '';
  const countLabel = data ? `${data.total} ${data.total === 1 ? 'evento' : 'eventos'}` : 'Buscando…';

  return (
    <div className="container">
      <div className="explore-head">
        <div className="crumbs" style={{ padding: '0 0 8px' }}><Link to="/">Inicio</Link> / <span>Explorar</span>{ciudad && <> / <span>{ciudad}</span></>}</div>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1>{catName ? shortCat(catName) : 'Eventos'} {ciudad ? `en ${ciudad}` : 'en Apurímac'}</h1>
            <p className="muted mt-1">Busca actividades, filtra resultados y encuentra tu siguiente experiencia.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <MapPin size={18} color="var(--orange)" />
            <select className="select" style={{ width: 210, height: 48 }} value={ciudad} onChange={(e) => set('ciudad', e.target.value)} aria-label="Ciudad">
              <option value="">Toda la región</option>
              {CITIES_FALLBACK.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="explore-grid">
        <aside className="filters desktop" aria-label="Filtros"><Filters params={params} set={set} categorias={categorias} /></aside>
        <div>
          {/* En móvil: buscador y chips quedan fijos arriba; "Filtros" es el primer chip */}
          <div className="explore-sticky">
            <KeywordSearch params={params} set={set} className="only-sm-block" />
            <QuickFilters params={params} set={set} lead={(
              <button type="button" className={`qchip only-sm-flex ${chips.length ? 'on' : ''}`} onClick={() => setDrawer(true)}>
                <SlidersHorizontal size={15} /> Filtros{chips.length > 0 && <span className="count-pill">{chips.length}</span>}
              </button>
            )} />
          </div>
          <div className="results-bar">
            <div className="row">
              <span className="bold row" style={{ gap: 8 }} aria-live="polite">
                {countLabel}{loading && data && <Loader2 size={16} className="spin" aria-label="Actualizando" />}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <select className="select hide-sm-el" style={{ height: 40, width: 190 }} value={params.get('orden') || 'fecha'} onChange={(e) => set('orden', e.target.value === 'fecha' ? '' : e.target.value)} aria-label="Ordenar">
                {ORDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="seg" role="group" aria-label="Vista">
                <button className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} onClick={() => changeView('grid')} aria-label="Cuadrícula"><LayoutGrid size={16} /></button>
                <button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => changeView('list')} aria-label="Lista"><List size={16} /></button>
                <button className={view === 'map' ? 'active' : ''} aria-pressed={view === 'map'} onClick={() => changeView('map')} aria-label="Mapa"><MapIcon size={16} /></button>
              </div>
            </div>
          </div>
          {chips.length > 0 && (
            <div className="active-filters">
              {chips.map(([k, label]) => <button key={k} className="chip active" onClick={() => set(k, '')}>{label} <X size={14} /></button>)}
              <button className="chip" onClick={() => setParams(ciudad ? { ciudad } : {})}>Limpiar filtros</button>
            </div>
          )}
          {!data ? <SkeletonGrid n={6} /> : (
            <div className={`results ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
              {items.length === 0 ? (
                <EmptyState icon={SearchX} title="No encontramos eventos con esos criterios"
                  text={chips.length ? 'Prueba quitando algún filtro o revisa otras fechas.' : 'Prueba con otra palabra o revisa otras fechas.'}
                  action={<div className="row-wrap" style={{ justifyContent: 'center' }}>
                    {chips.slice(0, 2).map(([k, label]) => <button key={k} className="chip" onClick={() => set(k, '')}>Quitar {label} <X size={14} /></button>)}
                    <button className="btn btn-primary" onClick={() => setParams(ciudad ? { ciudad } : {})}>Ver todos los eventos</button>
                  </div>} />
              ) : view === 'map' ? (
                <EventsMap eventos={items} />
              ) : view === 'list' ? (
                <div className="stack">{items.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
              ) : (
                <div className="ev-grid cols-3">{items.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>
              )}
            </div>
          )}
          {hasMore && (
            <div className="center mt-3" ref={sentinel}>
              <button className="btn btn-light" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <><Loader2 size={16} className="spin" /> Cargando…</> : 'Cargar más eventos'}
              </button>
            </div>
          )}
        </div>
      </div>

      {drawer && (
        <>
          <div className={`drawer-backdrop ${drawerClosing ? 'closing' : ''}`} onClick={closeDrawer} />
          <div className={`drawer filters ${drawerClosing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label="Filtros">
            <div className="row between"><h3>Filtros</h3><button className="icon-btn" onClick={closeDrawer} aria-label="Cerrar"><X /></button></div>
            <Filters params={params} set={set} categorias={categorias} withOrder />
            {/* Los filtros se aplican al instante; este botón solo confirma y muestra cuántos resultados hay */}
            <div className="drawer-foot">
              {chips.length > 0 && <button className="btn btn-ghost" onClick={() => setParams(ciudad ? { ciudad } : {})}>Limpiar</button>}
              <button className="btn btn-primary grow" onClick={closeDrawer}>
                {loading ? <Loader2 size={17} className="spin" /> : null} Ver {countLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
