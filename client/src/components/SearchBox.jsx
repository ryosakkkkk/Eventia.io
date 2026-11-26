import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Clock, CalendarDays, ArrowRight, History, X, Sparkles, Ticket } from 'lucide-react';
import { api, qs } from '../api';
import { useApp } from '../context/AppContext';
import { catStyle, hora12, relativeDay, shortCat, shortDate } from '../lib/format';
import { imgOf } from './EventCard';

const RECENT_KEY = 'eventia_recent_searches';
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecent(q) {
  try {
    const list = [q, ...readRecent().filter((x) => norm(x) !== norm(q))].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* almacenamiento no disponible */ }
}

function Highlight({ text, q }) {
  const i = q ? norm(text).indexOf(norm(q.trim())) : -1;
  if (i < 0) return text;
  const n = q.trim().length;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + n)}</mark>{text.slice(i + n)}</>;
}

const QUICK = [
  ['Hoy', '/explorar?cuando=hoy', CalendarDays],
  ['Este fin de semana', '/explorar?cuando=finde', Sparkles],
  ['Entrada libre', '/explorar?disponibilidad=libre', Ticket],
];

export function SearchBox({ cities }) {
  const { categorias } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const listId = useId();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const reqId = useRef(0);
  const [q, setQ] = useState(params.get('q') || '');
  const [ciudad, setCiudad] = useState(params.get('ciudad') || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState(readRecent);

  useEffect(() => { if (location.pathname === '/explorar') setQ(params.get('q') || ''); }, [params, location.pathname]);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  // Atajos: "/" o Ctrl/Cmd+K enfocan la búsqueda desde cualquier pantalla
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Sugerencias con espera corta tras teclear; se ignoran respuestas que lleguen tarde
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setEventos([]); setLoading(false); return undefined; }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api.get(`/events${qs({ q: term, ciudad, size: 5 })}`)
        .then((r) => { if (id === reqId.current) setEventos(r.eventos); })
        .catch(() => { if (id === reqId.current) setEventos([]); })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 180);
    return () => clearTimeout(t);
  }, [q, ciudad]);

  const term = q.trim();
  const cats = useMemo(
    () => (term.length < 2 ? [] : categorias.filter((c) => norm(c.nombre).includes(norm(term))).slice(0, 2)),
    [term, categorias]
  );

  const options = useMemo(() => {
    if (term.length < 2) {
      return [
        ...recent.map((r) => ({ kind: 'recent', label: r })),
        ...QUICK.map(([label, to, Icon]) => ({ kind: 'quick', label, to, Icon })),
      ];
    }
    return [
      ...cats.map((c) => ({ kind: 'cat', cat: c })),
      ...eventos.map((ev) => ({ kind: 'event', ev })),
      { kind: 'all' },
    ];
  }, [term, recent, cats, eventos]);

  useEffect(() => { setActive(-1); }, [term]);

  const goSearch = (text) => {
    const p = new URLSearchParams();
    if (text) { p.set('q', text); saveRecent(text); setRecent(readRecent()); }
    if (ciudad) p.set('ciudad', ciudad);
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/explorar?${p}`);
  };

  const choose = (opt) => {
    setOpen(false);
    if (opt.kind === 'recent') { setQ(opt.label); goSearch(opt.label); return; }
    if (opt.kind === 'quick') { navigate(opt.to); return; }
    if (opt.kind === 'cat') { navigate(`/explorar${qs({ categoria: opt.cat.id_categoria, ciudad })}`); return; }
    if (opt.kind === 'event') { if (term) saveRecent(term); navigate(`/evento/${opt.ev.id}`); return; }
    goSearch(term);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (options.length ? (a + d + options.length) % options.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && options[active]) choose(options[active]);
      else goSearch(term);
    } else if (e.key === 'Escape') {
      if (open) setOpen(false); else inputRef.current?.blur();
    } else if (e.key === 'Tab') setOpen(false);
  };

  const clearRecent = (e) => {
    e.stopPropagation();
    try { localStorage.removeItem(RECENT_KEY); } catch { /* nada */ }
    setRecent([]);
  };

  const optId = (i) => `${listId}-o${i}`;
  const showPanel = open && options.length > 0;
  const row = (opt, i, content) => {
    return (
      <li key={`${opt.kind}-${i}`} id={optId(i)} role="option" aria-selected={active === i}
        className={`sg-opt ${active === i ? 'active' : ''}`}
        onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(opt)}>
        {content}
      </li>
    );
  };

  return (
    <div className="search-box" ref={boxRef}>
      <form className="header-search" role="search" onSubmit={(e) => { e.preventDefault(); goSearch(term); }}>
        <Search size={18} color="var(--muted)" aria-hidden="true" />
        <input
          ref={inputRef} value={q} placeholder="Buscar eventos, artistas, lugares…"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          role="combobox" aria-label="Buscar eventos" aria-autocomplete="list" aria-expanded={showPanel}
          aria-controls={listId} aria-activedescendant={showPanel && active >= 0 ? optId(active) : undefined}
          autoComplete="off" spellCheck="false" enterKeyHint="search"
        />
        {q ? (
          <button type="button" className="sb-clear" aria-label="Borrar búsqueda" onClick={() => { setQ(''); inputRef.current?.focus(); }}><X size={15} /></button>
        ) : <kbd className="sb-kbd" aria-hidden="true">/</kbd>}
        <span className="sep" />
        <span className="city"><MapPin size={15} color="var(--orange)" />
          <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} aria-label="Ciudad">
            <option value="">Apurímac</option>
            {cities.map((c) => <option key={c.ciudad} value={c.ciudad}>{c.ciudad}</option>)}
          </select>
        </span>
        <button className="go" aria-label="Buscar"><Search size={16} /></button>
      </form>

      {showPanel && (
        <div className="suggest">
          {loading && <span className="sg-loading" aria-hidden="true" />}
          <ul id={listId} role="listbox" aria-label="Sugerencias">
            {term.length < 2 && recent.length > 0 && (
              <li className="sg-head" role="presentation">Búsquedas recientes <button onClick={clearRecent}>Borrar</button></li>
            )}
            {options.map((opt, i) => {
              if (opt.kind === 'recent') return row(opt, i,<><History size={17} className="sg-ic" /><span className="grow clamp-1">{opt.label}</span></>);
              if (opt.kind === 'quick') {
                const Icon = opt.Icon;
                return row(opt, i,<><Icon size={17} className="sg-ic" /><span className="grow">{opt.label}</span><ArrowRight size={15} className="sg-go" /></>);
              }
              if (opt.kind === 'cat') {
                const { Icon, color } = catStyle(opt.cat.nombre);
                return row(opt, i,<>
                  <span className="sg-cat" style={{ color, background: `${color}14` }}><Icon size={17} /></span>
                  <span className="grow"><b><Highlight text={shortCat(opt.cat.nombre)} q={term} /></b><small>Categoría · {opt.cat.proximos} próximos</small></span>
                  <ArrowRight size={15} className="sg-go" />
                </>);
              }
              if (opt.kind === 'event') {
                const ev = opt.ev;
                return row(opt, i,<>
                  <img src={imgOf(ev)} alt="" className="sg-thumb" loading="lazy" />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b className="clamp-1"><Highlight text={ev.nombre} q={term} /></b>
                    <small className="clamp-1"><Clock size={12} /> {relativeDay(ev.fecha) || shortDate(ev.fecha)} · {hora12(ev.hora)} · {ev.lugar}</small>
                  </span>
                </>);
              }
              return row(opt, i,<><Search size={17} className="sg-ic" /><span className="grow">Ver todos los resultados para <b>“{term}”</b></span><kbd>Enter</kbd></>);
            })}
            {term.length >= 2 && !loading && eventos.length === 0 && cats.length === 0 && (
              <li className="sg-empty" role="presentation">Sin coincidencias en {ciudad || 'la región'}. Prueba con otra palabra o cambia de ciudad.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
