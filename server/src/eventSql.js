const { HOY, AHORA } = require('./db');

// Columnas comunes de un evento. @uid = usuario actual (o NULL).
const EVENT_COLUMNS = `
  e.id_evento AS id, e.nombre, e.descripcion, e.artistas, e.imagen,
  CONVERT(varchar(10), e.fecha, 23) AS fecha, CONVERT(varchar(5), e.hora, 108) AS hora,
  e.lugar, e.direccion, e.ciudad, e.latitud, e.longitud, e.capacidad, e.entradas_disponibles,
  e.estado, e.visibilidad, e.destacado, e.fecha_creacion,
  c.id_categoria, c.nombre AS categoria,
  o.id_organizador, o.nombre AS organizador, o.id_usuario AS organizador_usuario,
  ISNULL(m.visualizaciones, 0) AS visualizaciones, ISNULL(m.favoritos, 0) AS total_favoritos,
  ISNULL(m.asistencias, 0) AS total_asistencias, ISNULL(m.compartidos, 0) AS compartidos,
  (SELECT CAST(AVG(CAST(v.puntuacion AS DECIMAL(4,2))) AS DECIMAL(3,1)) FROM valoraciones v WHERE v.id_evento = e.id_evento) AS rating,
  (SELECT COUNT(*) FROM valoraciones v WHERE v.id_evento = e.id_evento) AS total_valoraciones,
  CASE WHEN @uid IS NOT NULL AND EXISTS (SELECT 1 FROM favoritos f WHERE f.id_evento = e.id_evento AND f.id_usuario = @uid) THEN 1 ELSE 0 END AS es_favorito,
  CASE WHEN @uid IS NOT NULL AND EXISTS (SELECT 1 FROM asistencias a WHERE a.id_evento = e.id_evento AND a.id_usuario = @uid) THEN 1 ELSE 0 END AS asistire`;

const EVENT_FROM = `
  FROM eventos e
  JOIN categorias c ON c.id_categoria = e.id_categoria
  JOIN organizadores o ON o.id_organizador = e.id_organizador
  LEFT JOIN metrica_evento m ON m.id_evento = e.id_evento`;

// Eventos públicos y vigentes (RF01, RN06)
const PUBLIC_UPCOMING = `e.estado IN ('PUBLICADO','AGOTADO') AND e.visibilidad = 1 AND c.estado = 1 AND e.fecha >= ${HOY}`;

function shapeEvent(r) {
  if (!r) return r;
  const ev = { ...r };
  ev.destacado = !!ev.destacado;
  ev.visibilidad = !!ev.visibilidad;
  ev.es_favorito = !!ev.es_favorito;
  ev.asistire = !!ev.asistire;
  ev.rating = ev.rating !== null && ev.rating !== undefined ? Number(ev.rating) : null;
  ev.latitud = ev.latitud !== null && ev.latitud !== undefined ? Number(ev.latitud) : null;
  ev.longitud = ev.longitud !== null && ev.longitud !== undefined ? Number(ev.longitud) : null;
  // RF23 – estado de disponibilidad
  if (ev.capacidad === 0) ev.disponibilidad = 'LIBRE';
  else if (ev.entradas_disponibles <= 0 || ev.estado === 'AGOTADO') ev.disponibilidad = 'AGOTADO';
  else if (ev.entradas_disponibles / ev.capacidad <= 0.2) ev.disponibilidad = 'ULTIMOS';
  else ev.disponibilidad = 'DISPONIBLE';
  return ev;
}

module.exports = { EVENT_COLUMNS, EVENT_FROM, PUBLIC_UPCOMING, shapeEvent, HOY, AHORA };
