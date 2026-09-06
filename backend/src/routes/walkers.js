import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { db } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { writeEncrypted } from "../services/encryption.js";
import { archivarReemplazos } from "../services/documentos.js";
import { submitVerification, verificationProviderName } from "../services/verification.js";
import { leerFechaNacimiento, resolverEdad, validarEdadPaseador } from "../services/cedula.js";
import { geocodeSantiago, haversineKm } from "../services/geocode.js";
import { armarZonaCalles, parseZona, puntoEnPoligono } from "../services/zonaCalles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "uploads", "ids");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else if (file.fieldname === "autorizacion_padres" && file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Solo se aceptan fotos JPG, PNG o WEBP (la autorización de padres también puede ser PDF)."));
  },
});

export const walkersRouter = Router();

function walkerRow(row) {
  const zona = parseZona(row.calles_json);
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
    calles: zona.calles.map((c) => ({
      nombre: typeof c === "string" ? c : c.nombre,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
    })),
    vertices: zona.vertices,
    poligono: zona.poligono,
    banco: row.banco || null,
    tipo_cuenta: row.tipo_cuenta || null,
    numero_cuenta: row.numero_cuenta || null,
    titular: row.titular || null,
    rut_titular: row.rut_titular || null,
    email_transferencia: row.email_transferencia || null,
    pago_momento: row.pago_momento || null,
    monto_anticipado_clp: row.monto_anticipado_clp || null,
    edad: row.edad ?? null,
    solo_no_peligrosas: Boolean(row.solo_no_peligrosas),
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
  let zona = { calles: [], vertices: [], poligono: null, sinUbicacion: [] };
  if (nombres.length) {
    try {
      zona = await armarZonaCalles(nombres, { near: geo });
    } catch (err) {
      console.error("[Patitas] no se pudieron cruzar las calles", err);
      return res.status(503).json({
        error: "No pudimos ubicar los cruces de esas calles ahora. Probá de nuevo en un minuto.",
      });
    }
  }
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
    JSON.stringify({
      calles: zona.calles,
      vertices: zona.vertices,
      poligono: zona.poligono,
    }),
    p.id
  );
  res.json({
    ok: true,
    zona: { radio_km: radio, calles: zona.calles.length, vertices: zona.vertices.length },
    calles_sin_ubicacion: zona.sinUbicacion,
  });
});

walkersRouter.put("/mi-pago", auth(true), requireRol("paseador"), (req, res) => {
  const p = db.prepare("SELECT id, precio_clp FROM paseadores WHERE user_id = ?").get(req.user.id);
  if (!p) return res.status(404).json({ error: "Perfil de paseador no encontrado." });
  const {
    banco,
    tipo_cuenta,
    numero_cuenta,
    titular,
    rut_titular,
    email_transferencia,
    pago_momento,
    monto_anticipado_clp,
  } = req.body || {};
  const momento = ["antes", "despues", "mixto"].includes(pago_momento) ? pago_momento : null;
  let anticipo = momento === "mixto" ? Number(monto_anticipado_clp) : null;
  if (momento === "mixto") {
    if (!Number.isFinite(anticipo) || anticipo < 1000) {
      return res.status(400).json({ error: "Ingresa el monto anticipado (mínimo $1.000)." });
    }
    if (p.precio_clp && anticipo >= Number(p.precio_clp)) {
      return res.status(400).json({ error: "El anticipo tiene que ser menor que el precio del paseo." });
    }
  } else {
    anticipo = null;
  }
  const tipo = ["corriente", "vista", "rut", "ahorro"].includes(tipo_cuenta) ? tipo_cuenta : null;
  db.prepare(
    `UPDATE paseadores
     SET banco = ?, tipo_cuenta = ?, numero_cuenta = ?, titular = ?, rut_titular = ?,
         email_transferencia = ?, pago_momento = ?, monto_anticipado_clp = ?
     WHERE id = ?`
  ).run(
    String(banco || "").trim() || null,
    tipo,
    String(numero_cuenta || "").trim() || null,
    String(titular || "").trim() || null,
    String(rut_titular || "").trim() || null,
    String(email_transferencia || "").trim() || null,
    momento,
    anticipo,
    p.id
  );
  res.json({ ok: true });
});

