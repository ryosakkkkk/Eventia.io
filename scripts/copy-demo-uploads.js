// Copia las fotos de demostración a client/dist para que Vercel las sirva desde su CDN.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'server', 'uploads', 'demo');
const dest = path.join(__dirname, '..', 'client', 'dist', 'uploads', 'demo');
if (!fs.existsSync(src)) {
  console.log('No hay fotos de demostración para copiar.');
  process.exit(0);
}
fs.cpSync(src, dest, { recursive: true });
console.log(`✔ Fotos de demostración copiadas a ${path.relative(process.cwd(), dest)}`);
