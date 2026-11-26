import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Users, Share2, MessageCircle, Phone, MapPin, BarChart3 } from 'lucide-react';
import { api } from '../../api';
import { imgOf } from '../../components/EventCard';
import { CountUp, EmptyState, Loader, StatusBadge } from '../../components/ui';
import { Funnel, LineTrend, SERIES_COLOR } from '../../components/charts';
import { addDaysISO, fmt, todayISO } from '../../lib/format';

const SERIES = [
  ['VISUALIZACION', 'Vistas'],
  ['FAVORITO', 'Guardados'],
  ['ASISTENCIA', 'Asistiré'],
  ['COMPARTIDO', 'Compartidos'],
  ['CLIC_WHATSAPP', 'WhatsApp'],
];
// Las vistas (cientos) y las acciones (decenas) van en gráficos separados: en un mismo eje las acciones se aplastan.
const ACTIONS = SERIES.slice(1).map(([key, label]) => ({ key, label, color: SERIES_COLOR[key] }));

export function KpiTile({ icon: Icon, label, value, color, text, to }) {
  const inner = (
    <>
      {/* Primero la etiqueta y luego la cifra: se lee "qué" antes de "cuánto" (patrón Stripe / Linear) */}
      <span className="kpi-top"><span className="kpi-label">{label}</span><span className="ic" style={{ background: `${color}18`, color }}><Icon size={17} /></span></span>
      <b>{text ?? <CountUp value={value} />}</b>
    </>
  );
  return to ? <Link to={to} className="kpi">{inner}</Link> : <div className="kpi">{inner}</div>;
}

export function ChannelList({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div className="bar-list">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bl-row">
          <span className="row" style={{ gap: 8 }}><Icon size={16} color="var(--muted)" /> {label}</span>
          <b>{fmt(value)}</b>
          <div className="bl-bar"><span style={{ width: `${((value || 0) / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

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
        <div><h1>Estadísticas</h1><p>Cómo interactúa el público con tus eventos. Solo ves métricas de tus eventos.</p></div>
        <div className="seg" role="group" aria-label="Periodo">{[7, 30, 90].map((d) => <button key={d} className={dias === d ? 'active' : ''} aria-pressed={dias === d} onClick={() => setDias(d)}>{d} días</button>)}</div>
      </div>
      {!data.eventos.length ? (
        <EmptyState icon={BarChart3} title="Aún no tienes eventos" text="Publica tu primer evento para empezar a medir su alcance." action={<Link to="/publicar" className="btn btn-primary">Publicar evento</Link>} />
      ) : (
        <>
          <div className="kpis kpis-4">
            <KpiTile icon={Eye} label="Visualizaciones" value={t.visualizaciones} color={SERIES_COLOR.VISUALIZACION} />
            <KpiTile icon={Heart} label="Guardados" value={t.favoritos} color={SERIES_COLOR.FAVORITO} />
            <KpiTile icon={Users} label="Asistiré" value={t.asistencias} color={SERIES_COLOR.ASISTENCIA} />
            <KpiTile icon={BarChart3} label="Conversión de vistas a asistencia" text={t.visualizaciones && conv <= 100 ? `${conv}%` : '—'} color="#475569" />
          </div>

          <div className="dash-grid mb-3">
            <section className="card chart-card">
              <div className="chart-head"><h3>Embudo de conversión</h3><span className="muted small">Últimos {dias} días</span></div>
              <Funnel steps={[{ label: 'Vieron el evento', value: t.visualizaciones || 0 }, { label: 'Lo guardaron', value: t.favoritos || 0 }, { label: 'Confirmaron asistencia', value: t.asistencias || 0 }]} />
            </section>
            <section className="card chart-card">
              <div className="chart-head"><h3>Canales de contacto y difusión</h3></div>
              <ChannelList items={[
                { icon: MessageCircle, label: 'WhatsApp', value: t.clics_whatsapp }, { icon: Phone, label: 'Llamadas', value: t.clics_llamada },
                { icon: MapPin, label: 'Cómo llegar (mapa)', value: t.clics_mapa }, { icon: Share2, label: 'Veces compartido', value: t.compartidos },
              ]} />
            </section>
          </div>

          <section className="card chart-card mb-3">
            <div className="chart-head"><h3>Vistas por día</h3><span className="muted small">{fmt(t.visualizaciones)} en total</span></div>
            <LineTrend data={chart} series={[{ key: 'VISUALIZACION', label: 'Vistas', color: SERIES_COLOR.VISUALIZACION }]} height={240} label="Vistas por día" />
          </section>
          <section className="card chart-card mb-3">
            <div className="chart-head"><h3>Acciones por día</h3><span className="muted small">Guardados, asistencias, compartidos y WhatsApp</span></div>
            <LineTrend data={chart} series={ACTIONS} height={280} label="Acciones por día" />
          </section>
          <div className="card">
            <div className="chart-head" style={{ padding: '18px 20px 6px' }}><h3>Detalle por evento</h3></div>
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
