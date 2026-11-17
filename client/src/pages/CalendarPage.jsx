import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarX } from 'lucide-react';
import { api } from '../api';
import { EventRow } from '../components/EventCard';
import { EmptyState, Loader } from '../components/ui';
import { catStyle, longDate, monthName, todayISO } from '../lib/format';

const WD = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// RF40 / HU23 – Calendario de eventos
export default function CalendarPage() {
  const t = todayISO();
  const [mes, setMes] = useState(t.slice(0, 7));
  const [sel, setSel] = useState(t);
  const [eventos, setEventos] = useState(null);
  useEffect(() => { setEventos(null); api.get(`/events/calendar?mes=${mes}`).then((r) => setEventos(r.eventos)); }, [mes]);

  const [y, m] = mes.split('-').map(Number);
  const cells = useMemo(() => {
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;
    const arr = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(y, m - 1, 1 - offset + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      arr.push({ iso, n: d.getDate(), other: d.getMonth() !== m - 1 });
    }
    return arr;
  }, [y, m]);
  const byDay = useMemo(() => {
    const map = {};
    (eventos || []).forEach((e) => { (map[e.fecha] = map[e.fecha] || []).push(e); });
    return map;
  }, [eventos]);
  const move = (d) => {
    const nd = new Date(y, m - 1 + d, 1);
    setMes(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`);
  };
  const dayEvents = byDay[sel] || [];

  return (
    <div className="container section">
      <div className="page-head">
        <div><h1>Calendario de eventos</h1><p>Consulta las actividades por fecha y accede a su detalle.</p></div>
        <div className="row">
          <button className="icon-btn bordered" onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft /></button>
          <h2 style={{ minWidth: 190, textAlign: 'center', textTransform: 'capitalize' }}>{monthName(m - 1)} {y}</h2>
          <button className="icon-btn bordered" onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight /></button>
          <button className="btn btn-light btn-sm" onClick={() => { setMes(t.slice(0, 7)); setSel(t); }}>Hoy</button>
        </div>
      </div>
      {!eventos ? <Loader /> : (
        <div className="cal" role="grid">
          {WD.map((d) => <div key={d} className="cal-h">{d}</div>)}
          {cells.map((c, i) => c ? (
            <button key={c.iso} className={`cal-d ${c.other ? 'other' : ''} ${c.iso === t ? 'today' : ''} ${c.iso === sel ? 'sel' : ''}`} onClick={() => setSel(c.iso)}
              aria-label={`${c.iso}: ${(byDay[c.iso] || []).length} eventos`}>
              <span className="n">{c.n}</span>
              {(byDay[c.iso] || []).slice(0, 2).map((e) => (
                <span key={e.id} className="cal-ev" style={{ background: catStyle(e.categoria).color, opacity: e.fecha < t ? 0.55 : 1 }}>{e.hora} {e.nombre}</span>
              ))}
              {(byDay[c.iso] || []).length > 2 && <span className="cal-more">+{byDay[c.iso].length - 2} más</span>}
              <span className="cal-dots">{(byDay[c.iso] || []).slice(0, 3).map((e) => <i key={e.id} style={{ background: catStyle(e.categoria).color }} />)}</span>
            </button>
          ) : <div key={`x${i}`} className="cal-d other" />)}
        </div>
      )}
      <section className="section">
        <h2 className="mb-2">{longDate(sel)}</h2>
        {dayEvents.length === 0 ? (
          <EmptyState icon={CalendarX} title="No hay eventos este día" text="Selecciona otra fecha del calendario o explora los próximos eventos."
            action={<Link to="/explorar" className="btn btn-light">Ver próximos eventos</Link>} />
        ) : <div className="stack">{dayEvents.map((e) => <EventRow key={e.id} ev={e} />)}</div>}
      </section>
    </div>
  );
}
