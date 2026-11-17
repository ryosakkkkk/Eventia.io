import { useEffect, useState } from 'react';
import { Archive as ArchiveIcon } from 'lucide-react';
import { api } from '../api';
import { EventRow } from '../components/EventCard';
import { EmptyState, Loader, Stars } from '../components/ui';

// RF25 / RF26 – Eventos archivados públicos
export default function Archive() {
  const [eventos, setEventos] = useState(null);
  useEffect(() => { api.get('/events/archived').then((r) => setEventos(r.eventos)); }, []);
  return (
    <div className="container section">
      <div className="page-head"><div><h1>Eventos pasados</h1><p>Historial de eventos realizados en Abancay y Apurímac, con las valoraciones de quienes asistieron.</p></div></div>
      {!eventos ? <Loader /> : eventos.length === 0 ? (
        <EmptyState icon={ArchiveIcon} title="Aún no hay eventos archivados" />
      ) : (
        <div className="stack">
          {eventos.map((ev) => (
            <EventRow key={ev.id} ev={ev} right={ev.rating ? <span className="row small"><Stars value={ev.rating} /> <b>{ev.rating}</b></span> : <span className="tiny muted">Sin valoraciones</span>} />
          ))}
        </div>
      )}
    </div>
  );
}
