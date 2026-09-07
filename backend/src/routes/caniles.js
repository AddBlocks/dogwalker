import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth } from "../middleware/auth.js";
import { geocodeSantiago, haversineKm } from "../services/geocode.js";

export const canilesRouter = Router();

function publico(row, userId) {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    lat: row.lat,
    lng: row.lng,
    reportado_por: row.reportado_por,
    reportado_por_nombre: row.reportado_por_nombre,
    baja_solicitada: Boolean(row.baja_solicitada_por),
    baja_pedida_por_mi: userId ? Number(row.baja_solicitada_por) === Number(userId) : false,
  };
}

canilesRouter.get("/", auth(false), (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.nombre, c.direccion, c.lat, c.lng, c.reportado_por, c.baja_solicitada_por,
              u.nombre AS reportado_por_nombre
       FROM caniles c
       JOIN users u ON u.id = c.reportado_por
       WHERE c.deleted_at IS NULL
       ORDER BY c.created_at DESC`
    )
    .all();
  res.json(rows.map((r) => publico(r, req.user?.id)));
});

canilesRouter.post("/", auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || "").trim();
  const direccion = String(req.body?.direccion || "").trim();
  if (!nombre || !direccion) {
    return res.status(400).json({ error: "Indicá el nombre del canil y la dirección." });
  }
  const geo = await geocodeSantiago(direccion);
  if (!geo) {
    return res.status(400).json({
      error: "No encontramos esa dirección en Santiago. Probá con calle, número y comuna.",
    });
  }
  const cerca = db
    .prepare("SELECT id, nombre, lat, lng FROM caniles WHERE deleted_at IS NULL")
    .all()
    .find((c) => haversineKm(geo, { lat: c.lat, lng: c.lng }) < 0.08);
  if (cerca) {
    return res.status(409).json({ error: `Ya hay un canil cerca: ${cerca.nombre}.` });
  }
  const r = db
    .prepare(
      `INSERT INTO caniles (nombre, direccion, lat, lng, reportado_por)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(nombre, direccion, geo.lat, geo.lng, req.user.id);
  const row = db
    .prepare(
      `SELECT c.id, c.nombre, c.direccion, c.lat, c.lng, c.reportado_por, c.baja_solicitada_por,
              u.nombre AS reportado_por_nombre
       FROM caniles c JOIN users u ON u.id = c.reportado_por WHERE c.id = ?`
    )
    .get(lastId(r));
  res.status(201).json(publico(row, req.user.id));
});

canilesRouter.post("/:id/baja", auth(true), (req, res) => {
  const c = db.prepare("SELECT * FROM caniles WHERE id = ? AND deleted_at IS NULL").get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "Ese canil ya no está en el mapa." });
  if (c.baja_solicitada_por) {
    return res.status(400).json({ error: "Ya alguien pidió eliminarlo. El administrador tiene que autorizarlo." });
  }
  db.prepare(
    `UPDATE caniles SET baja_solicitada_por = ?, baja_solicitada_at = datetime('now') WHERE id = ?`
  ).run(req.user.id, c.id);
  res.json({ ok: true, mensaje: "Pediste eliminarlo. Queda en el mapa hasta que el administrador lo autorice." });
});
