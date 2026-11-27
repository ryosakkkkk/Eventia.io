import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const ACTUALIZADO = '27 de noviembre de 2026';

// Política de privacidad y condiciones de uso. Google las exige para publicar "Continuar con Google"
// y el formulario de registro pide aceptarlas, así que deben existir y ser fáciles de leer.
const DOCS = {
  privacidad: {
    titulo: 'Política de privacidad',
    intro: 'Eventia es una plataforma académica para descubrir y publicar eventos de Abancay y Apurímac. Aquí explicamos qué datos usamos, para qué y cómo puedes pedir que se corrijan o eliminen, conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú.',
    secciones: [
      ['Qué datos guardamos', [
        'Tu nombre y correo electrónico, para crear y proteger tu cuenta.',
        'Tu contraseña, siempre cifrada: nadie del equipo puede leerla.',
        'Lo que haces en Eventia: eventos guardados, asistencias confirmadas, intereses, valoraciones y reportes.',
        'Si organizas eventos: los datos del evento y los medios de contacto que decidas publicar (WhatsApp, teléfono, redes).',
        'Estadísticas de visitas a cada evento, con un identificador anónimo del navegador, para que los organizadores vean el alcance de sus publicaciones.',
      ]],
      ['Inicio de sesión con Google', [
        'Si eliges «Continuar con Google», Google nos comparte solo tu nombre y tu correo verificado.',
        'No recibimos tu contraseña de Google ni accedemos a tu correo, contactos, archivos u otros datos de tu cuenta.',
        'Si ya tenías una cuenta de Eventia con el mismo correo, ambas formas de entrar llevan a la misma cuenta.',
      ]],
      ['Para qué los usamos', [
        'Para que inicies sesión, guardes eventos y recibas recordatorios y avisos de cambios.',
        'Para enviarte códigos de verificación y notificaciones por correo, que puedes desactivar en tu perfil.',
        'Para recomendarte eventos según tus intereses.',
        'No vendemos ni alquilamos tus datos, y no los usamos para publicidad de terceros.',
      ]],
      ['Dónde se guardan', [
        'La base de datos está en Microsoft Azure; el sitio y las imágenes, en Vercel; los correos se envían con Gmail.',
        'Usamos cookies solo para mantener tu sesión iniciada y para contar visitas de forma anónima.',
      ]],
      ['Tus derechos', [
        'Puedes ver y corregir tu nombre y tus preferencias desde tu perfil.',
        'Para pedir una copia de tus datos o la eliminación de tu cuenta, responde a cualquier correo que te haya enviado Eventia y atenderemos tu solicitud.',
      ]],
    ],
  },
  condiciones: {
    titulo: 'Condiciones de uso',
    intro: 'Al crear una cuenta o usar Eventia aceptas estas condiciones. Son breves a propósito: buscan que la información sobre eventos de la región sea útil y confiable para todos.',
    secciones: [
      ['Tu cuenta', [
        'La cuenta es personal. Cuida tu contraseña; si entras con Google, la seguridad depende de tu cuenta de Google.',
        'Debes usar datos reales. Podemos suspender cuentas que suplanten a otras personas u organizaciones.',
      ]],
      ['Publicar eventos', [
        'Los organizadores son responsables de que la fecha, el lugar, los precios y los datos de contacto sean correctos.',
        'Cada evento se revisa antes de publicarse y puede ser rechazado, ocultado o retirado si es falso, engañoso, ofensivo o ilegal.',
        'Solo sube imágenes que tengas derecho a usar.',
      ]],
      ['Entradas y pagos', [
        'Eventia no vende entradas ni procesa pagos. Cualquier compra o reserva se acuerda directamente con el organizador.',
      ]],
      ['Uso aceptable', [
        'No publiques spam, contenido discriminatorio o violento, ni intentes acceder a cuentas o datos ajenos.',
        'Puedes reportar cualquier evento desde su página; el equipo revisa cada reporte.',
      ]],
      ['El servicio', [
        'Eventia es un proyecto académico ofrecido tal como está; hacemos lo posible por mantenerlo disponible, pero puede tener interrupciones.',
        'Si cambiamos estas condiciones, publicaremos la nueva versión en esta página con su fecha.',
      ]],
    ],
  },
};

export default function Legal({ doc }) {
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.titulo} · Eventia`; }, [d.titulo]);
  const otro = doc === 'privacidad' ? ['/condiciones', 'Condiciones de uso'] : ['/privacidad', 'Política de privacidad'];
  return (
    <div className="container section legal">
      <div className="page-head">
        <div>
          <h1>{d.titulo}</h1>
          <p>{d.intro}</p>
        </div>
      </div>
      {d.secciones.map(([titulo, items]) => (
        <section key={titulo} className="legal-section">
          <h2>{titulo}</h2>
          <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      ))}
      <p className="small muted">Última actualización: {ACTUALIZADO}. Consulta también la <Link className="link" to={otro[0]}>{otro[1]}</Link>.</p>
    </div>
  );
}
