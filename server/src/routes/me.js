const express = require('express');
const { query, one, tx, HOY } = require('../db');
const { bad, str, int, bool } = require('../util');
const { requireAuth } = require('../auth');
const { EVENT_COLUMNS, EVENT_FROM, shapeEvent } = require('../eventSql');
const { publicUser } = require('./auth');

const router = express.Router();
router.use(requireAuth);

// HU09 – Mis favoritos
router.get('/favorites', async (req, res) => {
  const rows = await query(
    `SELECT ${EVENT_COLUMNS}, CASE WHEN e.fecha < ${HOY} THEN 1 ELSE 0 END AS pasado ${EVENT_FROM}
       JOIN favoritos f ON f.id_evento = e.id_evento AND f.id_usuario = @uid
      WHERE e.estado <> 'ELIMINADO'
      ORDER BY CASE WHEN e.fecha < ${HOY} THEN 1 ELSE 0 END, e.fecha`,
    { uid: req.user.id_usuario }
  );
  res.json({ eventos: rows.map(shapeEvent) });
});

// HU10 – Eventos a los que asistiré (y pasados, para valorar)
router.get('/attendances', async (req, res) => {
  const rows = await query(
    `SELECT ${EVENT_COLUMNS}, CASE WHEN e.fecha < ${HOY} THEN 1 ELSE 0 END AS pasado,
            CASE WHEN EXISTS (SELECT 1 FROM valoraciones v WHERE v.id_evento = e.id_evento AND v.id_usuario = @uid) THEN 1 ELSE 0 END AS valorado
       ${EVENT_FROM} JOIN asistencias a ON a.id_evento = e.id_evento AND a.id_usuario = @uid
      WHERE e.estado <> 'ELIMINADO'
      ORDER BY CASE WHEN e.fecha < ${HOY} THEN 1 ELSE 0 END, e.fecha`,
    { uid: req.user.id_usuario }
  );
  res.json({ eventos: rows.map((r) => ({ ...shapeEvent(r), pasado: !!r.pasado, valorado: !!r.valorado })) });
});

// RF10 – Intereses
router.get('/interests', async (req, res) => {
  const rows = await query(`SELECT id_categoria, nivel_interes FROM interes_usuario WHERE id_usuario = @u`, { u: req.user.id_usuario });
  res.json({ intereses: rows });
});
router.put('/interests', async (req, res) => {
  const list = Array.isArray(req.body.intereses) ? req.body.intereses : [];
  const clean = list
    .map((i) => ({ id: int(i.id_categoria ?? i), nivel: Math.min(Math.max(int(i.nivel_interes, 3), 1), 5) }))
    .filter((i) => i.id);
  await tx(async (t) => {
    await t.query(`DELETE FROM interes_usuario WHERE id_usuario = @u`, { u: req.user.id_usuario });
    for (const i of clean)
      await t.query(
        `INSERT INTO interes_usuario (nivel_interes, id_categoria, id_usuario)
         SELECT @n, @c, @u WHERE EXISTS (SELECT 1 FROM categorias WHERE id_categoria = @c AND estado = 1)`,
        { n: i.nivel, c: i.id, u: req.user.id_usuario }
      );
  });
  res.json({ ok: true });
});

// RF27 – Notificaciones
router.get('/notifications', async (req, res) => {
  const rows = await query(
    `SELECT TOP 60 n.id_notificacion AS id, n.mensaje, n.tipo, n.leido, n.enviado, n.fecha_envio, n.id_evento,
            e.nombre AS evento, e.imagen
       FROM notificaciones n LEFT JOIN eventos e ON e.id_evento = n.id_evento
      WHERE n.id_usuario = @u ORDER BY n.id_notificacion DESC`,
    { u: req.user.id_usuario }
  );
  const unread = await one(`SELECT COUNT(*) AS n FROM notificaciones WHERE id_usuario = @u AND leido = 0`, { u: req.user.id_usuario });
  res.json({ notificaciones: rows.map((r) => ({ ...r, leido: !!r.leido, enviado: !!r.enviado })), no_leidas: unread.n });
});
router.get('/notifications/unread', async (req, res) => {
  const r = await one(`SELECT COUNT(*) AS n FROM notificaciones WHERE id_usuario = @u AND leido = 0`, { u: req.user.id_usuario });
  res.json({ no_leidas: r.n });
});
router.post('/notifications/read-all', async (req, res) => {
  await query(`UPDATE notificaciones SET leido = 1 WHERE id_usuario = @u AND leido = 0`, { u: req.user.id_usuario });
  res.json({ ok: true });
});
router.post('/notifications/:id/read', async (req, res) => {
  await query(`UPDATE notificaciones SET leido = 1 WHERE id_notificacion = @id AND id_usuario = @u`, { id: int(req.params.id), u: req.user.id_usuario });
  res.json({ ok: true });
});

// Perfil y preferencias (HU11)
router.put('/profile', async (req, res) => {
  const nombre = str(req.body.nombre, 150);
  if (!nombre || nombre.length < 3) throw bad('Ingresa un nombre válido.');
  await query(
    `UPDATE usuarios SET nombre = @nombre, notificaciones_email = @ne, notificaciones_recordatorio = @nr WHERE id_usuario = @u`,
    { nombre, ne: bool(req.body.notificaciones_email), nr: bool(req.body.notificaciones_recordatorio), u: req.user.id_usuario }
  );
  const u = await one(
    `SELECT u.*, o.id_organizador FROM usuarios u LEFT JOIN organizadores o ON o.id_usuario = u.id_usuario WHERE u.id_usuario = @u`,
    { u: req.user.id_usuario }
  );
  res.json({ ok: true, user: publicUser(u) });
});

router.get('/summary', async (req, res) => {
  const r = await one(
    `SELECT (SELECT COUNT(*) FROM favoritos WHERE id_usuario = @u) AS favoritos,
            (SELECT COUNT(*) FROM asistencias a JOIN eventos e ON e.id_evento = a.id_evento WHERE a.id_usuario = @u AND e.fecha >= ${HOY}) AS proximos,
            (SELECT COUNT(*) FROM interes_usuario WHERE id_usuario = @u) AS intereses,
            (SELECT COUNT(*) FROM notificaciones WHERE id_usuario = @u AND leido = 0) AS no_leidas`,
    { u: req.user.id_usuario }
  );
  res.json(r);
});

module.exports = router;
