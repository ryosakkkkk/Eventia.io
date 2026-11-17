const { query, AHORA, HOY } = require('./db');
const { notify, audit } = require('./services');

/**
 * RF24 / RN05 – Archivo automático.
 *  - Eventos cuya fecha y hora ya pasaron hoy → FINALIZADO
 *  - Eventos de días anteriores → ARCHIVADO (se quitan de destacados)
 */
async function archivePast() {
  const fin = await query(
    `UPDATE eventos SET estado = 'FINALIZADO', destacado = 0
     OUTPUT INSERTED.id_evento
      WHERE estado IN ('PUBLICADO','AGOTADO') AND fecha = ${HOY}
        AND DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), hora), CAST(fecha AS DATETIME2)) <= DATEADD(HOUR, -3, ${AHORA})`
  );
  const arch = await query(
    `UPDATE eventos SET estado = 'ARCHIVADO', destacado = 0
     OUTPUT INSERTED.id_evento
      WHERE estado IN ('PUBLICADO','AGOTADO','FINALIZADO') AND fecha < ${HOY}`
  );
  // Las solicitudes y borradores vencidos tampoco deben quedar pendientes
  const venc = await query(
    `UPDATE eventos SET estado = 'ARCHIVADO', visibilidad = 0
     OUTPUT INSERTED.id_evento
      WHERE estado IN ('PENDIENTE_DE_VALIDACION') AND fecha < ${HOY}`
  );
  if (arch.length || fin.length || venc.length)
    await audit(null, 'ARCHIVO_AUTOMATICO', 'eventos', null, `finalizados=${fin.length}; archivados=${arch.length + venc.length}`);
  return { finalizados: fin.length, archivados: arch.length + venc.length };
}

/**
 * RF14 / RF34 / RN09 – Recordatorios inteligentes ("No te lo pierdas").
 * Ventanas: 3 días antes y el mismo día/24 h antes. No se repiten (mensaje único) y
 * no se generan después del evento.
 */
async function sendReminders() {
  const rows = await query(
    `SELECT DISTINCT x.id_usuario, e.id_evento, e.nombre, e.lugar, CONVERT(varchar(5), e.hora, 108) AS hora,
            DATEDIFF(MINUTE, ${AHORA}, DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), e.hora), CAST(e.fecha AS DATETIME2))) AS minutos
       FROM (SELECT id_usuario, id_evento FROM favoritos UNION SELECT id_usuario, id_evento FROM asistencias) x
       JOIN eventos e ON e.id_evento = x.id_evento
       JOIN usuarios u ON u.id_usuario = x.id_usuario
      WHERE u.estado = 1 AND u.notificaciones_recordatorio = 1
        AND e.estado IN ('PUBLICADO','AGOTADO') AND e.visibilidad = 1
        AND DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), e.hora), CAST(e.fecha AS DATETIME2)) > ${AHORA}
        AND DATEADD(MINUTE, DATEDIFF(MINUTE, CAST('00:00' AS TIME), e.hora), CAST(e.fecha AS DATETIME2)) <= DATEADD(DAY, 3, ${AHORA})`
  );
  let enviados = 0;
  for (const r of rows) {
    const mensaje = r.minutos <= 24 * 60
      ? `¡No te lo pierdas! "${r.nombre}" es en menos de 24 horas (${r.hora} h, ${r.lugar}).`
      : `Faltan pocos días para "${r.nombre}". Prepárate: ${r.lugar}, ${r.hora} h.`;
    const dup = await query(
      `SELECT 1 AS x FROM notificaciones WHERE id_usuario = @u AND id_evento = @e AND tipo = 'RECORDATORIO' AND mensaje = @m`,
      { u: r.id_usuario, e: r.id_evento, m: mensaje }
    );
    if (dup.length) continue;
    await notify(r.id_usuario, 'RECORDATORIO', mensaje, r.id_evento, { email: true, asunto: `Recordatorio: ${r.nombre}` });
    enviados++;
  }
  return { recordatorios: enviados };
}

async function runAll() {
  const a = await archivePast();
  const b = await sendReminders();
  return { ...a, ...b };
}

function start() {
  const tick = () => runAll().catch((err) => console.error('[tareas]', err.message));
  setTimeout(tick, 5000);
  setInterval(tick, 10 * 60e3).unref(); // cada 10 minutos (RNF12)
}

module.exports = { start, runAll, archivePast, sendReminders };
