import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Users, Share2, MessageCircle, Phone, MapPin, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../../api';
import { imgOf } from '../../components/EventCard';
import { EmptyState, Loader, StatusBadge } from '../../components/ui';
import { addDaysISO, fmt, todayISO } from '../../lib/format';

const SERIES = [
  ['VISUALIZACION', 'Vistas', '#2f4fe0'],
  ['FAVORITO', 'Guardados', '#e11d48'],
  ['ASISTENCIA', 'Asistiré', '#16a34a'],
  ['COMPARTIDO', 'Compartidos', '#ff6a13'],
  ['CLIC_WHATSAPP', 'WhatsApp', '#1fae58'],
];

export function buildSeries(serie, dias, hasta = todayISO()) {
  const start = addDaysISO(hasta, -(dias - 1));
  const rows = [];
  const idx = {};
  for (let i = 0; i < dias; i++) {
    const d = addDaysISO(start, i);
    idx[d] = { dia: d.slice(5).split('-').reverse().join('/') };
    rows.push(idx[d]);
  }
  serie.forEach((s) => { if (idx[s.dia]) idx[s.dia][s.tipo] = (idx[s.dia][s.tipo] || 0) + s.n; });
  rows.forEach((r) => SERIES.forEach(([k]) => { r[k] = r[k] || 0; }));
  return rows;
}

// RF35 / RF44 / HU21 – Panel de marketing del organizador
export default function Marketing() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.get(`/organizer/metrics?dias=${dias}`).then(setData); }, [dias]);
  const chart = useMemo(() => (data ? buildSeries(data.serie, dias) : []), [data, dias]);
  if (!data) return <Loader />;
  const t = data.totales || {};
  const conv = t.visualizaciones ? Math.round(((t.asistencias || 0) / t.visualizaciones) * 1000) / 10 : 0;
  return (
    <>
      <div className="page-head">
        <div><h1>Marketing y estadísticas</h1><p>Cómo interactúa el público con tus eventos. Solo ves métricas de tus eventos.</p></div>
        <div className="seg">{[7, 30, 90].map((d) => <button key={d} className={dias === d ? 'active' : ''} onClick={() => setDias(d)}>{d} días</button>)}</div>
      </div>
      {!data.eventos.length ? (
        <EmptyState icon={BarChart3} title="Aún no tienes eventos" text="Publica tu primer evento para empezar a medir su alcance." action={<Link to="/publicar" className="btn btn-primary">Publicar evento</Link>} />
      ) : (
        <>
          <div className="kpis">
            {[[Eye, 'Visualizaciones', t.visualizaciones, '#2f4fe0'], [Heart, 'Guardados', t.favoritos, '#e11d48'], [Users, 'Asistiré', t.asistencias, '#16a34a'],
              [Share2, 'Compartidos', t.compartidos, '#ff6a13'], [MessageCircle, 'Clics WhatsApp', t.clics_whatsapp, '#1fae58'], [Phone, 'Clics llamada', t.clics_llamada, '#0284c7'],
              [MapPin, 'Clics en mapa', t.clics_mapa, '#7c3aed']].map(([Icon, label, v, color]) => (
              <div key={label} className="kpi"><span className="ic" style={{ background: `${color}15`, color }}><Icon size={19} /></span><b>{fmt(v)}</b><span>{label}</span></div>
            ))}
            <div className="kpi" style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' }}>
              <span className="ic" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}><BarChart3 size={19} /></span><b>{conv}%</b><span style={{ color: '#9fb0d0' }}>Vistas → Asistiré</span>
            </div>
          </div>
          <div className="card chart-card mb-3">
            <h3>Interacciones por día</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ left: -18, right: 8, top: 6 }}>
                  <defs>{SERIES.map(([k, , c]) => <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity={0.25} /><stop offset="1" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs>
                  <CartesianGrid stroke="#eef1f6" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7890' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7890' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e9f2', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map(([k, label, c]) => <Area key={k} type="monotone" dataKey={k} name={label} stroke={c} strokeWidth={2} fill={`url(#g${k})`} />)}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Evento</th><th>Estado</th><th>Vistas</th><th>Guardados</th><th>Asistiré</th><th>Compartidos</th><th>WhatsApp</th><th>Llamadas</th><th>Mapa</th></tr></thead>
                <tbody>
                  {data.eventos.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/evento/${e.id}`} className="row"><img className="thumb" src={imgOf(e)} alt="" /><b className="clamp-1" style={{ maxWidth: 240 }}>{e.nombre}</b></Link></td>
                      <td><StatusBadge estado={e.estado} /></td>
                      <td><b>{fmt(e.visualizaciones)}</b></td><td>{fmt(e.favoritos)}</td><td>{fmt(e.asistencias)}</td><td>{fmt(e.compartidos)}</td>
                      <td>{fmt(e.clics_whatsapp)}</td><td>{fmt(e.clics_llamada)}</td><td>{fmt(e.clics_mapa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="tiny muted mt-2">Totales del periodo calculados desde el historial de interacciones; la tabla muestra acumulados por evento.</p>
        </>
      )}
    </>
  );
}
