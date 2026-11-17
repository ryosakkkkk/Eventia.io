import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { Avatar, EmptyState, Loader } from '../../components/ui';
import { timeAgo } from '../../lib/format';

// RF28 – Administración de usuarios
export default function AdminUsers() {
  const { user, toast } = useApp();
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [users, setUsers] = useState(null);
  const load = () => api.get(`/admin/users?q=${encodeURIComponent(q)}&rol=${rol}`).then((r) => setUsers(r.usuarios));
  useEffect(() => { load(); }, [rol]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = async (u, body, msg) => {
    try { await api.patch(`/admin/users/${u.id}`, body); toast(msg); load(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="page-head"><div><h1>Usuarios</h1><p>Consulta cuentas, asigna el rol de organizador o deshabilita accesos.</p></div></div>
      <form className="row-wrap mb-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div className="input-icon grow" style={{ maxWidth: 380 }}><Search size={17} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" /></div>
        <select className="select" style={{ width: 190 }} value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="">Todos los roles</option><option value="USUARIO">Usuarios</option><option value="ORGANIZADOR">Organizadores</option><option value="ADMINISTRADOR">Administrador</option>
        </select>
        <button className="btn btn-light">Buscar</button>
      </form>
      {!users ? <Loader /> : users.length === 0 ? <EmptyState icon={Users} title="Sin resultados" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Organización</th><th>Registro</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const locked = u.rol === 'ADMINISTRADOR' || u.id === user.id;
                return (
                  <tr key={u.id}>
                    <td><div className="row"><Avatar name={u.nombre} /><div><b>{u.nombre}</b><div className="tiny muted">{u.correo}{!u.correo_verificado && ' · sin verificar'}</div></div></div></td>
                    <td>
                      {locked ? <span className="badge badge-violet">{u.rol === 'ADMINISTRADOR' ? 'Administrador' : u.rol}</span> : (
                        <select className="select" style={{ height: 42, width: 160 }} value={u.rol} onChange={(e) => patch(u, { rol: e.target.value }, 'Rol actualizado')}>
                          <option value="USUARIO">Usuario</option><option value="ORGANIZADOR">Organizador</option>
                        </select>
                      )}
                    </td>
                    <td className="small">{u.organizacion || <span className="muted">—</span>}{u.eventos > 0 && <div className="tiny muted">{u.eventos} eventos</div>}</td>
                    <td className="small muted">{timeAgo(u.fecha_registro)}</td>
                    <td>
                      {locked ? <span className="badge badge-green">Activo</span> : (
                        <label className="row small" style={{ gap: 8 }}>
                          <span className="switch"><input type="checkbox" checked={u.estado} onChange={(e) => patch(u, { estado: e.target.checked }, e.target.checked ? 'Cuenta habilitada' : 'Cuenta deshabilitada')} /><span /></span>
                          {u.estado ? 'Activo' : 'Deshabilitado'}
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
