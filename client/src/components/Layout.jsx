import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, CalendarDays, Compass, Bell, Plus, Heart, User, LogOut, LayoutDashboard, ShieldCheck, Home,
  Ticket, Settings, Sparkles, Archive, BarChart3, ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { Avatar } from './ui';

export const CITIES_FALLBACK = ['Abancay', 'Tamburco', 'Curahuasi', 'Andahuaylas', 'Chalhuanca', 'Chincheros'];

function useCities() {
  const [cities, setCities] = useState(CITIES_FALLBACK.map((ciudad) => ({ ciudad, total: 0 })));
  useEffect(() => { api.get('/events/cities').then((r) => setCities(r.ciudades)).catch(() => {}); }, []);
  return cities;
}

function UserMenu() {
  const { user, logout, toast } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const isOrg = user.rol === 'ORGANIZADOR' || user.rol === 'ADMINISTRADOR';
  return (
    <div className="menu" ref={ref}>
      <button className="row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menú de usuario">
        <Avatar name={user.nombre} /> <ChevronDown size={16} className="hide-sm" />
      </button>
      {open && (
        <div className="menu-pop" onClick={() => setOpen(false)}>
          <div className="head">
            <b className="clamp-1">{user.nombre}</b>
            <div className="tiny muted clamp-1">{user.correo}</div>
            <span className="badge badge-blue mt-1">{user.rol === 'ADMINISTRADOR' ? 'Administrador' : user.rol === 'ORGANIZADOR' ? 'Organizador' : 'Usuario'}</span>
          </div>
          <Link to="/cuenta/favoritos"><Heart size={17} /> Mis favoritos</Link>
          <Link to="/cuenta/asistencias"><Ticket size={17} /> Mis eventos</Link>
          <Link to="/cuenta/intereses"><Sparkles size={17} /> Para ti e intereses</Link>
          <Link to="/cuenta/perfil"><Settings size={17} /> Mi perfil</Link>
          {isOrg && <Link to="/organizador"><LayoutDashboard size={17} /> Panel del organizador</Link>}
          {user.rol === 'ADMINISTRADOR' && <Link to="/admin"><ShieldCheck size={17} /> Administración</Link>}
          <button onClick={async () => { await logout(); toast('Sesión cerrada', 'info'); navigate('/'); }}><LogOut size={17} /> Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, unread } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const cities = useCities();
  const [q, setQ] = useState(params.get('q') || '');
  const [ciudad, setCiudad] = useState(params.get('ciudad') || 'Abancay');
  useEffect(() => { if (location.pathname === '/explorar') setQ(params.get('q') || ''); }, [params, location.pathname]);
  const submit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (ciudad) p.set('ciudad', ciudad);
    navigate(`/explorar?${p}`);
  };
  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo" aria-label="Eventia, inicio">
          <img src="/favicon.png" alt="" /> <b>Eventia</b>
        </Link>
        <form className="header-search" onSubmit={submit} role="search">
          <Search size={18} color="var(--muted)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar eventos, artistas, lugares…" aria-label="Buscar eventos" />
          <span className="sep" />
          <span className="city"><MapPin size={15} color="var(--orange)" />
            <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} aria-label="Ciudad">
              {cities.map((c) => <option key={c.ciudad} value={c.ciudad}>{c.ciudad}</option>)}
            </select>
          </span>
          <button className="go" aria-label="Buscar"><Search size={16} /></button>
        </form>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/explorar" className="navlink hide-sm"><Compass size={19} /> <span className="hide-md">Explorar</span></NavLink>
          <NavLink to="/calendario" className="navlink hide-sm"><CalendarDays size={19} /> <span className="hide-md">Calendario</span></NavLink>
          <Link to="/publicar" className="btn btn-grad hide-sm" style={{ margin: '0 6px' }}><Plus size={18} /> Publicar evento</Link>
          {user ? (
            <>
              <Link to="/cuenta/notificaciones" className="icon-btn" aria-label={`Notificaciones (${unread} sin leer)`}>
                <Bell size={23} />{unread > 0 && <span className="dot-badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/ingresar" className="btn btn-ghost btn-sm">Ingresar</Link>
              <Link to="/registro" className="btn btn-dark hide-sm">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function TabBar() {
  const { user, unread } = useApp();
  return (
    <nav className="tabbar" aria-label="Navegación móvil">
      <NavLink to="/" end><Home size={24} />Inicio</NavLink>
      <NavLink to="/explorar"><Search size={24} />Explorar</NavLink>
      <NavLink to="/publicar" className="publish"><Plus size={22} />Publicar</NavLink>
      <NavLink to="/cuenta/favoritos"><Heart size={24} />Guardados</NavLink>
      <NavLink to={user ? '/cuenta/notificaciones' : '/ingresar'}>
        <User size={24} />{user ? 'Cuenta' : 'Ingresar'}{user && unread > 0 && <span className="dot-badge" style={{ right: '28%' }}>{unread}</span>}
      </NavLink>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="logo"><img src="/favicon.png" alt="" /> <b>Eventia</b></Link>
            <p className="mt-2" style={{ maxWidth: 330 }}>La plataforma para descubrir, guardar y compartir los eventos de Abancay y Apurímac. Descubre · Conecta · Vive.</p>
          </div>
          <div>
            <h4>Descubre</h4>
            <Link to="/explorar">Explorar eventos</Link>
            <Link to="/explorar?cuando=finde">Este fin de semana</Link>
            <Link to="/calendario">Calendario</Link>
            <Link to="/archivo">Eventos pasados</Link>
          </div>
          <div>
            <h4>Organizadores</h4>
            <Link to="/publicar">Publicar un evento</Link>
            <Link to="/organizador">Panel del organizador</Link>
            <Link to="/organizador/marketing">Estadísticas de marketing</Link>
          </div>
          <div>
            <h4>Tu cuenta</h4>
            <Link to="/cuenta/favoritos">Favoritos</Link>
            <Link to="/cuenta/intereses">Para ti</Link>
            <Link to="/cuenta/notificaciones">Notificaciones</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Eventia · Abancay, Apurímac – Perú</span>
          <span>Mapas © colaboradores de OpenStreetMap · <Link to="/creditos" style={{ display: 'inline', textDecoration: 'underline' }}>Créditos de fotografías</Link></span>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <>
      <Header />
      <main><Outlet /></main>
      <Footer />
      <TabBar />
    </>
  );
}

export function BareLayout() {
  return (<><Header /><main><Outlet /></main><TabBar /></>);
}

/* ---------- Layout de paneles (cuenta, organizador, administración) ---------- */
export function PanelLayout() {
  const { user, unread } = useApp();
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const isOrg = user?.rol === 'ORGANIZADOR' || user?.rol === 'ADMINISTRADOR';
  const L = ({ to, icon: Icon, children, end, count }) => (
    <NavLink to={to} end={end}><Icon size={18} /> {children}{count ? <span className="count">{count}</span> : null}</NavLink>
  );
  return (
    <>
      <Header />
      <div className="panel">
        <aside className="panel-side" aria-label="Menú del panel">
          <div className="who"><Avatar name={user?.nombre} /><div className="grow"><b className="clamp-1">{user?.nombre}</b><span className="tiny">{user?.rol?.toLowerCase()}</span></div></div>
          <div className="label">Mi cuenta</div>
          <L to="/cuenta/favoritos" icon={Heart}>Favoritos</L>
          <L to="/cuenta/asistencias" icon={Ticket}>Mis eventos</L>
          <L to="/cuenta/intereses" icon={Sparkles}>Para ti</L>
          <L to="/cuenta/notificaciones" icon={Bell} count={unread}>Notificaciones</L>
          <L to="/cuenta/perfil" icon={User}>Perfil</L>
          <div className="label">Organizador</div>
          {isOrg && <L to="/organizador" icon={LayoutDashboard} end>Panel</L>}
          {isOrg && <L to="/organizador/marketing" icon={BarChart3}>Marketing</L>}
          <L to="/publicar" icon={Plus}>Publicar evento</L>
          {user?.rol === 'ADMINISTRADOR' && (
            <>
              <div className="label">Administración</div>
              <L to="/admin" icon={ShieldCheck} end>Resumen</L>
              <L to="/admin/eventos" icon={CalendarDays}>Eventos</L>
              <L to="/admin/usuarios" icon={User}>Usuarios</L>
              <L to="/admin/categorias" icon={Compass}>Categorías</L>
              <L to="/admin/reportes" icon={Bell}>Reportes</L>
              <L to="/admin/auditoria" icon={Archive}>Auditoría</L>
            </>
          )}
        </aside>
        <section className="panel-main"><Outlet /></section>
      </div>
    </>
  );
}
