const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query, one } = require('../db');
const { bad, str, isEmail, HttpError } = require('../util');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../auth');
const { issueCode, checkCode, audit } = require('../services');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60e3, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' } });

const publicUser = (u) => ({
  id: u.id_usuario, nombre: u.nombre, correo: u.correo, rol: u.rol,
  notificaciones_email: !!u.notificaciones_email, notificaciones_recordatorio: !!u.notificaciones_recordatorio,
  id_organizador: u.id_organizador || null,
});

function validPassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres.');
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw bad('La contraseña debe combinar letras y números.');
}

// RF07 – Registro
router.post('/register', limiter, async (req, res) => {
  const nombre = str(req.body.nombre, 150);
  const correo = str(req.body.correo, 255)?.toLowerCase();
  const { contrasena } = req.body;
  if (!nombre || nombre.length < 3) throw bad('Ingresa tu nombre completo.');
  if (!isEmail(correo)) throw bad('Ingresa un correo electrónico válido.');
  validPassword(contrasena);

  const existing = await one(`SELECT id_usuario, correo_verificado FROM usuarios WHERE correo = @correo`, { correo });
  if (existing?.correo_verificado) throw bad('Ya existe una cuenta con este correo. Inicia sesión.');
  const hash = await bcrypt.hash(contrasena, 10);
  let user;
  if (existing) {
    // Reintento de registro no verificado: se actualizan los datos
    await query(`UPDATE usuarios SET nombre=@nombre, contrasena=@hash WHERE id_usuario=@id`, { nombre, hash, id: existing.id_usuario });
    user = { id_usuario: existing.id_usuario, correo };
  } else {
    user = await one(
      `INSERT INTO usuarios (nombre, correo, contrasena, rol) OUTPUT INSERTED.id_usuario VALUES (@nombre, @correo, @hash, 'USUARIO')`,
      { nombre, correo, hash }
    );
    user.correo = correo;
  }
  const extra = await issueCode(user, 'registro');
  res.status(201).json({ ok: true, correo, ...extra });
});

// RF08 – Verificación del correo
router.post('/verify', limiter, async (req, res) => {
  const correo = str(req.body.correo, 255)?.toLowerCase();
  const u = await one(`SELECT * FROM usuarios WHERE correo = @correo`, { correo });
  if (!u) throw bad('No encontramos una cuenta con ese correo.');
  if (u.correo_verificado) throw bad('Esta cuenta ya está verificada. Inicia sesión.');
  await checkCode(u.id_usuario, 'registro', req.body.codigo);
  await query(`UPDATE usuarios SET correo_verificado = 1 WHERE id_usuario = @id`, { id: u.id_usuario });
  await query(
    `INSERT INTO notificaciones (enviado, fecha_envio, mensaje, tipo, id_usuario)
     VALUES (1, SYSUTCDATETIME(), N'¡Bienvenido a Eventia! Elige tus intereses para recibir recomendaciones “Para ti”.', 'SISTEMA', @id)`,
    { id: u.id_usuario }
  );
  await audit(u.id_usuario, 'VERIFICAR_CORREO', 'usuarios', u.id_usuario, null);
  setAuthCookie(res, u);
  res.json({ ok: true, user: publicUser({ ...u, correo_verificado: true }) });
});

router.post('/resend', limiter, async (req, res) => {
  const correo = str(req.body.correo, 255)?.toLowerCase();
  const u = await one(`SELECT id_usuario, correo, correo_verificado FROM usuarios WHERE correo = @correo`, { correo });
  if (!u || u.correo_verificado) return res.json({ ok: true });
  const extra = await issueCode(u, 'registro');
  res.json({ ok: true, ...extra });
});

// RF09 – Inicio de sesión
router.post('/login', limiter, async (req, res) => {
  const correo = str(req.body.correo, 255)?.toLowerCase();
  const u = await one(
    `SELECT u.*, o.id_organizador FROM usuarios u LEFT JOIN organizadores o ON o.id_usuario = u.id_usuario WHERE u.correo = @correo`,
    { correo }
  );
  const ok = u && (await bcrypt.compare(String(req.body.contrasena || ''), u.contrasena));
  if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');
  if (!u.estado) throw new HttpError(403, 'Tu cuenta está deshabilitada. Contacta al administrador.');
  if (!u.correo_verificado) {
    const extra = await issueCode(u, 'registro');
    throw new HttpError(403, 'Debes verificar tu correo antes de ingresar. Te enviamos un nuevo código.', { needsVerification: true, correo, ...extra });
  }
  setAuthCookie(res, u);
  res.json({ ok: true, user: publicUser(u) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post('/password', requireAuth, async (req, res) => {
  const u = await one(`SELECT contrasena FROM usuarios WHERE id_usuario = @id`, { id: req.user.id_usuario });
  if (!(await bcrypt.compare(String(req.body.actual || ''), u.contrasena))) throw bad('La contraseña actual no es correcta.');
  validPassword(req.body.nueva);
  await query(`UPDATE usuarios SET contrasena = @h WHERE id_usuario = @id`, { h: await bcrypt.hash(req.body.nueva, 10), id: req.user.id_usuario });
  await audit(req.user.id_usuario, 'CAMBIAR_CONTRASENA', 'usuarios', req.user.id_usuario, null);
  res.json({ ok: true });
});

module.exports = { router, publicUser };
