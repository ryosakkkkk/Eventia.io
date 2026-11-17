const express = require('express');
const { query, one, tx, HOY } = require('../db');
const { bad, notFound, forbidden, str, int, bool, likeEscape } = require('../util');
const { requireRole } = require('../auth');
const { audit, notify, notifyInterested, notifyFollowers } = require('../services');
const { EVENT_COLUMNS, EVENT_FROM, shapeEvent } = require('../eventSql');
const jobs = require('../jobs');

const router = express.Router();
router.use(requireRole('ADMINISTRADOR'));
const me = (req) => req.user.id_usuario;

/* ---------- RF32 / HU18 – Estadísticas ---------- */
router.get('/stats', async (req, res) => {
  const valid = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
  const hasta = valid(req.query.hasta) || new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const desde = valid(req.query.desde) || new Date(Date.parse(hasta) - 29 * 86400e3).toISOString().slice(0, 10);
  const p = { desde, hasta };
  const PERIOD = `CAST(DATEADD(HOUR,-5,i.fecha) AS DATE) BETWEEN @desde AND @hasta`;
  const [totales, topVistos, categorias, topFavoritos, topAsistencias, serie, roles] = await Promise.all([
    one(`SELECT (SELECT COUNT(*) FROM eventos WHERE estado <> 'ELIMINADO') AS eventos,
                (SELECT COUNT(*) FROM eventos WHERE estado IN ('PUBLICADO','AGOTADO')) AS publicados,
                (SELECT COUNT(*) FROM eventos WHERE estado = 'PENDIENTE_DE_VALIDACION') AS pendientes,
                (SELECT COUNT(*) FROM eventos WHERE estado IN ('ARCHIVADO','FINALIZADO')) AS archivados,
                (SELECT COUNT(*) FROM usuarios WHERE correo_verificado = 1) AS usuarios,
                (SELECT COUNT(*) FROM usuarios WHERE CAST(fecha_registro AS DATE) BETWEEN @desde AND @hasta) AS nuevos_usuarios,
                (SELECT COUNT(*) FROM reportes WHERE estado IN ('PENDIENTE','EN_REVISION')) AS reportes_abiertos,
                (SELECT COUNT(*) FROM interaccion_evento i WHERE ${PERIOD}) AS interacciones,
                (SELECT COUNT(*) FROM interaccion_evento i WHERE ${PERIOD} AND tipo_interaccion='VISUALIZACION') AS visualizaciones,
                (SELECT COUNT(*) FROM interaccion_evento i WHERE ${PERIOD} AND tipo_interaccion='FAVORITO') AS favoritos,
                (SELECT COUNT(*) FROM interaccion_evento i WHERE ${PERIOD} AND tipo_interaccion='ASISTENCIA') AS asistencias`, p),
    query(`SELECT TOP 8 e.id_evento AS id, e.nombre, COUNT(*) AS n FROM interaccion_evento i JOIN eventos e ON e.id_evento = i.id_evento
            WHERE ${PERIOD} AND i.tipo_interaccion = 'VISUALIZACION' GROUP BY e.id_evento, e.nombre ORDER BY n DESC`, p),
    query(`SELECT c.nombre, COUNT(i.id_interaccion) AS n,
                  (SELECT COUNT(*) FROM eventos x WHERE x.id_categoria = c.id_categoria AND x.estado <> 'ELIMINADO') AS eventos
             FROM categorias c LEFT JOIN eventos e ON e.id_categoria = c.id_categoria
             LEFT JOIN interaccion_evento i ON i.id_evento = e.id_evento AND ${PERIOD}
            GROUP BY c.id_categoria, c.nombre ORDER BY n DESC`, p),
    query(`SELECT TOP 6 e.id_evento AS id, e.nombre, ISNULL(m.favoritos,0) AS n FROM eventos e LEFT JOIN metrica_evento m ON m.id_evento = e.id_evento
            WHERE e.estado <> 'ELIMINADO' ORDER BY n DESC`),
    query(`SELECT TOP 6 e.id_evento AS id, e.nombre, ISNULL(m.asistencias,0) AS n FROM eventos e LEFT JOIN metrica_evento m ON m.id_evento = e.id_evento
            WHERE e.estado <> 'ELIMINADO' ORDER BY n DESC`),
    query(`SELECT CONVERT(varchar(10), CAST(DATEADD(HOUR,-5,i.fecha) AS DATE), 23) AS dia, i.tipo_interaccion AS tipo, COUNT(*) AS n
             FROM interaccion_evento i WHERE ${PERIOD} GROUP BY CAST(DATEADD(HOUR,-5,i.fecha) AS DATE), i.tipo_interaccion`, p),
    query(`SELECT rol, COUNT(*) AS n FROM usuarios GROUP BY rol`),
  ]);
  res.json({ desde, hasta, totales, topVistos, categorias, topFavoritos, topAsistencias, serie, roles });
});

