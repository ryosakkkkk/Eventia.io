import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { PublicLayout, PanelLayout, BareLayout } from './components/Layout';
import { Loader } from './components/ui';
import Home from './pages/Home';
import Explore from './pages/Explore';
import EventDetail from './pages/EventDetail';

const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Archive = lazy(() => import('./pages/Archive'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Credits = lazy(() => import('./pages/Credits'));
const Legal = lazy(() => import('./pages/Legal'));
const Favorites = lazy(() => import('./pages/account/Favorites'));
const Attendances = lazy(() => import('./pages/account/Attendances'));
const Interests = lazy(() => import('./pages/account/Interests'));
const Notifications = lazy(() => import('./pages/account/Notifications'));
const Profile = lazy(() => import('./pages/account/Profile'));
const OrgDashboard = lazy(() => import('./pages/organizer/Dashboard'));
const EventForm = lazy(() => import('./pages/organizer/EventForm'));
const Marketing = lazy(() => import('./pages/organizer/Marketing'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'));

// RNF04 – control de acceso por rol en la interfaz (el backend también lo valida)
function Guard({ roles, children }) {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Loader />;
  if (!user) return <Navigate to={`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/explorar" element={<Explore />} />
              <Route path="/evento/:id" element={<EventDetail />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/archivo" element={<Archive />} />
              <Route path="/creditos" element={<Credits />} />
              <Route path="/privacidad" element={<Legal doc="privacidad" />} />
              <Route path="/condiciones" element={<Legal doc="condiciones" />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<BareLayout />}>
              <Route path="/ingresar" element={<Auth mode="login" />} />
              <Route path="/registro" element={<Auth mode="register" />} />
              <Route path="/verificar" element={<Auth mode="verify" />} />
            </Route>
            <Route element={<Guard><PanelLayout /></Guard>}>
              <Route path="/cuenta" element={<Navigate to="/cuenta/favoritos" replace />} />
              <Route path="/cuenta/favoritos" element={<Favorites />} />
              <Route path="/cuenta/asistencias" element={<Attendances />} />
              <Route path="/cuenta/intereses" element={<Interests />} />
              <Route path="/cuenta/notificaciones" element={<Notifications />} />
              <Route path="/cuenta/perfil" element={<Profile />} />
              <Route path="/publicar" element={<EventForm />} />
              <Route path="/organizador/eventos/:id/editar" element={<EventForm />} />
              <Route path="/organizador" element={<Guard roles={['ORGANIZADOR', 'ADMINISTRADOR']}><OrgDashboard /></Guard>} />
              <Route path="/organizador/marketing" element={<Guard roles={['ORGANIZADOR', 'ADMINISTRADOR']}><Marketing /></Guard>} />
              <Route path="/admin" element={<Guard roles={['ADMINISTRADOR']}><AdminDashboard /></Guard>} />
              <Route path="/admin/eventos" element={<Guard roles={['ADMINISTRADOR']}><AdminEvents /></Guard>} />
              <Route path="/admin/usuarios" element={<Guard roles={['ADMINISTRADOR']}><AdminUsers /></Guard>} />
              <Route path="/admin/categorias" element={<Guard roles={['ADMINISTRADOR']}><AdminCategories /></Guard>} />
              <Route path="/admin/reportes" element={<Guard roles={['ADMINISTRADOR']}><AdminReports /></Guard>} />
              <Route path="/admin/auditoria" element={<Guard roles={['ADMINISTRADOR']}><AdminAudit /></Guard>} />
            </Route>
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}
