import { useState } from 'react';
import { MessageCircle, Phone, Facebook, Instagram, Globe, Building2 } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';

// Campo con ícono. Debe declararse FUERA del formulario: si se declara dentro, React lo recrea en cada
// tecla, reemplaza el <input> y se pierde el foco (solo se podía escribir una letra).
const I = ({ icon: Icon, children }) => <div className="input-icon"><Icon size={17} />{children}</div>;

// RF06 / HU05 – Canales de contacto del organizador (RN11: distingue WhatsApp y teléfono)
export default function OrgProfileForm({ initial, onSaved, submitLabel = 'Guardar perfil' }) {
  const { toast, refreshUser } = useApp();
  const [f, setF] = useState({
    nombre: initial?.nombre || '', whatsapp: initial?.whatsapp || '', telefono: initial?.telefono || '',
    facebook: initial?.facebook || '', instagram: initial?.instagram || '', otras_redes: initial?.otras_redes || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => { const v = e.target.value; setF((x) => ({ ...x, [k]: v })); };
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api.put('/organizer/profile', f);
      toast('Perfil de organizador guardado');
      await refreshUser();
      onSaved?.(r.organizador);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={submit}>
      {err && <div className="form-error">{err}</div>}
      <label className="field"><span>Nombre del organizador u organización *</span>
        <I icon={Building2}><input className="input" value={f.nombre} onChange={up('nombre')} required placeholder="Ej. Asociación Cultural de Abancay" /></I></label>
      <div className="grid-2">
        <label className="field"><span>WhatsApp</span><I icon={MessageCircle}><input className="input" value={f.whatsapp} onChange={up('whatsapp')} placeholder="+51 9XX XXX XXX" inputMode="tel" /></I></label>
        <label className="field"><span>Teléfono para llamadas</span><I icon={Phone}><input className="input" value={f.telefono} onChange={up('telefono')} placeholder="Si es distinto al WhatsApp" inputMode="tel" /></I></label>
      </div>
      <small className="muted">Registra al menos un número. Los asistentes podrán escribirte o llamarte directamente.</small>
      <div className="grid-2">
        <label className="field"><span>Facebook</span><I icon={Facebook}><input className="input" value={f.facebook} onChange={up('facebook')} placeholder="facebook.com/tu-pagina" /></I></label>
        <label className="field"><span>Instagram</span><I icon={Instagram}><input className="input" value={f.instagram} onChange={up('instagram')} placeholder="instagram.com/tu-cuenta" /></I></label>
      </div>
      <label className="field"><span>Otras redes o web</span><I icon={Globe}><input className="input" value={f.otras_redes} onChange={up('otras_redes')} placeholder="https://…" /></I></label>
      <div><button className="btn btn-primary" disabled={busy}>{submitLabel}</button></div>
    </form>
  );
}
