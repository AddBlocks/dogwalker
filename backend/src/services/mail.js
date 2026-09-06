import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function enviarCorreo({ to, subject, text, html }) {
  if (!to) return { ok: false, skipped: true };
  if (!smtpConfigured()) {
    console.warn(`[Patitas] SMTP no configurado. Correo a ${to}: ${subject}\n${text}`);
    return { ok: true, mock: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Patitas <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: html || `<pre>${text}</pre>`,
  });
  return { ok: true };
}
