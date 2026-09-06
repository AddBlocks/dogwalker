import { db, lastId } from "../db.js";
import { enviarCorreo } from "./mail.js";
// import { enviarSms, enviarWhatsapp, telefonoE164 } from "./mensajes.js";

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

/** Solo correo gratis al administrador cuando hay un registro por autorizar. */
export async function avisarAdminNuevoRegistro(user) {
  const dest = adminDestinos();
  const rol = ROL[user.rol] || user.rol;
  const panel = `${frontUrl()}/admin`;
  const subject = `Patitas: nuevo ${rol} para autorizar`;
  const text = [
    `Se registró ${user.nombre} (${rol}).`,
    `Correo: ${user.email}`,
    `Celular: ${user.telefono || "no indicó"}`,
    user.rol === "paseador" ? "Es paseador: además revisa cédula y selfie." : "Es dueño: autoriza la cuenta para que pueda entrar.",
    `Panel: ${panel}`,
  ].join("\n");
  if (dest.email) {
    await enviarCorreo({ to: dest.email, subject, text }).catch((e) => console.error("[Patitas] correo admin", e));
  }
  // if (dest.whatsapp) {
  //   await enviarWhatsapp(dest.whatsapp, text).catch((e) => console.error("[Patitas] whatsapp admin", e));
  // }
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
