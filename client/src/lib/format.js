import {
  Music, Landmark, Trophy, UtensilsCrossed, Store, GraduationCap, Rocket, Users, Palette, PartyPopper, Sparkles,
} from 'lucide-react';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export const parseDate = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// Fecha/hora del evento en hora de Perú (UTC-5)
export const eventDate = (fecha, hora = '00:00') => new Date(`${fecha}T${hora}:00-05:00`);

export const todayISO = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function dateChip(fecha) {
  const d = parseDate(fecha);
  return { dia: DIA_CORTO[d.getDay()], num: d.getDate(), mes: MES_CORTO[d.getMonth()] };
}

export function relativeDay(fecha) {
  const t = todayISO();
  if (fecha === t) return 'Hoy';
  if (fecha === addDaysISO(t, 1)) return 'Mañana';
  return null;
}

export function longDate(fecha) {
  const d = parseDate(fecha);
  const s = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function shortDate(fecha) {
  const d = parseDate(fecha);
  return `${DIA_CORTO[d.getDay()].charAt(0)}${DIA_CORTO[d.getDay()].slice(1).toLowerCase()} ${d.getDate()} ${MES_CORTO[d.getMonth()].charAt(0)}${MES_CORTO[d.getMonth()].slice(1).toLowerCase()}`;
}
export const monthName = (m) => MESES[m];

export function hora12(hora) {
  if (!hora) return '';
  const [h, m] = hora.split(':').map(Number);
  const suf = h >= 12 ? 'p. m.' : 'a. m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suf}`;
}

export function timeAgo(value) {
  if (!value) return '';
  const d = new Date(value);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'Hace un momento';
  if (s < 3600) return `Hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `Hace ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `Hace ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fmt = (n) => new Intl.NumberFormat('es-PE').format(n || 0);

/* ---------- Categorías: ícono y color ---------- */
const CAT_STYLE = [
  [/m[uú]sica/i, Music, '#7c3aed'],
  [/cultura/i, Landmark, '#d9480f'],
  [/deporte/i, Trophy, '#059669'],
  [/gastronom/i, UtensilsCrossed, '#ea580c'],
  [/feria/i, Store, '#0284c7'],
  [/educa/i, GraduationCap, '#2f4fe0'],
  [/emprend/i, Rocket, '#4f46e5'],
  [/famil/i, Users, '#db2777'],
  [/arte/i, Palette, '#c026d3'],
  [/fiesta|festiv/i, PartyPopper, '#e11d48'],
];
export function catStyle(nombre = '') {
  for (const [re, Icon, color] of CAT_STYLE) if (re.test(nombre)) return { Icon, color };
  return { Icon: Sparkles, color: '#64748b' };
}
export const shortCat = (nombre = '') => nombre.replace(/ y conciertos| y tradición| y festividades/i, '');

/* ---------- Estados ---------- */
export const ESTADOS = {
  PUBLICADO: ['Publicado', 'green'],
  AGOTADO: ['Agotado', 'red'],
  PENDIENTE_DE_VALIDACION: ['En validación', 'amber'],
  BORRADOR: ['Borrador', 'gray'],
  FINALIZADO: ['Finalizado', 'slate'],
  ARCHIVADO: ['Archivado', 'slate'],
  ELIMINADO: ['Eliminado', 'red'],
};

export function availability(ev) {
  switch (ev.disponibilidad) {
    case 'LIBRE': return { label: 'Entrada libre', tone: 'blue' };
    case 'AGOTADO': return { label: 'Agotado', tone: 'red' };
    case 'ULTIMOS': return { label: `Últimos ${ev.entradas_disponibles} cupos`, tone: 'orange' };
    default: return { label: `${fmt(ev.entradas_disponibles)} cupos disponibles`, tone: 'green' };
  }
}

/* ---------- Enlaces externos ---------- */
export const waLink = (num, text) => `https://wa.me/${String(num).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const mapsLink = (ev) =>
  ev.latitud != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${ev.latitud},${ev.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.lugar}, ${ev.direccion}, ${ev.ciudad}, Perú`)}`;
export const wazeLink = (ev) =>
  ev.latitud != null ? `https://waze.com/ul?ll=${ev.latitud},${ev.longitud}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(`${ev.lugar} ${ev.ciudad}`)}`;

export function googleCalendarLink(ev) {
  const start = eventDate(ev.fecha, ev.hora);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.nombre, dates: `${f(start)}/${f(end)}`,
    details: `${location.origin}/evento/${ev.id}`, location: `${ev.lugar}, ${ev.direccion}, ${ev.ciudad}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function downloadIcs(ev) {
  const start = eventDate(ev.fecha, ev.hora);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eventia//ES', 'BEGIN:VEVENT',
    `UID:eventia-${ev.id}@eventia`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${ev.nombre}`, `LOCATION:${ev.lugar}, ${ev.direccion}, ${ev.ciudad}`, `URL:${location.origin}/evento/${ev.id}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${ev.nombre}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${ev.nombre.replace(/[^\w]+/g, '-').toLowerCase()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
