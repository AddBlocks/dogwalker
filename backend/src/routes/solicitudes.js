import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";

export const solicitudesRouter = Router();

solicitudesRouter.post("/", auth(true), requireRol("dueno"), (req, res) => {
  const { paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje } = req.body || {};
  if (!comuna_id || !horario || !frecuencia || !monto_clp) {
    return res.status(400).json({ error: "Completa comuna, horario, frecuencia y monto." });
  }
  if (paseador_id) {
    const walker = db
      .prepare(
        `SELECT p.id FROM paseadores p JOIN users u ON u.id = p.user_id
         WHERE u.id = ? AND p.estado_verificacion = 'aprobado'`
      )
      .get(Number(paseador_id));
    if (!walker) return res.status(404).json({ error: "Ese paseador no está disponible." });
  }
  const estado = paseador_id ? "pendiente" : "abierta";
  const r = db
    .prepare(
      `INSERT INTO solicitudes (dueno_id, paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      paseador_id ? Number(paseador_id) : null,
      Number(comuna_id),
      horario,
      frecuencia,
      Number(monto_clp),
      mensaje || null,
      estado
    );
  res.status(201).json({ id: lastId(r), estado });
});

solicitudesRouter.get("/mias", auth(true), (req, res) => {
  if (req.user.rol === "dueno") {
    const rows = db
      .prepare(
        `SELECT s.*, c.nombre AS comuna, u.nombre AS paseador_nombre, u.telefono AS paseador_telefono,
                (SELECT id FROM paseos WHERE solicitud_id = s.id ORDER BY id DESC LIMIT 1) AS paseo_id
         FROM solicitudes s
         JOIN comunas c ON c.id = s.comuna_id
         LEFT JOIN users u ON u.id = s.paseador_id
         WHERE s.dueno_id = ?
         ORDER BY s.created_at DESC`
      )
      .all(req.user.id)
      .map((s) => ({
        ...s,
        paseador_telefono: s.estado === "aceptada" ? s.paseador_telefono : null,
      }));
    return res.json(rows);
  }
  if (req.user.rol === "paseador") {
    const rows = db
      .prepare(
        `SELECT s.*, c.nombre AS comuna, d.nombre AS dueno_nombre, d.telefono AS dueno_telefono,
                (SELECT id FROM paseos WHERE solicitud_id = s.id ORDER BY id DESC LIMIT 1) AS paseo_id
         FROM solicitudes s
         JOIN comunas c ON c.id = s.comuna_id
         JOIN users d ON d.id = s.dueno_id
         WHERE s.paseador_id = ? OR (s.estado = 'abierta' AND s.comuna_id IN (
           SELECT pc.comuna_id FROM paseador_comunas pc
           JOIN paseadores p ON p.id = pc.paseador_id
           WHERE p.user_id = ? AND p.estado_verificacion = 'aprobado'
         ))
         ORDER BY CASE s.estado WHEN 'pendiente' THEN 0 WHEN 'abierta' THEN 1 ELSE 2 END, s.created_at DESC`
      )
      .all(req.user.id, req.user.id)
      .map((s) => ({
        ...s,
        dueno_telefono: s.estado === "aceptada" && s.paseador_id === req.user.id ? s.dueno_telefono : null,
      }));
    return res.json(rows);
  }
  res.json([]);
});

solicitudesRouter.post("/:id/aceptar", auth(true), requireRol("paseador"), (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ?").get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "Solicitud no existe." });
  if (s.estado !== "pendiente" && s.estado !== "abierta") {
    return res.status(400).json({ error: "Esta solicitud ya no se puede aceptar." });
  }
  if (s.paseador_id && s.paseador_id !== req.user.id) {
    return res.status(403).json({ error: "Esta solicitud es para otro paseador." });
  }
  const walkerOk = db
    .prepare("SELECT id FROM paseadores WHERE user_id = ? AND estado_verificacion = 'aprobado'")
    .get(req.user.id);
  if (!walkerOk) return res.status(403).json({ error: "Tu perfil aún no está aprobado." });

  db.prepare(
    `UPDATE solicitudes SET estado = 'aceptada', paseador_id = ?, responded_at = datetime('now') WHERE id = ?`
  ).run(req.user.id, s.id);

  const fecha = new Date().toISOString().slice(0, 10);
  const paseo = db
    .prepare(
      `INSERT INTO paseos (solicitud_id, dueno_id, paseador_id, comuna_id, fecha, monto_clp, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'acordado')`
    )
    .run(s.id, s.dueno_id, req.user.id, s.comuna_id, fecha, s.monto_clp);

  const dueno = db.prepare("SELECT telefono, nombre FROM users WHERE id = ?").get(s.dueno_id);
  res.json({
    ok: true,
    paseo_id: lastId(paseo),
    telefonos: { dueno: dueno.telefono, paseador: req.user.telefono },
    nombres: { dueno: dueno.nombre, paseador: req.user.nombre },
  });
});

solicitudesRouter.post("/:id/rechazar", auth(true), requireRol("paseador"), (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ?").get(Number(req.params.id));
  if (!s || (s.paseador_id && s.paseador_id !== req.user.id)) {
    return res.status(404).json({ error: "Solicitud no disponible." });
  }
  if (s.estado !== "pendiente") return res.status(400).json({ error: "Solo se pueden rechazar solicitudes pendientes." });
  db.prepare(`UPDATE solicitudes SET estado = 'rechazada', responded_at = datetime('now') WHERE id = ?`).run(s.id);
  res.json({ ok: true });
});

solicitudesRouter.post("/:id/cancelar", auth(true), requireRol("dueno"), (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ? AND dueno_id = ?").get(Number(req.params.id), req.user.id);
  if (!s) return res.status(404).json({ error: "Solicitud no encontrada." });
  if (!["abierta", "pendiente"].includes(s.estado)) {
    return res.status(400).json({ error: "Ya no se puede cancelar." });
  }
  db.prepare("UPDATE solicitudes SET estado = 'cancelada' WHERE id = ?").run(s.id);
  res.json({ ok: true });
});
