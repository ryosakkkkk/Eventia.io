import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, QrCode, Ticket, CalendarDays, Heart, Users, Share2, MessageCircle, Building2, FileClock, CheckCircle2, Archive, BarChart3 } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { imgOf } from '../../components/EventCard';
import { QrModal } from '../../components/Modals';
import { EmptyState, Loader, Modal, StatusBadge } from '../../components/ui';
import OrgProfileForm from '../../components/OrgProfileForm';
import { availability, fmt, shortDate, hora12 } from '../../lib/format';

// HU14 – Gestionar entradas
function TicketsModal({ ev, onClose, onSaved }) {
  const { toast } = useApp();
  const [cap, setCap] = useState(ev.capacidad);
  const [disp, setDisp] = useState(ev.entradas_disponibles);
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try {
      const r = await api.patch(`/organizer/events/${ev.id}/tickets`, { capacidad: Number(cap), entradas_disponibles: Number(disp) });
      toast(r.estado === 'AGOTADO' ? 'Actualizado: el evento figura como agotado.' : 'Entradas actualizadas');
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
  };
  return (
    <Modal title="Capacidad y entradas" onClose={onClose}
      footer={<><button className="btn btn-light" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
      <div className="stack">
        <p className="small muted">{ev.nombre}</p>
        {err && <div className="form-error">{err}</div>}
        <div className="grid-2">
          <label className="field"><span>Capacidad máxima</span><input type="number" min={0} className="input" value={cap} onChange={(e) => setCap(e.target.value)} /><small>0 = sin límite (entrada libre)</small></label>
          <label className="field"><span>Entradas disponibles</span><input type="number" min={0} max={cap} className="input" value={disp} onChange={(e) => setDisp(e.target.value)} /></label>
        </div>
        <div className="row-wrap">
          {[1, 5, 10].map((n) => <button key={n} type="button" className="chip" onClick={() => setDisp((d) => Math.max(0, Number(d) - n))}>−{n} vendidas</button>)}
          <button type="button" className="chip" onClick={() => setDisp(0)}>Marcar agotado</button>
        </div>
      </div>
    </Modal>
  );
}

export default function OrgDashboard() {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('activos');
  const load = () => {
    api.get('/organizer/events').then(setData);
    api.get('/organizer/metrics?dias=30').then(setMetrics);
  };
  useEffect(() => { load(); }, []);
  if (!data || !metrics) return <Loader />;
  const r = metrics.resumen || {};
  const t = metrics.totales || {};
  const groups = {
    activos: data.eventos.filter((e) => ['PUBLICADO', 'AGOTADO'].includes(e.estado)),
    revision: data.eventos.filter((e) => ['PENDIENTE_DE_VALIDACION', 'BORRADOR'].includes(e.estado)),
    pasados: data.eventos.filter((e) => ['FINALIZADO', 'ARCHIVADO'].includes(e.estado)),
  };
  const list = groups[tab];
  return (
    <>
      <div className="page-head">
        <div><h1>Panel del organizador</h1><p>Hola, {user.nombre.split(' ')[0]}. Administra tus publicaciones y revisa su rendimiento.</p></div>
        <div className="row">
          <button className="btn btn-light" onClick={() => setModal({ type: 'profile' })}><Building2 size={16} /> Perfil y contacto</button>
          <Link to="/publicar" className="btn btn-grad"><Plus size={16} /> Crear evento</Link>
        </div>
      </div>

      <div className="kpis">
        {[[CalendarDays, 'Eventos registrados', r.total, '#2f4fe0'], [CheckCircle2, 'Publicados', r.publicados, '#16a34a'], [FileClock, 'En validación / borrador', (r.pendientes || 0) + (r.borradores || 0), '#b45309'],
          [Eye, 'Vistas (30 días)', t.visualizaciones, '#7c3aed'], [Heart, 'Guardados (30 días)', t.favoritos, '#e11d48'], [MessageCircle, 'Clics de contacto', (t.clics_whatsapp || 0) + (t.clics_llamada || 0), '#1fae58']].map(([Icon, label, v, color]) => (
          <div key={label} className="kpi"><span className="ic" style={{ background: `${color}15`, color }}><Icon size={19} /></span><b>{fmt(v)}</b><span>{label}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="row between" style={{ padding: '14px 18px 0', flexWrap: 'wrap' }}>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
            <button className={`tab ${tab === 'activos' ? 'active' : ''}`} onClick={() => setTab('activos')}>Activos ({groups.activos.length})</button>
            <button className={`tab ${tab === 'revision' ? 'active' : ''}`} onClick={() => setTab('revision')}>En revisión y borradores ({groups.revision.length})</button>
            <button className={`tab ${tab === 'pasados' ? 'active' : ''}`} onClick={() => setTab('pasados')}><Archive size={14} /> Pasados ({groups.pasados.length})</button>
          </div>
          <Link to="/organizador/marketing" className="see-all small"><BarChart3 size={15} /> Ver marketing</Link>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 18 }}><EmptyState icon={CalendarDays} title="No hay eventos en esta sección" action={<Link to="/publicar" className="btn btn-primary">Crear evento</Link>} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Evento</th><th>Fecha</th><th>Estado</th><th>Cupos</th><th>Interacción</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {list.map((ev) => {
                  const av = availability(ev);
                  return (
                    <tr key={ev.id}>
                      <td><div className="row"><img className="thumb" src={imgOf(ev)} alt="" /><div style={{ minWidth: 0 }}><b className="clamp-1" style={{ maxWidth: 260, display: 'block' }}>{ev.nombre}</b><span className="tiny muted">{ev.categoria}</span></div></div></td>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>{shortDate(ev.fecha)}<br /><span className="muted">{hora12(ev.hora)}</span></td>
                      <td><StatusBadge estado={ev.estado} /></td>
                      <td><span className={`badge badge-${av.tone}`}>{av.label}</span></td>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                        <span title="Vistas"><Eye size={13} /> {fmt(ev.visualizaciones)}</span> · <span title="Guardados"><Heart size={13} /> {fmt(ev.total_favoritos)}</span> · <span title="Asistirán"><Users size={13} /> {fmt(ev.total_asistencias)}</span> · <span title="Compartidos"><Share2 size={13} /> {fmt(ev.compartidos)}</span>
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                          <Link className="icon-btn" to={`/evento/${ev.id}`} title="Ver"><Eye size={17} /></Link>
                          {!['ARCHIVADO', 'FINALIZADO'].includes(ev.estado) && <Link className="icon-btn" to={`/organizador/eventos/${ev.id}/editar`} title="Editar"><Pencil size={17} /></Link>}
                          {['PUBLICADO', 'AGOTADO'].includes(ev.estado) && <>
                            <button className="icon-btn" title="Entradas" onClick={() => setModal({ type: 'tickets', ev })}><Ticket size={17} /></button>
                            <button className="icon-btn" title="Código QR" onClick={() => setModal({ type: 'qr', ev })}><QrCode size={17} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'tickets' && <TicketsModal ev={modal.ev} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'qr' && <QrModal ev={modal.ev} onClose={() => setModal(null)} />}
      {modal?.type === 'profile' && (
        <Modal title="Perfil de organizador" onClose={() => setModal(null)} wide>
          <OrgProfileForm initial={data.organizador} onSaved={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </>
  );
}
