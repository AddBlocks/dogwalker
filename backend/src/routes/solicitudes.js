import { Router } from "express";
import { db, lastId } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";
import { haversineKm } from "../services/geocode.js";
import { avisarMatch, avisarSolicitudAPaseador } from "../services/notificaciones.js";
import { slugForRaza } from "../services/avatares.js";

function publicoPerroSolicitud(row) {
  return {
    id: row.id,
    nombre: row.nombre || "",
    raza: row.raza,
    avatar: row.avatar,
    tiene_foto: Boolean(row.foto_path),
    es_mezcla: Boolean(row.es_mezcla),
    agresivo: Boolean(row.agresivo),
  };
}

function perrosPorSolicitud(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const ph = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT sp.solicitud_id, p.id, p.nombre, p.raza, p.avatar, p.foto_path, p.es_mezcla, p.agresivo
       FROM solicitud_perros sp JOIN perros p ON p.id = sp.perro_id
       WHERE sp.solicitud_id IN (${ph})`
    )
    .all(...ids);
  for (const r of rows) {
    const list = map.get(r.solicitud_id) || [];
    list.push(publicoPerroSolicitud(r));
    map.set(r.solicitud_id, list);
  }
  return map;
}

function decorateSolicitud(s, { hidePaseadorPhone = false, hideDuenoPhone = false, perros = [] } = {}) {
  const { perro_foto_path, perro_nombre_live, perro_avatar, ...rest } = s;
  return {
    ...rest,
    paseador_telefono: hidePaseadorPhone ? null : s.paseador_telefono,
    dueno_telefono: hideDuenoPhone ? null : s.dueno_telefono,
    tipo_paseo: s.tipo_paseo || "uno",
    perro_nombre: s.perro_nombre || perro_nombre_live || "",
    perro_avatar: perro_avatar || slugForRaza(s.raza),
    perro_tiene_foto: Boolean(perro_foto_path),
    perros: perros.length
      ? perros
      : s.perro_id
        ? [
            {
              id: s.perro_id,
              nombre: s.perro_nombre || perro_nombre_live || "",
              raza: s.raza,
              avatar: perro_avatar || slugForRaza(s.raza),
              tiene_foto: Boolean(perro_foto_path),
              es_mezcla: Boolean(s.es_mezcla),
              agresivo: Boolean(s.agresivo),
            },
          ]
        : [],
  };
}

function conPerros(rows, extra) {
  const map = perrosPorSolicitud(rows.map((s) => s.id));
  return rows.map((s) => decorateSolicitud(s, { ...extra, perros: map.get(s.id) || [] }));
}

export const solicitudesRouter = Router();

solicitudesRouter.post("/", auth(true), requireRol("dueno"), async (req, res) => {
  const { paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje, raza, es_mezcla, agresivo, perro_id, perro_ids, tipo_paseo } = req.body || {};
  if (!comuna_id || !horario || !frecuencia || !monto_clp) {
    return res.status(400).json({ error: "Completa comuna, horario, frecuencia y monto." });
  }
  const tipos = ["uno", "varios", "grupal"];
  let tipo = tipos.includes(tipo_paseo) ? tipo_paseo : "uno";
  let ids = Array.isArray(perro_ids) ? [...new Set(perro_ids.map(Number).filter((n) => n > 0))] : [];
  if (!ids.length && perro_id) ids = [Number(perro_id)];
  if (tipo === "varios" && ids.length < 2) {
    return res.status(400).json({ error: "Para varios perros tuyos, elegí al menos dos." });
  }
  if (tipo !== "varios" && ids.length > 1) tipo = "varios";

  const perros = ids.map((idPerro) => {
    const row = db.prepare("SELECT * FROM perros WHERE id = ? AND user_id = ?").get(idPerro, req.user.id);
    return row;
  });
  if (ids.length && perros.some((p) => !p)) {
    return res.status(404).json({ error: "Ese perro no está en tu lista." });
  }
  const perro = perros[0] || null;
  const razaNom = String(perro?.raza || raza || req.user.perro_raza || "").trim();
  if (!razaNom) {
    return res.status(400).json({ error: "Indicá la raza de tu perro." });
  }
  const mezcla =
    perros.length
      ? perros.some((p) => p.es_mezcla)
      : es_mezcla === true || es_mezcla === 1 || es_mezcla === "1" || es_mezcla === "true" || /mezcla|mestizo/i.test(razaNom);
  const agresivoEnviado = perros.length > 0 || Object.prototype.hasOwnProperty.call(req.body || {}, "agresivo");
  const esAgresivo = perros.length ? perros.some((p) => p.agresivo) : agresivo === true || agresivo === 1 || agresivo === "1" || agresivo === "true";
  if (mezcla && !agresivoEnviado) {
    return res.status(400).json({ error: "Si tu perro es mezcla, indicá si es peligroso o agresivo." });
  }
  const perroNombre =
    perros
      .map((p) => p.nombre)
      .filter(Boolean)
      .join(", ") ||
    String(req.body?.perro_nombre || "").trim() ||
    null;
  if (paseador_id) {
    const walker = db
      .prepare(
        `SELECT p.id, p.solo_no_peligrosas, p.precio_varios_clp, p.precio_grupal_clp
         FROM paseadores p JOIN users u ON u.id = p.user_id
         WHERE u.id = ? AND p.estado_verificacion = 'aprobado'`
      )
      .get(Number(paseador_id));
    if (!walker) return res.status(404).json({ error: "Ese paseador no está disponible." });
    if (walker.solo_no_peligrosas && esAgresivo) {
      return res.status(400).json({
        error: "Este paseador es menor de 18 y solo puede pasear razas no peligrosas.",
      });
    }
    if (tipo === "varios" && !walker.precio_varios_clp) {
      return res.status(400).json({ error: "Este paseador no publicó precio para varios perros del mismo dueño." });
    }
    if (tipo === "grupal" && !walker.precio_grupal_clp) {
      return res.status(400).json({ error: "Este paseador no ofrece paseos con perros de otros dueños." });
    }
  }
  const estado = paseador_id ? "pendiente" : "abierta";
  const r = db
    .prepare(
      `INSERT INTO solicitudes (dueno_id, paseador_id, comuna_id, horario, frecuencia, monto_clp, mensaje, estado, raza, es_mezcla, agresivo, perro_id, perro_nombre, tipo_paseo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      perroNombre,
      tipo
    );
  const solicitudId = lastId(r);
  const insertSp = db.prepare("INSERT INTO solicitud_perros (solicitud_id, perro_id) VALUES (?, ?)");
  for (const p of perros) insertSp.run(solicitudId, p.id);
  if (paseador_id) {
    const walker = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(paseador_id));
    avisarSolicitudAPaseador({
      walker,
      dueno: req.user,
      solicitud: { horario, frecuencia },
    });
  }
  res.status(201).json({ id: solicitudId, estado });
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
      .all(req.user.id);
    return res.json(
      conPerros(rows).map((s) => ({
        ...s,
        paseador_telefono: s.estado === "aceptada" ? s.paseador_telefono : null,
      }))
    );
  }
  if (req.user.rol === "paseador") {
    const zona = db
      .prepare("SELECT lat, lng, radio_km, estado_verificacion, solo_no_peligrosas, precio_varios_clp, precio_grupal_clp FROM paseadores WHERE user_id = ?")
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
        if ((s.tipo_paseo || "uno") === "grupal" && !zona.precio_grupal_clp) return false;
        if ((s.tipo_paseo || "uno") === "varios" && !zona.precio_varios_clp) return false;
        return haversineKm({ lat: zona.lat, lng: zona.lng }, { lat: s.comuna_lat, lng: s.comuna_lng }) <= Number(zona.radio_km);
      })
      .map(({ comuna_lat, comuna_lng, ...s }) => s);
    return res.json(
      conPerros(rows).map((s) => ({
        ...s,
        dueno_telefono: s.estado === "aceptada" && s.paseador_id === req.user.id ? s.dueno_telefono : null,
      }))
    );
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
