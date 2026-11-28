import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  CalendarDays, Compass, Bell, Plus, Heart, User, LogOut, LayoutDashboard, ShieldCheck, Home,
  Ticket, Settings, Sparkles, BarChart3, ChevronDown, Users, Tags, Flag, ScrollText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { Avatar } from './ui';
import { SearchBox } from './SearchBox';

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
          <Link to="/cuenta/asistencias"><Ticket size={17} /> Mis asistencias</Link>
          <Link to="/cuenta/intereses"><Sparkles size={17} /> Para ti e intereses</Link>
          <Link to="/cuenta/perfil"><Settings size={17} /> Mi perfil</Link>
          {isOrg && <Link to="/organizador"><LayoutDashboard size={17} /> Mis publicaciones</Link>}
          {user.rol === 'ADMINISTRADOR' && <Link to="/admin"><ShieldCheck size={17} /> Administración</Link>}
          <button onClick={async () => { await logout(); toast('Sesión cerrada', 'info'); navigate('/'); }}><LogOut size={17} /> Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

export function Header({ inPanel = false }) {
  const { user, unread } = useApp();
  const cities = useCities();
  const scrolled = useScrolled();
  const { pathname } = useLocation();
  // En la portada la cabecera flota como cristal oscuro sobre el escenario; al bajar vuelve a ser clara
  const overlay = pathname === '/' && !scrolled;
  return (
    <header className={`header ${scrolled ? 'scrolled' : ''} ${overlay ? 'overlay' : ''}`}>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <div className="container">
        <Link to="/" className="logo" aria-label="Eventia, inicio">
          <img src="/logo-mark.png" alt="" width="50" height="40" /> <b>Eventia</b>
        </Link>
        <SearchBox cities={cities} />
        <nav className="nav" aria-label="Principal">
          <NavLink to="/explorar" className="navlink hide-sm"><Compass size={19} /> <span className="hide-md">Explorar</span></NavLink>
          <NavLink to="/calendario" className="navlink hide-sm"><CalendarDays size={19} /> <span className="hide-md">Calendario</span></NavLink>
          {!inPanel && <Link to="/publicar" className="btn btn-grad hide-sm" style={{ margin: '0 6px' }}><Plus size={18} /> Publicar evento</Link>}
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

const duo = (on) => (on ? { fill: 'currentColor', fillOpacity: 0.18, strokeWidth: 2.25 } : { strokeWidth: 1.9 });

export function TabBar() {
  const { user } = useApp();
  const { pathname } = useLocation();
  // "Cuenta" queda activa en todo /cuenta salvo en favoritos, que tiene su propia pestaña (Guardados)
  const inAccount = pathname.startsWith('/cuenta') && !pathname.startsWith('/cuenta/favoritos');
  return (
    <nav className="tabbar" aria-label="Navegación móvil">
      {/* Ícono activo en duotono (relleno suave + trazo), el resto solo trazo */}
      <NavLink to="/" end>{({ isActive }) => <><Home size={24} {...duo(isActive)} />Inicio</>}</NavLink>
      <NavLink to="/explorar">{({ isActive }) => <><Compass size={24} {...duo(isActive)} />Explorar</>}</NavLink>
      <NavLink to="/publicar" className="publish"><Plus size={22} />Publicar</NavLink>
      <NavLink to="/cuenta/favoritos">{({ isActive }) => <><Heart size={24} {...duo(isActive)} />Guardados</>}</NavLink>
      <NavLink to={user ? '/cuenta/asistencias' : '/ingresar'} className={({ isActive }) => (isActive || inAccount ? 'active' : '')}>
        {({ isActive }) => <><User size={24} {...duo(isActive || inAccount)} />{user ? 'Cuenta' : 'Ingresar'}</>}
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
            <Link to="/" className="logo"><img src="/logo-mark.png" alt="" width="50" height="40" /> <b>Eventia</b></Link>
            <p className="mt-2" style={{ maxWidth: 330 }}>La plataforma para descubrir, guardar y compartir los eventos de Abancay y Apurímac. Descubre · Conecta · Vive.</p>
          </div>
          <div>
            <h2>Descubre</h2>
            <Link to="/explorar">Explorar eventos</Link>
            <Link to="/explorar?cuando=finde">Este fin de semana</Link>
            <Link to="/calendario">Calendario</Link>
            <Link to="/archivo">Eventos pasados</Link>
          </div>
          <div>
            <h2>Organizadores</h2>
            <Link to="/publicar">Publicar un evento</Link>
            <Link to="/organizador">Mis publicaciones</Link>
            <Link to="/organizador/marketing">Estadísticas</Link>
          </div>
          <div>
            <h2>Tu cuenta</h2>
            <Link to="/cuenta/favoritos">Favoritos</Link>
            <Link to="/cuenta/intereses">Para ti</Link>
            <Link to="/cuenta/notificaciones">Notificaciones</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Eventia · Abancay, Apurímac – Perú</span>
          <span>Mapas © colaboradores de OpenStreetMap · <Link to="/creditos" style={{ display: 'inline', textDecoration: 'underline' }}>Créditos de fotografías</Link> · <Link to="/privacidad" style={{ display: 'inline', textDecoration: 'underline' }}>Privacidad</Link> · <Link to="/condiciones" style={{ display: 'inline', textDecoration: 'underline' }}>Condiciones</Link></span>
        </div>
      </div>
    </footer>
  );
}

// Al navegar a otra página: arriba al instante (sin deslizar). Al volver atrás se respeta la posición anterior.
function useScrollTop(pathname) {
  const nav = useNavigationType();
  useLayoutEffect(() => {
    if (nav !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, nav]);
}

export function PublicLayout() {
  const location = useLocation();
  useScrollTop(location.pathname);
  return (
    <>
      <Header />
      {/* La clave por ruta reinicia la animación de entrada en cada cambio de página */}
      <main id="contenido" key={location.pathname} className="page-enter"><Outlet /></main>
      <Footer />
      <TabBar />
    </>
  );
}

export function BareLayout() {
  const location = useLocation();
  return (<><Header /><main id="contenido" key={location.pathname} className="page-enter"><Outlet /></main><TabBar /></>);
}

/* ---------- Layout de paneles (cuenta, organizador, administración) ---------- */
// Fuera del componente: definido adentro, cada render (p. ej. al cambiar el contador) remontaría los enlaces y se perdería el foco
function SideLink({ to, icon: Icon, label, end, count }) {
  return (
    <NavLink to={to} end={end} title={label}>
      <Icon size={18} /> <span className="nl">{label}</span>{count ? <span className="count">{count}</span> : null}
    </NavLink>
  );
}

function panelNav(user, unread) {
  const groups = [];
  if (user?.rol === 'ADMINISTRADOR') {
    groups.push(['Administración', [
      ['/admin', ShieldCheck, 'Resumen', true], ['/admin/eventos', CalendarDays, 'Eventos'], ['/admin/usuarios', Users, 'Usuarios'],
      ['/admin/categorias', Tags, 'Categorías'], ['/admin/reportes', Flag, 'Reportes'], ['/admin/auditoria', ScrollText, 'Auditoría'],
    ]]);
  }
  if (user?.rol === 'ORGANIZADOR' || user?.rol === 'ADMINISTRADOR') {
    groups.push(['Organizador', [['/organizador', LayoutDashboard, 'Mis publicaciones', true], ['/organizador/marketing', BarChart3, 'Estadísticas'], ['/publicar', Plus, 'Publicar evento']]]);
  }
  groups.push(['Mi cuenta', [
    ['/cuenta/favoritos', Heart, 'Favoritos'], ['/cuenta/asistencias', Ticket, 'Asistencias'], ['/cuenta/intereses', Sparkles, 'Intereses'],
    ['/cuenta/notificaciones', Bell, 'Notificaciones', false, unread], ['/cuenta/perfil', User, 'Perfil'],
  ]]);
  return groups;
}

const SCOPES = [['/admin', 'Administración'], ['/organizador', 'Organizador'], ['/publicar', 'Organizador'], ['/cuenta', 'Mi cuenta']];

export function PanelLayout() {
  const { user, unread } = useApp();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const sideRef = useRef(null);
  useScrollTop(location.pathname);
  useEffect(() => { setNavOpen(false); }, [location.pathname]);
  // El menú móvil se cierra al tocar fuera o con Escape (y el foco vuelve al botón)
  useEffect(() => {
    if (!navOpen) return undefined;
    const onDown = (e) => { if (!sideRef.current?.contains(e.target)) setNavOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setNavOpen(false); sideRef.current?.querySelector('.panel-nav-toggle')?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [navOpen]);
  const groups = panelNav(user, unread);
  const isOrg = user?.rol === 'ORGANIZADOR' || user?.rol === 'ADMINISTRADOR';
  const flat = groups.flatMap(([, items]) => items);
  const current = flat.find(([to, , , end]) => (end ? location.pathname === to : location.pathname.startsWith(to))) || flat[0];
  const CurrentIcon = current[1];
  const scope = SCOPES.find(([k]) => location.pathname.startsWith(k))?.[1];
  return (
    <>
      <Header inPanel />
      <div className="panel">
        <aside ref={sideRef} className={`panel-side ${navOpen ? 'open' : ''}`} aria-label="Menú del panel">
          {/* Móvil: un botón con la sección actual abre el menú agrupado */}
          <button type="button" className="panel-nav-toggle" aria-expanded={navOpen} aria-controls="panel-nav" onClick={() => setNavOpen((o) => !o)}>
            <CurrentIcon size={18} /> <span className="grow">{current[2]}</span><ChevronDown size={18} className="chev" />
          </button>
          <nav id="panel-nav" className="panel-nav" aria-label="Panel">
            {groups.map(([label, items]) => (
              <div key={label} className="panel-group">
                <div className="label">{label}</div>
                {items.map(([to, icon, l, end, count]) => <SideLink key={to} to={to} icon={icon} label={l} end={end} count={count} />)}
              </div>
            ))}
            {!isOrg && (
              <Link to="/publicar" className="side-promo">
                <b>¿Organizas eventos?</b>
                <span>Publícalos gratis y llega a todo Abancay.</span>
              </Link>
            )}
          </nav>
        </aside>
        <main id="contenido" className="panel-main page-enter" key={location.pathname}>
          {scope && <span className="ph-eyebrow">{scope}</span>}
          <Outlet />
        </main>
      </div>
      {/* En el formulario de publicación la barra inferior competiría con sus botones */}
      {!(location.pathname.startsWith('/publicar') || location.pathname.endsWith('/editar')) && <TabBar />}
    </>
  );
}
