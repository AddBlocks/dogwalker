import jwt from "jsonwebtoken";
import { db, lastId } from "../db.js";
import { enviarCorreo } from "./mail.js";
// import { enviarSms, enviarWhatsapp, telefonoE164 } from "./mensajes.js";

const SECRET = process.env.JWT_SECRET || "dev-paseopatitas";

const ROL = { dueno: "dueño", paseador: "paseador", admin: "admin" };

function frontUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

function adminDestinos() {
  const admin = db
    .prepare("SELECT email, telefono FROM users WHERE rol = 'admin' AND deleted_at IS NULL ORDER BY id LIMIT 1")
    .get();
  return {
    email: String(process.env.ADMIN_NOTIFY_EMAIL || "").trim() || admin?.email || null,
    // WhatsApp al admin desactivado (sin costo).
    // whatsapp: String(process.env.ADMIN_NOTIFY_WHATSAPP || "").trim() || telefonoE164(admin?.telefono) || null,
  };
}

export function crearAviso({ userId, tipo, texto, enlace }) {
  if (!userId || !texto) return null;
  const r = db
    .prepare("INSERT INTO avisos (user_id, tipo, texto, enlace) VALUES (?, ?, ?, ?)")
    .run(userId, tipo || "info", texto, enlace || null);
  return lastId(r);
}

/* Correo/SMS a clientes desactivado: los avisos van dentro de la app.
export function quiereCorreo(user) {
  return user?.notify_email !== 0 && user?.notify_email !== false;
}
export function quiereSms(user) {
  return Boolean(user?.notify_sms) && Boolean(telefonoE164(user?.telefono));
}
export async function avisarUsuario(user, { subject, text }) {
  if (!user) return;
  const jobs = [];
  if (quiereCorreo(user)) {
    jobs.push(enviarCorreo({ to: user.email, subject, text }).catch((e) => console.error("[Patitas] correo", e)));
  }
  if (quiereSms(user)) {
    jobs.push(enviarSms(user.telefono, text).catch((e) => console.error("[Patitas] sms", e)));
  }
  await Promise.all(jobs);
}
*/

export function tokenAprobarPaseador(userId) {
  return jwt.sign({ typ: "aprobar_paseador", uid: Number(userId) }, SECRET, { expiresIn: "7d" });
}

export function enlaceAprobarPaseador(userId) {
  const base = (process.env.API_PUBLIC_URL || frontUrl()).replace(/\/$/, "");
  return `${base}/api/auth/aprobar-paseador?token=${encodeURIComponent(tokenAprobarPaseador(userId))}`;
}

/** Correo al admin solo cuando un paseador necesita autorización. Incluye botón para aprobar. */
export async function avisarAdminNuevoRegistro(user, extra = {}) {
  if (user.rol !== "paseador") return;
  const dest = adminDestinos();
  const aprobar = enlaceAprobarPaseador(user.id);
  const panel = `${frontUrl()}/admin`;
  const edadTxt = extra.edad != null ? `${extra.edad} años` : "edad no leída";
  const menor = extra.edad != null && extra.edad < 18;
  const subject = `Patitas: autorizar paseador ${user.nombre}`;
  const lineas = [
    `Se registró el paseador ${user.nombre}.`,
    `Correo: ${user.email}`,
    `Celular: ${user.telefono || "no indicó"}`,
    `Edad (cédula): ${edadTxt}${extra.fecha_nacimiento ? ` · nacido/a ${extra.fecha_nacimiento}` : ""}`,
    menor ? "Es menor de 18: solo puede pasear razas no peligrosas. Debió adjuntar autorización de los padres." : "Mayor de 18.",
    `Aprobar ahora: ${aprobar}`,
    `Panel: ${panel}`,
  ];
  const text = lineas.join("\n");
  const html = `
    <div style="font-family:sans-serif;max-width:520px;line-height:1.45">
      <h2 style="color:#1B4332">Nuevo paseador para autorizar</h2>
      <p><strong>${user.nombre}</strong> se registró en Patitas.</p>
      <p>Correo: ${user.email}<br/>Celular: ${user.telefono || "no indicó"}<br/>Edad: ${edadTxt}</p>
      ${menor ? "<p>Menor de 18: autorización de padres adjunta. Solo razas no peligrosas.</p>" : ""}
      <p><a href="${aprobar}" style="display:inline-block;background:#1B4332;color:#F6F1E7;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Autorizar cuenta</a></p>
      <p style="font-size:12px;color:#555">O abrí el <a href="${panel}">panel administrador</a>.</p>
    </div>`;
  if (dest.email) {
    await enviarCorreo({ to: dest.email, subject, text, html }).catch((e) => console.error("[Patitas] correo admin", e));
  }
}

export function avisarSolicitudAPaseador({ walker, dueno, solicitud }) {
  if (!walker) return;
  crearAviso({
    userId: walker.id,
    tipo: "solicitud",
    texto: `${dueno.nombre} te pidió un paseo (${solicitud.horario}, ${solicitud.frecuencia}). Revisa tu bandeja.`,
    enlace: "/solicitudes",
  });
}

export function avisarMatch({ dueno, walker, solicitud }) {
  const horario = solicitud?.horario || "el horario acordado";
  if (dueno) {
    crearAviso({
      userId: dueno.id,
      tipo: "match",
      texto: `Hay match: ${walker.nombre} aceptó tu paseo (${horario}). Entrá a Solicitudes para coordinar.`,
      enlace: "/solicitudes",
    });
  }
  if (walker) {
    crearAviso({
      userId: walker.id,
      tipo: "match",
      texto: `Hay match con ${dueno.nombre} (${horario}). Entrá a Bandeja para el contacto y el recorrido.`,
      enlace: "/solicitudes",
    });
  }
}

/* Correo al cliente cuando lo autorizan: desactivado.
export async function avisarCuentaAutorizada(user) {
  await avisarUsuario(user, {
    subject: "Patitas: tu cuenta fue autorizada",
    text:
      user.rol === "paseador"
        ? "El administrador autorizó tu cuenta. Completa la verificación de identidad para aparecer en el mapa."
        : "El administrador autorizó tu cuenta. Ya podés entrar a Patitas.",
  });
}
*/
