import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, EyeOff } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EmptyState, Loader } from '../../components/ui';
import { timeAgo } from '../../lib/format';

const STATES = [['PENDIENTE', 'Pendiente', 'amber'], ['EN_REVISION', 'En revisión', 'blue'], ['RESUELTO', 'Resuelto', 'green'], ['RECHAZADO', 'Rechazado', 'gray']];

// HU17 – Revisión de reportes
export default function AdminReports() {
  const { toast } = useApp();
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState(null);
  const load = () => api.get(`/admin/reports${filter ? `?estado=${filter}` : ''}`).then((r) => setItems(r.reportes));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const setState = async (r, estado) => { await api.patch(`/admin/reports/${r.id}`, { estado }); toast('Reporte actualizado'); load(); };
  const hide = async (r) => { await api.post(`/admin/events/${r.id_evento}/visibility`, { visibilidad: false }); toast('Evento ocultado al público'); load(); };
  return (
    <>
      <div className="page-head"><div><h1>Reportes de eventos</h1><p>Reportes enviados por la comunidad sobre información incorrecta o contenido inapropiado.</p></div></div>
      <div className="tabs">
        <button className={`tab ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>Todos</button>
        {STATES.map(([k, l]) => <button key={k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {!items ? <Loader /> : items.length === 0 ? <EmptyState icon={Flag} title="No hay reportes" text="¡Todo en orden!" /> : (
        <div className="stack">
          {items.map((r) => (
            <div key={r.id} className="card card-pad row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <span className="fact-ic" style={{ background: 'var(--red-soft)', color: 'var(--red)', width: 44, height: 44 }}><Flag size={20} /></span>
              <div className="grow" style={{ minWidth: 240 }}>
                <div className="row-wrap" style={{ gap: 8 }}><b>{r.motivo}</b><span className={`badge badge-${STATES.find((s) => s[0] === r.estado)?.[2]}`}>{STATES.find((s) => s[0] === r.estado)?.[1]}</span><span className="tiny muted">{timeAgo(r.fecha)}</span></div>
                <p className="small mt-1">Evento: <Link className="link" to={`/evento/${r.id_evento}`}>{r.evento}</Link> {!r.visibilidad && <span className="badge badge-gray">Oculto</span>}</p>
                {r.descripcion && <p className="small muted mt-1">“{r.descripcion}”</p>}
                <p className="tiny muted mt-1">Reportado por {r.usuario} ({r.correo})</p>
              </div>
              <div className="row-wrap" style={{ gap: 6 }}>
                <select className="select" style={{ height: 42, width: 160 }} value={r.estado} onChange={(e) => setState(r, e.target.value)} aria-label="Estado del reporte">
                  {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {r.visibilidad && <button className="btn btn-danger btn-sm" onClick={() => hide(r)}><EyeOff size={15} /> Ocultar evento</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
