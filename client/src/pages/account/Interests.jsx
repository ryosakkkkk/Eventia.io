import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EventCard } from '../../components/EventCard';
import { SkeletonGrid } from '../../components/ui';
import { catStyle } from '../../lib/format';

// RF10 / RF33 / HU07 / HU19 – Intereses y recomendaciones "Para ti"
export default function Interests() {
  const { categorias, toast } = useApp();
  const [sel, setSel] = useState({});
  const [recs, setRecs] = useState(null);
  const [saving, setSaving] = useState(false);
  const loadRecs = () => api.get('/events/for-you?size=9').then(setRecs);
  useEffect(() => {
    api.get('/me/interests').then((r) => setSel(Object.fromEntries(r.intereses.map((i) => [i.id_categoria, i.nivel_interes]))));
    loadRecs();
  }, []);
  const toggle = (id) => setSel((s) => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = 3; return n; });
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/me/interests', { intereses: Object.entries(sel).map(([id_categoria, nivel_interes]) => ({ id_categoria: Number(id_categoria), nivel_interes })) });
      toast('Preferencias guardadas. Actualizamos tus recomendaciones.');
      setRecs(null);
      loadRecs();
    } finally { setSaving(false); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>¿Qué te gusta?</h1><p>Elige tus categorías favoritas y cuánto te interesan. Combinamos esto con tus visitas, favoritos y asistencias.</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Guardar preferencias</button>
      </div>
      <div className="interest-grid">
        {categorias.map((c) => {
          const { Icon, color } = catStyle(c.nombre);
          const on = !!sel[c.id_categoria];
          return (
            <div key={c.id_categoria} className={`interest ${on ? 'on' : ''}`} role="checkbox" aria-checked={on} tabIndex={0}
              onClick={() => toggle(c.id_categoria)} onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), toggle(c.id_categoria))}>
              <span className="tick">{on && <Check size={14} />}</span>
              <span className="cat-circle" style={{ width: 46, height: 46, color, background: `${color}14`, borderColor: `${color}30` }}><Icon size={22} /></span>
              <b>{c.nombre}</b>
              {on ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <span className="tiny muted">Nivel de interés</span>
                  <input type="range" min={1} max={5} value={sel[c.id_categoria]} style={{ width: '100%', accentColor: 'var(--primary)' }}
                    onChange={(e) => setSel((s) => ({ ...s, [c.id_categoria]: Number(e.target.value) }))} aria-label={`Nivel de interés en ${c.nombre}`} />
                </div>
              ) : <span className="tiny muted">{c.descripcion}</span>}
            </div>
          );
        })}
      </div>

      <div className="section-head mt-4">
        <div><h2><Sparkles size={20} color="var(--violet)" style={{ verticalAlign: '-3px' }} /> Para ti</h2><p>Eventos próximos elegidos según tus intereses e interacciones.</p></div>
      </div>
      {!recs ? <SkeletonGrid n={3} /> : (
        <>
          {!recs.personalizado && <div className="form-note mb-2">Selecciona intereses y guarda para personalizar estas recomendaciones.</div>}
          <div className="ev-grid">{recs.eventos.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>
        </>
      )}
    </>
  );
}
