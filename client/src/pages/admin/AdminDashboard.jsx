import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Users, FileClock, Flag, Eye, Heart, UserCheck, PlayCircle, Archive, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { Loader } from '../../components/ui';
import { LineTrend, SERIES_COLOR } from '../../components/charts';
import { addDaysISO, fmt, shortCat, todayISO } from '../../lib/format';
import { buildSeries, KpiTile } from '../organizer/Marketing';

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
        <div><h1>Resumen</h1><p>Supervisa publicaciones, usuarios, categorías y reportes.</p></div>
        <div className="row-wrap">
          <input type="date" className="input" style={{ width: 160, height: 46 }} value={range.desde} max={range.hasta} onChange={(e) => setRange({ ...range, desde: e.target.value })} aria-label="Desde" />
          <input type="date" className="input" style={{ width: 160, height: 46 }} value={range.hasta} min={range.desde} max={todayISO()} onChange={(e) => setRange({ ...range, hasta: e.target.value })} aria-label="Hasta" />
          <button className="btn btn-light btn-sm" onClick={runJobs} title="Archiva eventos pasados y envía recordatorios"><PlayCircle size={16} /> Ejecutar tareas</button>
        </div>
      </div>
      {/* Primero lo que requiere una acción del administrador */}
      <div className="attention-grid mb-3">
        {[
          [FileClock, t.pendientes, 'evento pendiente de validación', 'eventos pendientes de validación', 'Revisar', '/admin/eventos'],
          [Flag, t.reportes_abiertos, 'reporte de la comunidad sin resolver', 'reportes de la comunidad sin resolver', 'Atender', '/admin/reportes'],
        ].map(([Icon, n, one, many, cta, to]) => (
          n > 0 ? (
            <Link key={to} to={to} className="attention">
              <Icon size={20} /><div className="grow"><b>{n} {n === 1 ? one : many}</b><span className="small muted">Requiere tu revisión</span></div>
              <span className="btn btn-light btn-sm">{cta} <ArrowRight size={15} /></span>
            </Link>
          ) : (
            <div key={to} className="attention ok"><CheckCircle2 size={20} /><div className="grow"><b>Sin {many.split(' ')[0]} por revisar</b><span className="small muted">Todo al día</span></div></div>
          )
        ))}
      </div>

      <div className="kpis kpis-3">
        <KpiTile icon={CalendarDays} label="Eventos registrados" value={t.eventos} color="#475569" to="/admin/eventos" />
        <KpiTile icon={Users} label="Usuarios verificados" value={t.usuarios} color="#475569" to="/admin/usuarios" />
        <KpiTile icon={UserCheck} label="Nuevos en el periodo" value={t.nuevos_usuarios} color="#475569" />
        <KpiTile icon={Eye} label="Vistas en el periodo" value={t.visualizaciones} color={SERIES_COLOR.VISUALIZACION} />
        <KpiTile icon={Heart} label="Favoritos en el periodo" value={t.favoritos} color={SERIES_COLOR.FAVORITO} />
        <KpiTile icon={Archive} label="Archivados" value={t.archivados} color="#475569" to="/admin/eventos?estado=ARCHIVADOS" />
      </div>

      <div className="dash-grid mb-3">
        <section className="card chart-card">
          <div className="chart-head"><h3>Vistas por día</h3><span className="muted small">{fmt(t.visualizaciones)} en el periodo</span></div>
          <LineTrend data={chart} series={[{ key: 'VISUALIZACION', label: 'Vistas', color: SERIES_COLOR.VISUALIZACION }]} height={240} label="Vistas por día" />
        </section>
        <section className="card chart-card">
          <div className="chart-head"><h3>Favoritos y asistencias por día</h3></div>
          <LineTrend data={chart} series={[{ key: 'FAVORITO', label: 'Favoritos', color: SERIES_COLOR.FAVORITO }, { key: 'ASISTENCIA', label: 'Asistiré', color: SERIES_COLOR.ASISTENCIA }]} height={240} label="Favoritos y asistencias por día" />
        </section>
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
