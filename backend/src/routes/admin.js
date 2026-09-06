import { Router } from "express";
import fs from "node:fs";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { scheduleIdPurge } from "../services/retention.js";
import { decryptBuffer } from "../services/encryption.js";
import { eliminarCuenta } from "../services/cuentas.js";
import { autorizarBorrado, getHistorico, listarPendientes, listarPendientesDe } from "../services/documentos.js";
// import { avisarCuentaAutorizada } from "../services/notificaciones.js";

export const adminRouter = Router();
adminRouter.use(auth(true), requireRol("admin"));

adminRouter.get("/paseadores", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.nombre, u.email, u.telefono, u.calificacion_promedio
       FROM paseadores p JOIN users u ON u.id = p.user_id
       WHERE u.deleted_at IS NULL
       ORDER BY CASE p.estado_verificacion WHEN 'pendiente' THEN 0 ELSE 1 END, p.created_at DESC`
    )
    .all()
    .map((p) => ({
      ...p,
      destacado: !!p.destacado,
      tiene_documentos: Boolean(p.cedula_frente || p.cedula_reverso || p.selfie || p.autorizacion_padres),
      docs_viejos: listarPendientesDe(p.id),
      docs: {
        cedula_frente: Boolean(p.cedula_frente),
        cedula_reverso: Boolean(p.cedula_reverso),
        selfie: Boolean(p.selfie),
        autorizacion_padres: Boolean(p.autorizacion_padres),
      },
      autorizacion_padres: undefined,
      direccion_privada: undefined,
      lat: undefined,
      lng: undefined,
      calles_json: undefined,
      numero_cuenta: undefined,
      rut_titular: undefined,
      radio_km: p.radio_km,
      cedula_frente: undefined,
      cedula_reverso: undefined,
      selfie: undefined,
    }));
  res.json(rows);
});

adminRouter.get("/paseadores/:id/documento/:tipo", (req, res) => {
  const col = { cedula_frente: "cedula_frente", cedula_reverso: "cedula_reverso", selfie: "selfie", autorizacion_padres: "autorizacion_padres" }[req.params.tipo];
  if (!col) return res.status(400).json({ error: "Tipo de documento inválido." });
  const p = db.prepare("SELECT * FROM paseadores WHERE id = ?").get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "Paseador no encontrado." });
  const filePath = p[col];
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "Ese documento no está disponible. Puede haber sido reemplazado; el anterior espera autorización para borrar.",
    });
  }
  try {
    const buf = decryptBuffer(fs.readFileSync(filePath));
    const pdf = buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF";
    res.setHeader("Content-Type", pdf ? "application/pdf" : sniffImage(buf));
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "No se pudo abrir el documento cifrado." });
  }
});

function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return "image/jpeg";
}

adminRouter.get("/documentos-historico", (_req, res) => {
  res.json(listarPendientes());
});

adminRouter.get("/documentos-historico/:id", (req, res) => {
  const row = getHistorico(req.params.id);
  if (!row || row.borrado_at) return res.status(404).json({ error: "Archivo no encontrado." });
  if (!fs.existsSync(row.file_path)) return res.status(404).json({ error: "El archivo ya no está en disco." });
  try {
    const buf = decryptBuffer(fs.readFileSync(row.file_path));
    const pdf = buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF";
    res.setHeader("Content-Type", pdf ? "application/pdf" : sniffImage(buf));
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "No se pudo abrir el documento cifrado." });
  }
});

adminRouter.post("/documentos-historico/:id/autorizar-borrado", (req, res) => {
  const result = autorizarBorrado(req.params.id, req.user.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminRouter.post("/paseadores/:id/aprobar", (req, res) => {
  const p = db.prepare("SELECT * FROM paseadores WHERE id = ?").get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "Paseador no encontrado." });
  db.prepare("UPDATE paseadores SET estado_verificacion = 'aprobado' WHERE id = ?").run(p.id);
  scheduleIdPurge(p.id);
  res.json({ ok: true });
});

adminRouter.post("/paseadores/:id/rechazar", (req, res) => {
  db.prepare("UPDATE paseadores SET estado_verificacion = 'rechazado' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post("/paseadores/:id/destacado", (req, res) => {
  const val = req.body?.destacado ? 1 : 0;
  db.prepare("UPDATE paseadores SET destacado = ? WHERE id = ?").run(val, Number(req.params.id));
  res.json({ ok: true, destacado: !!val });
});

adminRouter.get("/comercios", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT c.*, co.nombre AS comuna FROM comercios c
         JOIN comunas co ON co.id = c.comuna_id
         ORDER BY CASE c.estado WHEN 'pendiente' THEN 0 ELSE 1 END, c.created_at DESC`
      )
      .all()
  );
});

