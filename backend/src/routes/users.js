import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";
import { eliminarCuenta } from "../services/cuentas.js";

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
  const result = eliminarCuenta(req.user.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});
