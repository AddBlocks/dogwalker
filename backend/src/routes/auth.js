import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { enviarCorreo } from "../services/mail.js";
import { db, lastId, publicUser } from "../db.js";
import { auth, signToken } from "../middleware/auth.js";
import { avisarAdminNuevoRegistro } from "../services/notificaciones.js";
import { writeEncrypted } from "../services/encryption.js";
import { leerFechaNacimiento, resolverEdad, validarEdadPaseador } from "../services/cedula.js";
import { uploadDir } from "./walkers.js";

const SECRET = process.env.JWT_SECRET || "dev-paseopatitas";

const uploadReg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

function maybeMultipart(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return uploadReg.fields([
      { name: "cedula_frente", maxCount: 1 },
      { name: "cedula_reverso", maxCount: 1 },
      { name: "selfie", maxCount: 1 },
      { name: "autorizacion_padres", maxCount: 1 },
    ])(req, res, next);
  }
  next();
}

export const authRouter = Router();

function cuentaPendiente() {
  return {
    error: "Tu cuenta está en revisión. El administrador debe autorizarla antes de que puedas entrar.",
    pendiente: true,
  };
}

authRouter.post("/registro", maybeMultipart, async (req, res) => {
  const { email, password, nombre, telefono, rol, consentimiento, fecha_nacimiento } = req.body || {};
  const okConsent = consentimiento === true || consentimiento === "true" || consentimiento === "on";
  if (!okConsent) {
    return res.status(400).json({
      error: "Tenís que aceptar el tratamiento de datos personales (Ley 21.719) para crear la cuenta.",
    });
  }
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: "Faltan correo, contraseña o nombre." });
  }
  if (!["dueno", "paseador"].includes(rol)) {
    return res.status(400).json({ error: "Elige si sos dueño o paseador." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });

  let edadInfo = { fecha_nacimiento: null, edad: null };
  const files = req.files || {};
  if (rol === "paseador") {
    if (!files.cedula_frente?.[0]) {
      return res.status(400).json({ error: "Los paseadores deben subir la foto frontal de la cédula." });
    }
    const ocrIso = await leerFechaNacimiento(files.cedula_frente[0].buffer);
    edadInfo = resolverEdad({ ocrIso, fechaFormulario: fecha_nacimiento });
    const v = validarEdadPaseador(edadInfo.edad);
    if (v.error) return res.status(400).json({ error: v.error });
    if (v.menor && !files.autorizacion_padres?.[0]) {
      return res.status(400).json({
        error: "Si tenés menos de 18 años, subí una autorización simple de tus padres para pasear razas no peligrosas.",
      });
    }
  }

  const autorizado = rol === "paseador" ? 0 : 1;
  const r = db
    .prepare(
      `INSERT INTO users (email, password_hash, nombre, telefono, rol, consentimiento_at, autorizado, notify_email, notify_sms)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 1, 0)`
    )
    .run(String(email).toLowerCase(), bcrypt.hashSync(password, 10), nombre.trim(), telefono || null, rol, autorizado);

  const userId = lastId(r);
  if (rol === "paseador") {
    const stamp = `${userId}-${Date.now()}`;
    const frente = writeEncrypted(uploadDir, `${stamp}-frente.bin`, files.cedula_frente[0].buffer);
    const reverso = files.cedula_reverso?.[0]
      ? writeEncrypted(uploadDir, `${stamp}-reverso.bin`, files.cedula_reverso[0].buffer)
      : null;
    const selfie = files.selfie?.[0] ? writeEncrypted(uploadDir, `${stamp}-selfie.bin`, files.selfie[0].buffer) : null;
    const authPadres = files.autorizacion_padres?.[0]
      ? writeEncrypted(uploadDir, `${stamp}-padres.bin`, files.autorizacion_padres[0].buffer)
      : null;
    db.prepare(
      `INSERT INTO paseadores (
         user_id, estado_verificacion, proveedor_verificacion,
         cedula_frente, cedula_reverso, selfie, autorizacion_padres,
         fecha_nacimiento, edad, solo_no_peligrosas
       ) VALUES (?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      process.env.VERIFY_PROVIDER || "mock",
      frente,
      reverso,
      selfie,
      authPadres,
      edadInfo.fecha_nacimiento,
      edadInfo.edad,
      edadInfo.edad < 18 ? 1 : 0
    );
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (rol === "paseador") {
    try {
      await avisarAdminNuevoRegistro(user, edadInfo);
    } catch (err) {
      console.error("[Patitas] no se pudo avisar al admin", err);
    }
    return res.status(201).json({
      pendiente: true,
      email: user.email,
      edad: edadInfo.edad,
      mensaje: "Recibimos tu registro. El administrador autoriza tu cuenta de paseador y te avisamos para entrar.",
    });
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get("/aprobar-paseador", (req, res) => {
  const pagina = (titulo, cuerpo) =>
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${titulo}</title>
     <body style="font-family:sans-serif;background:#F6F1E7;color:#1B1B1B;padding:2rem;max-width:32rem">
     <h1 style="color:#1B4332">${titulo}</h1><p>${cuerpo}</p></body></html>`;
  try {
    const payload = jwt.verify(String(req.query.token || ""), SECRET);
    if (payload.typ !== "aprobar_paseador") throw new Error("token");
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND rol = 'paseador' AND deleted_at IS NULL").get(payload.uid);
    if (!user) return res.status(404).send(pagina("No encontrado", "No encontramos esa cuenta de paseador."));
    db.prepare("UPDATE users SET autorizado = 1 WHERE id = ?").run(user.id);
    res.send(pagina("Cuenta autorizada", `${user.nombre} ya puede entrar a Patitas.`));
  } catch {
    res.status(400).send(pagina("Enlace inválido", "Este enlace no es válido o venció. Autorizá desde el panel."));
  }
});

function claveTemporalVigente(user, password) {
  if (!user?.temp_password_hash || !user.temp_password_expires_at) return false;
  if (new Date(user.temp_password_expires_at).getTime() < Date.now()) return false;
  return bcrypt.compareSync(password || "", user.temp_password_hash);
}

function generarClaveTemporal() {
  const raw = crypto.randomBytes(5).toString("base64url").replace(/[-_]/g, "A").slice(0, 8);
  return `Pp${raw}`;
}

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(String(email || "").toLowerCase());
  const claveOk = user?.password_hash && bcrypt.compareSync(password || "", user.password_hash);
  const temporalOk = Boolean(user && claveTemporalVigente(user, password));
  if (!user || (!claveOk && !temporalOk)) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  if (!user.autorizado) {
    return res.status(403).json(cuentaPendiente());
  }
  if (temporalOk) {
    db.prepare("UPDATE users SET debe_cambiar_clave = 1 WHERE id = ?").run(user.id);
    user.debe_cambiar_clave = 1;
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post("/recuperar", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const generico = {
    ok: true,
    mensaje: "Si ese correo está en Patitas, te enviamos una clave temporal. Vale 5 minutos.",
  };
  if (!email || !email.includes("@")) return res.json(generico);
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(email);
  if (!user) return res.json(generico);
  const clave = generarClaveTemporal();
  const expira = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(
    `UPDATE users SET temp_password_hash = ?, temp_password_expires_at = ?, debe_cambiar_clave = 1 WHERE id = ?`
  ).run(bcrypt.hashSync(clave, 10), expira, user.id);
  const text = [
    `Hola ${user.nombre},`,
    `Tu clave temporal de Patitas es: ${clave}`,
    "Vale 5 minutos. Entrá con ella y cambiala apenas ingreses.",
  ].join("\n");
  await enviarCorreo({
    to: user.email,
    subject: "Patitas: tu clave temporal",
    text,
    html: `<div style="font-family:sans-serif;max-width:480px"><p>Hola ${user.nombre},</p><p>Tu clave temporal es:</p><p style="font-size:22px;font-weight:700;letter-spacing:1px">${clave}</p><p>Vale 5 minutos. Entrá con ella y cambiala apenas ingreses.</p></div>`,
  }).catch((e) => console.error("[Patitas] correo recuperar", e));
  res.json(generico);
});

authRouter.post("/cambiar-clave", auth(true), (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres." });
  }
  db.prepare(
    `UPDATE users SET password_hash = ?, temp_password_hash = NULL, temp_password_expires_at = NULL, debe_cambiar_clave = 0 WHERE id = ?`
  ).run(bcrypt.hashSync(password, 10), req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
});

authRouter.get("/me", auth(true), (req, res) => {
  let paseador = null;
  if (req.user.rol === "paseador") {
    paseador = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(req.user.id);
    if (paseador) {
      paseador = {
        id: paseador.id,
        descripcion: paseador.descripcion,
        precio_clp: paseador.precio_clp,
        disponibilidad: paseador.disponibilidad,
        destacado: !!paseador.destacado,
        estado_verificacion: paseador.estado_verificacion,
        fecha_nacimiento: paseador.fecha_nacimiento,
        edad: paseador.edad,
        solo_no_peligrosas: Boolean(paseador.solo_no_peligrosas),
        direccion_privada: paseador.direccion_privada,
        radio_km: paseador.radio_km,
        tiene_zona: Boolean(paseador.lat && paseador.lng && paseador.radio_km),
        banco: paseador.banco,
        tipo_cuenta: paseador.tipo_cuenta,
        numero_cuenta: paseador.numero_cuenta,
        titular: paseador.titular,
        rut_titular: paseador.rut_titular,
        email_transferencia: paseador.email_transferencia,
        pago_momento: paseador.pago_momento,
        monto_anticipado_clp: paseador.monto_anticipado_clp,
        docs: {
          cedula_frente: Boolean(paseador.cedula_frente),
          cedula_reverso: Boolean(paseador.cedula_reverso),
          selfie: Boolean(paseador.selfie),
          autorizacion_padres: Boolean(paseador.autorizacion_padres),
        },
        calles: (() => {
          try {
            const raw = JSON.parse(paseador.calles_json || "[]");
            const arr = Array.isArray(raw) ? raw : raw.calles || [];
            return arr.map((c) => (typeof c === "string" ? c : c.nombre)).filter(Boolean);
          } catch {
            return [];
          }
        })(),
      };
    }
  }
  res.json({ user: publicUser(req.user), paseador, googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID) });
});

