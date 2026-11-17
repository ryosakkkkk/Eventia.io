import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Users, FileClock, Flag, Eye, Heart, UserCheck, PlayCircle, Archive } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { Loader } from '../../components/ui';
import { addDaysISO, fmt, shortCat, todayISO } from '../../lib/format';
import { buildSeries } from '../organizer/Marketing';

function BarList({ items, valueKey = 'n', labelKey = 'nombre', link }) {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  if (!items.length) return <p className="muted small">Sin datos en el periodo.</p>;
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div key={i.id || i[labelKey]} className="bl-row">
          {link ? <Link to={`/evento/${i.id}`} className="clamp-1">{i[labelKey]}</Link> : <span className="clamp-1">{i[labelKey]}</span>}
          <b>{fmt(i[valueKey])}</b>
          <div className="bl-bar"><span style={{ width: `${(i[valueKey] / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// RF32 / HU18 – Estadísticas del administrador
export default function AdminDashboard() {
  const { toast } = useApp();
  const [range, setRange] = useState({ desde: addDaysISO(todayISO(), -29), hasta: todayISO() });
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.get(`/admin/stats?desde=${range.desde}&hasta=${range.hasta}`).then(setData); }, [range]);
  const dias = Math.max(1, Math.round((Date.parse(range.hasta) - Date.parse(range.desde)) / 86400e3) + 1);
  const chart = useMemo(() => (data ? buildSeries(data.serie, Math.min(dias, 366), range.hasta) : []), [data, dias, range.hasta]);
  const runJobs = async () => {
    const r = await api.post('/admin/jobs/run');
    toast(`Tareas ejecutadas: ${r.archivados} archivados, ${r.finalizados} finalizados, ${r.recordatorios} recordatorios.`);
  };
  if (!data) return <Loader />;
  const t = data.totales;
  return (
    <>
      <div className="page-head">
        <div><h1>Panel de administración</h1><p>Supervisa publicaciones, usuarios, categorías y reportes.</p></div>
        <div className="row-wrap">
          <input type="date" className="input" style={{ width: 160, height: 46 }} value={range.desde} max={range.hasta} onChange={(e) => setRange({ ...range, desde: e.target.value })} aria-label="Desde" />
          <input type="date" className="input" style={{ width: 160, height: 46 }} value={range.hasta} min={range.desde} max={todayISO()} onChange={(e) => setRange({ ...range, hasta: e.target.value })} aria-label="Hasta" />
          <button className="btn btn-light btn-sm" onClick={runJobs} title="Archiva eventos pasados y envía recordatorios"><PlayCircle size={16} /> Ejecutar tareas</button>
        </div>
      </div>
      <div className="kpis">
        {[[CalendarDays, 'Eventos registrados', t.eventos, '#2f4fe0', '/admin/eventos'], [FileClock, 'Pendientes de validación', t.pendientes, '#b45309', '/admin/eventos?estado=PENDIENTE_DE_VALIDACION'],
          [Flag, 'Reportes abiertos', t.reportes_abiertos, '#e11d48', '/admin/reportes'], [Users, 'Usuarios verificados', t.usuarios, '#7c3aed', '/admin/usuarios'],
          [UserCheck, 'Nuevos en el periodo', t.nuevos_usuarios, '#0284c7'], [Eye, 'Vistas en el periodo', t.visualizaciones, '#16a34a'],
          [Heart, 'Favoritos en el periodo', t.favoritos, '#e11d48'], [Archive, 'Archivados', t.archivados, '#64748b', '/admin/eventos?estado=ARCHIVADOS']].map(([Icon, label, v, color, to]) => {
          const inner = <><span className="ic" style={{ background: `${color}15`, color }}><Icon size={19} /></span><b>{fmt(v)}</b><span>{label}</span></>;
          return to ? <Link key={label} to={to} className="kpi">{inner}</Link> : <div key={label} className="kpi">{inner}</div>;
        })}
      </div>
      <div className="card chart-card mb-3">
        <h3>Interacciones en la plataforma</h3>
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={chart} margin={{ left: -18, right: 8, top: 6 }}>
              <CartesianGrid stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7890' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7890' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e9f2', fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="VISUALIZACION" name="Vistas" stroke="#2f4fe0" fill="#2f4fe022" strokeWidth={2} />
              <Area type="monotone" dataKey="FAVORITO" name="Favoritos" stroke="#e11d48" fill="#e11d4815" strokeWidth={2} />
              <Area type="monotone" dataKey="ASISTENCIA" name="Asistiré" stroke="#16a34a" fill="#16a34a15" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card chart-card"><h3>Eventos más visualizados</h3><BarList items={data.topVistos} link /></div>
        <div className="card chart-card"><h3>Categorías con mayor interacción</h3><BarList items={data.categorias.map((c) => ({ ...c, nombre: shortCat(c.nombre) }))} /></div>
        <div className="card chart-card"><h3>Más guardados en favoritos</h3><BarList items={data.topFavoritos} link /></div>
        <div className="card chart-card"><h3>Más confirmaciones de asistencia</h3><BarList items={data.topAsistencias} link /></div>
      </div>
    </>
  );
}
