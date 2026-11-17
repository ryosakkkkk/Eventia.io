const jwt = require('jsonwebtoken');
const { one } = require('./db');
const { HttpError, forbidden } = require('./util');

const COOKIE = 'eventia_token';
const isProd = () => process.env.NODE_ENV === 'production';

function signToken(user) {
  return jwt.sign({ sub: user.id_usuario, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: isProd() });
}

// Carga el usuario (si hay sesión) en req.user. Nunca falla.
async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const u = await one(
      `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.estado, u.correo_verificado,
              u.notificaciones_email, u.notificaciones_recordatorio, o.id_organizador
         FROM usuarios u LEFT JOIN organizadores o ON o.id_usuario = u.id_usuario
        WHERE u.id_usuario = @id`,
      { id: Number(payload.sub) }
    );
    if (u && u.estado && u.correo_verificado) req.user = u;
  } catch { /* token inválido o expirado */ }
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Debes iniciar sesión para continuar.'));
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Debes iniciar sesión para continuar.'));
    if (!roles.includes(req.user.rol)) return next(forbidden());
    next();
  };
}

const isAdmin = (req) => req.user?.rol === 'ADMINISTRADOR';

module.exports = { setAuthCookie, clearAuthCookie, loadUser, requireAuth, requireRole, isAdmin };