walkersRouter.get("/", (req, res) => {
  const comunaId = req.query.comuna ? Number(req.query.comuna) : null;
  const precioMax = req.query.precio_max ? Number(req.query.precio_max) : null;
  const calMin = req.query.calificacion_min ? Number(req.query.calificacion_min) : null;

  let sql = `
    SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
           p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados,
           p.lat, p.lng, p.radio_km, p.calles_json,
           p.banco, p.tipo_cuenta, p.numero_cuenta, p.titular, p.rut_titular,
           p.email_transferencia, p.pago_momento, p.monto_anticipado_clp,
           p.edad, p.solo_no_peligrosas
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
      rows = rows.filter((w) => {
        if (w.poligono?.length >= 3 && puntoEnPoligono(comuna.lat, comuna.lng, w.poligono)) return true;
        if (w.vertices?.some((v) => haversineKm(v, comuna) <= 2)) return true;
        return w.lat != null && w.lng != null && Number(w.radio_km) > 0 && haversineKm({ lat: w.lat, lng: w.lng }, comuna) <= Number(w.radio_km);
      });
    }
  }
  res.json(rows);
});

walkersRouter.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT u.id AS user_id, u.nombre, u.avatar_url, u.calificacion_promedio, u.calificacion_count,
              p.id AS paseador_id, p.descripcion, p.precio_clp, p.disponibilidad, p.destacado, p.paseos_completados,
              p.estado_verificacion, p.lat, p.lng, p.radio_km, p.calles_json,
              p.banco, p.tipo_cuenta, p.numero_cuenta, p.titular, p.rut_titular,
              p.email_transferencia, p.pago_momento, p.monto_anticipado_clp,
              p.edad, p.solo_no_peligrosas
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
    { name: "autorizacion_padres", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const p = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(req.user.id);
      if (!p) return res.status(404).json({ error: "Perfil de paseador no encontrado." });
      const primeraVez = !p.cedula_frente && !p.cedula_reverso && !p.selfie;
      if (primeraVez && (!files.cedula_frente?.[0] || !files.cedula_reverso?.[0] || !files.selfie?.[0])) {
        return res.status(400).json({ error: "Subí cédula por ambos lados y una selfie." });
      }
      if (!files.cedula_frente?.[0] && !p.cedula_frente) {
        return res.status(400).json({ error: "Subí el frente de la cédula." });
      }
      const bufferFrente = files.cedula_frente?.[0]?.buffer;
      const ocrIso = bufferFrente ? await leerFechaNacimiento(bufferFrente) : p.fecha_nacimiento;
      const edadInfo = resolverEdad({
        ocrIso: bufferFrente ? ocrIso : null,
        fechaFormulario: req.body?.fecha_nacimiento || p.fecha_nacimiento,
      });
      const v = validarEdadPaseador(edadInfo.edad);
      if (v.error) return res.status(400).json({ error: v.error });
      if (v.menor && !files.autorizacion_padres?.[0] && !p.autorizacion_padres) {
        return res.status(400).json({
          error: "Si tenés menos de 18 años, subí una autorización simple de tus padres para pasear razas no peligrosas.",
        });
      }
      const stamp = `${req.user.id}-${Date.now()}`;
      const frente = files.cedula_frente?.[0]
        ? writeEncrypted(uploadDir, `${stamp}-frente.bin`, files.cedula_frente[0].buffer)
        : p.cedula_frente;
      const reverso = files.cedula_reverso?.[0]
        ? writeEncrypted(uploadDir, `${stamp}-reverso.bin`, files.cedula_reverso[0].buffer)
        : p.cedula_reverso;
      const selfie = files.selfie?.[0]
        ? writeEncrypted(uploadDir, `${stamp}-selfie.bin`, files.selfie[0].buffer)
        : p.selfie;
      const authPadres = files.autorizacion_padres?.[0]
        ? writeEncrypted(uploadDir, `${stamp}-padres.bin`, files.autorizacion_padres[0].buffer)
        : p.autorizacion_padres;
      const nextPaths = {
        cedula_frente: frente,
        cedula_reverso: reverso,
        selfie,
        autorizacion_padres: authPadres,
      };
      archivarReemplazos(p, nextPaths);

      const result = await submitVerification({ userId: req.user.id });
      db.prepare(
        `UPDATE paseadores
         SET cedula_frente = ?, cedula_reverso = ?, selfie = ?, autorizacion_padres = ?,
             fecha_nacimiento = ?, edad = ?, solo_no_peligrosas = ?,
             proveedor_verificacion = ?, id_externo_verificacion = ?, estado_verificacion = 'pendiente'
         WHERE id = ?`
      ).run(
        frente,
        reverso,
        selfie,
        authPadres,
        edadInfo.fecha_nacimiento,
        edadInfo.edad,
        v.menor ? 1 : 0,
        result.provider,
        result.externalId,
        p.id
      );

      res.json({
        ok: true,
        proveedor: verificationProviderName(),
        mensaje: v.menor
          ? `${result.message} Edad ${edadInfo.edad}: solo podés pasear razas no peligrosas.`
          : result.message,
        estado: "pendiente",
        edad: edadInfo.edad,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || "No se pudieron guardar los documentos." });
    }
  }
);

export { uploadDir };
