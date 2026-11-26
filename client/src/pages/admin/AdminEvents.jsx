import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X, Star, ImageUp, EyeOff, Eye, Pencil, Trash2, Search, Flag, Archive, CalendarDays, Plus } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { imgOf } from '../../components/EventCard';
import { Confirm, EmptyState, Loader, RowMenu, StatusBadge } from '../../components/ui';
import { shortDate, hora12, fmt } from '../../lib/format';

const TABS = [
  ['PENDIENTE_DE_VALIDACION', 'Pendientes'], ['PUBLICADO', 'Publicados'], ['AGOTADO', 'Agotados'], ['BORRADOR', 'Borradores'], ['ARCHIVADOS', 'Archivados'], ['', 'Todos'],
];
const EMPTY = {
  PENDIENTE_DE_VALIDACION: ['No hay eventos por validar', 'Todo al día: cuando un organizador envíe un evento aparecerá aquí.'],
  PUBLICADO: ['No hay eventos publicados', 'Los eventos aprobados aparecerán aquí.'],
  AGOTADO: ['No hay eventos agotados', 'Aquí verás los eventos sin entradas disponibles.'],
  BORRADOR: ['No hay borradores', 'Los eventos devueltos o sin enviar aparecerán aquí.'],
  ARCHIVADOS: ['No hay eventos archivados', 'Los eventos pasados se archivan automáticamente.'],
};

