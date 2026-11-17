const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { query, one, HOY } = require('../db');
const { bad, notFound, forbidden, str, int, num, phone, url } = require('../util');
const { requireAuth, isAdmin } = require('../auth');
const { issueCode, checkCode, audit, notify, notifyFollowers, notifyInterested } = require('../services');
const { EVENT_COLUMNS, EVENT_FROM, shapeEvent } = require('../eventSql');

const router = express.Router();
router.use(requireAuth);

/* ---------- Subida de imágenes ---------- */
// Local: se guardan en server/uploads/eventos. Vercel (disco temporal): se guardan en Vercel Blob.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'eventos');
if (!process.env.VERCEL) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const newName = (file) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
const upload = multer({
  storage: USE_BLOB || process.env.VERCEL
    ? multer.memoryStorage()
    : multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, file, cb) => cb(null, newName(file)) }),
  limits: { fileSize: 4 * 1024 * 1024 }, // Vercel acepta solicitudes de hasta 4,5 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) && /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : bad('La imagen debe ser JPG, PNG, WEBP o GIF (máx. 4 MB).'), ok);
  },
});

async function saveImage(file) {
  if (!file) return null;
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const blob = await put(`eventos/${newName(file)}`, file.buffer, { access: 'public', contentType: file.mimetype });
    return blob.url;
  }
  if (process.env.VERCEL) throw bad('Para subir imágenes en Vercel conecta un almacenamiento Vercel Blob al proyecto.');
  return `/uploads/eventos/${file.filename}`;
}

/* ---------- Perfil de organizador ---------- */
async function getOrganizer(idUsuario) {
  return one(`SELECT * FROM organizadores WHERE id_usuario = @u`, { u: idUsuario });
}

router.get('/profile', async (req, res) => {
  res.json({ organizador: await getOrganizer(req.user.id_usuario) });
});

router.put('/profile', async (req, res) => {
  const data = {
    nombre: str(req.body.nombre, 150),
    whatsapp: phone(req.body.whatsapp),
    telefono: phone(req.body.telefono),
    facebook: url(req.body.facebook),
    instagram: url(req.body.instagram),
    otras: str(req.body.otras_redes, 1000),
    u: req.user.id_usuario,
  };
  if (!data.nombre) throw bad('Indica el nombre del organizador o la organización.');
  if (!data.whatsapp && !data.telefono) throw bad('Registra al menos un número de WhatsApp o de teléfono para que te contacten.');
  const exists = await getOrganizer(req.user.id_usuario);
  if (exists) {
    await query(
      `UPDATE organizadores SET nombre=@nombre, whatsapp=@whatsapp, telefono=@telefono, facebook=@facebook,
              instagram=@instagram, otras_redes=@otras WHERE id_usuario=@u`, data);
  } else {
    await query(
      `INSERT INTO organizadores (nombre, whatsapp, telefono, facebook, instagram, otras_redes, id_usuario)
       VALUES (@nombre, @whatsapp, @telefono, @facebook, @instagram, @otras, @u)`, data);
  }
  await audit(req.user.id_usuario, exists ? 'EDITAR_ORGANIZADOR' : 'CREAR_ORGANIZADOR', 'organizadores', null, data.nombre);
  res.json({ ok: true, organizador: await getOrganizer(req.user.id_usuario) });
});

// RF16 – Código antes de publicar
router.post('/request-code', async (req, res) => {
  const extra = await issueCode(req.user, 'publicacion');
  res.json({ ok: true, ...extra });
});

