const express = require('express');
const QRCode = require('qrcode');
const { query, one, HOY, AHORA } = require('../db');
const { bad, notFound, forbidden, str, int, likeEscape, HttpError } = require('../util');
const { requireAuth, isAdmin } = require('../auth');
const { trackInteraction, addMetric, audit } = require('../services');
const { EVENT_COLUMNS, EVENT_FROM, PUBLIC_UPCOMING, shapeEvent } = require('../eventSql');

const router = express.Router();
const uid = (req) => req.user?.id_usuario ?? null;

/* ---------- Utilidades de fecha (hora de Perú) ---------- */
const limaToday = () => new Date(Date.now() - 5 * 3600e3);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400e3);

function dateRange(cuando) {
  const t = limaToday();
  const dow = t.getUTCDay(); // 0 domingo … 6 sábado
  switch (cuando) {
    case 'hoy': return [iso(t), iso(t)];
    case 'manana': return [iso(addDays(t, 1)), iso(addDays(t, 1))];
    case 'finde': {
      if (dow === 0) return [iso(t), iso(t)];
      const start = dow >= 5 ? t : addDays(t, 5 - dow);
      const end = addDays(t, (7 - dow) % 7);
      return [iso(start), iso(end)];
    }
    case 'semana': return [iso(t), iso(addDays(t, 6))];
    case 'mes': return [iso(t), iso(addDays(t, 30))];
    default: return [null, null];
  }
}
const validDate = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/* ---------- RF01, RF03, RF04, RF39 – Listado, búsqueda y filtros ---------- */
router.get('/', async (req, res) => {
  const where = [PUBLIC_UPCOMING];
  const p = { uid: uid(req) };
  const q = str(req.query.q, 100);
  if (q) {
    p.q = `%${likeEscape(q)}%`;
    where.push(`(e.nombre LIKE @q ESCAPE '\\' OR e.descripcion LIKE @q ESCAPE '\\' OR e.artistas LIKE @q ESCAPE '\\'
      OR e.lugar LIKE @q ESCAPE '\\' OR e.ciudad LIKE @q ESCAPE '\\' OR c.nombre LIKE @q ESCAPE '\\' OR o.nombre LIKE @q ESCAPE '\\')`);
  }
  const cat = int(req.query.categoria);
  if (cat) { p.cat = cat; where.push('e.id_categoria = @cat'); }
  const ciudad = str(req.query.ciudad, 120);
  if (ciudad) { p.ciudad = ciudad; where.push('e.ciudad = @ciudad'); }
  let [desde, hasta] = dateRange(req.query.cuando);
  desde = validDate(req.query.desde) || desde;
  hasta = validDate(req.query.hasta) || hasta;
  if (desde) { p.desde = desde; where.push('e.fecha >= @desde'); }
  if (hasta) { p.hasta = hasta; where.push('e.fecha <= @hasta'); }
  if (req.query.disponibilidad === 'con_cupos') where.push(`e.estado <> 'AGOTADO' AND (e.capacidad = 0 OR e.entradas_disponibles > 0)`);
  if (req.query.disponibilidad === 'libre') where.push('e.capacidad = 0');
  if (req.query.destacado === '1') where.push('e.destacado = 1');

  const orders = {
    fecha: 'e.fecha ASC, e.hora ASC',
    popular: '(ISNULL(m.visualizaciones,0) + 3*ISNULL(m.favoritos,0) + 4*ISNULL(m.asistencias,0)) DESC, e.fecha ASC',
    recientes: 'e.fecha_creacion DESC',
  };
  const order = orders[req.query.orden] || orders.fecha;
  const size = Math.min(Math.max(int(req.query.size, 12), 1), 60);
  const page = Math.max(int(req.query.page, 1), 1);
  p.off = (page - 1) * size;
  p.size = size;

  const whereSql = where.join(' AND ');
  const [rows, total] = await Promise.all([
    query(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE ${whereSql} ORDER BY ${order} OFFSET @off ROWS FETCH NEXT @size ROWS ONLY`, p),
    one(`SELECT COUNT(*) AS n ${EVENT_FROM} WHERE ${whereSql}`, p),
  ]);
  res.json({ eventos: rows.map(shapeEvent), total: total.n, page, size });
});

/* ---------- RF38 – Destacados ---------- */
router.get('/featured', async (req, res) => {
  let rows = await query(
    // Orden: el evento destacado más recientemente por el administrador es la lámina principal
    `SELECT TOP 8 ${EVENT_COLUMNS} ${EVENT_FROM} WHERE ${PUBLIC_UPCOMING} AND e.destacado = 1
      ORDER BY (SELECT MAX(a.fecha) FROM auditorias a WHERE a.entidad = 'eventos' AND a.entidad_id = e.id_evento
                  AND a.accion IN ('DESTACAR_EVENTO', 'LAMINA_PRINCIPAL')) DESC, e.fecha, e.hora`,
    { uid: uid(req) }
  );
  res.json({ eventos: rows.map(shapeEvent) });
});

/* ---------- Top de la semana (ranking por interacciones de los últimos 7 días) ---------- */
router.get('/top', async (req, res) => {
  const rows = await query(
    `SELECT TOP 10 ${EVENT_COLUMNS},
        (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = e.id_evento AND i.fecha > DATEADD(DAY,-7,SYSUTCDATETIME())) AS score
     ${EVENT_FROM} WHERE ${PUBLIC_UPCOMING}
     ORDER BY score DESC, ISNULL(m.visualizaciones,0) DESC, e.fecha`,
    { uid: uid(req) }
  );
  res.json({ eventos: rows.map(shapeEvent) });
});

/* ---------- RF33 – Recomendaciones "Para ti" (RN10, RN13) ---------- */
router.get('/for-you', requireAuth, async (req, res) => {
  const p = { uid: uid(req), n: Math.min(int(req.query.size, 12), 30) };
  const pref = await query(
    `SELECT id_categoria, SUM(score) AS score FROM (
       SELECT id_categoria, nivel_interes * 3.0 AS score FROM interes_usuario WHERE id_usuario = @uid
       UNION ALL
       SELECT e.id_categoria,
              CASE i.tipo_interaccion WHEN 'VISUALIZACION' THEN 1.0 WHEN 'FAVORITO' THEN 3.0 WHEN 'ASISTENCIA' THEN 4.0
                                      WHEN 'COMPARTIDO' THEN 2.0 ELSE 1.0 END
         FROM interaccion_evento i JOIN eventos e ON e.id_evento = i.id_evento
        WHERE i.id_usuario = @uid AND i.fecha > DATEADD(DAY, -120, SYSUTCDATETIME())
     ) x GROUP BY id_categoria`,
    p
  );
  const rows = await query(
    `WITH pref AS (
       SELECT id_categoria, SUM(score) AS score FROM (
         SELECT id_categoria, nivel_interes * 3.0 AS score FROM interes_usuario WHERE id_usuario = @uid
         UNION ALL
         SELECT e2.id_categoria,
                CASE i.tipo_interaccion WHEN 'VISUALIZACION' THEN 1.0 WHEN 'FAVORITO' THEN 3.0 WHEN 'ASISTENCIA' THEN 4.0
                                        WHEN 'COMPARTIDO' THEN 2.0 ELSE 1.0 END
           FROM interaccion_evento i JOIN eventos e2 ON e2.id_evento = i.id_evento
          WHERE i.id_usuario = @uid AND i.fecha > DATEADD(DAY, -120, SYSUTCDATETIME())
       ) x GROUP BY id_categoria)
     SELECT TOP (@n) ${EVENT_COLUMNS},
            ISNULL(p.score, 0)
            + CASE WHEN e.destacado = 1 THEN 2 ELSE 0 END
            + 12.0 / (DATEDIFF(DAY, ${HOY}, e.fecha) + 3)
            - CASE WHEN e.estado = 'AGOTADO' THEN 6 ELSE 0 END AS score
       ${EVENT_FROM}
       LEFT JOIN pref p ON p.id_categoria = e.id_categoria
      WHERE ${PUBLIC_UPCOMING}
        AND NOT EXISTS (SELECT 1 FROM asistencias a WHERE a.id_evento = e.id_evento AND a.id_usuario = @uid)
        AND o.id_usuario <> @uid
      ORDER BY score DESC, e.fecha`,
    p
  );
  res.json({ personalizado: pref.length > 0, eventos: rows.map(shapeEvent) });
});

/* ---------- RF40 – Calendario ---------- */
router.get('/calendar', async (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : iso(limaToday()).slice(0, 7);
  const desde = `${mes}-01`;
  const rows = await query(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM}
      WHERE e.visibilidad = 1 AND c.estado = 1 AND e.estado IN ('PUBLICADO','AGOTADO','FINALIZADO','ARCHIVADO')
        AND e.fecha >= @desde AND e.fecha < DATEADD(MONTH, 1, CAST(@desde AS DATE))
      ORDER BY e.fecha, e.hora`,
    { uid: uid(req), desde }
  );
  res.json({ mes, eventos: rows.map(shapeEvent) });
});

/* ---------- RF39 – Ciudades disponibles ---------- */
router.get('/cities', async (_req, res) => {
  const rows = await query(
    `SELECT e.ciudad, COUNT(*) AS total FROM eventos e
      WHERE e.estado IN ('PUBLICADO','AGOTADO') AND e.visibilidad = 1 AND e.fecha >= ${HOY}
      GROUP BY e.ciudad ORDER BY CASE WHEN e.ciudad = N'Abancay' THEN 0 ELSE 1 END, e.ciudad`
  );
  const base = ['Abancay', 'Tamburco', 'Curahuasi', 'Andahuaylas', 'Chalhuanca', 'Chincheros'];
  const map = new Map(base.map((c) => [c, 0]));
  rows.forEach((r) => map.set(r.ciudad, r.total));
  res.json({ ciudades: [...map].map(([ciudad, total]) => ({ ciudad, total })) });
});

/* ---------- RF26 – Archivados públicos ---------- */
router.get('/archived', async (req, res) => {
  const rows = await query(
    `SELECT TOP 60 ${EVENT_COLUMNS} ${EVENT_FROM}
      WHERE e.estado IN ('ARCHIVADO','FINALIZADO') AND e.visibilidad = 1 ORDER BY e.fecha DESC`,
    { uid: uid(req) }
  );
  res.json({ eventos: rows.map(shapeEvent) });
});

/* ---------- RF02 – Detalle ---------- */
async function loadEvent(req, id) {
  const ev = await one(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE e.id_evento = @id`, { id, uid: uid(req) });
  if (!ev) throw notFound('El evento no existe.');
  const owner = req.user && ev.organizador_usuario === req.user.id_usuario;
  const publico = ev.visibilidad && ['PUBLICADO', 'AGOTADO', 'FINALIZADO', 'ARCHIVADO'].includes(ev.estado);
  if (!publico && !owner && !isAdmin(req)) throw notFound('El evento no existe o no está disponible.');
  return { ev: shapeEvent(ev), owner };
}

router.get('/:id', async (req, res) => {
  const id = int(req.params.id);
  if (!id) throw notFound();
  const { ev, owner } = await loadEvent(req, id);
  const [org, timing, ratings, similares, delOrganizador, miValoracion] = await Promise.all([
    one(`SELECT o.nombre, o.whatsapp, o.telefono, o.facebook, o.instagram, o.otras_redes,
                (SELECT COUNT(*) FROM eventos x WHERE x.id_organizador = o.id_organizador AND x.estado IN ('PUBLICADO','AGOTADO','ARCHIVADO','FINALIZADO')) AS total_eventos
           FROM organizadores o WHERE o.id_organizador = @o`, { o: ev.id_organizador }),
    one(`SELECT CASE WHEN DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), e.hora), CAST(e.fecha AS DATETIME2)) <= ${AHORA} THEN 1 ELSE 0 END AS pasado
           FROM eventos e WHERE e.id_evento = @id`, { id }),
    query(`SELECT TOP 20 v.id_valoracion AS id, v.puntuacion, v.comentario, v.fecha, u.nombre
             FROM valoraciones v JOIN usuarios u ON u.id_usuario = v.id_usuario
            WHERE v.id_evento = @id ORDER BY v.fecha DESC`, { id }),
    query(`SELECT TOP 4 ${EVENT_COLUMNS} ${EVENT_FROM} WHERE ${PUBLIC_UPCOMING} AND e.id_categoria = @cat AND e.id_evento <> @id ORDER BY e.fecha`,
      { id, cat: ev.id_categoria, uid: uid(req) }),
    query(`SELECT TOP 4 ${EVENT_COLUMNS} ${EVENT_FROM} WHERE ${PUBLIC_UPCOMING} AND e.id_organizador = @o AND e.id_evento <> @id ORDER BY e.fecha`,
      { id, o: ev.id_organizador, uid: uid(req) }),
    req.user ? one(`SELECT puntuacion, comentario FROM valoraciones WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario }) : null,
  ]);
  const pasado = !!timing?.pasado;
  res.json({
    evento: {
      ...ev,
      pasado,
      contacto: org,
      // Privacidad (RNF05): solo nombre y la inicial del apellido
      valoraciones: ratings.map((r) => {
        const [n, a] = String(r.nombre || '').split(/\s+/);
        return { ...r, nombre: a ? `${n} ${a[0]}.` : n };
      }),
      mi_valoracion: miValoracion,
      puede_valorar: !!(req.user && ev.asistire && pasado && !miValoracion),
      es_propietario: owner,
    },
    similares: similares.map(shapeEvent),
    del_organizador: delOrganizador.map(shapeEvent),
  });
});

