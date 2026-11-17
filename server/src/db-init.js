/**
 * Crea las 13 tablas de Eventia ejecutando database/01_schema.sql sobre la base configurada en .env.
 * Útil para una base en la nube (Azure SQL u otro SQL Server), donde no se permite CREATE DATABASE/USE.
 *   npm run db:init
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { getPool, one } = require('./db');

async function main() {
  const pool = await getPool();
  const exists = await one(`SELECT CASE WHEN OBJECT_ID('dbo.usuarios', 'U') IS NULL THEN 0 ELSE 1 END AS hay`);
  if (exists.hay) {
    console.log('Las tablas ya existen; no se modifica nada.');
    process.exit(0);
  }
  const script = fs.readFileSync(path.join(__dirname, '..', '..', 'database', '01_schema.sql'), 'utf8');
  const batches = script
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b && !/CREATE\s+DATABASE|^\s*USE\s+/im.test(b.replace(/\/\*[\s\S]*?\*\//g, '')));
  for (const b of batches) await pool.request().batch(b);
  console.log(`✔ Esquema creado (${batches.length} lotes). Ahora ejecuta: npm run seed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al crear el esquema:', err.message);
  process.exit(1);
});
