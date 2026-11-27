# Eventia · Descubre · Conecta · Vive

Plataforma web para publicar, descubrir y promocionar eventos de **Abancay (Apurímac)**, construida según el documento de
requerimientos (44 RF, 20 RNF, 28 HU), las reglas de negocio RN01–RN20 y el esquema SQL Server `EventiaDB` (13 tablas).

## Arquitectura

| Capa | Tecnología | Carpeta |
|---|---|---|
| Base de datos | Microsoft SQL Server Express (`.\SQLEXPRESS01`), script original sin cambios | `database/01_schema.sql` |
| Backend / API REST | Node.js 22 + Express 5, driver ODBC (`msnodesqlv8`) con autenticación de Windows | `server/` |
| Frontend | React 18 + Vite, React Router, Leaflet (OpenStreetMap), Recharts, Lucide | `client/` |

> Se usa ODBC con autenticación de Windows porque en este equipo SQL Server tiene TCP/IP desactivado y solo
> autenticación integrada; así funciona sin tocar la configuración del servidor. La cadena de conexión está en `server/.env`.

En producción, Express sirve la interfaz compilada (`client/dist`) y la API en el mismo puerto (`http://localhost:4000`).

## Puesta en marcha

1. **Primera vez:** doble clic en `instalar.bat` (crea `EventiaDB` si no existe, instala dependencias, carga datos de demo y compila).
2. **Uso diario:** doble clic en `iniciar.bat` → abre `http://localhost:4000`.

Modo desarrollo (recarga en caliente): `cd server && npm run dev` y, en otra terminal, `cd client && npm run dev` → `http://localhost:5173`.