// RF30 / HU15 / HU16 / HU26 – Moderación de eventos
export default function AdminEvents() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') ?? 'PENDIENTE_DE_VALIDACION';
  const [q, setQ] = useState('');
  const [eventos, setEventos] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [motivo, setMotivo] = useState('');
  const load = () => api.get(`/admin/events?estado=${estado}&q=${encodeURIComponent(q.trim())}`).then((r) => setEventos(r.eventos));
  useEffect(() => { setEventos(null); load(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  // Búsqueda en vivo al dejar de teclear
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, msg) => {
    try { await fn(); toast(msg); load(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>Eventos</h1><p>Revisa, valida, destaca, oculta o elimina publicaciones. Todas las acciones quedan en la auditoría.</p></div>
        {/* Acción secundaria: aquí lo principal es moderar, no publicar */}
        <Link to="/publicar" className="btn btn-light"><Plus size={17} /> Publicar evento</Link>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={l} role="tab" aria-selected={estado === k} className={`tab ${estado === k ? 'active' : ''}`} onClick={() => setParams(k ? { estado: k } : { estado: '' })}>{l}</button>)}
      </div>
      <div className="toolbar mb-2">
        <form className="input-icon grow" style={{ maxWidth: 420 }} role="search" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={17} /><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, organizador o ciudad" aria-label="Buscar eventos" />
        </form>
        {eventos && <span className="muted small" aria-live="polite">{eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}</span>}
      </div>
      {!eventos ? <Loader /> : eventos.length === 0 ? (
        <EmptyState icon={CalendarDays} title={q ? `Sin resultados para “${q}”` : (EMPTY[estado] || ['No hay eventos'])[0]}
          text={q ? 'Prueba con otro nombre, organizador o ciudad.' : (EMPTY[estado] || [])[1]} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Evento</th><th>Organizador</th><th>Fecha</th><th>Estado</th><th className="col-opt">Vistas</th><th className="col-actions" style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
            <tbody>
              {eventos.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <Link to={`/evento/${ev.id}`} className="row"><img className="thumb" src={imgOf(ev)} alt="" />
                      <span style={{ minWidth: 0 }}><b className="clamp-1" style={{ maxWidth: 240, display: 'block' }}>{ev.nombre}</b><span className="tiny muted">{ev.categoria} · {ev.ciudad}</span></span>
                    </Link>
                  </td>
                  <td className="small" title={ev.organizador_correo}><span className="clamp-1">{ev.organizador}</span></td>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{shortDate(ev.fecha)}<br /><span className="muted">{hora12(ev.hora)}</span></td>
                  <td>
                    <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                      <StatusBadge estado={ev.estado} />
                      {ev.destacado && <span className="badge badge-violet">★ Destacado</span>}
                      {!ev.visibilidad && ['PUBLICADO', 'AGOTADO', 'ARCHIVADO'].includes(ev.estado) && <span className="badge badge-gray">Oculto</span>}
                      {ev.reportes_abiertos > 0 && <span className="badge badge-red"><Flag size={11} /> {ev.reportes_abiertos}</span>}
                    </div>
                  </td>
                  <td className="small col-opt">{fmt(ev.visualizaciones)}</td>
                  <td className="col-actions">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {['PENDIENTE_DE_VALIDACION', 'BORRADOR'].includes(ev.estado) && <>
                        <button className="btn btn-success btn-sm" onClick={() => act(() => api.post(`/admin/events/${ev.id}/approve`), 'Evento aprobado y publicado')}><Check size={15} /> Aprobar</button>
                        {ev.estado === 'PENDIENTE_DE_VALIDACION' && <button className="btn btn-danger btn-sm" onClick={() => { setMotivo(''); setDialog({ type: 'reject', ev }); }}><X size={15} /> Rechazar</button>}
                      </>}
                      <RowMenu label={`Más acciones para ${ev.nombre}`} items={[
                        { label: 'Editar', icon: Pencil, to: `/organizador/eventos/${ev.id}/editar` },
                        { label: ev.destacado ? 'Quitar de destacados' : 'Destacar en portada', icon: Star, hidden: !['PUBLICADO', 'AGOTADO'].includes(ev.estado),
                          onClick: () => act(() => api.post(`/admin/events/${ev.id}/feature`, { destacado: !ev.destacado }), ev.destacado ? 'Quitado de destacados' : 'Evento destacado en la portada') },
                        { label: 'Usar como lámina principal', icon: ImageUp, hidden: !['PUBLICADO', 'AGOTADO'].includes(ev.estado),
                          onClick: () => act(() => api.post(`/admin/events/${ev.id}/lead`), 'Ahora es la lámina principal de la portada') },
                        { label: ev.visibilidad ? 'Ocultar al público' : 'Mostrar al público', icon: ev.visibilidad ? EyeOff : Eye, hidden: !['PUBLICADO', 'AGOTADO', 'ARCHIVADO', 'FINALIZADO'].includes(ev.estado),
                          onClick: () => act(() => api.post(`/admin/events/${ev.id}/visibility`, { visibilidad: !ev.visibilidad }), ev.visibilidad ? 'Evento oculto' : 'Evento visible') },
                        { label: 'Archivar', icon: Archive, hidden: !['PUBLICADO', 'AGOTADO'].includes(ev.estado),
                          onClick: () => act(() => api.post(`/admin/events/${ev.id}/archive`), 'Evento archivado') },
                        { label: 'Ver página pública', icon: Eye, to: `/evento/${ev.id}` },
                        { label: 'Eliminar definitivamente', icon: Trash2, danger: true, onClick: () => setDialog({ type: 'delete', ev }) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog?.type === 'reject' && (
        <Confirm title="Rechazar publicación" confirmLabel="Rechazar y notificar" danger onClose={() => setDialog(null)}
          onConfirm={() => act(() => api.post(`/admin/events/${dialog.ev.id}/reject`, { motivo }), 'Evento devuelto al organizador')}>
          <p className="muted small mb-2">El evento “{dialog.ev.nombre}” volverá a borrador y el organizador recibirá el motivo.</p>
          <label className="field">
            <span>Motivo para el organizador</span>
            <textarea className="textarea" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
              placeholder="Ej. La fecha no coincide con el afiche; agrega una dirección de referencia." />
            <small>Sé concreto: le ayudará a corregirlo y reenviarlo.</small>
          </label>
        </Confirm>
      )}
      {dialog?.type === 'delete' && (
        <Confirm title="Eliminar definitivamente" confirmLabel="Eliminar para siempre" danger onClose={() => setDialog(null)}
          text={`Se eliminará “${dialog.ev.nombre}” junto con sus favoritos, asistencias, métricas, reportes y valoraciones. Esta acción no se puede deshacer.`}
          onConfirm={() => act(() => api.del(`/admin/events/${dialog.ev.id}`), 'Evento eliminado')} />
      )}
    </>
  );
}
