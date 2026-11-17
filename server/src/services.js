const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, one } = require('./db');
const { sendCode, sendMail, smtpConfigured } = require('./mailer');
const { bad } = require('./util');

/* ---------------- Auditoría (RNF14) ---------------- */
async function audit(idUsuario, accion, entidad, entidadId, detalle) {
  try {
    await query(
      `INSERT INTO auditorias (accion, detalle, entidad, entidad_id, id_usuario)
       VALUES (@accion, @detalle, @entidad, @entidadId, @idUsuario)`,
      { accion, detalle: detalle ? String(detalle).slice(0, 4000) : null, entidad, entidadId: entidadId ?? null, idUsuario: idUsuario ?? null }
    );
  } catch (err) {
    console.error('[auditoría]', err.message);
  }
}

/* ---------------- Códigos de verificación (RF08, RF16) ---------------- */
async function issueCode(user, motivo) {
  const code = String(crypto.randomInt(100000, 1000000));
  const hash = await bcrypt.hash(code, 8);
  await query(
    `UPDATE usuarios SET codigo_verificacion = @hash,
            codigo_verificacion_expira = DATEADD(MINUTE, 15, SYSUTCDATETIME())
      WHERE id_usuario = @id`,
    { hash: `${motivo}:${hash}`, id: user.id_usuario }
  );
  // Sin SMTP el código solo se muestra en pantalla en desarrollo o con DEMO_MODE=true (presentaciones).
  const showOnScreen = !smtpConfigured() && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true');
  if (!smtpConfigured() && !showOnScreen)
    throw bad('El envío de correos no está configurado. El administrador debe definir SMTP_HOST o DEMO_MODE=true.');
  const r = await sendCode(user.correo, code, motivo);
  if (!r.ok) throw bad('No se pudo enviar el correo de verificación. Intenta nuevamente.');
  return showOnScreen ? { devCode: code } : {};
}

async function checkCode(idUsuario, motivo, code) {
  const row = await one(
    `SELECT codigo_verificacion, CASE WHEN codigo_verificacion_expira > SYSUTCDATETIME() THEN 1 ELSE 0 END vigente
       FROM usuarios WHERE id_usuario = @id`,
    { id: idUsuario }
  );
  if (!row || !row.codigo_verificacion || !row.codigo_verificacion.startsWith(motivo + ':'))
    throw bad('No hay un código pendiente. Solicita uno nuevo.');
  if (!row.vigente) throw bad('El código venció. Solicita uno nuevo.');
  const ok = await bcrypt.compare(String(code || '').trim(), row.codigo_verificacion.slice(motivo.length + 1));
  if (!ok) throw bad('El código ingresado no es correcto.');
  await query(
    `UPDATE usuarios SET codigo_verificacion = NULL, codigo_verificacion_expira = NULL WHERE id_usuario = @id`,
    { id: idUsuario }
  );
}

/* ---------------- Métricas e interacciones (RF35, RF43, RNF19) ---------------- */
const METRIC_COL = {
  VISUALIZACION: 'visualizaciones',
  FAVORITO: 'favoritos',
  ASISTENCIA: 'asistencias',
  COMPARTIDO: 'compartidos',
  CLIC_WHATSAPP: 'clics_whatsapp',
  CLIC_LLAMADA: 'clics_llamada',
};

// Evita duplicados: misma persona + evento + tipo en una ventana de tiempo.
const recent = new Map();
const WINDOW_MS = { VISUALIZACION: 6 * 3600e3, COMPARTIDO: 60e3, CLIC_WHATSAPP: 60e3, CLIC_LLAMADA: 60e3, CLIC_MAPA: 60e3 };
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > 6 * 3600e3) recent.delete(k);
}, 600e3).unref();

async function addMetric(idEvento, col, delta) {
  await query(
    `MERGE metrica_evento AS t
     USING (SELECT @id AS id_evento) AS s ON t.id_evento = s.id_evento
     WHEN MATCHED THEN UPDATE SET ${col} = CASE WHEN t.${col} + @d < 0 THEN 0 ELSE t.${col} + @d END,
                                  fecha_actualizacion = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT (id_evento, ${col}) VALUES (@id, CASE WHEN @d < 0 THEN 0 ELSE @d END);`,
    { id: idEvento, d: delta }
  );
}

/**
 * Registra una interacción. visitorKey identifica al visitante anónimo para no duplicar.
 * Devuelve true si se registró.
 */
async function trackInteraction(idEvento, tipo, idUsuario, visitorKey) {
  const win = WINDOW_MS[tipo];
  if (win) {
    const key = `${idUsuario || visitorKey || 'anon'}|${idEvento}|${tipo}`;
    const last = recent.get(key);
    if (last && Date.now() - last < win) return false;
    recent.set(key, Date.now());
  }
  await query(
    `INSERT INTO interaccion_evento (tipo_interaccion, id_evento, id_usuario) VALUES (@tipo, @ev, @u)`,
    { tipo, ev: idEvento, u: idUsuario || null }
  );
  if (METRIC_COL[tipo]) await addMetric(idEvento, METRIC_COL[tipo], 1);
  return true;
}

/* ---------------- Notificaciones (RF14, RF27, RNF18) ---------------- */
async function notify(idUsuario, tipo, mensaje, idEvento = null, { email = false, asunto = null } = {}) {
  const u = await one(`SELECT correo, notificaciones_email FROM usuarios WHERE id_usuario = @id AND estado = 1`, { id: idUsuario });
  if (!u) return;
  let enviado = true;
  let error = null;
  if (email && u.notificaciones_email) {
    const r = await sendMail(u.correo, asunto || 'Novedades de Eventia', asunto || 'Novedades de Eventia', `<p>${mensaje}</p>`);
    enviado = r.ok;
    error = r.error || null;
  }
  await query(
    `INSERT INTO notificaciones (enviado, error_envio, fecha_envio, mensaje, tipo, id_evento, id_usuario)
     VALUES (@enviado, @error, CASE WHEN @enviado = 1 THEN SYSUTCDATETIME() END, @mensaje, @tipo, @ev, @u)`,
    { enviado, error, mensaje: mensaje.slice(0, 1000), tipo, ev: idEvento, u: idUsuario }
  );
}

// Avisa a quienes guardaron o asistirán a un evento (cambios importantes).
async function notifyFollowers(idEvento, mensaje, tipo = 'EVENTO') {
  const users = await query(
    `SELECT id_usuario FROM favoritos WHERE id_evento = @id
     UNION SELECT id_usuario FROM asistencias WHERE id_evento = @id`,
    { id: idEvento }
  );
  for (const u of users) await notify(u.id_usuario, tipo, mensaje, idEvento, { email: true, asunto: 'Cambios en un evento que sigues' });
}

// Avisa a usuarios interesados en la categoría de un evento recién publicado.
async function notifyInterested(ev) {
  const users = await query(
    `SELECT DISTINCT i.id_usuario FROM interes_usuario i JOIN usuarios u ON u.id_usuario = i.id_usuario
      WHERE i.id_categoria = @cat AND u.estado = 1 AND u.id_usuario <> @owner`,
    { cat: ev.id_categoria, owner: ev.organizador_usuario || 0 }
  );
  for (const u of users)
    await notify(u.id_usuario, 'EVENTO', `Nuevo evento en una de tus categorías favoritas: "${ev.nombre}".`, ev.id_evento);
}

module.exports = { audit, issueCode, checkCode, trackInteraction, addMetric, notify, notifyFollowers, notifyInterested };
