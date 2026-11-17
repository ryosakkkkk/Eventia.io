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
  const proximos = (eventos || []).filter((e) => !e.pasado);
  const pasados = (eventos || []).filter((e) => e.pasado);
  return (
    <>
      <div className="page-head"><div><h1>Mis favoritos</h1><p>Eventos que guardaste para encontrarlos fácilmente. Te recordaremos cuando se acerquen.</p></div></div>
      {!eventos ? <SkeletonGrid n={3} /> : eventos.length === 0 ? (
        <EmptyState icon={Heart} title="Aún no tienes favoritos" text="Explora el catálogo y toca el corazón de los eventos que te interesan."
          action={<Link to="/explorar" className="btn btn-primary">Explorar eventos</Link>} />
      ) : (
        <>
          <div className="ev-grid">{proximos.map((ev) => <EventCard key={ev.id} ev={ev} onFav={(on) => !on && setEventos((x) => x.filter((e) => e.id !== ev.id))} />)}</div>
          {pasados.length > 0 && (<><h2 className="mt-4 mb-2">Ya realizados</h2><div className="ev-grid">{pasados.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div></>)}
        </>
      )}
    </>
  );
}
