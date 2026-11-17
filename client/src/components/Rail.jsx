import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

// Fila deslizable de tarjetas con flechas (estilo Ticketmaster). En móvil se desliza con el dedo.
export function Rail({ title, subtitle, link, linkLabel = 'Ver todos', wide, children, icon }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update, children]);
  const move = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.92, behavior: 'smooth' });
  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <h2>{icon}{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="row" style={{ gap: 16 }}>
          {link && <Link to={link} className="see-all">{linkLabel} <ArrowRight size={17} /></Link>}
          <div className="rail-arrows">
            <button onClick={() => move(-1)} disabled={edges.start} aria-label="Anterior"><ArrowLeft size={20} /></button>
            <button onClick={() => move(1)} disabled={edges.end} aria-label="Siguiente"><ArrowRight size={20} /></button>
          </div>
        </div>
      </div>
      <div className={`rail ${wide ? 'wide' : ''}`} ref={ref}>{children}</div>
    </section>
  );
}
