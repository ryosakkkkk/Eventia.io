import { Camera, ExternalLink } from 'lucide-react';
import { useCredits } from '../lib/credits';
import { Loader } from '../components/ui';

// Atribución de las fotografías de los eventos de demostración (licencias Creative Commons)
export default function Credits() {
  const credits = useCredits();
  const list = Object.entries(credits);
  return (
    <div className="container section">
      <div className="page-head">
        <div>
          <h1>Créditos de fotografías</h1>
          <p>Las fotos de los eventos de ejemplo provienen de Flickr y Wikimedia Commons (vía Openverse) con licencias Creative Commons que permiten su uso citando a sus autores.</p>
        </div>
      </div>
      {!list.length ? <Loader /> : (
        <div className="ev-grid">
          {list.map(([slug, c]) => (
            <div key={slug} className="ev-card">
              <div className="ev-media"><img src={`/uploads/demo/fotos/${c.archivo}`} alt={c.titulo || ''} loading="lazy" /></div>
              <div className="card-pad stack" style={{ gap: 6 }}>
                <b className="clamp-2">{c.titulo || 'Sin título'}</b>
                <span className="small muted row" style={{ gap: 6 }}><Camera size={15} /> {c.autor}</span>
                <span className="row-wrap small" style={{ gap: 10 }}>
                  <a className="link" href={c.licencia_url} target="_blank" rel="noopener noreferrer">{c.licencia}</a>
                  {c.fuente && <a className="link row" style={{ gap: 4 }} href={c.fuente} target="_blank" rel="noopener noreferrer">Ver original <ExternalLink size={13} /></a>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