/* ---------- Validación de datos del evento (RNF06) ---------- */
async function parseEvent(body, { strictDate }) {
  const ev = {
    nombre: str(body.nombre, 200),
    descripcion: str(body.descripcion, 8000),
    artistas: str(body.artistas, 500),
    id_categoria: int(body.id_categoria),
    fecha: str(body.fecha, 10),
    hora: str(body.hora, 5),
    ciudad: str(body.ciudad, 120),
    lugar: str(body.lugar, 200),
    direccion: str(body.direccion, 300),
    latitud: num(body.latitud),
    longitud: num(body.longitud),
    capacidad: int(body.capacidad, 0),
    entradas_disponibles: int(body.entradas_disponibles, null),
  };
  if (!ev.nombre || ev.nombre.length < 4) throw bad('El nombre del evento debe tener al menos 4 caracteres.');
  if (!ev.descripcion || ev.descripcion.length < 20) throw bad('Describe el evento con al menos 20 caracteres.');
  if (!ev.id_categoria) throw bad('Selecciona una categoría.');
  const cat = await one(`SELECT estado FROM categorias WHERE id_categoria = @c`, { c: ev.id_categoria });
  if (!cat || !cat.estado) throw bad('La categoría seleccionada no está disponible.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.fecha || '') || isNaN(Date.parse(ev.fecha))) throw bad('Indica una fecha válida.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(ev.hora || '')) throw bad('Indica una hora válida (HH:MM).');
  if (strictDate) {
    const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    if (ev.fecha < today) throw bad('La fecha del evento no puede estar en el pasado.');
  }
  if (!ev.ciudad) throw bad('Indica la ciudad.');
  if (!ev.lugar) throw bad('Indica el lugar del evento.');
  if (!ev.direccion) throw bad('Indica la dirección del evento.');
  if ((ev.latitud === null) !== (ev.longitud === null)) throw bad('La ubicación en el mapa está incompleta.');
  if (ev.latitud !== null && (Math.abs(ev.latitud) > 90 || Math.abs(ev.longitud) > 180)) throw bad('Coordenadas no válidas.');
  if (ev.capacidad < 0 || ev.capacidad > 1000000) throw bad('La capacidad no es válida.');
  if (ev.entradas_disponibles === null) ev.entradas_disponibles = ev.capacidad;
  if (ev.entradas_disponibles < 0) throw bad('Las entradas disponibles no pueden ser negativas.');
  if (ev.entradas_disponibles > ev.capacidad) throw bad('Las entradas disponibles no pueden superar la capacidad.');
  return ev;
}

const stateForTickets = (estado, capacidad, entradas) => {
  if (estado === 'PUBLICADO' && capacidad > 0 && entradas === 0) return 'AGOTADO';
  if (estado === 'AGOTADO' && (capacidad === 0 || entradas > 0)) return 'PUBLICADO';
  return estado;
};

async function ensureOrganizer(req) {
  let org = await getOrganizer(req.user.id_usuario);
  if (!org && isAdmin(req)) {
    await query(`INSERT INTO organizadores (nombre, id_usuario) VALUES (N'Eventia Abancay', @u)`, { u: req.user.id_usuario });
    org = await getOrganizer(req.user.id_usuario);
  }
  if (!org) throw bad('Primero completa tu perfil de organizador con tus datos de contacto.', { needsProfile: true });
  return org;
}

async function notifyAdmins(mensaje, idEvento) {
  const admins = await query(`SELECT id_usuario FROM usuarios WHERE rol = 'ADMINISTRADOR' AND estado = 1`);
  for (const a of admins) await notify(a.id_usuario, 'VALIDACION', mensaje, idEvento);
}

/* ---------- Mis eventos ---------- */
router.get('/events', async (req, res) => {
  const org = await getOrganizer(req.user.id_usuario);
  if (!org) return res.json({ eventos: [], organizador: null });
  const rows = await query(
    `SELECT ${EVENT_COLUMNS}, ISNULL(m.clics_whatsapp,0) AS clics_whatsapp, ISNULL(m.clics_llamada,0) AS clics_llamada
       ${EVENT_FROM} WHERE e.id_organizador = @o AND e.estado <> 'ELIMINADO' ORDER BY e.fecha DESC`,
    { o: org.id_organizador, uid: req.user.id_usuario }
  );
  res.json({ eventos: rows.map(shapeEvent), organizador: org });
});

