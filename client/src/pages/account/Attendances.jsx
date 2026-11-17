import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Star, X } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EventRow } from '../../components/EventCard';
import { Countdown, EmptyState, Loader } from '../../components/ui';

// HU10 – Eventos a los que asistiré
export default function Attendances() {
  const { toast } = useApp();
  const [eventos, setEventos] = useState(null);
  const [tab, setTab] = useState('proximos');
  const load = () => api.get('/me/attendances').then((r) => setEventos(r.eventos));
  useEffect(() => { load(); }, []);
  const cancel = async (ev) => {
    await api.del(`/events/${ev.id}/attend`);
    toast('Cancelaste tu asistencia', 'info');
    load();
  };
  if (!eventos) return <Loader />;
  const list = eventos.filter((e) => (tab === 'proximos' ? !e.pasado : e.pasado));
  return (
    <>
      <div className="page-head"><div><h1>Mis eventos</h1><p>Eventos en los que marcaste “Asistiré”. Recibirás recordatorios antes de cada uno.</p></div></div>
      <div className="tabs">
        <button className={`tab ${tab === 'proximos' ? 'active' : ''}`} onClick={() => setTab('proximos')}>Próximos ({eventos.filter((e) => !e.pasado).length})</button>
        <button className={`tab ${tab === 'pasados' ? 'active' : ''}`} onClick={() => setTab('pasados')}>Pasados ({eventos.filter((e) => e.pasado).length})</button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Ticket} title={tab === 'proximos' ? 'No tienes eventos próximos' : 'Aún no tienes eventos pasados'}
          text="Marca “Asistiré” en un evento para tenerlo aquí y recibir recordatorios."
          action={<Link to="/explorar" className="btn btn-primary">Buscar eventos</Link>} />
      ) : (
        <div className="stack">
          {list.map((ev) => (
            <EventRow key={ev.id} ev={ev} right={
              tab === 'proximos' ? (
                <div className="stack" style={{ alignItems: 'flex-end', gap: 8, minWidth: 230 }}>
                  <Countdown fecha={ev.fecha} hora={ev.hora} light />
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); cancel(ev); }}><X size={15} /> Cancelar asistencia</button>
                </div>
              ) : ev.valorado ? <span className="badge badge-green">Valorado</span>
                : <Link to={`/evento/${ev.id}`} className="btn btn-orange btn-sm"><Star size={15} /> Valorar</Link>
            } />
          ))}
        </div>
      )}
    </>
  );
}