/* ---------- RF30 / HU15 – Moderación de eventos ---------- */
router.get('/events', async (req, res) => {
  const where = [`e.estado <> 'ELIMINADO'`];
  const p = { uid: me(req) };
  const estado = str(req.query.estado, 30);
  if (estado === 'ARCHIVADOS') where.push(`e.estado IN ('ARCHIVADO','FINALIZADO')`);
  else if (estado) { p.estado = estado; where.push('e.estado = @estado'); }
  const q = str(req.query.q, 100);
  if (q) { p.q = `%${likeEscape(q)}%`; where.push(`(e.nombre LIKE @q ESCAPE '\\' OR o.nombre LIKE @q ESCAPE '\\' OR e.ciudad LIKE @q ESCAPE '\\')`); }
  const rows = await query(
    `SELECT TOP 300 ${EVENT_COLUMNS}, u.correo AS organizador_correo,
            (SELECT COUNT(*) FROM reportes r WHERE r.id_evento = e.id_evento AND r.estado IN ('PENDIENTE','EN_REVISION')) AS reportes_abiertos
       ${EVENT_FROM} JOIN usuarios u ON u.id_usuario = o.id_usuario
      WHERE ${where.join(' AND ')}
      ORDER BY CASE WHEN e.estado = 'PENDIENTE_DE_VALIDACION' THEN 0 ELSE 1 END, e.fecha_creacion DESC`, p);
  res.json({ eventos: rows.map(shapeEvent) });
});

