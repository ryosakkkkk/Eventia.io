import { useEffect, useRef, useState } from 'react';
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
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = async (u, body, msg) => {
    try { await api.patch(`/admin/users/${u.id}`, body); toast(msg); load(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="page-head"><div><h1>Usuarios</h1><p>Consulta cuentas, asigna el rol de organizador o deshabilita accesos.</p></div></div>
      <div className="toolbar mb-2">
        <form className="input-icon grow" style={{ maxWidth: 380 }} role="search" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={17} /><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" />
        </form>
        <div className="quick-filters" role="group" aria-label="Filtrar por rol" style={{ padding: 0, margin: 0 }}>
          {[['', 'Todos'], ['USUARIO', 'Usuarios'], ['ORGANIZADOR', 'Organizadores'], ['ADMINISTRADOR', 'Administradores']].map(([v, l]) => (
            <button key={l} type="button" className={`qchip ${rol === v ? 'on' : ''}`} aria-pressed={rol === v} onClick={() => setRol(v)}>{l}</button>
          ))}
        </div>
        {users && <span className="muted small" aria-live="polite">{users.length} {users.length === 1 ? 'cuenta' : 'cuentas'}</span>}
      </div>
      {!users ? <Loader /> : users.length === 0 ? <EmptyState icon={Users} title="Sin resultados" text="Prueba con otro nombre o correo, o cambia el filtro de rol." /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Organización</th><th>Registro</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const locked = u.rol === 'ADMINISTRADOR' || u.id === user.id;
                return (
                  <tr key={u.id} className={u.estado ? '' : 'row-off'}>
                    <td><div className="row"><Avatar name={u.nombre} /><div><b>{u.nombre}</b><div className="tiny muted">{u.correo}{!u.correo_verificado && ' · sin verificar'}</div></div></div></td>
                    <td>
                      {locked ? <span className="badge badge-violet">{u.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Tu cuenta'}</span> : (
                        <select className="select" style={{ height: 38, width: 160 }} value={u.rol} aria-label={`Rol de ${u.nombre}`} onChange={(e) => patch(u, { rol: e.target.value }, 'Rol actualizado')}>
                          <option value="USUARIO">Usuario</option><option value="ORGANIZADOR">Organizador</option>
                        </select>
                      )}
                    </td>
                    <td className="small">{u.organizacion || <span className="muted">—</span>}{u.eventos > 0 && <div className="tiny muted">{u.eventos} eventos</div>}</td>
                    <td className="small muted">{timeAgo(u.fecha_registro)}</td>
                    <td>
                      {locked ? <span className="badge badge-green">Activo</span> : (
                        <label className="row small" style={{ gap: 8 }}>
                          <span className="switch"><input type="checkbox" checked={u.estado} aria-label={`Cuenta de ${u.nombre} habilitada`} onChange={(e) => patch(u, { estado: e.target.checked }, e.target.checked ? 'Cuenta habilitada' : 'Cuenta deshabilitada')} /><span /></span>
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
