import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, lastId, publicUser } from "../db.js";
import { auth, signToken } from "../middleware/auth.js";
import { avisarAdminNuevoRegistro } from "../services/notificaciones.js";

export const authRouter = Router();

function cuentaPendiente() {
  return {
    error: "Tu cuenta está en revisión. El administrador debe autorizarla antes de que puedas entrar.",
    pendiente: true,
  };
}

authRouter.post("/registro", async (req, res) => {
  const { email, password, nombre, telefono, rol, consentimiento } = req.body || {};
  if (!consentimiento) {
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

  const r = db
    .prepare(
      `INSERT INTO users (email, password_hash, nombre, telefono, rol, consentimiento_at, autorizado, notify_email, notify_sms)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 0, 1, 0)`
    )
    .run(String(email).toLowerCase(), bcrypt.hashSync(password, 10), nombre.trim(), telefono || null, rol);

  if (rol === "paseador") {
    db.prepare("INSERT INTO paseadores (user_id, estado_verificacion, proveedor_verificacion) VALUES (?, 'pendiente', ?)")
      .run(lastId(r), process.env.VERIFY_PROVIDER || "mock");
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(lastId(r));
  try {
    await avisarAdminNuevoRegistro(user);
  } catch (err) {
    console.error("[Patitas] no se pudo avisar al admin", err);
  }
  res.status(201).json({
    pendiente: true,
    email: user.email,
    mensaje: "Recibimos tu registro. El administrador te autoriza y te avisamos para que puedas entrar.",
  });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(String(email || "").toLowerCase());
  if (!user || !user.password_hash || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  if (!user.autorizado) {
    return res.status(403).json(cuentaPendiente());
  }
  res.json({ token: signToken(user), user: publicUser(user) });
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
           VALUES (?, ?, ?, 'dueno', datetime('now'), ?, 0, 1, 0)`
        )
        .run(email, payload.sub, payload.name || email.split("@")[0], payload.picture || null);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(lastId(r));
      await avisarAdminNuevoRegistro(user);
      return res.redirect(`${front}/login?pendiente=1`);
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
