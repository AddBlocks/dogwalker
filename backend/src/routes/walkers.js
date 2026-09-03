import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { db } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { writeEncrypted } from "../services/encryption.js";
import { submitVerification, verificationProviderName } from "../services/verification.js";

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

function walkerRow(row) {
  const comunas = db
    .prepare(
      `SELECT c.id, c.nombre, c.lat, c.lng FROM paseador_comunas pc
       JOIN comunas c ON c.id = pc.comuna_id WHERE pc.paseador_id = ?`
    )
    .all(row.paseador_id);
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
    comunas,
    telefono_visible: false,
  };
}

walkersRouter.get("/", (req, res) => {
  const comunaId = req.query.comuna ? Number(req.query.comuna) : null;
  const precioMax = req.query.precio_max ? Number(req.query.precio_max) : null;
  const calMin = req.query.calificacion_min ? Number(req.query.calificacion_min) : null;

  let sql = `
    SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
           p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados
    FROM paseadores p
    JOIN users u ON u.id = p.user_id
    WHERE p.estado_verificacion = 'aprobado' AND u.deleted_at IS NULL
  `;
  const params = [];
  if (comunaId) {
    sql += ` AND p.id IN (SELECT paseador_id FROM paseador_comunas WHERE comuna_id = ?)`;
    params.push(comunaId);
  }
  if (precioMax) {
    sql += ` AND p.precio_clp <= ?`;
    params.push(precioMax);
  }
  if (calMin) {
    sql += ` AND u.calificacion_promedio >= ?`;
    params.push(calMin);
  }
  sql += ` ORDER BY p.destacado DESC, u.calificacion_promedio DESC, p.paseos_completados DESC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(walkerRow));
});

walkersRouter.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
              p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados,
              p.estado_verificacion
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

walkersRouter.put(
  "/mi-oferta",
  auth(true),
  requireRol("paseador"),
  (req, res) => {
    const { descripcion, precio_clp, disponibilidad, comunas } = req.body || {};
    const p = db.prepare("SELECT id FROM paseadores WHERE user_id = ?").get(req.user.id);
    if (!p) return res.status(404).json({ error: "Perfil de paseador no encontrado." });
    db.prepare(
      `UPDATE paseadores SET descripcion = ?, precio_clp = ?, disponibilidad = ? WHERE id = ?`
    ).run(descripcion || null, precio_clp || null, disponibilidad || null, p.id);
    if (Array.isArray(comunas)) {
      db.prepare("DELETE FROM paseador_comunas WHERE paseador_id = ?").run(p.id);
      const ins = db.prepare("INSERT INTO paseador_comunas (paseador_id, comuna_id) VALUES (?, ?)");
      for (const cid of comunas) ins.run(p.id, Number(cid));
    }
    res.json({ ok: true });
  }
);

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