### Cuentas de prueba
Las contraseñas están en `server/.env` (no se escriben en el código):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@eventia.local` | `ADMIN_PASSWORD` |
| Organizador | `organizador@eventia.local` | `DEMO_PASSWORD` |
| Usuario | `usuario@eventia.local` | `DEMO_PASSWORD` |

Regenerar datos de demostración: `cd server && npm run seed -- --reset` (conserva las categorías).

### Fotos de los eventos de ejemplo
Las 23 fotos de `server/uploads/demo/fotos/` son reales, obtenidas de Flickr mediante Openverse con licencias
**CC BY / CC BY-SA**, que permiten usarlas citando al autor. Cada evento muestra su crédito bajo la foto y la página
`/creditos` (enlace en el pie de página) lista autor, licencia y enlace al original; los datos están en
`server/uploads/demo/fotos/creditos.json`. Son imágenes ilustrativas: no corresponden a los eventos reales de Abancay.
Para usar fotos propias, reemplaza el archivo `.jpg` con el mismo nombre o sube la imagen desde el formulario del evento.

### Correo electrónico
Si `SMTP_HOST` está vacío (modo desarrollo), los códigos de verificación se muestran en pantalla y en la consola del servidor.
Para enviar correos reales, completa `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` en `server/.env`.

## Diseño UX/UI (investigación de competencia)
Se analizaron Ticketmaster, Joinnus, Eventbrite, Fever, Teleticket, AllEvents, Luma y Meetup. Patrones adoptados:

- **Escala amplia estilo Ticketmaster**: tipografía base de 16 px, contenedor de hasta 1400 px (1560 px en pantallas grandes),
  botones de 48–58 px, campos de 52 px y tarjetas con imágenes grandes.
- **Láminas destacadas** que pasan solas (6,5 s) con transición deslizante, barra de progreso, flechas, pausa, puntos,
  gesto de deslizar con el dedo y columna de miniaturas; el fondo de la portada toma el color de la lámina activa.
- **Filas deslizables** (“Top 10”, “Esta semana”, categorías) con títulos en mayúsculas, barra de acento y flechas ← →.
- En **celular**: láminas con la imagen completa arriba y los datos abajo, buscador compacto debajo, tarjetas a todo el
  ancho, carruseles que se deslizan con el dedo, barra inferior con botón “Publicar” destacado y modales tipo hoja inferior.

- Portada con carrusel de **destacados** (pausa, flechas, puntos) y **tarjeta de búsqueda** “¿Qué buscas? · Categoría · Cuándo · Dónde”.
- Fila circular de **categorías** con conteo de eventos y pestañas **Todo · Para ti · Hoy · Mañana · Fin de semana · Entrada libre**.
- **Tarjeta de evento** estándar: imagen 16:9, chip de fecha (mes/día/semana), corazón para guardar, insignias de urgencia
  (Hoy, Últimos cupos, Agotado, Entrada libre), prueba social (“N asistirán”) y valoración.
- **Top 10 de la semana** con números grandes (estilo Fever/Joinnus).
- **Detalle**: hero con fondo difuminado, bloque de fecha tipo calendario + “Agregar a Google Calendar / .ics”, ubicación con mapa y
  “Cómo llegar” (Google Maps/Waze), panel lateral fijo con **contador regresivo**, barra de cupos, “Asistiré”, Guardar,
  Compartir y **WhatsApp/Llamar**; en móvil, **barra inferior fija** con las acciones principales.
- **Explorar** con filtros laterales (cajón en móvil), chips de filtros activos y vistas **cuadrícula / lista / mapa**.
- **Publicación en 4 pasos** con **vista previa en vivo**, selector de ubicación en mapa y verificación por código.
- Paneles de organizador y administrador con barra lateral oscura (del prototipo), KPIs y gráficos.
- Estados vacíos con acción, esqueletos de carga, notificaciones tipo *toast*, diseño responsive y accesible.

## Cobertura de requisitos (resumen)

| Requisito | Dónde |
|---|---|
| RF01–RF05, RF39 | `GET /api/events` (búsqueda, categoría, fechas, ciudad, disponibilidad), Explorar, mapa |
| RF06, RF43 | Botones WhatsApp/Llamar/redes + registro de clics (`/interactions`) |
| RF07–RF09, RN01 | Registro, código de verificación (hash bcrypt, 15 min), login con cookie httpOnly |
| RF10, RF11, RF33, HU19 | Intereses con nivel 1–5 + puntuación por interacciones → sección **Para ti** |
| RF12, RF13 | Favoritos y “Asistiré” (únicos por usuario/evento) |
| RF14, RF34, RNF12, RN09 | Tarea automática cada 10 min: recordatorios 3 días y 24 h antes, sin duplicados |
| RF15–RF17, RN02 | Publicación con código por correo → `PENDIENTE_DE_VALIDACION`; el admin publica directo |
| RF18, RN03 | Edición solo del dueño (o admin); aviso a seguidores si cambia fecha/hora/lugar |
| RF19, RN04 | Eliminación definitiva solo por el administrador (con confirmación) |
| RF21–RF23, RN07–RN08 | Capacidad/entradas, sin negativos, agotado automático, medidor de cupos |
| RF24–RF26, RN05–RN06 | Archivo automático (FINALIZADO/ARCHIVADO), página de eventos pasados, visibilidad por admin |
| RF27, RNF18 | Notificaciones con estado `enviado`/`error_envio`/`fecha_envio` |
| RF28–RF30 | Gestión de usuarios, categorías y moderación (aprobar, rechazar con motivo, ocultar) |
| RF31 | Reporte de eventos con motivos y seguimiento de estado |
| RF32, HU18 | Estadísticas del admin filtrables por periodo |
| RF35, RF44, RN15 | Panel de marketing del organizador (solo sus eventos) |
| RF36 | Compartir: WhatsApp, Facebook, Telegram, X, correo, copiar enlace (registra COMPARTIDO) |
| RF37, RN16 | Código QR único por evento (`/api/events/:id/qr`), descarga PNG |
| RF38, RN17 | Destacados (solo publicados y vigentes) |
| RF40, RF41 | Calendario mensual y contador regresivo en vivo |
| RF42, RN18 | Valoraciones solo después del evento y para quien marcó “Asistiré” |
| RNF03–RNF06 | bcrypt, control de roles en API y UI, validación en backend, consultas parametrizadas |
| RNF14 | Auditoría de acciones (`auditorias`) visible en el panel |
| RNF19 | Deduplicación de vistas/clics por visitante y ventana de tiempo |

## Ramas del repositorio
- **`main`**: versión estable. Vercel la publica como **Producción**.
- **`develop`**: desarrollo diario. Cada `push` genera un despliegue de **Vista previa** (Preview) en Vercel.
  Cuando algo está probado en `develop`, se integra a `main` con un Pull Request.

## Despliegue en Vercel
Vercel ejecuta la API como una función serverless (`api/index.js`) y sirve la interfaz compilada (`client/dist`)
desde su CDN. Como Vercel **no puede conectarse al SQL Server de tu computadora**, necesitas un SQL Server en la nube
con el mismo esquema (recomendado: **Azure SQL Database**, que tiene una oferta gratuita).

**Sitio publicado:** https://eventia-abancay.vercel.app (Vercel Hobby + Azure SQL gratuito + Vercel Blob).

1. **Base de datos en la nube (Azure SQL, gratis):** crea un servidor y una base llamada `EventiaDB` con usuario y
   contraseña SQL, usando la **oferta gratuita** (100 000 s de vCore y 32 GB al mes) con pausa automática al agotarla,
   para que nunca haya cobros. Con Azure CLI:
   ```bash
   az sql db create -g <grupo> -s <servidor> -n EventiaDB --edition GeneralPurpose --compute-model Serverless \
     --family Gen5 --capacity 2 --use-free-limit true --free-limit-exhaustion-behavior AutoPause
   ```
   Con **Azure for Students** solo se permiten algunas regiones (consulta la directiva *Allowed resource deployment
   regions*) y no todas admiten la base gratuita: en este proyecto funcionó **Canada East**.
   En *Networking* agrega tu IP y permite el acceso desde Vercel (Vercel no tiene IP fija: se suele abrir
   `0.0.0.0 – 255.255.255.255`; usa una contraseña larga y robusta). La base gratuita se pausa tras 1 hora sin uso;
   la API reintenta la conexión mientras se reanuda, así que la primera visita después de una pausa tarda unos segundos.
2. **Crear tablas y datos (desde tu PC):** en `server/.env` completa `DB_SERVER`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`
   (al tener `DB_SERVER`, la app usa la nube en vez del SQL Server local) y ejecuta:
   ```bash
   cd server && npm run db:init && npm run seed
   ```
   Luego borra o comenta esas variables para volver a trabajar en local.
