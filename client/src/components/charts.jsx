import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from './ui';

// Color por entidad (siempre el mismo para la misma métrica en todo el sistema).
// Orden validado con validate_palette.js de la skill dataviz: CVD ΔE ≥ 9.1, visión normal ≥ 22.9.
export const SERIES_COLOR = {
  VISUALIZACION: '#2a78d6',
  FAVORITO: '#eb6834',
  ASISTENCIA: '#1baf7a',
  COMPARTIDO: '#eda100',
  CLIC_WHATSAPP: '#6250d6',
};
// Rampa ordinal (un solo tono, de claro a oscuro) para etapas del embudo; validada con --ordinal.
const FUNNEL_RAMP = ['#86b6ef', '#3987e5', '#1c5cab'];
const INK_2 = '#475569';
const AXIS = '#64748b';
const GRID = '#e2e8f0';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tip">
      <b className="viz-tip-title">{label}</b>
      {payload.map((p) => (
        <div key={p.dataKey} className="viz-tip-row">
          <i style={{ background: p.color }} aria-hidden="true" /><span>{p.name}</span><b>{fmt(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

// Etiqueta directa al final de cada línea; si dos quedan a la misma altura, la siguiente sube
// (hacia abajo chocaría con el eje cuando ambas terminan en cero).
function EndLabel({ x, y, index, last, name, taken }) {
  if (index !== last || x == null || y == null) return null;
  let ly = y;
  while (taken.some((t) => Math.abs(t - ly) < 15)) ly -= 15;
  taken.push(ly);
  return <text x={x + 8} y={ly} dy={4} fill={INK_2} fontSize={12.5} fontWeight={600}>{name}</text>;
}

// Tendencia diaria: líneas de 2 px, cuadrícula tenue, cursor vertical con tooltip.
export function LineTrend({ data, series, height = 280, xKey = 'dia', label }) {
  const multi = series.length > 1;
  const last = data.length - 1;
  const taken = [];
  const animate = !prefersReducedMotion();
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: multi ? 104 : 18, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
            interval="preserveStartEnd" minTickGap={28} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
          {multi && (
            <Legend verticalAlign="top" align="left" height={34} iconType="plainline" iconSize={16}
              formatter={(v) => <span style={{ color: INK_2, fontSize: 13, fontWeight: 600 }}>{v}</span>} />
          )}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={animate}
              label={multi ? <EndLabel last={last} name={s.label} taken={taken} /> : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Embudo de conversión: cada etapa muestra su valor y el % respecto de la anterior.
// Los favoritos también se pueden marcar desde el listado, así que una etapa puede superar a la anterior.
export function Funnel({ steps }) {
  const base = Math.max(1, ...steps.map((s) => s.value || 0));
  const rateText = (rate, prev) => {
    if (!prev) return 'Sin datos en la etapa anterior';
    if (rate > 100) return 'Más que en la etapa anterior';
    return `${rate}% de la etapa anterior`;
  };
  return (
    <ol className="funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 1000) / 10 : null;
        const width = s.value ? Math.max((s.value / base) * 100, 1.5) : 0;
        return (
          <li key={s.label} title={`${s.label}: ${fmt(s.value)}`}>
            <div className="fn-head">
              <span>{s.label}</span>
              <b>{fmt(s.value)}</b>
            </div>
            <div className="fn-track"><span style={{ width: `${width}%`, background: FUNNEL_RAMP[i] || FUNNEL_RAMP[FUNNEL_RAMP.length - 1] }} /></div>
            {i > 0 && <small className="fn-rate">{rateText(rate, prev)}</small>}
          </li>
        );
      })}
    </ol>
  );
}