/* ---------- RF37 – Código QR (RN16) ---------- */
router.get('/:id/qr', async (req, res) => {
  const id = int(req.params.id);
  await loadEvent(req, id);
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const png = await QRCode.toBuffer(`${base}/evento/${id}?utm_source=qr`, {
    width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b1d35', light: '#ffffff' },
  });
  res.type('png');
  if (req.query.download) res.attachment(`eventia-evento-${id}-qr.png`);
  res.send(png);
});

/* ---------- RF43 – Interacciones (visualización, compartir, contacto, mapa) ---------- */
const PUBLIC_TYPES = ['VISUALIZACION', 'COMPARTIDO', 'CLIC_WHATSAPP', 'CLIC_LLAMADA', 'CLIC_MAPA'];
router.post('/:id/interactions', async (req, res) => {
  const id = int(req.params.id);
  const tipo = String(req.body.tipo || '').toUpperCase();
  if (!PUBLIC_TYPES.includes(tipo)) throw bad('Tipo de interacción no válido.');
  const { ev, owner } = await loadEvent(req, id);
  // RN14: no se contabilizan las vistas del propio organizador ni de eventos no públicos
  if (owner || !ev.visibilidad) return res.json({ ok: true, registrado: false });
  const registrado = await trackInteraction(id, tipo, uid(req), req.cookies?.eventia_vid);
  res.json({ ok: true, registrado });
});