adminRouter.post("/comercios/:id/aprobar", (req, res) => {
  db.prepare("UPDATE comercios SET estado = 'aprobado' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post("/comercios/:id/rechazar", (req, res) => {
  db.prepare("UPDATE comercios SET estado = 'rechazado' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post("/comercios/:id/destacado", (req, res) => {
  const val = req.body?.destacado ? 1 : 0;
  db.prepare("UPDATE comercios SET destacado = ? WHERE id = ?").run(val, Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.get("/anuncios", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, c.nombre AS comuna
       FROM anuncios a LEFT JOIN comunas c ON c.id = a.comuna_id
       ORDER BY a.created_at DESC`
    )
    .all();
  res.json(rows);
});

adminRouter.post("/anuncios", (req, res) => {
  const {
    titulo,
    texto,
    imagen_url,
    enlace,
    ubicacion,
    comuna_id,
    segmento,
    fecha_inicio,
    fecha_fin,
    activo,
  } = req.body || {};
  const lugares = ["banner_mapa", "tarjeta_busqueda", "superior_directorio"];
  if (!titulo || !lugares.includes(ubicacion) || !segmento || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: "Faltan datos del anuncio." });
  }
  const r = db
    .prepare(
      `INSERT INTO anuncios (titulo, texto, imagen_url, enlace, ubicacion, comuna_id, segmento, fecha_inicio, fecha_fin, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      titulo,
      texto || null,
      imagen_url || null,
      enlace || null,
      ubicacion,
      comuna_id || null,
      segmento,
      fecha_inicio,
      fecha_fin,
      activo === false ? 0 : 1
    );
  res.status(201).json({ id: lastId(r) });
});

adminRouter.put("/anuncios/:id", (req, res) => {
  const a = db.prepare("SELECT * FROM anuncios WHERE id = ?").get(Number(req.params.id));
  if (!a) return res.status(404).json({ error: "Anuncio no existe." });
  const next = { ...a, ...req.body };
  db.prepare(
    `UPDATE anuncios SET titulo=?, texto=?, imagen_url=?, enlace=?, ubicacion=?, comuna_id=?,
      segmento=?, fecha_inicio=?, fecha_fin=?, activo=? WHERE id=?`
  ).run(
    next.titulo,
    next.texto,
    next.imagen_url,
    next.enlace,
    next.ubicacion,
    next.comuna_id || null,
    next.segmento,
    next.fecha_inicio,
    next.fecha_fin,
    next.activo ? 1 : 0,
    a.id
  );
  res.json({ ok: true });
});

adminRouter.get("/usuarios", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.nombre, u.telefono, u.rol, u.created_at, u.calificacion_promedio, u.autorizado,
              p.id AS paseador_id, p.estado_verificacion, p.edad, p.solo_no_peligrosas
       FROM users u
       LEFT JOIN paseadores p ON p.user_id = u.id
       WHERE u.deleted_at IS NULL AND u.rol IN ('dueno','paseador')
       ORDER BY u.autorizado ASC, u.created_at DESC`
    )
    .all();
  res.json(rows);
});

adminRouter.post("/usuarios/:id/autorizar", async (req, res) => {
  const u = db
    .prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL AND rol IN ('dueno','paseador')")
    .get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: "Usuario no encontrado." });
  if (u.rol !== "paseador") {
    return res.status(400).json({ error: "Solo los paseadores requieren autorización." });
  }
  db.prepare("UPDATE users SET autorizado = 1 WHERE id = ?").run(u.id);
  // const next = db.prepare("SELECT * FROM users WHERE id = ?").get(u.id);
  // await avisarCuentaAutorizada(next);
  res.json({ ok: true });
});

adminRouter.delete("/usuarios/:id", (req, res) => {
  try {
    const result = eliminarCuenta(req.params.id, { actorId: req.user.id });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar el usuario." });
  }
});

adminRouter.get("/metricas", (_req, res) => {
  const users = db.prepare("SELECT rol, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY rol").all();
  const paseos = db.prepare("SELECT estado, COUNT(*) AS n FROM paseos GROUP BY estado").all();
  const ads = db.prepare("SELECT SUM(impresiones) AS impresiones, SUM(clics) AS clics FROM anuncios").get();
  res.json({ users, paseos, ads });
});
