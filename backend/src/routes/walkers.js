import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { db } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { writeEncrypted } from "../services/encryption.js";
import { submitVerification, verificationProviderName } from "../services/verification.js";
import { geocodeLista, geocodeSantiago, haversineKm } from "../services/geocode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "uploads", "ids");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan fotos JPG, PNG o WEBP."));
  },
});

export const walkersRouter = Router();

function parseCalles(json) {
  try {
    const a = JSON.parse(json || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function walkerRow(row) {
  return {
    id: row.user_id,
    paseador_id: row.paseador_id,
    nombre: row.nombre,
    avatar_url: row.avatar_url,
    descripcion: row.descripcion,
    precio_clp: row.precio_clp,
    disponibilidad: row.disponibilidad,
    destacado: !!row.destacado,
    calificacion: row.calificacion_promedio,
    cantidad_reseñas: row.calificacion_count,
    paseos: row.paseos_completados,
    lat: row.lat,
    lng: row.lng,
    radio_km: row.radio_km,
    calles: parseCalles(row.calles_json).map((c) => ({
      nombre: c.nombre,
      lat: c.lat,
      lng: c.lng,
    })),
    telefono_visible: false,
  };
}

walkersRouter.put("/mi-oferta", auth(true), requireRol("paseador"), async (req, res) => {
  const { descripcion, precio_clp, disponibilidad, direccion, radio_km, calles } = req.body || {};
  const p = db.prepare("SELECT id FROM paseadores WHERE user_id = ?").get(req.user.id);
  if (!p) return res.status(404).json({ error: "Perfil de paseador no encontrado." });
  const radio = Number(radio_km);
  if (!direccion || !String(direccion).trim()) {
    return res.status(400).json({ error: "Ingresa tu dirección. Queda privada; solo se usa como centro de tu zona." });
  }
  if (!Number.isFinite(radio) || radio < 0.5 || radio > 20) {
    return res.status(400).json({ error: "El radio de paseo debe ser entre 0,5 y 20 km." });
  }
  const geo = await geocodeSantiago(direccion);
  if (!geo) {
    return res.status(400).json({
      error: "No encontramos esa dirección en Santiago. Probá con calle, número y comuna.",
    });
  }
  const nombres = Array.isArray(calles)
    ? [...new Set(calles.map((c) => String(c).trim()).filter(Boolean))].slice(0, 12)
    : [];
  const callesGeo = nombres.length ? await geocodeLista(nombres) : [];
  db.prepare(
    `UPDATE paseadores
     SET descripcion = ?, precio_clp = ?, disponibilidad = ?,
         direccion_privada = ?, lat = ?, lng = ?, radio_km = ?, calles_json = ?
     WHERE id = ?`
  ).run(
    descripcion || null,
    precio_clp || null,
    disponibilidad || null,
    String(direccion).trim(),
    geo.lat,
    geo.lng,
    radio,
    JSON.stringify(callesGeo),
    p.id
  );
  res.json({ ok: true, zona: { radio_km: radio, calles: callesGeo.length } });
});

walkersRouter.get("/", (req, res) => {
  const comunaId = req.query.comuna ? Number(req.query.comuna) : null;
  const precioMax = req.query.precio_max ? Number(req.query.precio_max) : null;
  const calMin = req.query.calificacion_min ? Number(req.query.calificacion_min) : null;

  let sql = `
    SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
           p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados,
           p.lat, p.lng, p.radio_km, p.calles_json
    FROM paseadores p
    JOIN users u ON u.id = p.user_id
    WHERE p.estado_verificacion = 'aprobado' AND u.deleted_at IS NULL
      AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.radio_km IS NOT NULL
  `;
  const params = [];
  if (precioMax) {
    sql += ` AND p.precio_clp <= ?`;
    params.push(precioMax);
  }
  if (calMin) {
    sql += ` AND u.calificacion_promedio >= ?`;
    params.push(calMin);
  }
  sql += ` ORDER BY p.destacado DESC, u.calificacion_promedio DESC, p.paseos_completados DESC`;

  let rows = db.prepare(sql).all(...params).map(walkerRow);
  if (comunaId) {
    const comuna = db.prepare("SELECT lat, lng FROM comunas WHERE id = ?").get(comunaId);
    if (comuna) {
      rows = rows.filter((w) => haversineKm({ lat: w.lat, lng: w.lng }, comuna) <= Number(w.radio_km));
    }
  }
  res.json(rows);
});

walkersRouter.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
              p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados,
              p.estado_verificacion, p.lat, p.lng, p.radio_km, p.calles_json
       FROM paseadores p JOIN users u ON u.id = p.user_id
       WHERE u.id = ? AND u.deleted_at IS NULL`
    )
    .get(Number(req.params.id));
  if (!row || row.estado_verificacion !== "aprobado") {
    return res.status(404).json({ error: "Paseador no disponible." });
  }
  const resenas = db
    .prepare(
      `SELECT r.promedio, r.comentario, r.created_at, u.nombre AS autor
       FROM resenas r JOIN users u ON u.id = r.autor_id
       WHERE r.destino_id = ? AND r.tipo = 'dueno_a_paseador'
       ORDER BY r.created_at DESC LIMIT 20`
    )
    .all(row.user_id);
  res.json({ ...walkerRow(row), resenas });
});

walkersRouter.post(
  "/verificacion",
  auth(true),
  requireRol("paseador"),
  upload.fields([
    { name: "cedula_frente", maxCount: 1 },
    { name: "cedula_reverso", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      if (!files.cedula_frente?.[0] || !files.cedula_reverso?.[0] || !files.selfie?.[0]) {
        return res.status(400).json({ error: "Subí cédula por ambos lados y una selfie." });
      }
      const p = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(req.user.id);
      const stamp = `${req.user.id}-${Date.now()}`;
      const frente = writeEncrypted(uploadDir, `${stamp}-frente.bin`, files.cedula_frente[0].buffer);
      const reverso = writeEncrypted(uploadDir, `${stamp}-reverso.bin`, files.cedula_reverso[0].buffer);
      const selfie = writeEncrypted(uploadDir, `${stamp}-selfie.bin`, files.selfie[0].buffer);

      const result = await submitVerification({ userId: req.user.id });
      db.prepare(
        `UPDATE paseadores
         SET cedula_frente = ?, cedula_reverso = ?, selfie = ?,
             proveedor_verificacion = ?, id_externo_verificacion = ?, estado_verificacion = 'pendiente'
         WHERE id = ?`
      ).run(frente, reverso, selfie, result.provider, result.externalId, p.id);

      res.json({
        ok: true,
        proveedor: verificationProviderName(),
        mensaje: result.message,
        estado: "pendiente",
      });
    } catch (err) {
      res.status(400).json({ error: err.message || "No se pudieron guardar los documentos." });
    }
  }
);

export { uploadDir };
