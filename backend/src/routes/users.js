import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";
import { deleteFileSafe } from "../services/encryption.js";

export const usersRouter = Router();

usersRouter.put("/me", auth(true), (req, res) => {
  const { nombre, telefono } = req.body || {};
  db.prepare("UPDATE users SET nombre = ?, telefono = ? WHERE id = ?").run(
    nombre || req.user.nombre,
    telefono || req.user.telefono,
    req.user.id
  );
  res.json({ ok: true });
});

/** Derecho de cancelación / eliminación (Ley 21.719). */
usersRouter.post("/me/eliminar", auth(true), (req, res) => {
  const p = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(req.user.id);
  if (p) {
    deleteFileSafe(p.cedula_frente);
    deleteFileSafe(p.cedula_reverso);
    deleteFileSafe(p.selfie);
    db.prepare(
      `UPDATE paseadores SET cedula_frente=NULL, cedula_reverso=NULL, selfie=NULL,
        descripcion=NULL, estado_verificacion='rechazado' WHERE id=?`
    ).run(p.id);
  }
  const anon = `eliminado-${req.user.id}@eliminado.local`;
  db.prepare(
    `UPDATE users SET email = ?, password_hash = NULL, google_id = NULL, nombre = 'Cuenta eliminada',
      telefono = NULL, avatar_url = NULL, deleted_at = datetime('now')
     WHERE id = ?`
  ).run(anon, req.user.id);
  res.json({ ok: true });
});
