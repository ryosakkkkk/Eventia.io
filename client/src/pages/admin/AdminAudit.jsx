import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Loader } from '../../components/ui';

// RNF14 – Trazabilidad de operaciones
export default function AdminAudit() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/admin/audit').then((r) => setRows(r.auditoria)); }, []);
  if (!rows) return <Loader />;
  const list = rows.filter((r) => !q || `${r.accion} ${r.detalle} ${r.usuario} ${r.entidad}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="page-head"><div><h1>Auditoría</h1><p>Registro de publicaciones, ediciones, eliminaciones y otras operaciones importantes (últimos 200).</p></div>
        <input className="input" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar auditoría" /></div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(r.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td><span className="badge badge-blue">{r.accion.replace(/_/g, ' ').toLowerCase()}</span></td>
                <td className="small">{r.usuario || <span className="muted">Sistema</span>}</td>
                <td className="small muted">{r.entidad}{r.entidad_id ? ` #${r.entidad_id}` : ''}</td>
                <td className="small" style={{ maxWidth: 380 }}>{r.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
