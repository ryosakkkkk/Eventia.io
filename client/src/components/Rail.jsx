import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useReveal } from './ui';

// Fila deslizable de tarjetas: flechas, arrastre con el mouse, desvanecido en los bordes y entrada al hacer scroll.
// En pantallas táctiles se desliza con el dedo (scroll nativo con imán).
export function Rail({ title, subtitle, link, linkLabel = 'Ver todos', wide, children, icon }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [dragging, setDragging] = useState(false);
  const shown = useReveal(ref);

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

  // Arrastre solo con mouse; el dedo usa el desplazamiento nativo
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft };
    moved.current = false;
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const el = ref.current;
    const dx = e.clientX - drag.current.x;
    if (!moved.current && Math.abs(dx) > 6) {
      moved.current = true;
      // Sin desplazamiento suave ni imán mientras se arrastra (se aplica al instante, sin esperar a React)
      el.style.scrollBehavior = 'auto';
      el.style.scrollSnapType = 'none';
      setDragging(true);
    }
    if (moved.current) el.scrollLeft = drag.current.left - dx;
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    if (moved.current) {
      setDragging(false);
      const el = ref.current;
      // Al soltar, el imán vuelve a alinear la tarjeta más cercana con desplazamiento suave
      el.style.scrollBehavior = '';
      el.style.scrollSnapType = '';
    }
  };
  const onClickCapture = (e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } };

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
      <div className={`rail ${wide ? 'wide' : ''} ${dragging ? 'dragging' : ''} ${edges.start ? '' : 'fade-l'} ${edges.end ? '' : 'fade-r'} reveal ${shown ? 'in' : ''}`}
        ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}
        onClickCapture={onClickCapture} onDragStart={(e) => e.preventDefault()}>
        {children}
      </div>
    </section>
  );
}
