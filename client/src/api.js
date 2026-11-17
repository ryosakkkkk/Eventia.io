// Cliente HTTP de la API de Eventia (cookies httpOnly, mismo origen)
export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || 'Ocurrió un error. Intenta nuevamente.');
    this.status = status;
    this.data = data || {};
  }
}

async function request(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api' + url, opts);
  } catch {
    throw new ApiError(0, { error: 'No se pudo conectar con el servidor.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b ?? {}),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Registro de interacciones de marketing (no bloquea la interfaz)
export const track = (id, tipo) => api.post(`/events/${id}/interactions`, { tipo }).catch(() => {});
