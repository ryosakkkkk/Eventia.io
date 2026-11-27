// Aplicación Express de Eventia. La usan el servidor local (src/index.js) y la función de Vercel (api/index.js).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { query, HOY } = require('./db');
const { loadUser } = require('./auth');
const jobs = require('./jobs');

if (!process.env.JWT_SECRET) {
  throw new Error('Falta la variable JWT_SECRET (server/.env en local o Environment Variables en Vercel).');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://*.public.blob.vercel-storage.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Identificador anónimo del visitante para no duplicar métricas (RNF19)
app.use((req, res, next) => {
  if (!req.cookies.eventia_vid) {
    const vid = crypto.randomBytes(12).toString('hex');
    res.cookie('eventia_vid', vid, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 365 * 86400e3 });
    req.cookies.eventia_vid = vid;
  }
  next();
});

// En la nube (sin procesos permanentes) el archivo automático se ejecuta como máximo cada 15 min al recibir visitas (RF24)
if (process.env.VERCEL) {
  let last = 0;
  app.use('/api/events', async (_req, _res, next) => {
    if (Date.now() - last > 15 * 60e3) {
      last = Date.now();
      await jobs.archivePast().catch((err) => console.error('[archivo]', err.message));
    }
    next();
  });
}

app.use('/api', loadUser);

/* ---------- API ---------- */
app.get('/api/health', async (_req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ ok: true });
});

// Tareas programadas (Vercel Cron): archivo automático y recordatorios (RF14, RF24, RF34)
app.get('/api/cron', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado.' });
  res.json({ ok: true, ...(await jobs.runAll()) });
});

// RF20 – Categorías activas (con número de eventos próximos y la foto de su próximo evento, para la portada)
app.get('/api/categories', async (_req, res) => {
  const rows = await query(
    `SELECT c.id_categoria, c.nombre, c.descripcion,
            (SELECT COUNT(*) FROM eventos e WHERE e.id_categoria = c.id_categoria AND e.estado IN ('PUBLICADO','AGOTADO')
                AND e.visibilidad = 1 AND e.fecha >= ${HOY}) AS proximos,
            (SELECT TOP 1 e.imagen FROM eventos e WHERE e.id_categoria = c.id_categoria AND e.estado IN ('PUBLICADO','AGOTADO','ARCHIVADO')
                AND e.visibilidad = 1 AND e.imagen IS NOT NULL AND e.imagen <> ''
              -- Primero un evento próximo (destacado o el más cercano); si ninguno tiene foto, el pasado más reciente
              ORDER BY CASE WHEN e.fecha >= ${HOY} THEN 0 ELSE 1 END, e.destacado DESC,
                       ABS(DATEDIFF(DAY, ${HOY}, e.fecha))) AS imagen
       FROM categorias c WHERE c.estado = 1 ORDER BY c.id_categoria`
  );
  res.json({ categorias: rows });
});

app.get('/api/report-reasons', (_req, res) => res.json({ motivos: require('./routes/events').MOTIVOS }));
app.use('/api/auth', require('./routes/auth').router);
app.use('/api/events', require('./routes/events').router);
app.use('/api/me', require('./routes/me'));
app.use('/api/organizer', require('./routes/organizer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

/* ---------- Archivos estáticos (en Vercel los sirve la CDN) ---------- */
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d', fallthrough: false }));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (!process.env.VERCEL && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

/* ---------- Errores ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') err = Object.assign(new Error('La imagen supera los 4 MB.'), { status: 400 });
  const status = err.status || 500;
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  const { status: _s, message, stack, ...extra } = err;
  res.status(status).json({ error: status >= 500 ? 'Ocurrió un error inesperado. Intenta nuevamente.' : message, ...(status < 500 ? extra : {}) });
});

module.exports = app;
