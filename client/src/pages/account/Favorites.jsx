import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from '../../api';
import { EventCard } from '../../components/EventCard';
import { EmptyState, SkeletonGrid } from '../../components/ui';

// HU09 – Mis favoritos
export default function Favorites() {
  const [eventos, setEventos] = useState(null);
  const load = () => api.get('/me/favorites').then((r) => setEventos(r.eventos));
  useEffect(() => { load(); }, []);
  // Sin favoritos: sugerimos lo más popular para que la página no sea un callejón sin salida
  const [sugeridos, setSugeridos] = useState([]);
  useEffect(() => {
    if (eventos && eventos.length === 0 && !sugeridos.length) api.get('/events?size=3&orden=popular').then((r) => setSugeridos(r.eventos || [])).catch(() => {});
  }, [eventos]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al quitar se oculta la tarjeta; si el usuario pulsa "Deshacer" vuelve a su lugar
  const onFav = (ev) => (on) => setEventos((x) => (on
    ? (x.some((e) => e.id === ev.id) ? x : [...x, ev].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)))
    : x.filter((e) => e.id !== ev.id)));
  const proximos = (eventos || []).filter((e) => !e.pasado);
  const pasados = (eventos || []).filter((e) => e.pasado);
  return (
    <>
      <div className="page-head"><div><h1>Mis favoritos</h1><p>Eventos que guardaste para encontrarlos fácilmente. Te recordaremos cuando se acerquen.</p></div></div>
      {!eventos ? <SkeletonGrid n={3} /> : eventos.length === 0 ? (
        <>
          <EmptyState icon={Heart} title="Aún no tienes favoritos" text="Toca el corazón de un evento para guardarlo aquí. Te avisaremos cuando se acerque."
            action={<Link to="/explorar" className="btn btn-primary">Explorar eventos</Link>} />
          {sugeridos.length > 0 && (<>
            <h2 className="mt-4 mb-2" style={{ fontSize: 20 }}>Populares esta semana</h2>
            <div className="ev-grid">{sugeridos.map((ev) => <EventCard key={ev.id} ev={ev} onFav={(on) => on && load()} />)}</div>
          </>)}
        </>
      ) : (
        <>
          <div className="ev-grid">{proximos.map((ev) => <EventCard key={ev.id} ev={{ ...ev, es_favorito: true }} onFav={onFav(ev)} />)}</div>
          {pasados.length > 0 && (<><h2 className="mt-4 mb-2">Ya realizados</h2><div className="ev-grid">{pasados.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div></>)}
        </>
      )}
    </>
  );
}