/* ---------- RF12 – Favoritos ---------- */
router.post('/:id/favorite', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  await loadEvent(req, id);
  const exists = await one(`SELECT 1 AS x FROM favoritos WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario });
  if (!exists) {
    await query(`INSERT INTO favoritos (id_evento, id_usuario) VALUES (@id, @u)`, { id, u: req.user.id_usuario });
    await trackInteraction(id, 'FAVORITO', req.user.id_usuario);
  }
  res.json({ ok: true, es_favorito: true });
});
router.delete('/:id/favorite', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  const r = await query(`DELETE FROM favoritos OUTPUT DELETED.id_favorito WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario });
  if (r.length) await addMetric(id, 'favoritos', -1);
  res.json({ ok: true, es_favorito: false });
});

/* ---------- RF13 – Asistiré ---------- */
router.post('/:id/attend', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  const { ev } = await loadEvent(req, id);
  if (!['PUBLICADO', 'AGOTADO'].includes(ev.estado)) throw bad('Este evento ya no admite confirmaciones de asistencia.');
  const exists = await one(`SELECT 1 AS x FROM asistencias WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario });
  if (!exists) {
    await query(`INSERT INTO asistencias (id_evento, id_usuario) VALUES (@id, @u)`, { id, u: req.user.id_usuario });
    await trackInteraction(id, 'ASISTENCIA', req.user.id_usuario);
  }
  res.json({ ok: true, asistire: true });
});
router.delete('/:id/attend', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  const r = await query(`DELETE FROM asistencias OUTPUT DELETED.id_asistencia WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario });
  if (r.length) await addMetric(id, 'asistencias', -1);
  res.json({ ok: true, asistire: false });
});

