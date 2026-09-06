import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";
import { eliminarCuenta } from "../services/cuentas.js";

export const usersRouter = Router();

usersRouter.put("/me", auth(true), (req, res) => {
  const { nombre, telefono, email, perro_raza, perro_mezcla, perro_agresivo } = req.body || {};
  let nextEmail = req.user.email;
  if (email !== undefined) {
    nextEmail = String(email || "").trim().toLowerCase();
    if (!nextEmail.includes("@")) return res.status(400).json({ error: "Ingresá un correo válido." });
    const taken = db
      .prepare("SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL")
      .get(nextEmail, req.user.id);
    if (taken) return res.status(409).json({ error: "Ese correo ya está en uso." });
  }
  db.prepare(
    `UPDATE users SET nombre = ?, telefono = ?, email = ?, perro_raza = ?, perro_mezcla = ?, perro_agresivo = ? WHERE id = ?`
  ).run(
    nombre || req.user.nombre,
    telefono !== undefined ? telefono || null : req.user.telefono,
    nextEmail,
    perro_raza !== undefined ? String(perro_raza || "").trim() || null : req.user.perro_raza,
    perro_mezcla === undefined ? Number(req.user.perro_mezcla || 0) : perro_mezcla ? 1 : 0,
    perro_agresivo === undefined ? Number(req.user.perro_agresivo || 0) : perro_agresivo ? 1 : 0,
    req.user.id
  );
  res.json({ ok: true });
});

usersRouter.get("/avisos", auth(true), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM avisos WHERE user_id = ? ORDER BY id DESC LIMIT 30")
    .all(req.user.id);
  const no_leidos = rows.filter((a) => !a.leido).length;
  res.json({ avisos: rows, no_leidos });
});

usersRouter.post("/avisos/leer", auth(true), (req, res) => {
  const id = req.body?.id ? Number(req.body.id) : null;
  if (id) {
    db.prepare("UPDATE avisos SET leido = 1 WHERE id = ? AND user_id = ?").run(id, req.user.id);
  } else {
    db.prepare("UPDATE avisos SET leido = 1 WHERE user_id = ?").run(req.user.id);
  }
  res.json({ ok: true });
});

/** Derecho de cancelación / eliminación (Ley 21.719). */
usersRouter.post("/me/eliminar", auth(true), (req, res) => {
  const result = eliminarCuenta(req.user.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});
