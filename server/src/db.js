/*
 * Dos modos de conexión a SQL Server:
 *  - Nube (Vercel, Azure SQL u otro servidor con TCP): define DB_SERVER, DB_NAME, DB_USER y DB_PASSWORD.
 *    Usa el driver "tedious" (JavaScript puro, funciona en Linux/Vercel).
 *  - Local (Windows): define DB_CONNECTION_STRING (ODBC con autenticación de Windows, no requiere TCP/IP).
 */
const CLOUD = Boolean(process.env.DB_SERVER);
// El nombre del módulo ODBC se arma en tiempo de ejecución para que el empaquetador de Vercel no intente incluirlo.
const sql = CLOUD ? require('mssql') : require(['mssql', 'msnodesqlv8'].join('/'));

const config = CLOUD
  ? {
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME || 'EventiaDB',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: process.env.DB_ENCRYPT !== 'false', trustServerCertificate: process.env.DB_TRUST_CERT === 'true' },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    }
  : {
      connectionString: process.env.DB_CONNECTION_STRING,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

function bind(req, name, value) {
  if (value === undefined || value === null) return req.input(name, sql.NVarChar(sql.MAX), null);
  if (typeof value === 'boolean') return req.input(name, sql.Bit, value);
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return req.input(name, Math.abs(value) > 2147483647 ? sql.BigInt : sql.Int, value);
    return req.input(name, sql.Decimal(18, 6), value);
  }
  if (value instanceof Date) return req.input(name, sql.DateTime2(6), value);
  const s = String(value);
  return req.input(name, s.length > 4000 ? sql.NVarChar(sql.MAX) : sql.NVarChar(4000), s);
}

// BIGINT llega como texto desde el driver: se normaliza a número.
function normalize(recordset) {
  if (!recordset) return [];
  const bigCols = Object.entries(recordset.columns || {})
    .filter(([, c]) => c.type === sql.BigInt || (c.type && c.type.declaration === 'bigint'))
    .map(([k]) => k);
  if (!bigCols.length) return Array.from(recordset);
  return recordset.map((row) => {
    for (const k of bigCols) if (row[k] !== null && row[k] !== undefined) row[k] = Number(row[k]);
    return row;
  });
}

async function query(text, params = {}, transaction = null) {
  const req = transaction ? new sql.Request(transaction) : (await getPool()).request();
  for (const [k, v] of Object.entries(params)) bind(req, k, v);
  const result = await req.query(text);
  return normalize(result.recordset);
}

async function one(text, params = {}, transaction = null) {
  const rows = await query(text, params, transaction);
  return rows[0] || null;
}

async function tx(fn) {
  const pool = await getPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    const res = await fn({
      query: (text, params) => query(text, params, t),
      one: (text, params) => one(text, params, t),
    });
    await t.commit();
    return res;
  } catch (err) {
    try { await t.rollback(); } catch { /* ignore */ }
    throw err;
  }
}

// Fecha y hora local de Perú (UTC-5, sin horario de verano)
const HOY = "CAST(DATEADD(HOUR,-5,SYSUTCDATETIME()) AS DATE)";
const AHORA = "DATEADD(HOUR,-5,SYSUTCDATETIME())";

module.exports = { sql, getPool, query, one, tx, HOY, AHORA, CLOUD };