/* ---------- RF42 – Valoración posterior (RN18) ---------- */
router.post('/:id/ratings', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  const puntuacion = int(req.body.puntuacion);
  if (!puntuacion || puntuacion < 1 || puntuacion > 5) throw bad('La puntuación debe estar entre 1 y 5 estrellas.');
  const comentario = str(req.body.comentario, 2000);
  const ok = await one(
    `SELECT CASE WHEN DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), e.hora), CAST(e.fecha AS DATETIME2)) <= ${AHORA} THEN 1 ELSE 0 END AS pasado,
            CASE WHEN EXISTS (SELECT 1 FROM asistencias a WHERE a.id_evento = e.id_evento AND a.id_usuario = @u) THEN 1 ELSE 0 END AS asistio
       FROM eventos e WHERE e.id_evento = @id AND e.estado <> 'ELIMINADO'`,
    { id, u: req.user.id_usuario }
  );
  if (!ok) throw notFound();
  if (!ok.pasado) throw bad('Podrás valorar el evento cuando haya finalizado.');
  if (!ok.asistio) throw forbidden('Solo quienes marcaron “Asistiré” pueden valorar este evento.');
  const prev = await one(`SELECT 1 AS x FROM valoraciones WHERE id_evento = @id AND id_usuario = @u`, { id, u: req.user.id_usuario });
  if (prev) throw bad('Ya registraste tu valoración para este evento.');
  await query(`INSERT INTO valoraciones (puntuacion, comentario, id_evento, id_usuario) VALUES (@p, @c, @id, @u)`,
    { p: puntuacion, c: comentario, id, u: req.user.id_usuario });
  res.status(201).json({ ok: true });
});

