import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X, Star, ImageUp, EyeOff, Eye, Pencil, Trash2, Search, Flag, Archive, CalendarDays } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { imgOf } from '../../components/EventCard';
import { Confirm, EmptyState, Loader, StatusBadge } from '../../components/ui';
import { shortDate, hora12, fmt } from '../../lib/format';

const TABS = [
  ['PENDIENTE_DE_VALIDACION', 'Pendientes'], ['PUBLICADO', 'Publicados'], ['AGOTADO', 'Agotados'], ['BORRADOR', 'Borradores'], ['ARCHIVADOS', 'Archivados'], ['', 'Todos'],
];

// RF30 / HU15 / HU16 / HU26 – Moderación de eventos
export default function AdminEvents() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') ?? 'PENDIENTE_DE_VALIDACION';
  const [q, setQ] = useState('');
  const [eventos, setEventos] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [motivo, setMotivo] = useState('');
  const load = () => api.get(`/admin/events?estado=${estado}&q=${encodeURIComponent(q)}`).then((r) => setEventos(r.eventos));
  useEffect(() => { setEventos(null); load(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, msg) => {
    try { await fn(); toast(msg); load(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>Eventos</h1><p>Revisa, valida, destaca, oculta o elimina publicaciones. Todas las acciones quedan en la auditoría.</p></div>
        <Link to="/publicar" className="btn btn-grad">Publicar como administrador</Link>
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => <button key={l} className={`tab ${estado === k ? 'active' : ''}`} onClick={() => setParams(k ? { estado: k } : { estado: '' })}>{l}</button>)}
      </div>
      <form className="row mb-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div className="input-icon grow" style={{ maxWidth: 420 }}><Search size={17} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, organizador o ciudad" /></div>
        <button className="btn btn-light">Buscar</button>
      </form>
      {!eventos ? <Loader /> : eventos.length === 0 ? <EmptyState icon={CalendarDays} title="No hay eventos en esta sección" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Evento</th><th>Organizador</th><th>Fecha</th><th>Estado</th><th>Vistas</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
            <tbody>
              {eventos.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <Link to={`/evento/${ev.id}`} className="row"><img className="thumb" src={imgOf(ev)} alt="" />
                      <span style={{ minWidth: 0 }}><b className="clamp-1" style={{ maxWidth: 240, display: 'block' }}>{ev.nombre}</b><span className="tiny muted">{ev.categoria} · {ev.ciudad}</span></span>
                    </Link>
                  </td>
                  <td className="small">{ev.organizador}<br /><span className="tiny muted">{ev.organizador_correo}</span></td>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{shortDate(ev.fecha)}<br /><span className="muted">{hora12(ev.hora)}</span></td>
                  <td>
                    <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                      <StatusBadge estado={ev.estado} />
                      {ev.destacado && <span className="badge badge-violet">★ Destacado</span>}
                      {!ev.visibilidad && ['PUBLICADO', 'AGOTADO', 'ARCHIVADO'].includes(ev.estado) && <span className="badge badge-gray">Oculto</span>}
                      {ev.reportes_abiertos > 0 && <span className="badge badge-red"><Flag size={11} /> {ev.reportes_abiertos}</span>}
                    </div>
                  </td>
                  <td className="small">{fmt(ev.visualizaciones)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
                      {['PENDIENTE_DE_VALIDACION', 'BORRADOR'].includes(ev.estado) && <>
                        <button className="btn btn-success btn-sm" onClick={() => act(() => api.post(`/admin/events/${ev.id}/approve`), 'Evento aprobado y publicado')}><Check size={15} /> Aprobar</button>
                        {ev.estado === 'PENDIENTE_DE_VALIDACION' && <button className="btn btn-danger btn-sm" onClick={() => { setMotivo(''); setDialog({ type: 'reject', ev }); }}><X size={15} /> Rechazar</button>}
                      </>}
                      {['PUBLICADO', 'AGOTADO'].includes(ev.estado) && (
                        <button className="icon-btn" title={ev.destacado ? 'Quitar de destacados' : 'Destacar en portada'} style={{ color: ev.destacado ? '#7c3aed' : undefined }}
                          onClick={() => act(() => api.post(`/admin/events/${ev.id}/feature`, { destacado: !ev.destacado }), ev.destacado ? 'Quitado de destacados' : 'Evento destacado en la portada')}>
                          <Star size={17} fill={ev.destacado ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      {['PUBLICADO', 'AGOTADO'].includes(ev.estado) && (
                        <button className="icon-btn" title="Poner como lámina principal de la portada"
                          onClick={() => act(() => api.post(`/admin/events/${ev.id}/lead`), 'Ahora es la lámina principal de la portada')}>
                          <ImageUp size={17} />
                        </button>
                      )}
                      {['PUBLICADO', 'AGOTADO', 'ARCHIVADO', 'FINALIZADO'].includes(ev.estado) && (
                        <button className="icon-btn" title={ev.visibilidad ? 'Ocultar al público' : 'Mostrar al público'}
                          onClick={() => act(() => api.post(`/admin/events/${ev.id}/visibility`, { visibilidad: !ev.visibilidad }), ev.visibilidad ? 'Evento oculto' : 'Evento visible')}>
                          {ev.visibilidad ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      )}
                      {['PUBLICADO', 'AGOTADO'].includes(ev.estado) && (
                        <button className="icon-btn" title="Archivar" onClick={() => act(() => api.post(`/admin/events/${ev.id}/archive`), 'Evento archivado')}><Archive size={17} /></button>
                      )}
                      <Link className="icon-btn" title="Editar" to={`/organizador/eventos/${ev.id}/editar`}><Pencil size={17} /></Link>
                      <button className="icon-btn" title="Eliminar definitivamente" style={{ color: 'var(--red)' }} onClick={() => setDialog({ type: 'delete', ev })}><Trash2 size={17} /></button>
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
          <textarea className="textarea" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. La fecha no coincide con el afiche; agrega una dirección de referencia." />
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
