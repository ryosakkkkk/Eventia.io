import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, QrCode, Ticket, CalendarDays, Heart, Users, Share2, MessageCircle, Building2, FileClock, CheckCircle2, Archive, BarChart3 } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { imgOf } from '../../components/EventCard';
import { QrModal } from '../../components/Modals';
import { EmptyState, Loader, Modal, RowMenu, StatusBadge } from '../../components/ui';
import OrgProfileForm from '../../components/OrgProfileForm';
import { Funnel, SERIES_COLOR } from '../../components/charts';
import { KpiTile } from './Marketing';
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
        <div><h1>Mis publicaciones</h1><p>Hola, {user.nombre.split(' ')[0]}. Administra tus publicaciones y revisa su rendimiento.</p></div>
        <div className="row">
          <button className="btn btn-light" onClick={() => setModal({ type: 'profile' })}><Building2 size={16} /> Perfil y contacto</button>
          <Link to="/publicar" className="btn btn-grad"><Plus size={16} /> Crear evento</Link>
        </div>
      </div>

      {r.borradores > 0 && (
        <div className="attention mb-3">
          <FileClock size={20} />
          <div className="grow"><b>Tienes {r.borradores} {r.borradores === 1 ? 'borrador sin enviar' : 'borradores sin enviar'}</b>
            <span className="small muted">Envíalos a revisión para que el público pueda verlos.</span></div>
          <button className="btn btn-light btn-sm" onClick={() => setTab('revision')}>Ver borradores</button>
        </div>
      )}

      <div className="dash-grid dash-grid-wide mb-3">
        <div className="kpis kpis-2">
          <KpiTile icon={CheckCircle2} label="Eventos publicados" value={r.publicados} color="#15803d" />
          <KpiTile icon={FileClock} label="En revisión o borrador" value={(r.pendientes || 0) + (r.borradores || 0)} color="#b45309" />
          <KpiTile icon={Eye} label="Vistas · 30 días" value={t.visualizaciones} color={SERIES_COLOR.VISUALIZACION} />
          <KpiTile icon={MessageCircle} label="Contactos · 30 días" value={(t.clics_whatsapp || 0) + (t.clics_llamada || 0)} color={SERIES_COLOR.CLIC_WHATSAPP} />
        </div>
        <section className="card chart-card">
          <div className="chart-head"><h3>Rendimiento · 30 días</h3><Link to="/organizador/marketing" className="see-all small"><BarChart3 size={15} /> Ver marketing</Link></div>
          <Funnel steps={[{ label: 'Vieron tus eventos', value: t.visualizaciones || 0 }, { label: 'Los guardaron', value: t.favoritos || 0 }, { label: 'Confirmaron asistencia', value: t.asistencias || 0 }]} />
        </section>
      </div>

      <div className="card">
        <div className="row between" style={{ padding: '10px 18px 0', flexWrap: 'wrap' }}>
          <div className="tabs" role="tablist" style={{ marginBottom: 0, borderBottom: 0 }}>
            {[['activos', 'Activos', null], ['revision', 'En revisión y borradores', null], ['pasados', 'Pasados', Archive]].map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                {Icon && <Icon size={14} />}{label} <span className="tab-count">{groups[k].length}</span>
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 18 }}><EmptyState icon={CalendarDays} title="No hay eventos en esta sección" action={<Link to="/publicar" className="btn btn-primary">Crear evento</Link>} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Evento</th><th>Fecha</th><th>Estado</th><th>Cupos</th><th className="col-opt">Interacción</th><th className="col-actions" style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {list.map((ev) => {
                  const av = availability(ev);
                  return (
                    <tr key={ev.id}>
                      <td><Link to={`/evento/${ev.id}`} className="row"><img className="thumb" src={imgOf(ev)} alt="" /><span style={{ minWidth: 0 }}><b className="clamp-1" style={{ maxWidth: 260, display: 'block' }}>{ev.nombre}</b><span className="tiny muted">{ev.categoria}</span></span></Link></td>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>{shortDate(ev.fecha)}<br /><span className="muted">{hora12(ev.hora)}</span></td>
                      <td><StatusBadge estado={ev.estado} /></td>
                      <td><span className={`badge badge-${av.tone}`}>{av.label}</span></td>
                      <td className="small muted col-opt" style={{ whiteSpace: 'nowrap' }}>
                        <span title="Vistas"><Eye size={13} /> {fmt(ev.visualizaciones)}</span> · <span title="Guardados"><Heart size={13} /> {fmt(ev.total_favoritos)}</span> · <span title="Asistirán"><Users size={13} /> {fmt(ev.total_asistencias)}</span> · <span title="Compartidos"><Share2 size={13} /> {fmt(ev.compartidos)}</span>
                      </td>
                      <td className="col-actions">
                        {/* Una acción visible con texto; el resto en el menú "más" */}
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          {!['ARCHIVADO', 'FINALIZADO'].includes(ev.estado) && <Link className="btn btn-light btn-sm" to={`/organizador/eventos/${ev.id}/editar`} aria-label={`Editar ${ev.nombre}`}><Pencil size={15} /> Editar</Link>}
                          <RowMenu label={`Más acciones para ${ev.nombre}`} items={[
                            { label: 'Capacidad y entradas', icon: Ticket, hidden: !['PUBLICADO', 'AGOTADO'].includes(ev.estado), onClick: () => setModal({ type: 'tickets', ev }) },
                            { label: 'Código QR del evento', icon: QrCode, hidden: !['PUBLICADO', 'AGOTADO'].includes(ev.estado), onClick: () => setModal({ type: 'qr', ev }) },
                            { label: 'Ver página pública', icon: Eye, to: `/evento/${ev.id}` },
                          ]} />
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
