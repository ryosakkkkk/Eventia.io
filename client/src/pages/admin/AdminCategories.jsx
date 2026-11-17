import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { Loader, Modal } from '../../components/ui';
import { catStyle } from '../../lib/format';

// RF29 – Administración de categorías
export default function AdminCategories() {
  const { toast } = useApp();
  const [cats, setCats] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.get('/admin/categories').then((r) => setCats(r.categorias));
  useEffect(() => { load(); }, []);
  const save = async () => {
    setErr('');
    try {
      if (edit.id_categoria) await api.put(`/admin/categories/${edit.id_categoria}`, edit);
      else await api.post('/admin/categories', edit);
      toast('Categoría guardada');
      setEdit(null); load();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (c) => {
    await api.patch(`/admin/categories/${c.id_categoria}/estado`, { estado: !c.estado });
    toast(c.estado ? 'Categoría desactivada' : 'Categoría activada');
    load();
  };
  if (!cats) return <Loader />;
  return (
    <>
      <div className="page-head">
        <div><h1>Categorías</h1><p>Crea, edita, activa o desactiva las categorías de eventos. Las inactivas no aparecen al público.</p></div>
        <button className="btn btn-primary" onClick={() => { setErr(''); setEdit({ nombre: '', descripcion: '' }); }}><Plus size={16} /> Nueva categoría</button>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Categoría</th><th>Descripción</th><th>Eventos</th><th>Activa</th><th /></tr></thead>
          <tbody>
            {cats.map((c) => {
              const { Icon, color } = catStyle(c.nombre);
              return (
                <tr key={c.id_categoria} style={{ opacity: c.estado ? 1 : 0.6 }}>
                  <td><span className="row"><span className="cat-circle" style={{ width: 42, height: 42, color, background: `${color}14` }}><Icon size={17} /></span><b>{c.nombre}</b></span></td>
                  <td className="small muted">{c.descripcion}</td>
                  <td>{c.eventos}</td>
                  <td><span className="switch"><input type="checkbox" checked={c.estado} onChange={() => toggle(c)} aria-label={`Activar ${c.nombre}`} /><span /></span></td>
                  <td><button className="icon-btn" onClick={() => { setErr(''); setEdit({ ...c }); }} aria-label="Editar"><Pencil size={17} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id_categoria ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setEdit(null)}
          footer={<><button className="btn btn-light" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
          <div className="stack">
            {err && <div className="form-error">{err}</div>}
            <label className="field"><span>Nombre</span><input className="input" maxLength={120} value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></label>
            <label className="field"><span>Descripción</span><textarea className="textarea" maxLength={500} value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </>
  );
}