async function getEvent(id) {
  const ev = await one(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE e.id_evento = @id`, { id, uid: null });
  if (!ev || ev.estado === 'ELIMINADO') throw notFound('El evento no existe.');
  return shapeEvent(ev);
}

router.post('/events/:id/approve', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  if (!['PENDIENTE_DE_VALIDACION', 'BORRADOR'].includes(ev.estado)) throw bad('El evento no está pendiente de validación.');
  const estado = ev.capacidad > 0 && ev.entradas_disponibles === 0 ? 'AGOTADO' : 'PUBLICADO';
  await query(`UPDATE eventos SET estado = @s, visibilidad = 1 WHERE id_evento = @id`, { s: estado, id: ev.id });
  await audit(me(req), 'VALIDAR_EVENTO', 'eventos', ev.id, `Publicado: ${ev.nombre}`);
  await notify(ev.organizador_usuario, 'VALIDACION', `¡Tu evento "${ev.nombre}" fue aprobado y ya está publicado!`, ev.id,
    { email: true, asunto: 'Tu evento fue publicado' });
  await notifyInterested({ ...ev, id_evento: ev.id });
  res.json({ ok: true, estado });
});

router.post('/events/:id/reject', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  const motivo = str(req.body.motivo, 500) || 'No cumple con las normas de publicación.';
  await query(`UPDATE eventos SET estado = 'BORRADOR', visibilidad = 0, destacado = 0 WHERE id_evento = @id`, { id: ev.id });
  await audit(me(req), 'RECHAZAR_EVENTO', 'eventos', ev.id, motivo);
  await notify(ev.organizador_usuario, 'VALIDACION', `Tu evento "${ev.nombre}" requiere cambios: ${motivo} Puedes editarlo y enviarlo de nuevo.`, ev.id,
    { email: true, asunto: 'Tu evento requiere cambios' });
  res.json({ ok: true });
});

// RF38 / HU26 – Destacados (RN17)
router.post('/events/:id/feature', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  const destacado = bool(req.body.destacado);
  if (destacado) {
    const vigente = await one(`SELECT 1 AS x FROM eventos WHERE id_evento=@id AND estado IN ('PUBLICADO','AGOTADO') AND visibilidad=1 AND fecha >= ${HOY}`, { id: ev.id });
    if (!vigente) throw bad('Solo los eventos publicados y vigentes pueden destacarse.');
  }
  await query(`UPDATE eventos SET destacado = @d WHERE id_evento = @id`, { d: destacado, id: ev.id });
  await audit(me(req), destacado ? 'DESTACAR_EVENTO' : 'QUITAR_DESTACADO', 'eventos', ev.id, ev.nombre);
  res.json({ ok: true, destacado });
});

// Mostrar un evento destacado como primera lámina de la portada
router.post('/events/:id/lead', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  const vigente = await one(`SELECT 1 AS x FROM eventos WHERE id_evento=@id AND estado IN ('PUBLICADO','AGOTADO') AND visibilidad=1 AND fecha >= ${HOY}`, { id: ev.id });
  if (!vigente) throw bad('Solo los eventos publicados y vigentes pueden ir en la portada.');
  await query(`UPDATE eventos SET destacado = 1 WHERE id_evento = @id`, { id: ev.id });
  await audit(me(req), 'LAMINA_PRINCIPAL', 'eventos', ev.id, ev.nombre);
  res.json({ ok: true });
});

// RF26 – Visibilidad (p. ej. archivados públicos) / ocultar un evento reportado
router.post('/events/:id/visibility', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  const vis = bool(req.body.visibilidad);
  if (vis && ['BORRADOR', 'PENDIENTE_DE_VALIDACION'].includes(ev.estado)) throw bad('Primero valida el evento.');
  await query(`UPDATE eventos SET visibilidad = @v, destacado = CASE WHEN @v = 0 THEN 0 ELSE destacado END WHERE id_evento = @id`, { v: vis, id: ev.id });
  await audit(me(req), vis ? 'MOSTRAR_EVENTO' : 'OCULTAR_EVENTO', 'eventos', ev.id, ev.nombre);
  res.json({ ok: true, visibilidad: vis });
});

router.post('/events/:id/archive', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  await query(`UPDATE eventos SET estado = 'ARCHIVADO', destacado = 0 WHERE id_evento = @id`, { id: ev.id });
  await audit(me(req), 'ARCHIVAR_EVENTO', 'eventos', ev.id, ev.nombre);
  res.json({ ok: true });
});

// RF19 – Eliminación definitiva (solo administrador, RN04)
router.delete('/events/:id', async (req, res) => {
  const ev = await getEvent(int(req.params.id));
  if (['PUBLICADO', 'AGOTADO'].includes(ev.estado))
    await notifyFollowers(ev.id, `El evento "${ev.nombre}" fue retirado de Eventia.`).catch(() => {});
  await tx(async (t) => {
    for (const table of ['favoritos', 'asistencias', 'interaccion_evento', 'metrica_evento', 'notificaciones', 'reportes', 'valoraciones'])
      await t.query(`DELETE FROM ${table} WHERE id_evento = @id`, { id: ev.id });
    await t.query(`DELETE FROM eventos WHERE id_evento = @id`, { id: ev.id });
  });
  await audit(me(req), 'ELIMINAR_EVENTO', 'eventos', ev.id, `Eliminado definitivamente: ${ev.nombre}`);
  res.json({ ok: true });
});

router.delete('/ratings/:id', async (req, res) => {
  const r = await query(`DELETE FROM valoraciones OUTPUT DELETED.id_evento WHERE id_valoracion = @id`, { id: int(req.params.id) });
  if (!r.length) throw notFound();
  await audit(me(req), 'MODERAR_VALORACION', 'valoraciones', int(req.params.id), `Evento ${r[0].id_evento}`);
  res.json({ ok: true });
});

/* ---------- RF28 – Usuarios ---------- */
router.get('/users', async (req, res) => {
  const where = ['1=1'];
  const p = {};
  const q = str(req.query.q, 100);
  if (q) { p.q = `%${likeEscape(q)}%`; where.push(`(u.nombre LIKE @q ESCAPE '\\' OR u.correo LIKE @q ESCAPE '\\')`); }
  if (req.query.rol) { p.rol = str(req.query.rol, 20); where.push('u.rol = @rol'); }
  const rows = await query(
    `SELECT TOP 300 u.id_usuario AS id, u.nombre, u.correo, u.rol, u.estado, u.correo_verificado, u.fecha_registro,
            o.nombre AS organizacion,
            (SELECT COUNT(*) FROM eventos e WHERE e.id_organizador = o.id_organizador AND e.estado <> 'ELIMINADO') AS eventos
       FROM usuarios u LEFT JOIN organizadores o ON o.id_usuario = u.id_usuario
      WHERE ${where.join(' AND ')} ORDER BY u.fecha_registro DESC`, p);
  res.json({ usuarios: rows.map((u) => ({ ...u, estado: !!u.estado, correo_verificado: !!u.correo_verificado })) });
});

router.patch('/users/:id', async (req, res) => {
  const id = int(req.params.id);
  if (id === me(req)) throw bad('No puedes modificar tu propia cuenta de administrador desde aquí.');
  const u = await one(`SELECT id_usuario, rol, nombre FROM usuarios WHERE id_usuario = @id`, { id });
  if (!u) throw notFound();
  if (u.rol === 'ADMINISTRADOR') throw forbidden('La cuenta administradora no puede modificarse.');
  const sets = [];
  const p = { id };
  if (req.body.rol !== undefined) {
    // RN12 – un único administrador global
    if (!['USUARIO', 'ORGANIZADOR'].includes(req.body.rol)) throw bad('Rol no permitido.');
    sets.push('rol = @rol'); p.rol = req.body.rol;
  }
  if (req.body.estado !== undefined) { sets.push('estado = @estado'); p.estado = bool(req.body.estado); }
  if (!sets.length) throw bad('Nada que actualizar.');
  await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario = @id`, p);
  await audit(me(req), 'GESTIONAR_USUARIO', 'usuarios', id, JSON.stringify({ rol: p.rol, estado: p.estado }));
  res.json({ ok: true });
});