async function loadOwned(req, id) {
  const ev = await one(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE e.id_evento = @id`, { id, uid: req.user.id_usuario });
  if (!ev || ev.estado === 'ELIMINADO') throw notFound('El evento no existe.');
  // RN03 – solo el organizador dueño (o el administrador)
  if (ev.organizador_usuario !== req.user.id_usuario && !isAdmin(req)) throw forbidden('Solo puedes gestionar tus propios eventos.');
  return shapeEvent(ev);
}

router.get('/events/:id', async (req, res) => {
  res.json({ evento: await loadOwned(req, int(req.params.id)) });
});

/* ---------- RF15/RF16/RF17 – Crear evento ---------- */
router.post('/events', upload.single('imagen'), async (req, res) => {
  const accion = ['borrador', 'enviar', 'publicar'].includes(req.body.accion) ? req.body.accion : 'enviar';
  const admin = isAdmin(req);
  if (accion === 'publicar' && !admin) throw forbidden('Solo el administrador puede publicar directamente.');
  const org = await ensureOrganizer(req);
  const ev = await parseEvent(req.body, { strictDate: accion !== 'borrador' });
  if (accion === 'enviar' && !admin) await checkCode(req.user.id_usuario, 'publicacion', req.body.codigo);

  const estado = accion === 'borrador' ? 'BORRADOR' : accion === 'publicar' || admin ? 'PUBLICADO' : 'PENDIENTE_DE_VALIDACION';
  const imagen = await saveImage(req.file);
  const finalEstado = stateForTickets(estado, ev.capacidad, ev.entradas_disponibles);
  const created = await one(
    `INSERT INTO eventos (nombre, descripcion, artistas, id_categoria, fecha, hora, ciudad, lugar, direccion, latitud, longitud,
                          capacidad, entradas_disponibles, estado, visibilidad, imagen, id_organizador)
     OUTPUT INSERTED.id_evento
     VALUES (@nombre, @descripcion, @artistas, @id_categoria, @fecha, @hora, @ciudad, @lugar, @direccion, @latitud, @longitud,
             @capacidad, @entradas_disponibles, @estado, @vis, @imagen, @org)`,
    { ...ev, estado: finalEstado, vis: estado === 'PUBLICADO', imagen, org: org.id_organizador }
  );
  const id = created.id_evento;
  await query(`INSERT INTO metrica_evento (id_evento) VALUES (@id)`, { id });

  // Al validar su correo para publicar, el usuario pasa a ser organizador (RF15)
  if (accion === 'enviar' && req.user.rol === 'USUARIO')
    await query(`UPDATE usuarios SET rol = 'ORGANIZADOR' WHERE id_usuario = @u`, { u: req.user.id_usuario });

  await audit(req.user.id_usuario, estado === 'PUBLICADO' ? 'PUBLICAR_EVENTO' : estado === 'BORRADOR' ? 'CREAR_BORRADOR' : 'SOLICITAR_PUBLICACION',
    'eventos', id, ev.nombre);
  if (estado === 'PENDIENTE_DE_VALIDACION') {
    await notifyAdmins(`Nuevo evento pendiente de validación: "${ev.nombre}".`, id);
    await notify(req.user.id_usuario, 'VALIDACION', `Recibimos tu evento "${ev.nombre}". Te avisaremos cuando sea revisado.`, id);
  }
  if (estado === 'PUBLICADO') await notifyInterested({ ...ev, id_evento: id, organizador_usuario: req.user.id_usuario });
  res.status(201).json({ ok: true, id, estado: finalEstado });
});

/* ---------- RF18 – Editar evento ---------- */
router.put('/events/:id', upload.single('imagen'), async (req, res) => {
  const id = int(req.params.id);
  const prev = await loadOwned(req, id);
  if (['ARCHIVADO', 'FINALIZADO'].includes(prev.estado) && !isAdmin(req)) throw bad('Los eventos finalizados o archivados no se pueden editar.');
  const accion = req.body.accion || 'guardar';
  const admin = isAdmin(req);
  const ev = await parseEvent(req.body, { strictDate: accion === 'enviar' || ['PUBLICADO', 'AGOTADO'].includes(prev.estado) && prev.fecha !== req.body.fecha });

  let estado = prev.estado;
  if (accion === 'enviar' && prev.estado === 'BORRADOR') {
    if (admin) estado = 'PUBLICADO';
    else {
      await checkCode(req.user.id_usuario, 'publicacion', req.body.codigo);
      estado = 'PENDIENTE_DE_VALIDACION';
      if (req.user.rol === 'USUARIO') await query(`UPDATE usuarios SET rol='ORGANIZADOR' WHERE id_usuario=@u`, { u: req.user.id_usuario });
    }
  }
  estado = stateForTickets(estado, ev.capacidad, ev.entradas_disponibles);
  const imagen = req.file ? await saveImage(req.file) : req.body.quitar_imagen === '1' ? null : prev.imagen;
  const vis = ['PUBLICADO', 'AGOTADO'].includes(estado) ? true : estado === 'PENDIENTE_DE_VALIDACION' || estado === 'BORRADOR' ? false : prev.visibilidad;

  await query(
    `UPDATE eventos SET nombre=@nombre, descripcion=@descripcion, artistas=@artistas, id_categoria=@id_categoria, fecha=@fecha,
            hora=@hora, ciudad=@ciudad, lugar=@lugar, direccion=@direccion, latitud=@latitud, longitud=@longitud,
            capacidad=@capacidad, entradas_disponibles=@entradas_disponibles, estado=@estado, visibilidad=@vis, imagen=@imagen
      WHERE id_evento=@id`,
    { ...ev, estado, vis, imagen, id }
  );
  const cambios = [];
  if (prev.fecha !== ev.fecha) cambios.push(`fecha: ${ev.fecha}`);
  if (prev.hora !== ev.hora) cambios.push(`hora: ${ev.hora}`);
  if (prev.lugar !== ev.lugar || prev.direccion !== ev.direccion) cambios.push(`lugar: ${ev.lugar}`);
  await audit(req.user.id_usuario, admin && prev.organizador_usuario !== req.user.id_usuario ? 'ADMIN_EDITAR_EVENTO' : 'EDITAR_EVENTO',
    'eventos', id, cambios.join('; ') || 'Actualización de datos');
  // RF27 – cambios importantes a quienes siguen el evento
  if (cambios.length && ['PUBLICADO', 'AGOTADO'].includes(estado))
    await notifyFollowers(id, `El evento "${ev.nombre}" cambió (${cambios.join(', ')}). Revisa los detalles actualizados.`);
  if (estado === 'PENDIENTE_DE_VALIDACION' && prev.estado === 'BORRADOR')
    await notifyAdmins(`Nuevo evento pendiente de validación: "${ev.nombre}".`, id);
  res.json({ ok: true, estado });
});

/* ---------- RF21/RF22 – Capacidad y entradas (HU14) ---------- */
router.patch('/events/:id/tickets', async (req, res) => {
  const id = int(req.params.id);
  const prev = await loadOwned(req, id);
  const capacidad = int(req.body.capacidad, prev.capacidad);
  const entradas = int(req.body.entradas_disponibles, prev.entradas_disponibles);
  if (capacidad < 0) throw bad('La capacidad no puede ser negativa.');
  if (entradas < 0) throw bad('Las entradas disponibles no pueden ser negativas.');
  if (entradas > capacidad) throw bad('Las entradas disponibles no pueden superar la capacidad.');
  const estado = stateForTickets(prev.estado, capacidad, entradas);
  await query(`UPDATE eventos SET capacidad=@c, entradas_disponibles=@e, estado=@s WHERE id_evento=@id`, { c: capacidad, e: entradas, s: estado, id });
  await audit(req.user.id_usuario, 'ACTUALIZAR_ENTRADAS', 'eventos', id, `capacidad=${capacidad}; disponibles=${entradas}`);
  if (estado === 'AGOTADO' && prev.estado !== 'AGOTADO')
    await notifyFollowers(id, `Las entradas para "${prev.nombre}" se agotaron.`);
  res.json({ ok: true, estado, capacidad, entradas_disponibles: entradas });
});

/* ---------- RF35/RF44 – Panel de marketing (RN15) ---------- */
router.get('/metrics', async (req, res) => {
  const org = await getOrganizer(req.user.id_usuario);
  if (!org) return res.json({ totales: null, eventos: [], serie: [] });
  const dias = Math.min(Math.max(int(req.query.dias, 30), 7), 365);
  const p = { o: org.id_organizador, dias };
  const [eventos, serie, totales] = await Promise.all([
    query(
      `SELECT e.id_evento AS id, e.nombre, e.estado, CONVERT(varchar(10), e.fecha, 23) AS fecha, e.imagen, c.nombre AS categoria,
              ISNULL(m.visualizaciones,0) AS visualizaciones, ISNULL(m.favoritos,0) AS favoritos, ISNULL(m.asistencias,0) AS asistencias,
              ISNULL(m.compartidos,0) AS compartidos, ISNULL(m.clics_whatsapp,0) AS clics_whatsapp, ISNULL(m.clics_llamada,0) AS clics_llamada,
              (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = e.id_evento AND i.tipo_interaccion = 'CLIC_MAPA') AS clics_mapa
         FROM eventos e JOIN categorias c ON c.id_categoria = e.id_categoria LEFT JOIN metrica_evento m ON m.id_evento = e.id_evento
        WHERE e.id_organizador = @o AND e.estado <> 'ELIMINADO'
        ORDER BY ISNULL(m.visualizaciones,0) DESC`, p),
    query(
      `SELECT CONVERT(varchar(10), CAST(DATEADD(HOUR,-5,i.fecha) AS DATE), 23) AS dia, i.tipo_interaccion AS tipo, COUNT(*) AS n
         FROM interaccion_evento i JOIN eventos e ON e.id_evento = i.id_evento
        WHERE e.id_organizador = @o AND i.fecha >= DATEADD(DAY, -@dias, SYSUTCDATETIME())
        GROUP BY CAST(DATEADD(HOUR,-5,i.fecha) AS DATE), i.tipo_interaccion`, p),
    one(
      `SELECT
         SUM(CASE WHEN i.tipo_interaccion='VISUALIZACION' THEN 1 ELSE 0 END) AS visualizaciones,
         SUM(CASE WHEN i.tipo_interaccion='FAVORITO' THEN 1 ELSE 0 END) AS favoritos,
         SUM(CASE WHEN i.tipo_interaccion='ASISTENCIA' THEN 1 ELSE 0 END) AS asistencias,
         SUM(CASE WHEN i.tipo_interaccion='COMPARTIDO' THEN 1 ELSE 0 END) AS compartidos,
         SUM(CASE WHEN i.tipo_interaccion='CLIC_WHATSAPP' THEN 1 ELSE 0 END) AS clics_whatsapp,
         SUM(CASE WHEN i.tipo_interaccion='CLIC_LLAMADA' THEN 1 ELSE 0 END) AS clics_llamada,
         SUM(CASE WHEN i.tipo_interaccion='CLIC_MAPA' THEN 1 ELSE 0 END) AS clics_mapa
         FROM interaccion_evento i JOIN eventos e ON e.id_evento = i.id_evento
        WHERE e.id_organizador = @o AND i.fecha >= DATEADD(DAY, -@dias, SYSUTCDATETIME())`, p),
  ]);
  const resumen = await one(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN estado IN ('PUBLICADO','AGOTADO') THEN 1 ELSE 0 END) AS publicados,
            SUM(CASE WHEN estado = 'PENDIENTE_DE_VALIDACION' THEN 1 ELSE 0 END) AS pendientes,
            SUM(CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
            SUM(CASE WHEN estado IN ('ARCHIVADO','FINALIZADO') THEN 1 ELSE 0 END) AS finalizados
       FROM eventos WHERE id_organizador = @o AND estado <> 'ELIMINADO'`, p);
  for (const k of Object.keys(totales || {})) totales[k] = totales[k] || 0;
  res.json({ dias, totales, resumen, eventos, serie });
});

module.exports = router;
