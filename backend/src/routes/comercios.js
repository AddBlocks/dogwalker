import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth } from "../middleware/auth.js";

export const comerciosRouter = Router();

comerciosRouter.get("/", (req, res) => {
  const comunaId = req.query.comuna ? Number(req.query.comuna) : null;
  const categoria = req.query.categoria || null;
  let sql = `
    SELECT c.*, co.nombre AS comuna,
      (SELECT AVG(puntaje) FROM comercio_resenas r WHERE r.comercio_id = c.id) AS calificacion,
      (SELECT COUNT(*) FROM comercio_resenas r WHERE r.comercio_id = c.id) AS cantidad_resenas
    FROM comercios c
    JOIN comunas co ON co.id = c.comuna_id
    WHERE c.estado = 'aprobado'
  `;
  const params = [];
  if (comunaId) {
    sql += " AND c.comuna_id = ?";
    params.push(comunaId);
  }
  if (categoria) {
    sql += " AND c.categoria = ?";
    params.push(categoria);
  }
  sql += " ORDER BY c.destacado DESC, calificacion DESC";
  res.json(
    db.prepare(sql).all(...params).map((r) => ({
      ...r,
      destacado: !!r.destacado,
      calificacion: r.calificacion ? Math.round(r.calificacion * 10) / 10 : 0,
    }))
  );
});

comerciosRouter.get("/:id", (req, res) => {
  const c = db
    .prepare(
      `SELECT c.*, co.nombre AS comuna,
        (SELECT AVG(puntaje) FROM comercio_resenas r WHERE r.comercio_id = c.id) AS calificacion,
        (SELECT COUNT(*) FROM comercio_resenas r WHERE r.comercio_id = c.id) AS cantidad_resenas
       FROM comercios c JOIN comunas co ON co.id = c.comuna_id
       WHERE c.id = ? AND c.estado = 'aprobado'`
    )
    .get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "Comercio no encontrado." });
  const resenas = db
    .prepare(
      `SELECT r.puntaje, r.comentario, r.created_at, u.nombre
       FROM comercio_resenas r JOIN users u ON u.id = r.user_id
       WHERE r.comercio_id = ? ORDER BY r.created_at DESC`
    )
    .all(c.id);
  res.json({
    ...c,
    destacado: !!c.destacado,
    calificacion: c.calificacion ? Math.round(c.calificacion * 10) / 10 : 0,
    resenas,
  });
});

comerciosRouter.post("/", auth(true), (req, res) => {
  const { nombre, categoria, comuna_id, direccion, telefono, horario } = req.body || {};
  const cats = ["veterinaria", "peluqueria", "tienda", "adiestrador"];
  if (!nombre || !cats.includes(categoria) || !comuna_id) {
    return res.status(400).json({ error: "Indica nombre, rubro y comuna." });
  }
  const r = db
    .prepare(
      `INSERT INTO comercios (nombre, categoria, comuna_id, direccion, telefono, horario, estado, sugerido_por)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`
    )
    .run(nombre, categoria, Number(comuna_id), direccion || null, telefono || null, horario || null, req.user.id);
  res.status(201).json({ id: lastId(r), estado: "pendiente" });
});

comerciosRouter.post("/:id/resenas", auth(true), (req, res) => {
  const { puntaje, comentario } = req.body || {};
  const n = Number(puntaje);
  if (n < 1 || n > 5) return res.status(400).json({ error: "El puntaje va de 1 a 5." });
  const c = db.prepare("SELECT id FROM comercios WHERE id = ? AND estado = 'aprobado'").get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "Comercio no disponible." });
  db.prepare("INSERT INTO comercio_resenas (comercio_id, user_id, puntaje, comentario) VALUES (?, ?, ?, ?)").run(
    c.id,
    req.user.id,
    n,
    comentario || null
  );
  res.status(201).json({ ok: true });
});
