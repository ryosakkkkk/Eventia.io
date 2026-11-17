// Prueba rápida de los endpoints principales: node tests/smoke.js (con el servidor iniciado)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const BASE = process.env.SMOKE_URL || `http://localhost:${process.env.PORT || 4000}/api`;

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const kv = c.split(';')[0];
      const name = kv.split('=')[0];
      cookie = cookie.split('; ').filter((x) => x && !x.startsWith(name + '=')).concat(kv).join('; ');
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

let fails = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '✔' : '✘'} ${name}${cond ? '' : '  ' + JSON.stringify(extra).slice(0, 300)}`);
  if (!cond) fails++;
};

(async () => {
  const pw = process.env.DEMO_PASSWORD;
  const evs = (await (await fetch(BASE + '/events?size=5')).json()).eventos;
  const evId = evs[0].id;

  // Usuario
  const u = client();
  let r = await u('POST', '/auth/login', { correo: 'usuario@eventia.local', contrasena: pw });
  check('login usuario', r.status === 200, r.data);
  r = await u('GET', '/events/for-you'); check('para ti', r.status === 200 && r.data.eventos.length > 0, r.data);
  r = await u('POST', `/events/${evId}/favorite`); check('favorito', r.data.es_favorito === true, r.data);
  r = await u('GET', '/me/favorites'); check('mis favoritos', r.status === 200 && r.data.eventos.length > 0, r.data);
  r = await u('POST', `/events/${evId}/attend`); check('asistiré', r.data.asistire === true, r.data);
  r = await u('GET', '/me/attendances'); check('mis asistencias', r.status === 200, r.data);
  r = await u('POST', `/events/${evId}/interactions`, { tipo: 'COMPARTIDO' }); check('compartido', r.status === 200, r.data);
  r = await u('GET', `/events/${evId}`); check('detalle con sesión', r.data.evento?.es_favorito === true, r.data);
  r = await u('GET', '/me/notifications'); check('notificaciones', r.status === 200, r.data);
  r = await u('PUT', '/me/interests', { intereses: [{ id_categoria: 1, nivel_interes: 5 }, { id_categoria: 4, nivel_interes: 3 }] });
  check('intereses', r.status === 200, r.data);
  r = await u('GET', '/me/summary'); check('resumen', r.status === 200, r.data);
  r = await u('POST', `/events/${evId}/ratings`, { puntuacion: 5 }); check('valorar antes del evento → 400', r.status === 400, r.data);
  const past = (await u('GET', '/me/attendances')).data.eventos.find((e) => e.pasado && !e.valorado);
  if (past) { r = await u('POST', `/events/${past.id}/ratings`, { puntuacion: 4, comentario: 'Prueba' }); check('valorar evento pasado', r.status === 201, r.data); }
  r = await u('GET', '/admin/stats'); check('usuario no accede a admin → 403', r.status === 403, r.data);

  // Organizador
  const o = client();
  r = await o('POST', '/auth/login', { correo: 'organizador@eventia.local', contrasena: pw }); check('login organizador', r.status === 200, r.data);
  r = await o('GET', '/organizer/events'); check('mis eventos', r.data.eventos?.length > 0, r.data);
  const mine = r.data.eventos.find((e) => e.estado === 'PUBLICADO');
  r = await o('GET', '/organizer/metrics?dias=30'); check('métricas', r.data.totales?.visualizaciones > 0, r.data);
  r = await o('PATCH', `/organizer/events/${mine.id}/tickets`, { capacidad: mine.capacidad || 100, entradas_disponibles: -1 });
  check('entradas negativas → 400', r.status === 400, r.data);
  r = await o('POST', '/organizer/request-code'); check('código de publicación', r.status === 200, r.data);
  const fd = new FormData();
  Object.entries({ nombre: 'Evento de prueba smoke', descripcion: 'Descripción suficientemente larga para validar.', id_categoria: '1',
    fecha: new Date(Date.now() + 9 * 86400e3).toISOString().slice(0, 10), hora: '18:00', ciudad: 'Abancay', lugar: 'Plaza', direccion: 'Centro',
    capacidad: '50', entradas_disponibles: '50', accion: 'enviar', codigo: r.data.devCode || '000000' }).forEach(([k, v]) => fd.append(k, v));
  const cookieRes = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'organizador@eventia.local', contrasena: pw }) });
  const ck = cookieRes.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  // Nuevo código porque el login no lo invalida pero lo pedimos de nuevo con la cookie
  const code = await (await fetch(BASE + '/organizer/request-code', { method: 'POST', headers: { cookie: ck } })).json();
  fd.set('codigo', code.devCode || '000000');
  const cr = await fetch(BASE + '/organizer/events', { method: 'POST', headers: { cookie: ck }, body: fd });
  const created = await cr.json();
  check('crear evento (pendiente)', cr.status === 201 && created.estado === 'PENDIENTE_DE_VALIDACION', created);

  // Administrador
  const a = client();
  r = await a('POST', '/auth/login', { correo: process.env.ADMIN_EMAIL, contrasena: process.env.ADMIN_PASSWORD }); check('login admin', r.status === 200, r.data);
  r = await a('GET', '/admin/stats'); check('estadísticas', r.data.totales?.eventos > 0, r.data);
  r = await a('GET', '/admin/events?estado=PENDIENTE_DE_VALIDACION'); check('pendientes', r.data.eventos?.length > 0, r.data);
  if (created.id) {
    r = await a('POST', `/admin/events/${created.id}/approve`); check('aprobar', r.status === 200, r.data);
    r = await a('POST', `/admin/events/${created.id}/feature`, { destacado: true }); check('destacar', r.status === 200, r.data);
    r = await a('DELETE', `/admin/events/${created.id}`); check('eliminar definitivamente', r.status === 200, r.data);
  }
  r = await a('GET', '/admin/users'); check('usuarios', r.data.usuarios?.length > 0, r.data);
  r = await a('GET', '/admin/categories'); check('categorías', r.data.categorias?.length >= 11, r.data);
  r = await a('GET', '/admin/reports'); check('reportes', r.status === 200, r.data);
  r = await a('GET', '/admin/audit'); check('auditoría', r.data.auditoria?.length > 0, r.data);
  r = await a('POST', '/admin/jobs/run'); check('tareas automáticas', r.status === 200, r.data);

  // Limpieza de la prueba
  await u('DELETE', `/events/${evId}/attend`);
  console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
  process.exit(fails ? 1 : 0);
})();
