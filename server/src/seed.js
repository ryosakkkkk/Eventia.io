/**
 * Datos iniciales de Eventia.
 *   npm run seed            → crea el administrador (desde .env) y datos de demostración si la base está vacía
 *   npm run seed -- --reset → borra eventos/usuarios y vuelve a generar todo (las categorías se conservan)
 *   npm run seed -- --solo-admin → crea únicamente la cuenta del administrador
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, one, getPool } = require('./db');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const ONLY_ADMIN = args.includes('--solo-admin');
const RUN = Date.now().toString(36);

const today = new Date(Date.now() - 5 * 3600e3);
const day = (n) => new Date(today.getTime() + n * 86400e3).toISOString().slice(0, 10);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[rnd(0, arr.length - 1)];

async function createUser(nombre, correo, password, rol) {
  const exists = await one(`SELECT id_usuario FROM usuarios WHERE correo = @c`, { c: correo });
  if (exists) return exists.id_usuario;
  const r = await one(
    `INSERT INTO usuarios (nombre, correo, contrasena, rol, correo_verificado, fecha_registro)
     OUTPUT INSERTED.id_usuario VALUES (@n, @c, @h, @r, 1, DATEADD(DAY, -@d, SYSUTCDATETIME()))`,
    { n: nombre, c: correo, h: await bcrypt.hash(password, 10), r: rol, d: rnd(5, 90) }
  );
  return r.id_usuario;
}

/* ---------- Afiches SVG generados (sin depender de imágenes externas) ---------- */
const PALETTES = {
  'Música y conciertos': ['#3b1d8f', '#7c3aed', '#ff7a1a'],
  'Cultura y tradición': ['#7a1f2b', '#d9480f', '#ffd43b'],
  Deportes: ['#064e3b', '#10b981', '#d9f99d'],
  'Gastronomía': ['#7c2d12', '#f97316', '#fde68a'],
  Ferias: ['#1e3a8a', '#0ea5e9', '#fef08a'],
  'Educación': ['#0b1d35', '#2f4fe0', '#93c5fd'],
  Emprendimiento: ['#111827', '#6366f1', '#22d3ee'],
  'Eventos familiares': ['#9d174d', '#f472b6', '#fde047'],
  Arte: ['#4a044e', '#c026d3', '#fb923c'],
  'Fiestas y festividades': ['#831843', '#ef4444', '#facc15'],
  Otros: ['#1f2937', '#64748b', '#e2e8f0'],
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function poster(file, title, categoria, sub, seed) {
  const [a, b, c] = PALETTES[categoria] || PALETTES.Otros;
  const words = title.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 16) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  lines.push(cur.trim());
  const shapes = [];
  for (let i = 0; i < 7; i++) {
    const x = (seed * 97 + i * 173) % 1200;
    const y = (seed * 53 + i * 131) % 675;
    const r = 40 + ((seed + i * 37) % 160);
    shapes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? c : '#ffffff'}" opacity="${i % 2 ? 0.16 : 0.07}"/>`);
  }
  const mountains = `<path d="M0 560 L180 400 L300 500 L470 330 L640 520 L800 380 L980 540 L1200 410 L1200 675 L0 675 Z" fill="#000" opacity=".22"/>
    <path d="M0 610 L220 500 L380 580 L560 470 L760 600 L940 500 L1200 590 L1200 675 L0 675 Z" fill="#000" opacity=".25"/>`;
  // Ilustración sin título: la interfaz ya muestra el nombre del evento sobre la imagen
  // (evita textos duplicados en las láminas y recortes en tarjetas 4:3).
  const sunX = 300 + ((seed * 131) % 600);
  const rays = Array.from({ length: 14 }, (_, i) => {
    const ang = (i / 14) * Math.PI * 2;
    return `<line x1="${sunX + Math.cos(ang) * 120}" y1="${300 + Math.sin(ang) * 120}" x2="${sunX + Math.cos(ang) * 175}" y2="${300 + Math.sin(ang) * 175}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".18"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".65" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>${shapes.join('')}
  <circle cx="${sunX}" cy="300" r="230" fill="url(#s)"/><circle cx="${sunX}" cy="300" r="92" fill="#fff" opacity=".22"/>${rays}
  ${mountains}
  <text x="600" y="118" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="30" fill="#fff" opacity=".55" letter-spacing="14">${esc(sub.toUpperCase())}</text>
</svg>`;
  fs.writeFileSync(file, svg);
}

// Evento de ejemplo → foto en uploads/demo/fotos/<slug>.webp (original .jpg al lado, ver creditos.json)
const PHOTO = {
  'Festival de la Canción Andina': 'festival-cancion-andina',
  'Noche de Rock Apurimeño': 'noche-rock',
  'Feria Gastronómica Sabores de Apurímac': 'feria-gastronomica-mistura',
  'Maratón Ampay 10K': 'maraton-ampay',
  'Taller de Fotografía Urbana': 'taller-fotografia',
  'Exposición Colores del Ande': 'expo-colores-ande',
  'Feria Artesanal de Navidad': 'feria-navidad',
  'Startup Weekend Abancay': 'startup-weekend',
  'Día de la Familia en el Parque': 'dia-familia',
  'Encuentro de Danzas Apurimeñas': 'danzas-apurimenas',
  'Torneo Interbarrios de Fútbol': 'torneo-futbol',
  'Cine bajo las estrellas': 'cine-estrellas',
  'Festival del Anís de Curahuasi': 'festival-anis',
  'Conferencia de Innovación Educativa': 'conferencia-educativa',
  'Festival del Queso Andahuaylino': 'festival-queso',
  'Pasacalle Navideño': 'pasacalle-navideno',
  'Caminata al Mirador de Taraccasa': 'caminata-taraccasa',
  'Concurso Juvenil de Talentos': 'concurso-talentos',
  'Ruta de los Miradores en Bicicleta': 'ruta-bicicleta',
  'Encuentro de Poesía Joven': 'poesia-joven',
  'Feria de Primavera': 'feria-primavera',
  'Encuentro Cultural de Tamburco': 'encuentro-tamburco',
  'Concierto Sinfónico de Aniversario': 'concierto-sinfonico',
};

const PLACES = {
  plaza: ['Plaza de Armas de Abancay', 'Jr. Lima con Jr. Arequipa, Cercado', -13.6362, -72.8815],
  coliseo: ['Coliseo Cerrado de Abancay', 'Av. Díaz Bárcenas s/n', -13.6338, -72.8786],
  estadio: ['Estadio Condebamba', 'Av. Venezuela s/n', -13.6297, -72.8711],
  ampay: ['Santuario Nacional del Ampay', 'Ingreso por Tamburco, km 4', -13.5917, -72.8840],
  casacultura: ['Casa de la Cultura', 'Jr. Cusco 324, Cercado', -13.6352, -72.8802],
  parque: ['Parque Micaela Bastidas', 'Av. Arenas cuadra 3', -13.6378, -72.8770],
  auditorio: ['Auditorio Municipal', 'Jr. Lima 501, Cercado', -13.6368, -72.8828],
  tamburco: ['Plaza de Tamburco', 'Plaza principal de Tamburco', -13.6203, -72.8730],
  curahuasi: ['Plaza de Curahuasi', 'Plaza principal de Curahuasi', -13.5441, -72.6948],
  andahuaylas: ['Campo ferial de Andahuaylas', 'Av. Perú s/n, Andahuaylas', -13.6575, -73.3870],
  mirador: ['Mirador de Taraccasa', 'Carretera a Taraccasa km 2', -13.6488, -72.8925],
  hub: ['Centro de Innovación Abancay', 'Av. Núñez 210, Cercado', -13.6331, -72.8833],
};

async function main() {
  await getPool();
  if (RESET) {
    console.log('Reiniciando datos (se conservan las categorías)…');
    for (const t of ['valoraciones', 'reportes', 'notificaciones', 'metrica_evento', 'interaccion_evento', 'interes_usuario', 'favoritos', 'asistencias', 'auditorias', 'eventos', 'organizadores', 'usuarios'])
      await query(`DELETE FROM ${t}`);
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, DEMO_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD en server/.env');
  const adminId = await createUser(ADMIN_NAME || 'Administrador', ADMIN_EMAIL.toLowerCase(), ADMIN_PASSWORD, 'ADMINISTRADOR');
  console.log(`✔ Administrador: ${ADMIN_EMAIL}`);
  if (ONLY_ADMIN) process.exit(0);

  const count = await one(`SELECT COUNT(*) AS n FROM eventos`);
  if (count.n > 0) {
    console.log('La base ya tiene eventos; no se generan datos de demostración. Usa --reset para regenerarlos.');
    process.exit(0);
  }
  if (!DEMO_PASSWORD) throw new Error('Define DEMO_PASSWORD en server/.env');

  const cats = Object.fromEntries((await query(`SELECT id_categoria, nombre FROM categorias`)).map((c) => [c.nombre, c.id_categoria]));
  const demoOrgUser = await createUser('Lucía Quispe', 'organizador@eventia.local', DEMO_PASSWORD, 'ORGANIZADOR');
  const demoUser = await createUser('Carlos Huamán', 'usuario@eventia.local', DEMO_PASSWORD, 'USUARIO');
  const randomPass = () => crypto.randomBytes(18).toString('base64url');
  const org2User = await createUser('Club Deportivo Andino', 'club.andino@eventia.local', randomPass(), 'ORGANIZADOR');
  const org3User = await createUser('Colectivo Sabores de Apurímac', 'sabores@eventia.local', randomPass(), 'ORGANIZADOR');

  const mkOrg = async (u, nombre, wa, tel, fb, ig) =>
    (await one(
      `INSERT INTO organizadores (nombre, whatsapp, telefono, facebook, instagram, id_usuario) OUTPUT INSERTED.id_organizador
       VALUES (@n, @wa, @tel, @fb, @ig, @u)`, { n: nombre, wa, tel, fb, ig, u })).id_organizador;
  const orgCultura = await mkOrg(demoOrgUser, 'Asociación Cultural Apurímac Vive', '+51900000101', '+51900000102', 'https://facebook.com/', 'https://instagram.com/');
  const orgDeporte = await mkOrg(org2User, 'Club Deportivo Andino', '+51900000201', null, 'https://facebook.com/', null);
  const orgSabores = await mkOrg(org3User, 'Colectivo Sabores de Apurímac', '+51900000301', '+51900000302', null, 'https://instagram.com/');
  await mkOrg(adminId, 'Eventia Abancay', '+51900000001', null, null, null);

  const names = ['Ana Ccorahua', 'Miguel Soto', 'Rosa Palomino', 'Jhon Pumacayo', 'Diana Arias', 'Luis Tello', 'Fiorella Vargas',
    'Kevin Ayala', 'Milagros Huillca', 'Renzo Chipana', 'Sofía Gamarra', 'Edwin Cáceres', 'Paola Serrano', 'Gabriel Navarro'];
  const crowd = [];
  for (let i = 0; i < names.length; i++)
    crowd.push(await createUser(names[i], `persona${i + 1}@eventia.local`, randomPass(), 'USUARIO'));

  const E = [
    ['Festival de la Canción Andina', 'Música y conciertos', orgCultura, 4, '19:00', 'plaza', 2000, 1450, true,
      'Una noche para celebrar la música andina con agrupaciones de toda la región Apurímac. Huaynos, música de cuerdas, danzas invitadas y un gran cierre con fuegos artificiales. Lleva abrigo: la noche abanquina refresca.',
      'Los Andinos de Apurímac, Voces de Ampay, Banda Juvenil Abancay'],
    ['Noche de Rock Apurimeño', 'Música y conciertos', orgCultura, 9, '20:30', 'coliseo', 800, 95, false,
      'Las bandas de rock más potentes de Abancay y Andahuaylas comparten escenario en una noche de guitarras, fusión andina y mucha energía. Ingreso para mayores de 16 años.',
      'Ruta Kuntur, Piedra Negra, Los del Pachachaca'],
    ['Feria Gastronómica Sabores de Apurímac', 'Gastronomía', orgSabores, 2, '11:00', 'parque', 0, 0, true,
      'Más de 30 puestos con lo mejor de la cocina regional: cuy chactado, chicharrón abanquino, tamales, panes de Curahuasi, dulces de caña y bebidas tradicionales. Ingreso libre para toda la familia.',
      'Cocineras tradicionales de Abancay, Tamburco y Curahuasi'],
    ['Maratón Ampay 10K', 'Deportes', orgDeporte, 12, '07:00', 'ampay', 500, 0, true,
      'Carrera de montaña de 10 km con salida en Tamburco y recorrido por el bosque de intimpas del Santuario Nacional del Ampay. Incluye hidratación, medalla de finisher y cronometraje.',
      null],
    ['Taller de Fotografía Urbana', 'Educación', orgCultura, 1, '15:00', 'casacultura', 30, 12, false,
      'Aprende composición, luz natural y edición básica desde tu celular. Recorreremos el centro histórico capturando la vida cotidiana de Abancay. Cupos limitados.',
      'Facilitadora: Mariela Contreras'],
    ['Exposición Colores del Ande', 'Arte', orgCultura, 0, '18:00', 'casacultura', 150, 110, false,
      'Muestra colectiva de pintura, textilería y cerámica de artistas jóvenes apurimeños. La inauguración incluye un conversatorio con los autores.',
      'Colectivo Arte Pachachaca'],
    ['Feria Artesanal de Navidad', 'Ferias', orgSabores, 26, '10:00', 'plaza', 0, 0, false,
      'Encuentra regalos únicos hechos a mano: tejidos, retablos, juguetes de madera, cerámica y productos naturales de productores locales.',
      null],
    ['Startup Weekend Abancay', 'Emprendimiento', orgCultura, 16, '09:00', 'hub', 120, 64, false,
      '54 horas para convertir una idea en un proyecto real. Forma equipo, recibe mentorías y presenta tu propuesta ante un jurado de emprendedores e inversionistas de la región.',
      'Mentores invitados de Cusco y Lima'],
    ['Día de la Familia en el Parque', 'Eventos familiares', orgSabores, 6, '10:00', 'parque', 0, 0, false,
      'Juegos inflables, cuentacuentos, pintacaritas, concurso de cometas y feria de comida saludable. Una mañana para disfrutar en familia.',
      'Grupo de teatro Los Picaflores'],
    ['Encuentro de Danzas Apurimeñas', 'Cultura y tradición', orgCultura, 7, '16:00', 'plaza', 0, 0, true,
      'Más de 15 conjuntos presentan danzas tradicionales de las siete provincias de Apurímac. Un recorrido por la identidad, la vestimenta y la música de nuestra región.',
      'Conjuntos de Abancay, Aymaraes, Grau, Cotabambas y más'],
    ['Torneo Interbarrios de Fútbol', 'Deportes', orgDeporte, 3, '14:00', 'estadio', 3000, 2600, false,
      'Gran final del torneo interbarrios. Ven a alentar a tu equipo y disfruta de la previa con música y comida.',
      null],
    ['Cine bajo las estrellas', 'Eventos familiares', orgCultura, 10, '19:30', 'tamburco', 200, 140, false,
      'Proyección al aire libre de una película familiar peruana. Trae tu manta y tu cojín; habrá canchita y bebidas calientes.',
      null],
    ['Festival del Anís de Curahuasi', 'Gastronomía', orgSabores, 20, '09:00', 'curahuasi', 0, 0, false,
      'Celebra el producto bandera de Curahuasi con degustaciones, concurso de postres, música en vivo y visitas a los campos de cultivo.',
      'Productores de Curahuasi'],
    ['Conferencia de Innovación Educativa', 'Educación', orgCultura, 14, '08:30', 'auditorio', 250, 41, false,
      'Docentes y especialistas comparten experiencias sobre tecnología en el aula, inteligencia artificial y aprendizaje activo. Se entregará constancia de participación.',
      'Ponentes invitados'],
    ['Festival del Queso Andahuaylino', 'Ferias', orgSabores, 18, '10:00', 'andahuaylas', 0, 0, false,
      'Productores lácteos de Andahuaylas presentan quesos, yogures y manjares. Concurso del mejor queso y feria ganadera.',
      null],
    ['Pasacalle Navideño', 'Fiestas y festividades', orgCultura, 35, '17:00', 'plaza', 0, 0, false,
      'Comparsas, carros alegóricos y bandas recorren el centro de Abancay para dar la bienvenida a la Navidad.',
      'Instituciones educativas y bandas de la ciudad'],
    ['Caminata al Mirador de Taraccasa', 'Deportes', orgDeporte, 5, '06:30', 'mirador', 60, 22, false,
      'Caminata guiada de dificultad moderada hasta el mirador con la mejor vista del valle de Abancay. Incluye guía y refrigerio.',
      null],
  ];

  const ids = [];
  let seed = 1;
  const demoDir = path.join(__dirname, '..', 'uploads', 'demo');
  fs.mkdirSync(demoDir, { recursive: true });
  const insertEvent = async (row, estado, vis) => {
    const [nombre, cat, org, offset, hora, placeKey, cap, disp, dest, desc, artistas] = row;
    const [lugar, direccion, lat, lng] = PLACES[placeKey];
    const ciudad = placeKey === 'tamburco' || placeKey === 'ampay' ? 'Tamburco' : placeKey === 'curahuasi' ? 'Curahuasi' : placeKey === 'andahuaylas' ? 'Andahuaylas' : 'Abancay';
    // Foto real con licencia libre (uploads/demo/fotos, ver creditos.json); si no existe, ilustración generada
    const slug = PHOTO[nombre];
    let img;
    if (slug && fs.existsSync(path.join(demoDir, 'fotos', `${slug}.webp`))) {
      img = `/uploads/demo/fotos/${slug}.webp`;
      seed++;
    } else {
      const file = `evento-${seed}-${RUN}.svg`;
      poster(path.join(demoDir, file), nombre, cat, cat, seed++);
      img = `/uploads/demo/${file}`;
    }
    const finalEstado = estado === 'PUBLICADO' && cap > 0 && disp === 0 ? 'AGOTADO' : estado;
    const r = await one(
      `INSERT INTO eventos (nombre, descripcion, artistas, id_categoria, fecha, hora, ciudad, lugar, direccion, latitud, longitud,
                            capacidad, entradas_disponibles, estado, visibilidad, destacado, imagen, id_organizador, fecha_creacion)
       OUTPUT INSERTED.id_evento
       VALUES (@nombre, @desc, @artistas, @cat, @fecha, @hora, @ciudad, @lugar, @direccion, @lat, @lng, @cap, @disp, @estado, @vis, @dest,
               @img, @org, DATEADD(DAY, -@ago, SYSUTCDATETIME()))`,
      { nombre, desc, artistas, cat: cats[cat], fecha: day(offset), hora, ciudad, lugar, direccion, lat, lng, cap, disp,
        estado: finalEstado, vis, dest: dest && vis, img, org, ago: rnd(3, 25) });
    await query(`INSERT INTO metrica_evento (id_evento) VALUES (@id)`, { id: r.id_evento });
    return r.id_evento;
  };

  for (const row of E) ids.push({ id: await insertEvent(row, 'PUBLICADO', true), offset: row[3] });
  // Pendientes, borradores y archivados
  const pend = await insertEvent(['Concurso Juvenil de Talentos', 'Arte', orgCultura, 22, '17:00', 'auditorio', 300, 300, false,
    'Jóvenes de 15 a 25 años muestran su talento en canto, baile, poesía y artes escénicas. Inscripciones abiertas hasta una semana antes.', null],
  'PENDIENTE_DE_VALIDACION', false);
  await insertEvent(['Ruta de los Miradores en Bicicleta', 'Deportes', orgDeporte, 28, '07:30', 'mirador', 80, 80, false,
    'Recorrido ciclístico de nivel intermedio por los miradores que rodean Abancay. Casco obligatorio.', null], 'PENDIENTE_DE_VALIDACION', false);
  await insertEvent(['Encuentro de Poesía Joven', 'Cultura y tradición', orgCultura, 30, '18:00', 'casacultura', 80, 80, false,
    'Recital abierto de poesía en castellano y quechua. Borrador en preparación.', null], 'BORRADOR', false);
  const past1 = await insertEvent(['Feria de Primavera', 'Ferias', orgSabores, -34, '10:00', 'parque', 0, 0, false,
    'Feria de flores, plantas, productos orgánicos y artesanía para recibir la primavera.', null], 'ARCHIVADO', true);
  const past2 = await insertEvent(['Encuentro Cultural de Tamburco', 'Cultura y tradición', orgCultura, -48, '15:00', 'tamburco', 400, 0, false,
    'Danzas, música y gastronomía tradicional del distrito de Tamburco.', 'Conjuntos folclóricos de Tamburco'], 'ARCHIVADO', true);
  const past3 = await insertEvent(['Concierto Sinfónico de Aniversario', 'Música y conciertos', orgCultura, -12, '19:00', 'auditorio', 250, 0, false,
    'Concierto de gala por el aniversario de la ciudad con la orquesta juvenil regional.', 'Orquesta Juvenil de Apurímac'], 'ARCHIVADO', true);

  /* ---------- Interacciones históricas (últimos 30 días) ---------- */
  const tipos = [['VISUALIZACION', 14], ['COMPARTIDO', 1], ['CLIC_WHATSAPP', 2], ['CLIC_LLAMADA', 1], ['CLIC_MAPA', 2]];
  const everyone = [demoUser, ...crowd];
  for (const { id } of ids) {
    const popularity = rnd(4, 18);
    for (const [tipo, weight] of tipos) {
      const n = Math.round(popularity * weight * (0.6 + Math.random() * 0.8));
      const values = [];
      for (let i = 0; i < n; i++) {
        const u = Math.random() < 0.45 ? pick(everyone) : null;
        values.push(`('${tipo}', ${id}, ${u ?? 'NULL'}, DATEADD(MINUTE, -${rnd(30, 30 * 24 * 60)}, SYSUTCDATETIME()))`);
      }
      for (let i = 0; i < values.length; i += 300)
        await query(`INSERT INTO interaccion_evento (tipo_interaccion, id_evento, id_usuario, fecha) VALUES ${values.slice(i, i + 300).join(',')}`);
    }
    // Favoritos y asistencias de la comunidad
    const fans = [...crowd].sort(() => Math.random() - 0.5).slice(0, rnd(1, crowd.length - 2));
    for (const u of fans) {
      if (Math.random() < 0.6) {
        await query(`INSERT INTO favoritos (id_evento, id_usuario, fecha) VALUES (@e, @u, DATEADD(HOUR, -@h, SYSUTCDATETIME()))`, { e: id, u, h: rnd(1, 400) });
        await query(`INSERT INTO interaccion_evento (tipo_interaccion, id_evento, id_usuario, fecha) VALUES ('FAVORITO', @e, @u, DATEADD(HOUR, -@h, SYSUTCDATETIME()))`, { e: id, u, h: rnd(1, 400) });
      }
      if (Math.random() < 0.55) {
        await query(`INSERT INTO asistencias (id_evento, id_usuario, fecha) VALUES (@e, @u, DATEADD(HOUR, -@h, SYSUTCDATETIME()))`, { e: id, u, h: rnd(1, 400) });
        await query(`INSERT INTO interaccion_evento (tipo_interaccion, id_evento, id_usuario, fecha) VALUES ('ASISTENCIA', @e, @u, DATEADD(HOUR, -@h, SYSUTCDATETIME()))`, { e: id, u, h: rnd(1, 400) });
      }
    }
  }

  // Asistencias y valoraciones en eventos pasados
  for (const ev of [past1, past2, past3]) {
    for (const u of crowd.slice(0, rnd(5, 10))) {
      await query(`INSERT INTO asistencias (id_evento, id_usuario) VALUES (@e, @u)`, { e: ev, u });
      if (Math.random() < 0.7)
        await query(`INSERT INTO valoraciones (puntuacion, comentario, id_evento, id_usuario) VALUES (@p, @c, @e, @u)`, {
          p: rnd(3, 5), e: ev, u,
          c: pick(['¡Excelente organización!', 'Muy bonito, volvería a ir.', 'Buen ambiente y buena música.', 'Faltó un poco de señalización, pero lo disfruté.', null]),
        });
    }
  }
  // El usuario demo asistió a un evento pasado (podrá valorarlo) y sigue algunos próximos
  await query(`INSERT INTO asistencias (id_evento, id_usuario) VALUES (@e, @u)`, { e: past3, u: demoUser });
  for (const k of [0, 2, 9]) await query(`INSERT INTO favoritos (id_evento, id_usuario) VALUES (@e, @u)`, { e: ids[k].id, u: demoUser });
  for (const k of [0, 4]) await query(`INSERT INTO asistencias (id_evento, id_usuario) VALUES (@e, @u)`, { e: ids[k].id, u: demoUser });
  for (const [cat, nivel] of [['Música y conciertos', 5], ['Gastronomía', 4], ['Cultura y tradición', 3]])
    await query(`INSERT INTO interes_usuario (nivel_interes, id_categoria, id_usuario) VALUES (@n, @c, @u)`, { n: nivel, c: cats[cat], u: demoUser });

  // Métricas agregadas coherentes con el historial
  await query(`
    UPDATE m SET
      visualizaciones = (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = m.id_evento AND i.tipo_interaccion = 'VISUALIZACION'),
      compartidos     = (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = m.id_evento AND i.tipo_interaccion = 'COMPARTIDO'),
      clics_whatsapp  = (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = m.id_evento AND i.tipo_interaccion = 'CLIC_WHATSAPP'),
      clics_llamada   = (SELECT COUNT(*) FROM interaccion_evento i WHERE i.id_evento = m.id_evento AND i.tipo_interaccion = 'CLIC_LLAMADA'),
      favoritos       = (SELECT COUNT(*) FROM favoritos f WHERE f.id_evento = m.id_evento),
      asistencias     = (SELECT COUNT(*) FROM asistencias a WHERE a.id_evento = m.id_evento),
      fecha_actualizacion = SYSUTCDATETIME()
    FROM metrica_evento m`);

  // Notificaciones y reporte de ejemplo
  const n = (u, tipo, msg, ev) => query(`INSERT INTO notificaciones (enviado, fecha_envio, mensaje, tipo, id_evento, id_usuario) VALUES (1, SYSUTCDATETIME(), @m, @t, @e, @u)`, { m: msg, t: tipo, e: ev, u });
  await n(demoUser, 'SISTEMA', '¡Bienvenido a Eventia! Elige tus intereses para recibir recomendaciones “Para ti”.', null);
  await n(demoUser, 'EVENTO', 'Nuevo evento en una de tus categorías favoritas: "Noche de Rock Apurimeño".', ids[1].id);
  await n(adminId, 'VALIDACION', 'Nuevo evento pendiente de validación: "Concurso Juvenil de Talentos".', pend);
  await query(`INSERT INTO reportes (motivo, descripcion, id_evento, id_usuario) VALUES (N'Fecha o ubicación equivocada', N'La dirección no coincide con el mapa.', @e, @u)`,
    { e: ids[10].id, u: crowd[2] });
  await query(`INSERT INTO auditorias (accion, detalle, entidad, id_usuario) VALUES ('DATOS_DEMO', N'Carga inicial de datos de demostración', 'sistema', @u)`, { u: adminId });
  // El Festival de la Canción Andina es la lámina principal de la portada
  await query(`INSERT INTO auditorias (accion, detalle, entidad, entidad_id, id_usuario) VALUES ('LAMINA_PRINCIPAL', @n, 'eventos', @e, @u)`,
    { n: E[0][0], e: ids[0].id, u: adminId });

  console.log(`✔ ${E.length + 6} eventos de demostración con métricas, favoritos, asistencias y valoraciones`);
  console.log('✔ Cuentas demo: organizador@eventia.local y usuario@eventia.local (contraseña: DEMO_PASSWORD en server/.env)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en la carga inicial:', err.message);
  process.exit(1);
});
