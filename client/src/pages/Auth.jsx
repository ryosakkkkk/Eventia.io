import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Heart, BellRing, Sparkles, MailCheck, Lock, Mail, User } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';

function Art() {
  return (
    <div className="auth-art">
      <img src="/logo.png" alt="Eventia" style={{ width: 120, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,.35))', background: 'rgba(255,255,255,.92)', borderRadius: 24, padding: 6 }} />
      <div>
        <h2>Todo lo que pasa en Abancay, en un solo lugar.</h2>
        <p>Crea tu cuenta gratis para guardar eventos, confirmar tu asistencia y recibir recomendaciones hechas para ti.</p>
        <div className="pill-list">
          <div><Heart size={20} /> Guarda tus eventos favoritos</div>
          <div><BellRing size={20} /> Recordatorios antes de cada evento</div>
          <div><Sparkles size={20} /> Recomendaciones “Para ti”</div>
        </div>
      </div>
      <span className="tiny" style={{ color: '#8fa0c2' }}>Descubre · Conecta · Vive</span>
    </div>
  );
}

function PasswordInput({ value, onChange, id, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon" style={{ position: 'relative' }}>
      <Lock size={17} />
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required style={{ paddingRight: 44 }} />
      <button type="button" className="icon-btn" style={{ position: 'absolute', right: 3, top: 3 }} onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
}

function OtpInput({ value, onChange }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const setAt = (i, ch) => {
    const arr = digits.map((d) => (d === ' ' ? '' : d));
    arr[i] = ch;
    onChange(arr.join(''));
  };
  return (
    <div className="otp" onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); } }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" maxLength={1} aria-label={`Dígito ${i + 1}`}
          value={d.trim()} autoFocus={i === 0}
          onChange={(e) => { const ch = e.target.value.replace(/\D/g, '').slice(-1); setAt(i, ch); if (ch && i < 5) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !d.trim() && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

export default function Auth({ mode }) {
  const { setUser, toast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [form, setForm] = useState({ nombre: '', correo: location.state?.correo || params.get('correo') || '', contrasena: '', confirmar: '', acepto: false });
  const [codigo, setCodigo] = useState('');
  const [devCode, setDevCode] = useState(location.state?.devCode || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { setError(''); }, [mode]);
  useEffect(() => { if (!cooldown) return undefined; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const up = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const goVerify = (correo, dev) => navigate(`/verificar?${new URLSearchParams({ correo, next })}`, { state: { correo, devCode: dev } });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'login') {
        const r = await api.post('/auth/login', { correo: form.correo, contrasena: form.contrasena });
        setUser(r.user);
        toast(`¡Hola, ${r.user.nombre.split(' ')[0]}!`);
        navigate(next, { replace: true });
      } else if (mode === 'register') {
        if (form.contrasena !== form.confirmar) throw new Error('Las contraseñas no coinciden.');
        if (!form.acepto) throw new Error('Debes aceptar las condiciones de uso.');
        const r = await api.post('/auth/register', { nombre: form.nombre, correo: form.correo, contrasena: form.contrasena });
        toast('Te enviamos un código de verificación a tu correo.', 'info');
        goVerify(r.correo, r.devCode);
      } else {
        const r = await api.post('/auth/verify', { correo: form.correo, codigo });
        setUser(r.user);
        toast('¡Correo verificado! Bienvenido a Eventia.');
        navigate(next === '/' ? '/cuenta/intereses' : next, { replace: true });
      }
    } catch (err) {
      if (err.data?.needsVerification) { toast(err.message, 'info'); goVerify(err.data.correo, err.data.devCode); return; }
      setError(err.message);
    } finally { setBusy(false); }
  };

  const resend = async () => {
    try {
      const r = await api.post('/auth/resend', { correo: form.correo });
      setDevCode(r.devCode || '');
      setCooldown(45);
      toast('Te enviamos un nuevo código.', 'info');
    } catch (err) { setError(err.message); }
  };

  const s = strength(form.contrasena);
  return (
    <div className="auth">
      <Art />
      <div className="auth-form">
        <form className="box stack" onSubmit={submit} noValidate={mode === 'verify'}>
          {mode === 'login' && <><h1>Iniciar sesión</h1><p className="muted">Accede a tu cuenta de Eventia.</p></>}
          {mode === 'register' && <><h1>Crear cuenta</h1><p className="muted">Regístrate con tu correo. Te enviaremos un código para verificarlo.</p></>}
          {mode === 'verify' && (
            <div className="center stack" style={{ alignItems: 'center' }}>
              <div className="empty" style={{ border: 0, padding: 0, background: 'none' }}><div className="ic"><MailCheck size={30} /></div></div>
              <h1>Verifica tu correo</h1>
              <p className="muted">Ingresa el código de 6 dígitos que enviamos a <b>{form.correo}</b>. Tu cuenta se activará al validarlo.</p>
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}

          {mode === 'register' && (
            <label className="field"><span>Nombre completo</span>
              <div className="input-icon"><User size={17} /><input className="input" value={form.nombre} onChange={up('nombre')} autoComplete="name" required minLength={3} /></div>
            </label>
          )}
          {mode !== 'verify' && (
            <label className="field"><span>Correo electrónico</span>
              <div className="input-icon"><Mail size={17} /><input className="input" type="email" value={form.correo} onChange={up('correo')} autoComplete="email" required /></div>
            </label>
          )}
          {mode !== 'verify' && (
            <label className="field"><span>Contraseña</span>
              <PasswordInput id="pw" value={form.contrasena} onChange={up('contrasena')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {mode === 'register' && <>
                <div className="pw-meter" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < s ? 'on' : ''} />)}</div>
                <small>Mínimo 8 caracteres, con letras y números.</small>
              </>}
            </label>
          )}
          {mode === 'register' && (
            <>
              <label className="field"><span>Confirmar contraseña</span>
                <PasswordInput id="pw2" value={form.confirmar} onChange={up('confirmar')} autoComplete="new-password" />
              </label>
              <label className="check small"><input type="checkbox" checked={form.acepto} onChange={up('acepto')} /> Acepto las condiciones de uso y la política de privacidad de Eventia.</label>
            </>
          )}
          {mode === 'verify' && (
            <>
              <OtpInput value={codigo} onChange={setCodigo} />
              {devCode && <div className="dev-code center">Modo desarrollo (correo no configurado). Tu código es <b>{devCode}</b></div>}
            </>
          )}

          <button className="btn btn-grad btn-lg btn-block" disabled={busy || (mode === 'verify' && codigo.length !== 6)}>
            {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta y recibir código' : 'Verificar correo'}
          </button>

          {mode === 'login' && <p className="center small">¿Aún no tienes cuenta? <Link className="link" to={`/registro?next=${encodeURIComponent(next)}`}>Regístrate gratis</Link></p>}
          {mode === 'register' && <p className="center small">¿Ya tienes cuenta? <Link className="link" to={`/ingresar?next=${encodeURIComponent(next)}`}>Inicia sesión</Link></p>}
          {mode === 'verify' && (
            <p className="center small">¿No te llegó? {cooldown ? <span className="muted">Reenviar en {cooldown}s</span> : <button type="button" className="link" onClick={resend}>Reenviar código</button>}</p>
          )}
        </form>
      </div>
    </div>
  );
}
