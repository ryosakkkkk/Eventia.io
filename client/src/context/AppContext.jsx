import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { api } from '../api';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 180);
  }, []);

  // toast(mensaje, tipo, { action: { label, onClick }, duration })
  const toast = useCallback((message, type = 'success', opts = {}) => {
    const id = ++tid.current;
    const duration = opts.duration ?? (opts.action ? 6000 : 4200);
    setToasts((t) => [...t.slice(-2), { id, message, type, action: opts.action, duration }]);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const r = await api.get('/me/notifications/unread');
      setUnread(r.no_leidas);
    } catch { /* sin sesión */ }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setUnread(0);
  }, []);

  useEffect(() => {
    refreshUser();
    api.get('/categories').then((r) => setCategorias(r.categorias)).catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return undefined;
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  const value = useMemo(
    () => ({ user, setUser, ready, refreshUser, logout, categorias, unread, setUnread, refreshUnread, toast }),
    [user, ready, refreshUser, logout, categorias, unread, refreshUnread, toast]
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type} ${t.leaving ? 'leaving' : ''}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : t.type === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
            {t.action && (
              <button className="toast-action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
            <button className="toast-close" aria-label="Cerrar" onClick={() => dismiss(t.id)}><X size={16} /></button>
            {/* La barra marca el tiempo restante; al pasar el cursor se pausa y el aviso no se cierra */}
            <i className="toast-progress" style={{ '--toast-dur': `${t.duration}ms` }}
              onAnimationEnd={() => dismiss(t.id)} aria-hidden="true" />
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);

// Para acciones que requieren sesión: redirige al login y vuelve después.
export function useRequireLogin() {
  const { user, toast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (msg = 'Inicia sesión para continuar.') => {
      if (user) return true;
      toast(msg, 'info');
      navigate(`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`);
      return false;
    },
    [user, toast, navigate, location]
  );
}
