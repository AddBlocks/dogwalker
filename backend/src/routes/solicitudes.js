import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { haversineKm } from "../services/geocode.js";
import { avisarMatch, avisarSolicitudAPaseador } from "../services/notificaciones.js";
import { slugForRaza } from "../services/avatares.js";

function decorateSolicitud(s, { hidePaseadorPhone = false, hideDuenoPhone = false } = {}) {
  const { perro_foto_path, perro_nombre_live, perro_avatar, ...rest } = s;
  return {
    ...rest,
    paseador_telefono: hidePaseadorPhone ? null : s.paseador_telefono,
    dueno_telefono: hideDuenoPhone ? null : s.dueno_telefono,
    perro_nombre: s.perro_nombre || perro_nombre_live || "",
    perro_avatar: perro_avatar || slugForRaza(s.raza),
    perro_tiene_foto: Boolean(perro_foto_path),
  };
}

export const solicitudesRouter = Router();

solicitudesRouter.post("/", auth(true), requireRol("dueno"), async (req, res) => {
  const { paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje, raza, es_mezcla, agresivo, perro_id } = req.body || {};
  if (!comuna_id || !horario || !frecuencia || !monto_clp) {
    return res.status(400).json({ error: "Completa comuna, horario, frecuencia y monto." });
  }
  let perro = null;
  if (perro_id) {
    perro = db.prepare("SELECT * FROM perros WHERE id = ? AND user_id = ?").get(Number(perro_id), req.user.id);
    if (!perro) return res.status(404).json({ error: "Ese perro no está en tu lista." });
  }
  const razaNom = String(perro?.raza || raza || req.user.perro_raza || "").trim();
  if (!razaNom) {
    return res.status(400).json({ error: "Indicá la raza de tu perro." });
  }
  const mezcla =
    perro != null
      ? Boolean(perro.es_mezcla)
      : es_mezcla === true || es_mezcla === 1 || es_mezcla === "1" || es_mezcla === "true" || /mezcla|mestizo/i.test(razaNom);
  const agresivoEnviado = perro != null || Object.prototype.hasOwnProperty.call(req.body || {}, "agresivo");
  const esAgresivo = perro != null ? Boolean(perro.agresivo) : agresivo === true || agresivo === 1 || agresivo === "1" || agresivo === "true";
  if (mezcla && !agresivoEnviado) {
    return res.status(400).json({ error: "Si tu perro es mezcla, indicá si es peligroso o agresivo." });
  }
  const perroNombre = perro?.nombre || String(req.body?.perro_nombre || "").trim() || null;
  if (paseador_id) {
    const walker = db
      .prepare(
        `SELECT p.id, p.solo_no_peligrosas FROM paseadores p JOIN users u ON u.id = p.user_id
         WHERE u.id = ? AND p.estado_verificacion = 'aprobado'`
      )
      .get(Number(paseador_id));
    if (!walker) return res.status(404).json({ error: "Ese paseador no está disponible." });
    if (walker.solo_no_peligrosas && esAgresivo) {
      return res.status(400).json({
        error: "Este paseador es menor de 18 y solo puede pasear razas no peligrosas.",
      });
    }
  }
  const estado = paseador_id ? "pendiente" : "abierta";
  const r = db
    .prepare(
      `INSERT INTO solicitudes (dueno_id, paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje, estado, raza, es_mezcla, agresivo, perro_id, perro_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      paseador_id ? Number(paseador_id) : null,
      Number(comuna_id),
      horario,
      frecuencia,
      Number(monto_clp),
      mensaje || null,
      estado,
      razaNom,
      mezcla ? 1 : 0,
      esAgresivo ? 1 : 0,
      perro ? perro.id : null,
      perroNombre
    );
  if (paseador_id) {
    const walker = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(paseador_id));
    avisarSolicitudAPaseador({
      walker,
      dueno: req.user,
      solicitud: { horario, frecuencia },
    });
  }
  res.status(201).json({ id: lastId(r), estado });
});

solicitudesRouter.get("/mias", auth(true), (req, res) => {
  if (req.user.rol === "dueno") {
    const rows = db
      .prepare(
        `SELECT s.*, c.nombre AS comuna, u.nombre AS paseador_nombre, u.telefono AS paseador_telefono,
                p.nombre AS perro_nombre_live, p.avatar AS perro_avatar, p.foto_path AS perro_foto_path,
                (SELECT id FROM paseos WHERE solicitud_id = s.id ORDER BY id DESC LIMIT 1) AS paseo_id
         FROM solicitudes s
         JOIN comunas c ON c.id = s.comuna_id
         LEFT JOIN users u ON u.id = s.paseador_id
         LEFT JOIN perros p ON p.id = s.perro_id
         WHERE s.dueno_id = ?
         ORDER BY s.created_at DESC`
      )
      .all(req.user.id)
      .map((s) => decorateSolicitud(s, { hidePaseadorPhone: s.estado !== "aceptada" }));
    return res.json(rows);
  }
  if (req.user.rol === "paseador") {
    const zona = db
      .prepare("SELECT lat, lng, radio_km, estado_verificacion, solo_no_peligrosas FROM paseadores WHERE user_id = ?")
      .get(req.user.id);
    const rows = db
      .prepare(
        `SELECT s.*, c.nombre AS comuna, c.lat AS comuna_lat, c.lng AS comuna_lng,
                d.nombre AS dueno_nombre, d.telefono AS dueno_telefono,
                p.nombre AS perro_nombre_live, p.avatar AS perro_avatar, p.foto_path AS perro_foto_path,
                (SELECT id FROM paseos WHERE solicitud_id = s.id ORDER BY id DESC LIMIT 1) AS paseo_id
         FROM solicitudes s
         JOIN comunas c ON c.id = s.comuna_id
         JOIN users d ON d.id = s.dueno_id
         LEFT JOIN perros p ON p.id = s.perro_id
         WHERE s.paseador_id = ? OR s.estado = 'abierta'
         ORDER BY CASE s.estado WHEN 'pendiente' THEN 0 WHEN 'abierta' THEN 1 ELSE 2 END, s.created_at DESC`
      )
      .all(req.user.id)
      .filter((s) => {
        if (s.paseador_id === req.user.id) return true;
        if (s.estado !== "abierta") return false;
        if (!zona || zona.estado_verificacion !== "aprobado" || zona.lat == null || zona.lng == null || !zona.radio_km) {
          return false;
        }
        if (zona.solo_no_peligrosas && s.agresivo) return false;
        return haversineKm({ lat: zona.lat, lng: zona.lng }, { lat: s.comuna_lat, lng: s.comuna_lng }) <= Number(zona.radio_km);
      })
      .map(({ comuna_lat, comuna_lng, ...s }) =>
        decorateSolicitud(s, {
          hideDuenoPhone: !(s.estado === "aceptada" && s.paseador_id === req.user.id),
        })
      );
    return res.json(rows);
  }
  res.json([]);
});

solicitudesRouter.post("/:id/aceptar", auth(true), requireRol("paseador"), async (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ?").get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "Solicitud no existe." });
  if (s.estado !== "pendiente" && s.estado !== "abierta") {
    return res.status(400).json({ error: "Esta solicitud ya no se puede aceptar." });
  }
  if (s.paseador_id && s.paseador_id !== req.user.id) {
    return res.status(403).json({ error: "Esta solicitud es para otro paseador." });
  }
  const walkerOk = db
    .prepare("SELECT id, solo_no_peligrosas FROM paseadores WHERE user_id = ? AND estado_verificacion = 'aprobado'")
    .get(req.user.id);
  if (!walkerOk) return res.status(403).json({ error: "Tu perfil aún no está aprobado." });
  if (walkerOk.solo_no_peligrosas && s.agresivo) {
    return res.status(400).json({ error: "Como menor de 18 solo podés aceptar paseos de razas no peligrosas." });
  }

  db.prepare(
    `UPDATE solicitudes SET estado = 'aceptada', paseador_id = ?, responded_at = datetime('now') WHERE id = ?`
  ).run(req.user.id, s.id);

  const fecha = new Date().toISOString().slice(0, 10);
  const paseo = db
    .prepare(
      `INSERT INTO paseos (solicitud_id, dueno_id, paseador_id, comuna_id, fecha, monto_clp, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'acordado')`
    )
    .run(s.id, s.dueno_id, req.user.id, s.comuna_id, fecha, s.monto_clp);

  const dueno = db.prepare("SELECT * FROM users WHERE id = ?").get(s.dueno_id);
  avisarMatch({
    dueno,
    walker: req.user,
    solicitud: s,
  });
  res.json({
    ok: true,
    paseo_id: lastId(paseo),
    telefonos: { dueno: dueno.telefono, paseador: req.user.telefono },
    nombres: { dueno: dueno.nombre, paseador: req.user.nombre },
  });
});

solicitudesRouter.post("/:id/rechazar", auth(true), requireRol("paseador"), (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ?").get(Number(req.params.id));
  if (!s || (s.paseador_id && s.paseador_id !== req.user.id)) {
    return res.status(404).json({ error: "Solicitud no disponible." });
  }
  if (s.estado !== "pendiente") return res.status(400).json({ error: "Solo se pueden rechazar solicitudes pendientes." });
  db.prepare(`UPDATE solicitudes SET estado = 'rechazada', responded_at = datetime('now') WHERE id = ?`).run(s.id);
  res.json({ ok: true });
});

solicitudesRouter.post("/:id/cancelar", auth(true), requireRol("dueno"), (req, res) => {
  const s = db.prepare("SELECT * FROM solicitudes WHERE id = ? AND dueno_id = ?").get(Number(req.params.id), req.user.id);
  if (!s) return res.status(404).json({ error: "Solicitud no encontrada." });
  if (!["abierta", "pendiente"].includes(s.estado)) {
    return res.status(400).json({ error: "Ya no se puede cancelar." });
  }
  db.prepare("UPDATE solicitudes SET estado = 'cancelada' WHERE id = ?").run(s.id);
  res.json({ ok: true });
});
