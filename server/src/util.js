class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

const bad = (msg, extra) => new HttpError(400, msg, extra);
const forbidden = (msg = 'No tienes permisos para esta acción.') => new HttpError(403, msg);
const notFound = (msg = 'Recurso no encontrado.') => new HttpError(404, msg);

const str = (v, max = 4000) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const int = (v, def = null) => {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 255;
const likeEscape = (s) => s.replace(/[\\%_[]/g, (c) => '\\' + c);
const phone = (v) => {
  const s = str(v, 30);
  if (!s) return null;
  const clean = s.replace(/[^\d+]/g, '');
  if (clean.replace(/\D/g, '').length < 6) throw bad('El número de teléfono no es válido.');
  return clean;
};
const url = (v, max = 500) => {
  const s = str(v, max);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return 'https://' + s;
  return s;
};

module.exports = { HttpError, bad, forbidden, notFound, str, int, num, bool, isEmail, likeEscape, phone, url };