authRouter.get("/google/url", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(501).json({ error: "Google no está configurado en este servidor." });
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  res.json({ url: url.toString() });
});

authRouter.get("/google/callback", async (req, res) => {
  const front = process.env.FRONTEND_URL || "http://localhost:5173";
  try {
    const code = req.query.code;
    if (!code) throw new Error("Sin código");
    const body = new URLSearchParams({
      code: String(code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then((r) => r.json());
    if (!tok.id_token) throw new Error("Google no devolvió token");
    const payload = JSON.parse(Buffer.from(tok.id_token.split(".")[1], "base64").toString());
    const email = String(payload.email).toLowerCase();
    let user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(email);
    if (!user) {
      const r = db
        .prepare(
          `INSERT INTO users (email, google_id, nombre, rol, consentimiento_at, avatar_url, autorizado, notify_email, notify_sms)
           VALUES (?, ?, ?, 'dueno', datetime('now'), ?, 1, 1, 0)`
        )
        .run(email, payload.sub, payload.name || email.split("@")[0], payload.picture || null);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(lastId(r));
    }
    if (!user.google_id) {
      db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(payload.sub, user.id);
    }
    if (!user.autorizado) {
      return res.redirect(`${front}/login?pendiente=1`);
    }
    const token = signToken(user);
    res.redirect(`${front}/login?google_token=${encodeURIComponent(token)}`);
  } catch {
    res.redirect(`${front}/login?error=google`);
  }
});
