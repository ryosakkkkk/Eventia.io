const nodemailer = require('nodemailer');

let transporter = null;
const smtpConfigured = () => Boolean(process.env.SMTP_HOST);

function getTransporter() {
  if (!transporter && smtpConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const wrap = (title, body) => `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f5f7fb">
  <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e5eaf2">
    <h2 style="margin:0 0 12px;color:#0b1d35">${title}</h2>
    <div style="color:#36435a;font-size:15px;line-height:1.6">${body}</div>
  </div>
  <p style="color:#8a94a8;font-size:12px;text-align:center">Eventia · Descubre · Conecta · Vive</p>
</div>`;

/**
 * Envía un correo. Si no hay SMTP configurado (modo desarrollo) se registra en consola.
 * Devuelve { ok, error, simulated }.
 */
async function sendMail(to, subject, title, htmlBody) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[correo simulado] Para: ${to}\nAsunto: ${subject}\n${htmlBody.replace(/<[^>]+>/g, '')}\n`);
    return { ok: true, simulated: true };
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html: wrap(title, htmlBody) });
    return { ok: true };
  } catch (err) {
    console.error('[correo] Error de envío:', err.message);
    return { ok: false, error: err.message };
  }
}

async function sendCode(to, code, motivo) {
  const titles = {
    registro: 'Verifica tu correo',
    publicacion: 'Código para publicar tu evento',
  };
  return sendMail(
    to,
    `${code} es tu código de Eventia`,
    titles[motivo] || 'Tu código de verificación',
    `<p>Tu código de verificación es:</p>
     <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#2f4fe0">${code}</p>
     <p>Vence en 15 minutos. Si no solicitaste este código, ignora este mensaje.</p>`
  );
}

module.exports = { sendMail, sendCode, smtpConfigured };
