import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { AVATAR_SLUGS, slugForRaza } from "../services/avatares.js";
import { uploadPerrosDir } from "../paths.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan fotos JPG, PNG o WEBP."));
  },
});

function uploadFoto(req, res, next) {
  upload.single("foto")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "No se pudo subir la foto." });
    next();
  });
}

export function publicoPerro(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    nombre: row.nombre || "",
    raza: row.raza,
    es_mezcla: Boolean(row.es_mezcla),
    agresivo: Boolean(row.agresivo),
    avatar: row.avatar || slugForRaza(row.raza),
    tiene_foto: Boolean(row.foto_path),
  };
}

export function listarPerros(userId) {
  return db
    .prepare("SELECT * FROM perros WHERE user_id = ? ORDER BY id")
    .all(Number(userId))
    .map(publicoPerro);
}

export function borrarFotosPerros(userId) {
  const rows = db.prepare("SELECT foto_path FROM perros WHERE user_id = ?").all(Number(userId));
  for (const r of rows) unlinkSafe(r.foto_path);
}

function unlinkSafe(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ya no está */
  }
}

function saveFoto(userId, perroId, file) {
  const ext = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
  const dest = path.join(uploadPerrosDir, `${userId}-${perroId}-${Date.now()}${ext}`);
  fs.writeFileSync(dest, file.buffer);
  return dest;
}

function parseBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function datosDesdeBody(body) {
  const nombre = String(body?.nombre || "").trim() || null;
  const raza = String(body?.raza || "").trim();
  const mezcla = parseBool(body?.es_mezcla) || /mezcla|mestizo/i.test(raza);
  const agresivoEnviado = Object.prototype.hasOwnProperty.call(body || {}, "agresivo");
  const agresivo = parseBool(body?.agresivo);
  let avatar = String(body?.avatar || "").trim() || null;
  if (avatar && !AVATAR_SLUGS.includes(avatar)) avatar = null;
  if (!avatar) avatar = slugForRaza(raza);
  return { nombre, raza, mezcla, agresivoEnviado, agresivo, avatar };
}

function validarDatos({ raza, mezcla, agresivoEnviado }) {
  if (!raza) return "Indicá la raza de tu perro.";
  if (mezcla && !agresivoEnviado) return "Si tu perro es mezcla, indicá si es peligroso o agresivo.";
  return null;
}

export const perrosRouter = Router();

perrosRouter.get("/", auth(true), requireRol("dueno"), (req, res) => {
  res.json(listarPerros(req.user.id));
});

perrosRouter.get("/:id/foto", auth(false), (req, res) => {
  const row = db.prepare("SELECT foto_path FROM perros WHERE id = ?").get(Number(req.params.id));
  if (!row?.foto_path || !fs.existsSync(row.foto_path)) {
    return res.status(404).json({ error: "Ese perro no tiene foto." });
  }
  const ext = path.extname(row.foto_path).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  fs.createReadStream(row.foto_path).pipe(res);
});

perrosRouter.post("/", auth(true), requireRol("dueno"), uploadFoto, (req, res) => {
  const datos = datosDesdeBody(req.body || {});
  const error = validarDatos(datos);
  if (error) return res.status(400).json({ error });
  const r = db
    .prepare(
      `INSERT INTO perros (user_id, nombre, raza, es_mezcla, agresivo, avatar)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, datos.nombre, datos.raza, datos.mezcla ? 1 : 0, datos.agresivo ? 1 : 0, datos.avatar);
  const id = lastId(r);
  if (req.file) {
    const dest = saveFoto(req.user.id, id, req.file);
    db.prepare("UPDATE perros SET foto_path = ? WHERE id = ?").run(dest, id);
  }
  const row = db.prepare("SELECT * FROM perros WHERE id = ?").get(id);
  res.status(201).json(publicoPerro(row));
});

perrosRouter.put("/:id", auth(true), requireRol("dueno"), uploadFoto, (req, res) => {
  const row = db.prepare("SELECT * FROM perros WHERE id = ? AND user_id = ?").get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "Perro no encontrado." });
  const datos = datosDesdeBody(req.body || {});
  const error = validarDatos(datos);
  if (error) return res.status(400).json({ error });
  let fotoPath = row.foto_path;
  if (req.file) {
    unlinkSafe(row.foto_path);
    fotoPath = saveFoto(req.user.id, row.id, req.file);
  } else if (parseBool(req.body?.quitar_foto)) {
    unlinkSafe(row.foto_path);
    fotoPath = null;
  }
  db.prepare(
    `UPDATE perros SET nombre = ?, raza = ?, es_mezcla = ?, agresivo = ?, avatar = ?, foto_path = ?
     WHERE id = ?`
  ).run(datos.nombre, datos.raza, datos.mezcla ? 1 : 0, datos.agresivo ? 1 : 0, datos.avatar, fotoPath, row.id);
  const next = db.prepare("SELECT * FROM perros WHERE id = ?").get(row.id);
  res.json(publicoPerro(next));
});

perrosRouter.delete("/:id", auth(true), requireRol("dueno"), (req, res) => {
  const row = db.prepare("SELECT * FROM perros WHERE id = ? AND user_id = ?").get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "Perro no encontrado." });
  db.prepare("UPDATE solicitudes SET perro_id = NULL WHERE perro_id = ?").run(row.id);
  unlinkSafe(row.foto_path);
  db.prepare("DELETE FROM perros WHERE id = ?").run(row.id);
  res.json({ ok: true });
});
