import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="container section">
      <EmptyState icon={MapPinOff} title="Página no encontrada" text="El enlace que seguiste no existe o fue movido."
        action={<Link to="/" className="btn btn-primary">Volver al inicio</Link>} />
    </div>
  );
}
