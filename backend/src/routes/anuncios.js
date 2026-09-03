import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";

export const anunciosRouter = Router();

function segmentoMatch(segmento, rol) {
  if (segmento === "ambos") return true;
  if (segmento === "duenos") return rol === "dueno" || !rol;
  if (segmento === "paseadores") return rol === "paseador";
  return false;
}

anunciosRouter.get("/", auth(false), (req, res) => {
  const ubicacion = req.query.ubicacion;
  const comunaId = req.query.comuna ? Number(req.query.comuna) : null;
  const rol = req.user?.rol;
  const rows = db
    .prepare(
      `SELECT * FROM anuncios
       WHERE activo = 1
         AND date(fecha_inicio) <= date('now')
         AND date(fecha_fin) >= date('now')
         AND (? IS NULL OR ubicacion = ?)`
    )
    .all(ubicacion || null, ubicacion || null)
    .filter((a) => {
      if (!segmentoMatch(a.segmento, rol)) return false;
      if (a.comuna_id == null) return true;
      if (!comunaId) return true;
      return a.comuna_id === comunaId;
    });
  res.json(rows);
});

anunciosRouter.post("/:id/impresion", auth(false), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE anuncios SET impresiones = impresiones + 1 WHERE id = ?").run(id);
  db.prepare("INSERT INTO anuncio_eventos (anuncio_id, tipo, user_id) VALUES (?, 'impresion', ?)").run(
    id,
    req.user?.id || null
  );
  res.json({ ok: true });
});

anunciosRouter.post("/:id/clic", auth(false), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE anuncios SET clics = clics + 1 WHERE id = ?").run(id);
  db.prepare("INSERT INTO anuncio_eventos (anuncio_id, tipo, user_id) VALUES (?, 'clic', ?)").run(
    id,
    req.user?.id || null
  );
  res.json({ ok: true });
});
