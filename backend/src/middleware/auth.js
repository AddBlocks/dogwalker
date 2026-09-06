import jwt from "jsonwebtoken";
import { db } from "../db.js";

const SECRET = process.env.JWT_SECRET || "dev-paseopatitas";

export function signToken(user) {
  return jwt.sign({ id: user.id, rol: user.rol }, SECRET, { expiresIn: "30d" });
}

export function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      if (required) return res.status(401).json({ error: "Tenís que iniciar sesión." });
      req.user = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, SECRET);
      const user = db
        .prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL")
        .get(payload.id);
      if (!user) {
        if (required) return res.status(401).json({ error: "Sesión inválida." });
        req.user = null;
        return next();
      }
      req.user = user;
      if (required && user.rol !== "admin" && user.autorizado === 0) {
        return res.status(403).json({
          error: "Tu cuenta está en revisión. El administrador debe autorizarla.",
          pendiente: true,
        });
      }
      next();
    } catch {
      if (required) return res.status(401).json({ error: "Sesión vencida." });
      req.user = null;
      next();
    }
  };
}

export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No tenís permiso para esta acción." });
    }
    next();
  };
}