/* ---------- RF29 – Categorías ---------- */
router.get('/categories', async (_req, res) => {
  const rows = await query(
    `SELECT c.id_categoria, c.nombre, c.descripcion, c.estado,
            (SELECT COUNT(*) FROM eventos e WHERE e.id_categoria = c.id_categoria AND e.estado <> 'ELIMINADO') AS eventos
       FROM categorias c ORDER BY c.nombre`);
  res.json({ categorias: rows.map((c) => ({ ...c, estado: !!c.estado })) });
});
router.post('/categories', async (req, res) => {
  const nombre = str(req.body.nombre, 120);
  if (!nombre) throw bad('Indica el nombre de la categoría.');
  if (await one(`SELECT 1 AS x FROM categorias WHERE nombre = @n`, { n: nombre })) throw bad('Ya existe una categoría con ese nombre.');
  const r = await one(`INSERT INTO categorias (nombre, descripcion, estado) OUTPUT INSERTED.id_categoria VALUES (@n, @d, 1)`,
    { n: nombre, d: str(req.body.descripcion, 500) });
  await audit(me(req), 'CREAR_CATEGORIA', 'categorias', r.id_categoria, nombre);
  res.status(201).json({ ok: true, id: r.id_categoria });
});
router.put('/categories/:id', async (req, res) => {
  const id = int(req.params.id);
  const nombre = str(req.body.nombre, 120);
  if (!nombre) throw bad('Indica el nombre de la categoría.');
  if (await one(`SELECT 1 AS x FROM categorias WHERE nombre = @n AND id_categoria <> @id`, { n: nombre, id })) throw bad('Ya existe una categoría con ese nombre.');
  await query(`UPDATE categorias SET nombre = @n, descripcion = @d WHERE id_categoria = @id`, { n: nombre, d: str(req.body.descripcion, 500), id });
  await audit(me(req), 'EDITAR_CATEGORIA', 'categorias', id, nombre);
  res.json({ ok: true });
});
router.patch('/categories/:id/estado', async (req, res) => {
  const id = int(req.params.id);
  const estado = bool(req.body.estado);
  await query(`UPDATE categorias SET estado = @e WHERE id_categoria = @id`, { e: estado, id });
  await audit(me(req), estado ? 'ACTIVAR_CATEGORIA' : 'DESACTIVAR_CATEGORIA', 'categorias', id, null);
  res.json({ ok: true });
});