/* ---------- RF31 – Reportar evento ---------- */
const MOTIVOS = ['Información incorrecta', 'Fecha o ubicación equivocada', 'Contenido inapropiado', 'Evento sospechoso o fraudulento', 'Evento cancelado', 'Otro'];
router.post('/:id/reports', requireAuth, async (req, res) => {
  const id = int(req.params.id);
  await loadEvent(req, id);
  const motivo = str(req.body.motivo, 200);
  if (!motivo || !MOTIVOS.includes(motivo)) throw bad('Selecciona un motivo válido.');
  const descripcion = str(req.body.descripcion, 1000);
  const dup = await one(`SELECT 1 AS x FROM reportes WHERE id_evento=@id AND id_usuario=@u AND estado IN ('PENDIENTE','EN_REVISION')`, { id, u: req.user.id_usuario });
  if (dup) throw new HttpError(409, 'Ya tienes un reporte en revisión para este evento.');
  const r = await one(`INSERT INTO reportes (motivo, descripcion, id_evento, id_usuario) OUTPUT INSERTED.id_reporte VALUES (@m, @d, @id, @u)`,
    { m: motivo, d: descripcion, id, u: req.user.id_usuario });
  await audit(req.user.id_usuario, 'REPORTAR_EVENTO', 'reportes', r.id_reporte, `Evento ${id}: ${motivo}`);
  res.status(201).json({ ok: true });
});

module.exports = { router, MOTIVOS };
