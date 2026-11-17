import { useEffect, useState } from 'react';

// Créditos de las fotos de demostración (licencias Creative Commons que exigen atribución)
let cache = null;
export function loadCredits() {
  if (!cache) cache = fetch('/uploads/demo/fotos/creditos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return cache;
}

export function useCredits() {
  const [credits, setCredits] = useState({});
  useEffect(() => { loadCredits().then(setCredits); }, []);
  return credits;
}

export function creditFor(credits, imagen) {
  const m = /\/uploads\/demo\/fotos\/([\w-]+)\.jpg$/.exec(imagen || '');
  return m ? credits[m[1]] : null;
}