/* ---------- HU17 – Reportes ---------- */
router.get('/reports', async (req, res) => {
  const p = {};
  let where = '1=1';
  if (req.query.estado) { p.estado = str(req.query.estado, 20); where = 'r.estado = @estado'; }
  const rows = await query(
    `SELECT TOP 300 r.id_reporte AS id, r.motivo, r.descripcion, r.estado, r.fecha, e.id_evento, e.nombre AS evento, e.estado AS estado_evento,
            e.visibilidad, u.nombre AS usuario, u.correo
       FROM reportes r JOIN eventos e ON e.id_evento = r.id_evento JOIN usuarios u ON u.id_usuario = r.id_usuario
      WHERE ${where}
      ORDER BY CASE r.estado WHEN 'PENDIENTE' THEN 0 WHEN 'EN_REVISION' THEN 1 ELSE 2 END, r.fecha DESC`, p);
  res.json({ reportes: rows.map((r) => ({ ...r, visibilidad: !!r.visibilidad })) });
});
router.patch('/reports/:id', async (req, res) => {
  const id = int(req.params.id);
  const estado = req.body.estado;
  if (!['PENDIENTE', 'EN_REVISION', 'RESUELTO', 'RECHAZADO'].includes(estado)) throw bad('Estado no válido.');
  const r = await one(`UPDATE reportes SET estado = @s OUTPUT INSERTED.id_usuario, INSERTED.id_evento WHERE id_reporte = @id`, { s: estado, id });
  if (!r) throw notFound();
  await audit(me(req), 'GESTIONAR_REPORTE', 'reportes', id, estado);
  if (['RESUELTO', 'RECHAZADO'].includes(estado))
    await notify(r.id_usuario, 'SISTEMA', estado === 'RESUELTO'
      ? 'Gracias por tu reporte. Revisamos el evento y tomamos las medidas correspondientes.'
      : 'Revisamos tu reporte y no encontramos problemas en el evento. ¡Gracias por ayudarnos!', r.id_evento);
  res.json({ ok: true });
});

/* ---------- RNF14 – Auditoría ---------- */
router.get('/audit', async (req, res) => {
  const rows = await query(
    `SELECT TOP 200 a.id, a.accion, a.detalle, a.entidad, a.entidad_id, a.fecha, u.nombre AS usuario
       FROM auditorias a LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario ORDER BY a.id DESC`);
  res.json({ auditoria: rows });
});

// Ejecutar manualmente las tareas automáticas (archivo y recordatorios)
router.post('/jobs/run', async (req, res) => {
  const r = await jobs.runAll();
  await audit(me(req), 'EJECUTAR_TAREAS', 'sistema', null, JSON.stringify(r));
  res.json({ ok: true, ...r });
});

module.exports = router;
