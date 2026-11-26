import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Heart, Ticket, Sparkles, Bell } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../../components/ui';

export default function Profile() {
  const { user, setUser, toast } = useApp();
  const [nombre, setNombre] = useState(user.nombre);
  const [pw, setPw] = useState({ actual: '', nueva: '', confirmar: '' });
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/me/summary').then(setSummary); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put('/me/profile', { nombre, notificaciones_email: user.notificaciones_email, notificaciones_recordatorio: user.notificaciones_recordatorio });
      setUser(r.user);
      toast('Perfil actualizado');
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.nueva !== pw.confirmar) return setErr('Las contraseñas nuevas no coinciden.');
    try {
      await api.post('/auth/password', { actual: pw.actual, nueva: pw.nueva });
      setPw({ actual: '', nueva: '', confirmar: '' });
      toast('Contraseña actualizada');
    } catch (e2) { setErr(e2.message); }
  };
  const stats = [
    [Heart, 'Favoritos', summary?.favoritos, '/cuenta/favoritos'],
    [Ticket, 'Próximos', summary?.proximos, '/cuenta/asistencias'],
    [Sparkles, 'Intereses', summary?.intereses, '/cuenta/intereses'],
    [Bell, 'Sin leer', summary?.no_leidas, '/cuenta/notificaciones'],
  ];
  return (
    <>
      <div className="card card-pad row mb-3" style={{ gap: 18, flexWrap: 'wrap' }}>
        <Avatar name={user.nombre} large />
        <div className="grow">
          <h2>{user.nombre}</h2>
          <p className="muted small">{user.correo}</p>
          <div className="row-wrap mt-1" style={{ gap: 6 }}>
            <span className="badge badge-green"><BadgeCheck size={13} /> Correo verificado</span>
            <span className="badge badge-gray">{user.rol === 'ADMINISTRADOR' ? 'Administrador' : user.rol === 'ORGANIZADOR' ? 'Organizador' : 'Usuario'}</span>
          </div>
        </div>
      </div>
      <div className="kpis kpis-4">
        {stats.map(([Icon, label, v, to]) => (
          <Link key={label} to={to} className="kpi"><span className="kpi-top"><span className="kpi-label">{label}</span><span className="ic" style={{ background: 'var(--brand-soft)', color: 'var(--orange-700)' }}><Icon size={17} /></span></span><b>{v ?? '–'}</b></Link>
        ))}
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card card-pad stack" onSubmit={saveProfile}>
          <h3>Datos personales</h3>
          <label className="field"><span>Nombre completo</span><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} /></label>
          <label className="field"><span>Correo electrónico</span><input className="input" value={user.correo} disabled /><small>El correo verificado no puede cambiarse.</small></label>
          <div><button className="btn btn-primary">Guardar cambios</button></div>
        </form>
        <form className="card card-pad stack" onSubmit={savePw}>
          <h3>Seguridad</h3>
          {err && <div className="form-error">{err}</div>}
          <label className="field"><span>Contraseña actual</span><input className="input" type="password" value={pw.actual} onChange={(e) => setPw({ ...pw, actual: e.target.value })} required autoComplete="current-password" /></label>
          <label className="field"><span>Nueva contraseña</span><input className="input" type="password" value={pw.nueva} onChange={(e) => setPw({ ...pw, nueva: e.target.value })} required autoComplete="new-password" /><small>Mínimo 8 caracteres, con letras y números.</small></label>
          <label className="field"><span>Confirmar nueva contraseña</span><input className="input" type="password" value={pw.confirmar} onChange={(e) => setPw({ ...pw, confirmar: e.target.value })} required autoComplete="new-password" /></label>
          <div><button className="btn btn-dark">Actualizar contraseña</button></div>
        </form>
      </div>
    </>
  );
}
