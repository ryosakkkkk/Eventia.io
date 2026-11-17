// Servidor local de Eventia (en Vercel se usa api/index.js)
const app = require('./app');
const jobs = require('./jobs');

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Eventia API escuchando en http://localhost:${port}`);
  jobs.start();
});
