import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, List, Map as MapIcon, SlidersHorizontal, X, SearchX, Search, MapPin } from 'lucide-react';
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

function Filters({ params, set, categorias, onClose }) {
  const [q, setQ] = useState(params.get('q') || '');
  useEffect(() => setQ(params.get('q') || ''), [params]);
  const Opt = ({ k, v, label, count, icon }) => (
    <button className={`filter-opt ${(params.get(k) || '') === v ? 'active' : ''}`} onClick={() => { set(k, v); onClose?.(); }}>
      {icon}{label}{count !== undefined && <span className="count">{count}</span>}
    </button>
  );
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); onClose?.(); }}>
        <div className="input-icon"><Search size={17} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Palabra clave, artista…" aria-label="Palabra clave" /></div>
      </form>
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
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem('eventia_view') || 'grid');
  const [drawer, setDrawer] = useState(false);
  const key = params.toString();

  const set = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    if (k === 'cuando') { p.delete('desde'); p.delete('hasta'); }
    if (k === 'desde' || k === 'hasta') p.delete('cuando');
    setParams(p);
  };

  useEffect(() => {
    setData(null); setPage(1);
    const size = view === 'map' ? 60 : 12;
    api.get(`/events${qs({ ...Object.fromEntries(params), size, page: 1 })}`).then((r) => { setData(r); setItems(r.eventos); });
  }, [key, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const next = page + 1;
    const r = await api.get(`/events${qs({ ...Object.fromEntries(params), size: 12, page: next })}`);
    setItems((x) => [...x, ...r.eventos]);
    setPage(next);
  };
  const changeView = (v) => { setView(v); localStorage.setItem('eventia_view', v); };

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
          <div className="results-bar">
            <div className="row">
              <button className="btn btn-light btn-sm only-mobile" onClick={() => setDrawer(true)}><SlidersHorizontal size={16} /> Filtros</button>
              <span className="bold">{data ? `${data.total} ${data.total === 1 ? 'evento' : 'eventos'}` : 'Buscando…'}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <select className="select" style={{ height: 46, width: 200 }} value={params.get('orden') || 'fecha'} onChange={(e) => set('orden', e.target.value === 'fecha' ? '' : e.target.value)} aria-label="Ordenar">
                {ORDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="seg" role="group" aria-label="Vista">
                <button className={view === 'grid' ? 'active' : ''} onClick={() => changeView('grid')} aria-label="Cuadrícula"><LayoutGrid size={16} /></button>
                <button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')} aria-label="Lista"><List size={16} /></button>
                <button className={view === 'map' ? 'active' : ''} onClick={() => changeView('map')} aria-label="Mapa"><MapIcon size={16} /></button>
              </div>
            </div>
          </div>
          {chips.length > 0 && (
            <div className="active-filters">
              {chips.map(([k, label]) => <button key={k} className="chip active" onClick={() => set(k, '')}>{label} <X size={14} /></button>)}
              <button className="chip" onClick={() => setParams(ciudad ? { ciudad } : {})}>Limpiar filtros</button>
            </div>
          )}
          {!data ? <SkeletonGrid n={6} /> : items.length === 0 ? (
            <EmptyState icon={SearchX} title="No encontramos eventos con esos criterios"
              text="Prueba con otra palabra, quita algún filtro o revisa otras fechas."
              action={<button className="btn btn-primary" onClick={() => setParams({})}>Ver todos los eventos</button>} />
          ) : view === 'map' ? (
            <EventsMap eventos={items} />
          ) : view === 'list' ? (
            <div className="stack">{items.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
          ) : (
            <div className="ev-grid cols-3">{items.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>
          )}
          {data && view !== 'map' && items.length < data.total && (
            <div className="center mt-3"><button className="btn btn-light" onClick={loadMore}>Cargar más eventos</button></div>
          )}
        </div>
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer filters" role="dialog" aria-label="Filtros">
            <div className="row between"><h3>Filtros</h3><button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Cerrar"><X /></button></div>
            <Filters params={params} set={set} categorias={categorias} onClose={() => setDrawer(false)} />
          </div>
        </>
      )}
    </div>
  );
}