3. **Proyecto en Vercel:** *Add New → Project → Import* el repositorio de GitHub. Deja el directorio raíz en `./` y
   elige el preset **Other** (si Vercel sugiere *Services*, cámbialo): `vercel.json` ya define instalación,
   compilación, rutas, cabeceras de seguridad y la tarea diaria.
4. **Variables de entorno** (*Settings → Environment Variables*):
   | Variable | Valor |
   |---|---|
   | `JWT_SECRET` | Texto aleatorio largo |
   | `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Datos de Azure SQL (p. ej. `mi-servidor.database.windows.net`) |
   | `PUBLIC_URL` | `https://tu-proyecto.vercel.app` (para enlaces y códigos QR) |
   | `CRON_SECRET` | Texto aleatorio (protege `/api/cron`, la tarea diaria de archivo y recordatorios) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo real para los códigos de verificación |
   | `DEMO_MODE` | `true` solo si no tienes SMTP y quieres mostrar los códigos en pantalla (presentaciones) |
5. **Imágenes subidas:** en *Storage → Create → Blob* crea un almacén **público** y conéctalo al proyecto marcando
   *Add a read-write token env var* (agrega `BLOB_READ_WRITE_TOKEN`). Sin él, los eventos se ven pero no se pueden
   subir afiches nuevos.
6. Haz *Redeploy*. La rama `main` queda en producción y `develop` en vista previa.

> En Vercel el archivo automático de eventos pasados se ejecuta al recibir visitas (como máximo cada 15 min) y la
> tarea `/api/cron` corre una vez al día (límite del plan gratuito) para archivar y enviar recordatorios.

## Pruebas
Con el servidor iniciado: `cd server && node tests/smoke.js` (31 comprobaciones de API para usuario, organizador y administrador).

## Pendiente para producción
- Servir detrás de **HTTPS** (RNF02) — las cookies pasan a `secure` con `NODE_ENV=production`.
- Configurar SMTP real y respaldos periódicos de `EventiaDB` (RNF15) y fin.
