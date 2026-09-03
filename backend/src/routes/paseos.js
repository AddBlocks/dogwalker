import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";

export const paseosRouter = Router();

paseosRouter.get("/", auth(true), (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.nombre AS comuna, d.nombre AS dueno_nombre, d.telefono AS dueno_telefono,
              w.nombre AS paseador_nombre, w.telefono AS paseador_telefono,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'dueno_a_paseador') AS resena_dueno,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'paseador_a_dueno') AS resena_paseador
       FROM paseos p
       JOIN comunas c ON c.id = p.comuna_id
       JOIN users d ON d.id = p.dueno_id
       JOIN users w ON w.id = p.paseador_id
       WHERE p.dueno_id = ? OR p.paseador_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.id, req.user.id)
    .map((p) => ({
      ...p,
      dueno_telefono: p.estado !== "cancelado" ? p.dueno_telefono : null,
      paseador_telefono: p.estado !== "cancelado" ? p.paseador_telefono : null,
      puede_resenar:
        p.estado === "completado" &&
        ((req.user.rol === "dueno" && !p.resena_dueno) || (req.user.rol === "paseador" && !p.resena_paseador)),
    }));
  res.json(rows);
});

paseosRouter.post("/:id/completar", auth(true), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "Paseo no encontrado." });
  if (p.dueno_id !== req.user.id && p.paseador_id !== req.user.id) {
    return res.status(403).json({ error: "No es tu paseo." });
  }
  if (p.estado !== "acordado") return res.status(400).json({ error: "Este paseo ya está cerrado." });
  db.prepare("UPDATE paseos SET estado = 'completado' WHERE id = ?").run(p.id);
  db.prepare("UPDATE paseadores SET paseos_completados = paseos_completados + 1 WHERE user_id = ?").run(p.paseador_id);
  res.json({ ok: true });
});
