import { useEffect, useState } from 'react';
import { Copy, Check, Send, Facebook, MessageCircle, Link2, Mail, Share2, Download } from 'lucide-react';
import { api, track } from '../api';
import { useApp } from '../context/AppContext';
import { Modal } from './ui';

// RF36 / HU22 – Compartir evento
export function ShareModal({ ev, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/evento/${ev.id}`;
  const text = `¡Mira este evento en Eventia! ${ev.nombre}`;
  const shared = () => track(ev.id, 'COMPARTIDO');
  const opts = [
    ['WhatsApp', '#1fae58', MessageCircle, `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['Facebook', '#1877f2', Facebook, `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ['Telegram', '#229ed9', Send, `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`],
    ['X', '#0f1419', Share2, `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`],
    ['Correo', '#6b7890', Mail, `mailto:?subject=${encodeURIComponent(ev.nombre)}&body=${encodeURIComponent(`${text}\n${url}`)}`],
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* sin permisos */ }
    setCopied(true);
    shared();
    setTimeout(() => setCopied(false), 2000);
  };
  const native = async () => {
    try { await navigator.share({ title: ev.nombre, text, url }); shared(); } catch { /* cancelado */ }
  };
  return (
    <Modal title="Compartir evento" onClose={onClose}>
      <div className="share-grid">
        {opts.map(([name, color, Icon, href]) => (
          <a key={name} className="share-opt" href={href} target="_blank" rel="noopener noreferrer" onClick={shared}>
            <span className="ic" style={{ background: color }}><Icon size={22} /></span>{name}
          </a>
        ))}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button className="share-opt" onClick={native}><span className="ic" style={{ background: 'var(--primary)' }}><Share2 size={22} /></span>Más</button>
        )}
      </div>
      <div className="copy-row">
        <div className="input-icon grow"><Link2 size={16} /><input className="input" readOnly value={url} onFocus={(e) => e.target.select()} /></div>
        <button className="btn btn-dark" onClick={copy}>{copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}</button>
      </div>
    </Modal>
  );
}

// RF31 / HU17 – Reportar evento
export function ReportModal({ ev, onClose }) {
  const { toast } = useApp();
  const [motivos, setMotivos] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/report-reasons').then((r) => setMotivos(r.motivos)); }, []);
  const send = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/events/${ev.id}/reports`, { motivo, descripcion });
      toast('Gracias. Tu reporte fue enviado al equipo de Eventia.');
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Reportar evento" onClose={onClose}
      footer={<><button className="btn btn-light" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!motivo || busy} onClick={send}>Enviar reporte</button></>}>
      <div className="stack">
        <p className="muted small">Ayúdanos a mantener información confiable. Tu reporte será revisado por el administrador.</p>
        {error && <div className="form-error">{error}</div>}
        <div className="stack" style={{ gap: 6 }}>
          {motivos.map((m) => (
            <label key={m} className="check" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 12, background: motivo === m ? 'var(--primary-soft)' : '#fff' }}>
              <input type="radio" name="motivo" checked={motivo === m} onChange={() => setMotivo(m)} /> {m}
            </label>
          ))}
        </div>
        <label className="field"><span>Detalles (opcional)</span>
          <textarea className="textarea" maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cuéntanos qué información es incorrecta…" />
        </label>
      </div>
    </Modal>
  );
}

// RF37 / HU25 – Código QR del evento
export function QrModal({ ev, onClose }) {
  const url = `${location.origin}/evento/${ev.id}`;
  return (
    <Modal title="Código QR del evento" onClose={onClose}
      footer={<a className="btn btn-primary" href={`/api/events/${ev.id}/qr?download=1`}><Download size={16} /> Descargar PNG</a>}>
      <div className="center stack" style={{ alignItems: 'center' }}>
        <div style={{ padding: 14, borderRadius: 20, border: '1px solid var(--line)', background: '#fff' }}>
          <img src={`/api/events/${ev.id}/qr`} alt={`Código QR de ${ev.nombre}`} width={240} height={240} />
        </div>
        <h3>{ev.nombre}</h3>
        <p className="muted small">Imprímelo en afiches, volantes o compártelo en redes. Al escanearlo se abre la página pública del evento.</p>
        <code className="small" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 8 }}>{url}</code>
      </div>
    </Modal>
  );
}
