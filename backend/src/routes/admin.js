import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { scheduleIdPurge } from "../services/retention.js";

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
      tiene_documentos: Boolean(p.cedula_frente || p.cedula_reverso || p.selfie),
      cedula_frente: undefined,
      cedula_reverso: undefined,
      selfie: undefined,
    }));
  res.json(rows);
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

adminRouter.get("/metricas", (_req, res) => {
  const users = db.prepare("SELECT rol, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY rol").all();
  const paseos = db.prepare("SELECT estado, COUNT(*) AS n FROM paseos GROUP BY estado").all();
  const ads = db.prepare("SELECT SUM(impresiones) AS impresiones, SUM(clics) AS clics FROM anuncios").get();
  res.json({ users, paseos, ads });
});
