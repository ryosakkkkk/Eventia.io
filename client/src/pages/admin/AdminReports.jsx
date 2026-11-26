import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, EyeOff, Check, X, Search as SearchIcon, RotateCcw } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EmptyState, Loader, RowMenu } from '../../components/ui';
import { timeAgo } from '../../lib/format';

const STATES = [['PENDIENTE', 'Pendiente', 'amber'], ['EN_REVISION', 'En revisión', 'blue'], ['RESUELTO', 'Resuelto', 'green'], ['RECHAZADO', 'Descartado', 'gray']];
const TABS = [['PENDIENTE', 'Pendientes'], ['EN_REVISION', 'En revisión'], ['RESUELTO', 'Resueltos'], ['RECHAZADO', 'Descartados'], ['', 'Todos']];
const EMPTY = {
  PENDIENTE: ['No hay reportes pendientes', 'Todo en orden: cuando alguien reporte un evento aparecerá aquí.'],
  EN_REVISION: ['Nada en revisión', 'Los reportes que marques “en revisión” aparecerán aquí.'],
  RESUELTO: ['Aún no hay reportes resueltos', ''],
  RECHAZADO: ['No hay reportes descartados', ''],
  '': ['No hay reportes', '¡Todo en orden!'],
};

// HU17 – Revisión de reportes: la vista abre en lo que requiere atención y cada reporte tiene acciones directas
export default function AdminReports() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const filter = params.get('estado') ?? 'PENDIENTE';
  const [items, setItems] = useState(null);
  const load = () => api.get(`/admin/reports${filter ? `?estado=${filter}` : ''}`).then((r) => setItems(r.reportes));
  useEffect(() => { setItems(null); load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const setState = async (r, estado, msg, { undo = true } = {}) => {
    const prev = r.estado;
    try {
      await api.patch(`/admin/reports/${r.id}`, { estado });
      load();
      toast(msg, 'success', undo ? { action: { label: 'Deshacer', onClick: () => setState(r, prev, 'Cambio deshecho', { undo: false }) } } : undefined);
    } catch (e) { toast(e.message, 'error'); }
  };
  const hide = async (r) => {
    try {
      await api.post(`/admin/events/${r.id_evento}/visibility`, { visibilidad: false });
      load();
      toast('Evento ocultado al público', 'success', { action: { label: 'Deshacer', onClick: async () => { await api.post(`/admin/events/${r.id_evento}/visibility`, { visibilidad: true }); load(); } } });
    } catch (e) { toast(e.message, 'error'); }
  };
  const [title, text] = EMPTY[filter] || EMPTY[''];

  return (
    <>
      <div className="page-head"><div><h1>Reportes</h1><p>Avisos de la comunidad sobre información incorrecta o contenido inapropiado.</p></div></div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={l} role="tab" aria-selected={filter === k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setParams({ estado: k })}>{l}</button>
        ))}
      </div>
      {!items ? <Loader /> : items.length === 0 ? <EmptyState icon={Flag} title={title} text={text} /> : (
        <div className="stack">
          {items.map((r) => {
            const st = STATES.find((s) => s[0] === r.estado);
            const open = ['PENDIENTE', 'EN_REVISION'].includes(r.estado);
            return (
              <article key={r.id} className="card card-pad report-item">
                <span className="fact-ic" style={{ background: 'var(--red-soft)', color: 'var(--red)', width: 44, height: 44 }}><Flag size={20} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    <b>{r.motivo}</b>
                    {st && <span className={`badge badge-${st[2]}`}>{st[1]}</span>}
                    <span className="tiny muted">{timeAgo(r.fecha)}</span>
                  </div>
                  <p className="small mt-1">Evento: <Link className="link" to={`/evento/${r.id_evento}`}>{r.evento}</Link> {!r.visibilidad && <span className="badge badge-gray">Oculto</span>}</p>
                  {r.descripcion && <p className="small muted mt-1">“{r.descripcion}”</p>}
                  <p className="tiny muted mt-1" title={r.correo}>Reportado por {r.usuario}</p>
                </div>
                <div className="report-actions">
                  {open && <>
                    <button className="btn btn-success btn-sm" onClick={() => setState(r, 'RESUELTO', 'Reporte marcado como resuelto')}><Check size={15} /> Resolver</button>
                    <button className="btn btn-light btn-sm" onClick={() => setState(r, 'RECHAZADO', 'Reporte descartado')}><X size={15} /> Descartar</button>
                  </>}
                  <RowMenu label={`Más acciones para el reporte de ${r.evento}`} items={[
                    { label: 'Pasar a revisión', icon: SearchIcon, hidden: r.estado !== 'PENDIENTE', onClick: () => setState(r, 'EN_REVISION', 'Reporte en revisión') },
                    { label: 'Reabrir', icon: RotateCcw, hidden: open, onClick: () => setState(r, 'PENDIENTE', 'Reporte reabierto') },
                    { label: 'Ocultar el evento al público', icon: EyeOff, danger: true, hidden: !r.visibilidad, onClick: () => hide(r) },
                  ]} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
