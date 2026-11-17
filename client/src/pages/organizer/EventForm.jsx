import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Info, MailCheck, Save, Send, Trash2, MapPin, ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EventCard } from '../../components/EventCard';
import { MapPicker, ABANCAY } from '../../components/MapView';
import { Loader, Modal, StatusBadge } from '../../components/ui';
import OrgProfileForm from '../../components/OrgProfileForm';
import { todayISO } from '../../lib/format';

const CITY_CENTER = {
  Abancay: ABANCAY, Tamburco: [-13.6203, -72.873], Curahuasi: [-13.5441, -72.6948], Andahuaylas: [-13.6575, -73.387],
  Chalhuanca: [-14.2948, -73.2443], Chincheros: [-13.5181, -73.7228],
};
const STEPS = ['Información', 'Fecha y lugar', 'Imagen y cupos', 'Revisar y publicar'];
const EMPTY = {
  nombre: '', id_categoria: '', descripcion: '', artistas: '', fecha: '', hora: '19:00', ciudad: 'Abancay', lugar: '', direccion: '',
  latitud: null, longitud: null, limitada: false, capacidad: 0, entradas_disponibles: 0,
};

function validate(step, f) {
  if (step === 0) {
    if (f.nombre.trim().length < 4) return 'El nombre debe tener al menos 4 caracteres.';
    if (!f.id_categoria) return 'Selecciona una categoría.';
    if (f.descripcion.trim().length < 20) return 'Describe el evento con al menos 20 caracteres.';
  }
  if (step === 1) {
    if (!f.fecha) return 'Indica la fecha del evento.';
    if (f.fecha < todayISO()) return 'La fecha no puede estar en el pasado.';
    if (!f.hora) return 'Indica la hora de inicio.';
    if (!f.ciudad.trim() || !f.lugar.trim() || !f.direccion.trim()) return 'Completa ciudad, lugar y dirección.';
  }
  if (step === 2 && f.limitada) {
    if (Number(f.capacidad) <= 0) return 'Indica la capacidad máxima.';
    if (Number(f.entradas_disponibles) < 0) return 'Las entradas disponibles no pueden ser negativas.';
    if (Number(f.entradas_disponibles) > Number(f.capacidad)) return 'Las entradas disponibles no pueden superar la capacidad.';
  }
  return null;
}

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user, categorias, toast, refreshUser } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const isAdmin = user.rol === 'ADMINISTRADOR';
  const [org, setOrg] = useState(undefined);
  const [f, setF] = useState(EMPTY);
  const [estado, setEstado] = useState(null);
  const [imagen, setImagen] = useState({ file: null, url: null, removed: false });
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeModal, setCodeModal] = useState(null);
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    api.get('/organizer/profile').then((r) => setOrg(r.organizador));
    if (editing) {
      api.get(`/organizer/events/${id}`).then(({ evento: e }) => {
        setF({ ...EMPTY, ...e, id_categoria: String(e.id_categoria), artistas: e.artistas || '', limitada: e.capacidad > 0 });
        setEstado(e.estado);
        setImagen({ file: null, url: e.imagen, removed: false });
      }).catch((e) => { toast(e.message, 'error'); navigate('/organizador'); });
    }
  }, [id, editing, navigate, toast]);

  const up = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const preview = useMemo(() => {
    const cat = categorias.find((c) => String(c.id_categoria) === String(f.id_categoria));
    const cap = f.limitada ? Number(f.capacidad) || 0 : 0;
    const disp = f.limitada ? Number(f.entradas_disponibles) || 0 : 0;
    return {
      id: 0, nombre: f.nombre || 'Nombre de tu evento', categoria: cat?.nombre || 'Categoría', fecha: f.fecha || todayISO(), hora: f.hora || '19:00',
      lugar: f.lugar || 'Lugar', ciudad: f.ciudad || 'Abancay', imagen: imagen.url, total_asistencias: 0, capacidad: cap, entradas_disponibles: disp,
      disponibilidad: cap === 0 ? 'LIBRE' : disp === 0 ? 'AGOTADO' : disp / cap <= 0.2 ? 'ULTIMOS' : 'DISPONIBLE',
    };
  }, [f, imagen.url, categorias]);

  if (org === undefined || (editing && !estado)) return <Loader />;

  if (!org && !isAdmin) {
    return (
      <>
        <div className="page-head"><div><h1>Antes de publicar</h1><p>Completa tu perfil de organizador. Estos datos se mostrarán en tus eventos para que las personas puedan contactarte.</p></div></div>
        <div className="card card-pad" style={{ maxWidth: 760 }}><OrgProfileForm onSaved={(o) => setOrg(o)} submitLabel="Continuar" /></div>
      </>
    );
  }

  const next = () => {
    const e = validate(step, f);
    if (e) return setError(e);
    setError('');
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return setError('La imagen debe ser JPG, PNG, WEBP o GIF.');
    if (file.size > 4 * 1024 * 1024) return setError('La imagen supera los 4 MB.');
    setError('');
    setImagen({ file, url: URL.createObjectURL(file), removed: false });
  };

  const send = async (accion, code) => {
    for (let s = 0; s < 3; s++) {
      const e = validate(s, f);
      if (e) { setStep(s); setError(e); return; }
    }
    setBusy(true); setError('');
    const fd = new FormData();
    const cap = f.limitada ? Number(f.capacidad) : 0;
    const data = { ...f, capacidad: cap, entradas_disponibles: f.limitada ? Number(f.entradas_disponibles) : 0, accion };
    const FIELDS = ['nombre', 'id_categoria', 'descripcion', 'artistas', 'fecha', 'hora', 'ciudad', 'lugar', 'direccion', 'latitud', 'longitud', 'capacidad', 'entradas_disponibles', 'accion'];
    FIELDS.forEach((k) => { const v = data[k]; if (v !== null && v !== undefined) fd.append(k, v); });
    if (code) fd.append('codigo', code);
    if (imagen.file) fd.append('imagen', imagen.file);
    if (imagen.removed) fd.append('quitar_imagen', '1');
    try {
      const r = editing ? await api.put(`/organizer/events/${id}`, fd) : await api.post('/organizer/events', fd);
      setCodeModal(null);
      await refreshUser();
      const msg = r.estado === 'PENDIENTE_DE_VALIDACION' ? '¡Evento enviado! El administrador lo revisará pronto.'
        : r.estado === 'BORRADOR' ? 'Borrador guardado.' : editing ? 'Cambios guardados.' : '¡Evento publicado!';
      toast(msg);
      navigate(user.rol === 'USUARIO' && r.estado === 'BORRADOR' ? '/organizador' : '/organizador');
    } catch (e) {
      if (codeModal) setCodeModal((m) => ({ ...m, error: e.message }));
      else setError(e.message);
      if (e.data?.needsProfile) setOrg(null);
    } finally { setBusy(false); }
  };

  // RF16 – verificación por correo antes de enviar a publicación
  const requestCode = async () => {
    for (let s = 0; s < 3; s++) {
      const e = validate(s, f);
      if (e) { setStep(s); setError(e); return; }
    }
    setBusy(true);
    try {
      const r = await api.post('/organizer/request-code');
      setCodigo('');
      setCodeModal({ devCode: r.devCode, error: '' });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const canSubmitForReview = !editing || estado === 'BORRADOR';
  const primary = isAdmin
    ? { label: editing ? 'Guardar cambios' : 'Publicar ahora', icon: Send, run: () => send(editing && estado !== 'BORRADOR' ? 'guardar' : editing ? 'enviar' : 'publicar') }
    : canSubmitForReview
      ? { label: 'Enviar a revisión', icon: Send, run: requestCode }
      : { label: 'Guardar cambios', icon: Save, run: () => send('guardar') };

  return (
    <>
      <div className="page-head">
        <div>
          <Link to={editing ? '/organizador' : '/'} className="small muted row" style={{ gap: 4 }}><ArrowLeft size={15} /> Volver</Link>
          <h1 className="mt-1">{editing ? 'Editar evento' : 'Publicar un evento'}</h1>
          <p>{editing ? 'Actualiza la información; avisaremos a quienes siguen el evento si cambian fecha, hora o lugar.' : isAdmin ? 'Como administrador, el evento se publica directamente.' : 'Completa los pasos. Tu evento será revisado antes de publicarse.'}</p>
        </div>
        {estado && <StatusBadge estado={estado} />}
      </div>

      <div className="steps" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <button key={s} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => i < step && setStep(i)} type="button">
            <i>{i < step ? <Check size={14} /> : i + 1}</i>{s}
          </button>
        ))}
      </div>

      <div className="wizard">
        <div className="card card-pad stack">
          {error && <div className="form-error" role="alert">{error}</div>}

          {step === 0 && <>
            <h3>Información del evento</h3>
            <label className="field"><span>Nombre del evento *</span><input className="input" maxLength={200} value={f.nombre} onChange={up('nombre')} placeholder="Ej. Festival de la Canción Andina" /></label>
            <label className="field"><span>Categoría *</span>
              <select className="select" value={f.id_categoria} onChange={up('id_categoria')}>
                <option value="">Selecciona una categoría</option>
                {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="field"><span>Descripción *</span>
              <textarea className="textarea" maxLength={8000} value={f.descripcion} onChange={up('descripcion')} placeholder="¿Qué vivirán los asistentes? Incluye programa, recomendaciones, edad mínima, etc." style={{ minHeight: 170 }} />
              <small>{f.descripcion.length}/8000 · mínimo 20 caracteres</small>
            </label>
            <label className="field"><span>Artistas o participantes</span><input className="input" maxLength={500} value={f.artistas} onChange={up('artistas')} placeholder="Separados por comas" /></label>
          </>}

          {step === 1 && <>
            <h3>Fecha y lugar</h3>
            <div className="grid-2">
              <label className="field"><span>Fecha *</span><input type="date" className="input" min={todayISO()} value={f.fecha} onChange={up('fecha')} /></label>
              <label className="field"><span>Hora de inicio *</span><input type="time" className="input" value={f.hora} onChange={up('hora')} /></label>
            </div>
            <div className="grid-2">
              <label className="field"><span>Ciudad *</span>
                <input className="input" list="ciudades" value={f.ciudad} onChange={up('ciudad')} />
                <datalist id="ciudades">{Object.keys(CITY_CENTER).map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="field"><span>Lugar *</span><input className="input" maxLength={200} value={f.lugar} onChange={up('lugar')} placeholder="Ej. Plaza de Armas" /></label>
            </div>
            <label className="field"><span>Dirección *</span><input className="input" maxLength={300} value={f.direccion} onChange={up('direccion')} placeholder="Calle, número, referencia" /></label>
            <div className="field">
              <span className="row between"><span className="label"><MapPin size={14} style={{ verticalAlign: '-2px' }} /> Ubicación en el mapa</span>
                {f.latitud != null && <button type="button" className="link small" onClick={() => setF({ ...f, latitud: null, longitud: null })}>Quitar punto</button>}</span>
              <MapPicker lat={f.latitud} lng={f.longitud} center={CITY_CENTER[f.ciudad]} onPick={(la, lo) => setF((x) => ({ ...x, latitud: la, longitud: lo }))} />
              <small>Haz clic en el mapa para marcar el lugar exacto (puedes arrastrar el marcador).</small>
            </div>
          </>}

          {step === 2 && <>
            <h3>Imagen y cupos</h3>
            <div className="upload" onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
              {imagen.url ? <img src={imagen.url} alt="Vista previa del afiche" /> : (
                <div className="stack" style={{ alignItems: 'center' }}><ImagePlus size={36} color="var(--primary)" /><b>Sube el afiche o una foto del evento</b><span className="small muted">JPG, PNG o WEBP · máx. 4 MB · recomendado 1200×675</span></div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pickFile} />
            </div>
            {imagen.url && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setImagen({ file: null, url: null, removed: true })}><Trash2 size={15} /> Quitar imagen</button></div>}
            <hr className="divider" />
            <label className="row between">
              <span><b>Capacidad limitada</b><br /><span className="small muted">Actívalo si el evento tiene un número máximo de asistentes o entradas.</span></span>
              <span className="switch"><input type="checkbox" checked={f.limitada} onChange={(e) => setF({ ...f, limitada: e.target.checked, capacidad: e.target.checked ? f.capacidad || 100 : 0, entradas_disponibles: e.target.checked ? f.entradas_disponibles || f.capacidad || 100 : 0 })} /><span /></span>
            </label>
            {f.limitada ? (
              <div className="grid-2">
                <label className="field"><span>Capacidad máxima *</span><input type="number" min={1} className="input" value={f.capacidad} onChange={up('capacidad')} /></label>
                <label className="field"><span>Entradas disponibles *</span><input type="number" min={0} max={f.capacidad} className="input" value={f.entradas_disponibles} onChange={up('entradas_disponibles')} /><small>Al llegar a 0 se mostrará como agotado.</small></label>
              </div>
            ) : <div className="form-note"><Info size={14} style={{ verticalAlign: '-2px' }} /> Se mostrará como “Entrada libre / sin límite de aforo”.</div>}
          </>}

          {step === 3 && <>
            <h3>Revisa tu evento</h3>
            <dl className="stack small" style={{ gap: 8, margin: 0 }}>
              {[['Nombre', f.nombre], ['Categoría', preview.categoria], ['Fecha y hora', `${f.fecha} · ${f.hora}`], ['Lugar', `${f.lugar}, ${f.direccion} (${f.ciudad})`],
                ['Mapa', f.latitud != null ? 'Ubicación marcada' : 'Sin punto en el mapa'], ['Cupos', f.limitada ? `${f.entradas_disponibles} de ${f.capacidad}` : 'Entrada libre'],
                ['Contacto', org ? [org.whatsapp && `WhatsApp ${org.whatsapp}`, org.telefono && `Tel. ${org.telefono}`].filter(Boolean).join(' · ') || '—' : 'Eventia']].map(([k, v]) => (
                <div key={k} className="row" style={{ alignItems: 'flex-start' }}><dt className="muted" style={{ width: 110, flex: 'none' }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd></div>
              ))}
            </dl>
            {!isAdmin && canSubmitForReview && (
              <div className="form-note row" style={{ alignItems: 'flex-start' }}><ShieldCheck size={18} style={{ flex: 'none' }} /> Para proteger a la comunidad, te enviaremos un código a tu correo para confirmar la publicación. Luego el administrador validará el evento.</div>
            )}
          </>}

          <hr className="divider" style={{ margin: '6px 0' }} />
          <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="btn btn-light" onClick={() => { setError(''); setStep((s) => Math.max(s - 1, 0)); }} disabled={step === 0}><ArrowLeft size={16} /> Anterior</button>
            <div className="row" style={{ gap: 8 }}>
              {(!editing || estado === 'BORRADOR') && !isAdmin && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => send(editing ? 'guardar' : 'borrador')}><Save size={16} /> Guardar borrador</button>
              )}
              {step < 3 ? <button type="button" className="btn btn-primary" onClick={next}>Siguiente <ArrowRight size={16} /></button>
                : <button type="button" className="btn btn-grad" disabled={busy} onClick={primary.run}><primary.icon size={16} /> {primary.label}</button>}
            </div>
          </div>
        </div>

        <div className="preview-sticky">
          <p className="tiny bold muted mb-2" style={{ letterSpacing: '.08em' }}>VISTA PREVIA</p>
          <div style={{ pointerEvents: 'none' }}><EventCard ev={preview} /></div>
          <p className="tiny muted mt-2">Así verán tu evento en el catálogo de Eventia.</p>
        </div>
      </div>

      {codeModal && (
        <Modal title="Confirma tu publicación" onClose={() => setCodeModal(null)}
          footer={<><button className="btn btn-light" onClick={() => setCodeModal(null)}>Cancelar</button>
            <button className="btn btn-grad" disabled={codigo.length !== 6 || busy} onClick={() => send(editing ? 'enviar' : 'enviar', codigo)}><Send size={16} /> Verificar y enviar</button></>}>
          <div className="stack center" style={{ alignItems: 'center' }}>
            <div className="empty" style={{ border: 0, padding: 0, background: 'none' }}><div className="ic"><MailCheck size={30} /></div></div>
            <p className="muted">Enviamos un código de 6 dígitos a <b>{user.correo}</b>.</p>
            {codeModal.error && <div className="form-error">{codeModal.error}</div>}
            <input className="input center" style={{ fontSize: 26, letterSpacing: '.4em', fontWeight: 800, maxWidth: 240, height: 58 }} inputMode="numeric" maxLength={6} autoFocus
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Código de verificación" />
            {codeModal.devCode && <div className="dev-code">Modo desarrollo: tu código es <b>{codeModal.devCode}</b></div>}
          </div>
        </Modal>
      )}
    </>
  );
}
