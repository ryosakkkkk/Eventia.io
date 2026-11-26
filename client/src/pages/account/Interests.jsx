import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { EventCard } from '../../components/EventCard';
import { SkeletonGrid } from '../../components/ui';
import { catStyle } from '../../lib/format';

// El nivel 1–5 se presenta como tres opciones con nombre (más fáciles de elegir que un deslizador sin rótulos)
const LEVELS = [[1, 'Poco'], [3, 'Me gusta'], [5, 'Mucho']];
const nearestLevel = (n) => LEVELS.reduce((best, [v]) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 3);

// RF10 / RF33 / HU07 / HU19 – Intereses y recomendaciones "Para ti"
export default function Interests() {
  const { categorias, toast } = useApp();
  const [sel, setSel] = useState({});
  const [saved, setSaved] = useState('{}');
  const [recs, setRecs] = useState(null);
  const [saving, setSaving] = useState(false);
  const loadRecs = () => api.get('/events/for-you?size=9').then(setRecs);
  useEffect(() => {
    api.get('/me/interests').then((r) => {
      const s = Object.fromEntries(r.intereses.map((i) => [i.id_categoria, nearestLevel(i.nivel_interes)]));
      setSel(s);
      setSaved(JSON.stringify(s));
    });
    loadRecs();
  }, []);
  const dirty = useMemo(() => JSON.stringify(sel) !== saved, [sel, saved]);
  const toggle = (id) => setSel((s) => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = 3; return n; });
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/me/interests', { intereses: Object.entries(sel).map(([id_categoria, nivel_interes]) => ({ id_categoria: Number(id_categoria), nivel_interes })) });
      setSaved(JSON.stringify(sel));
      toast('Preferencias guardadas. Actualizamos tus recomendaciones.');
      setRecs(null);
      loadRecs();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const count = Object.keys(sel).length;
  return (
    <>
      <div className="page-head">
        <div><h1>¿Qué te gusta?</h1><p>Elige tus categorías favoritas y cuánto te interesan. Combinamos esto con tus visitas, favoritos y asistencias.</p></div>
        <span className="muted small">{count === 0 ? 'Ninguna elegida' : `${count} ${count === 1 ? 'categoría elegida' : 'categorías elegidas'}`}</span>
      </div>
      <div className="interest-grid">
        {categorias.map((c) => {
          const { Icon, color } = catStyle(c.nombre);
          const on = !!sel[c.id_categoria];
          return (
            <div key={c.id_categoria} className={`interest ${on ? 'on' : ''}`}>
              <button type="button" className="interest-toggle" aria-pressed={on} onClick={() => toggle(c.id_categoria)}>
                <span className="tick" aria-hidden="true">{on && <Check size={14} />}</span>
                <span className="cat-circle" style={{ width: 44, height: 44, color, background: `${color}14`, borderColor: `${color}30` }}><Icon size={21} /></span>
                <b>{c.nombre}</b>
                {!on && <span className="tiny muted">{c.descripcion}</span>}
              </button>
              {on && (
                <div className="level" role="radiogroup" aria-label={`Cuánto te interesa ${c.nombre}`}>
                  {LEVELS.map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={sel[c.id_categoria] === v} className={sel[c.id_categoria] === v ? 'on' : ''}
                      onClick={() => setSel((s) => ({ ...s, [c.id_categoria]: v }))}>{label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de guardado: aparece solo cuando hay cambios sin guardar */}
      {dirty && (
        <div className="save-bar" role="region" aria-label="Cambios sin guardar">
          <span>Tienes cambios sin guardar</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(JSON.parse(saved))} disabled={saving}>Descartar</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>Guardar preferencias</button>
        </div>
      )}

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
