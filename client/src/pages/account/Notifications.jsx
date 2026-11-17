import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CalendarCheck, ShieldCheck, Sparkles, Megaphone, Info, CheckCheck } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EmptyState, Loader } from '../../components/ui';
import { timeAgo } from '../../lib/format';

const TYPE = {
  RECORDATORIO: [BellRing, '#ff6a13', 'Recordatorio'],
  EVENTO: [Sparkles, '#7c3aed', 'Evento'],
  VALIDACION: [CalendarCheck, '#16a34a', 'Publicación'],
  SEGURIDAD: [ShieldCheck, '#e11d48', 'Seguridad'],
  MARKETING: [Megaphone, '#0284c7', 'Novedades'],
  SISTEMA: [Info, '#2f4fe0', 'Sistema'],
};

// RF27 / HU11 – Notificaciones
export default function Notifications() {
  const { user, setUser, setUnread, toast } = useApp();
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState({ e: user.notificaciones_email, r: user.notificaciones_recordatorio });
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
  return (
    <>
      <div className="page-head">
        <div><h1>Notificaciones</h1><p>Recordatorios, cambios y novedades de los eventos que te interesan.</p></div>
        {data.no_leidas > 0 && <button className="btn btn-light btn-sm" onClick={readAll}><CheckCheck size={16} /> Marcar todas como leídas</button>}
      </div>
      <div className="two-col">
        <div className="card">
          {data.notificaciones.length === 0 ? (
            <EmptyState icon={Bell} title="No tienes notificaciones" text="Cuando guardes eventos o confirmes asistencia, te avisaremos aquí." />
          ) : data.notificaciones.map((n) => {
            const [Icon, color, label] = TYPE[n.tipo] || TYPE.SISTEMA;
            const body = (
              <>
                <span className="ic" style={{ background: `${color}15`, color }}><Icon size={20} /></span>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}><b className="small">{label}</b><span className="tiny muted">{timeAgo(n.fecha_envio)}</span></div>
                  <p className="small" style={{ color: 'var(--text-2)' }}>{n.mensaje}</p>
                </div>
                {!n.leido && <span className="unread-dot" aria-label="No leída" />}
              </>
            );
            return n.id_evento ? (
              <Link key={n.id} to={`/evento/${n.id_evento}`} className={`notif ${n.leido ? '' : 'unread'}`} onClick={() => read(n)}>{body}</Link>
            ) : (
              <div key={n.id} className={`notif ${n.leido ? '' : 'unread'}`} onClick={() => read(n)}>{body}</div>
            );
          })}
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
