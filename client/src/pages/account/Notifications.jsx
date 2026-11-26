import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CalendarCheck, ShieldCheck, Sparkles, Megaphone, Info, CheckCheck } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EmptyState, Loader } from '../../components/ui';
import { timeAgo } from '../../lib/format';

const TYPE = {
  RECORDATORIO: [BellRing, '#c2410c', 'Recordatorio'],
  EVENTO: [Sparkles, '#7c3aed', 'Evento'],
  VALIDACION: [CalendarCheck, '#15803d', 'Publicación'],
  SEGURIDAD: [ShieldCheck, '#be123c', 'Seguridad'],
  MARKETING: [Megaphone, '#0369a1', 'Novedades'],
  SISTEMA: [Info, '#2563eb', 'Sistema'],
};

// Agrupa por cercanía en el tiempo para que lo reciente se lea primero
function groupOf(fecha) {
  const d = new Date(fecha);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const diff = (start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400e3;
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return 'Esta semana';
  return 'Anteriores';
}

// RF27 / HU11 – Notificaciones
export default function Notifications() {
  const { user, setUser, setUnread, toast } = useApp();
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState({ e: user.notificaciones_email, r: user.notificaciones_recordatorio });
  const [filter, setFilter] = useState('todas');
  const load = () => api.get('/me/notifications').then((r) => { setData(r); setUnread(r.no_leidas); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const readAll = async () => { await api.post('/me/notifications/read-all'); load(); };
  const read = (n) => !n.leido && api.post(`/me/notifications/${n.id}/read`).then(load);
  const savePrefs = async (next) => {
    setPrefs(next);
    const r = await api.put('/me/profile', { nombre: user.nombre, notificaciones_email: next.e, notificaciones_recordatorio: next.r });
    setUser(r.user);
    toast('Preferencias de notificación actualizadas');
  };
  if (!data) return <Loader />;
  const list = data.notificaciones.filter((n) => filter === 'todas' || !n.leido);
  const groups = list.reduce((acc, n) => {
    const g = groupOf(n.fecha_envio);
    (acc[g] = acc[g] || []).push(n);
    return acc;
  }, {});
  return (
    <>
      <div className="page-head">
        <div><h1>Notificaciones</h1><p>Recordatorios, cambios y novedades de los eventos que te interesan.</p></div>
        {data.no_leidas > 0 && <button className="btn btn-light btn-sm" onClick={readAll}><CheckCheck size={16} /> Marcar todas como leídas</button>}
      </div>
      <div className="two-col">
        <div>
          <div className="seg mb-2" role="group" aria-label="Filtrar notificaciones">
            <button className={filter === 'todas' ? 'active' : ''} aria-pressed={filter === 'todas'} onClick={() => setFilter('todas')}>Todas</button>
            <button className={filter === 'sin-leer' ? 'active' : ''} aria-pressed={filter === 'sin-leer'} onClick={() => setFilter('sin-leer')}>
              Sin leer{data.no_leidas > 0 && <span className="count-pill">{data.no_leidas}</span>}
            </button>
          </div>
          <div className="card">
            {list.length === 0 ? (
              <EmptyState icon={Bell} title={filter === 'todas' ? 'No tienes notificaciones' : 'Estás al día'}
                text={filter === 'todas' ? 'Cuando guardes eventos o confirmes asistencia, te avisaremos aquí.' : 'No tienes notificaciones sin leer.'} />
            ) : ['Hoy', 'Ayer', 'Esta semana', 'Anteriores'].filter((g) => groups[g]).map((g) => (
              <section key={g}>
                <h4 className="notif-group">{g}</h4>
                {groups[g].map((n) => {
                  const [Icon, color, label] = TYPE[n.tipo] || TYPE.SISTEMA;
                  const body = (
                    <>
                      <span className="ic" style={{ background: `${color}14`, color }}><Icon size={19} /></span>
                      {/* El mensaje es lo importante; tipo y hora quedan como dato secundario */}
                      <div className="grow" style={{ minWidth: 0 }}>
                        <p className="notif-msg">{!n.leido && <span className="sr-only">No leída: </span>}{n.mensaje}</p>
                        <span className="notif-meta">{label} · {timeAgo(n.fecha_envio)}</span>
                      </div>
                      {!n.leido && <span className="unread-dot" aria-hidden="true" />}
                    </>
                  );
                  return n.id_evento ? (
                    <Link key={n.id} to={`/evento/${n.id_evento}`} className={`notif ${n.leido ? '' : 'unread'}`} onClick={() => read(n)}>{body}</Link>
                  ) : (
                    <div key={n.id} className={`notif ${n.leido ? '' : 'unread'}`} role="button" tabIndex={0} onClick={() => read(n)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), read(n))}>{body}</div>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
        <div>
          <div className="card card-pad stack">
            <h3>Preferencias</h3>
            <label className="row between">
              <span><b className="small">Recordatorios de eventos</b><br /><span className="tiny muted">3 días y 24 horas antes de tus favoritos y eventos con “Asistiré”.</span></span>
              <span className="switch"><input type="checkbox" checked={prefs.r} onChange={(e) => savePrefs({ ...prefs, r: e.target.checked })} /><span /></span>
            </label>
            <label className="row between">
              <span><b className="small">Avisos por correo</b><br /><span className="tiny muted">Recibe también por email los recordatorios y cambios importantes.</span></span>
              <span className="switch"><input type="checkbox" checked={prefs.e} onChange={(e) => savePrefs({ ...prefs, e: e.target.checked })} /><span /></span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
