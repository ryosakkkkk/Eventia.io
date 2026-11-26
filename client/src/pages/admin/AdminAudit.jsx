import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../api';
import { Loader } from '../../components/ui';

// Color de la acción según su naturaleza (alta, baja, revisión, sistema)
const tone = (a) => (/elimin|deshabil|rechaz/.test(a) ? 'red' : /public|aprob|habilit|crear|registr/.test(a) ? 'green'
  : /edit|actualiz|cambi|rol/.test(a) ? 'blue' : /archivo|automat|tarea/.test(a) ? 'gray' : 'violet');
const humanize = (a) => { const t = a.replace(/_/g, ' ').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

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
        <div className="input-icon" style={{ width: 300 }}><Search size={17} /><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por acción, usuario o detalle" aria-label="Filtrar auditoría" /></div></div>
      <p className="muted small mb-2" aria-live="polite">{list.length} {list.length === 1 ? 'registro' : 'registros'}</p>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(r.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td><span className={`badge badge-${tone(r.accion.toLowerCase())}`}>{humanize(r.accion)}</span></td>
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
