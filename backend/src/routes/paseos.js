import { Router } from "express";
import { db } from "../db.js";
import { auth, requireRol } from "../middleware/auth.js";

export const paseosRouter = Router();

function haversine(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function rutaDe(paseoId) {
  return db
    .prepare("SELECT lat, lng, recorded_at FROM paseo_puntos WHERE paseo_id = ? ORDER BY id ASC")
    .all(paseoId);
}

function distanciaMetros(puntos) {
  let m = 0;
  for (let i = 1; i < puntos.length; i++) m += haversine(puntos[i - 1], puntos[i]);
  return Math.round(m);
}

function assertParticipante(paseo, user) {
  if (!paseo) return { error: "Paseo no encontrado.", status: 404 };
  if (paseo.dueno_id !== user.id && paseo.paseador_id !== user.id) {
    return { error: "No es tu paseo.", status: 403 };
  }
  return null;
}

function puntoValido(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

function guardarPunto(paseoId, lat, lng) {
  db.prepare("INSERT INTO paseo_puntos (paseo_id, lat, lng) VALUES (?, ?, ?)").run(paseoId, lat, lng);
}

function detallePaseo(id, userId, rol) {
  const p = db
    .prepare(
      `SELECT p.*, c.nombre AS comuna, c.lat AS comuna_lat, c.lng AS comuna_lng,
              d.nombre AS dueno_nombre, d.telefono AS dueno_telefono,
              w.nombre AS paseador_nombre, w.telefono AS paseador_telefono,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'dueno_a_paseador') AS resena_dueno,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'paseador_a_dueno') AS resena_paseador
       FROM paseos p
       JOIN comunas c ON c.id = p.comuna_id
       JOIN users d ON d.id = p.dueno_id
       JOIN users w ON w.id = p.paseador_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!p) return null;
  const puntos = rutaDe(p.id);
  return {
    ...p,
    dueno_telefono: p.estado !== "cancelado" ? p.dueno_telefono : null,
    paseador_telefono: p.estado !== "cancelado" ? p.paseador_telefono : null,
    puntos,
    distancia_m: p.distancia_m || distanciaMetros(puntos),
    puede_resenar:
      p.estado === "completado" &&
      ((rol === "dueno" && !p.resena_dueno) || (rol === "paseador" && !p.resena_paseador)),
    soy_paseador: p.paseador_id === userId,
  };
}

paseosRouter.get("/", auth(true), (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.nombre AS comuna, d.nombre AS dueno_nombre, d.telefono AS dueno_telefono,
              w.nombre AS paseador_nombre, w.telefono AS paseador_telefono,
              (SELECT COUNT(*) FROM paseo_puntos x WHERE x.paseo_id = p.id) AS puntos_count,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'dueno_a_paseador') AS resena_dueno,
              (SELECT COUNT(*) FROM resenas r WHERE r.paseo_id = p.id AND r.tipo = 'paseador_a_dueno') AS resena_paseador
       FROM paseos p
       JOIN comunas c ON c.id = p.comuna_id
       JOIN users d ON d.id = p.dueno_id
       JOIN users w ON w.id = p.paseador_id
       WHERE p.dueno_id = ? OR p.paseador_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.id, req.user.id)
    .map((p) => ({
      ...p,
      dueno_telefono: p.estado !== "cancelado" ? p.dueno_telefono : null,
      paseador_telefono: p.estado !== "cancelado" ? p.paseador_telefono : null,
      puede_resenar:
        p.estado === "completado" &&
        ((req.user.rol === "dueno" && !p.resena_dueno) || (req.user.rol === "paseador" && !p.resena_paseador)),
    }));
  res.json(rows);
});

paseosRouter.get("/:id", auth(true), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  const denied = assertParticipante(p, req.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  res.json(detallePaseo(p.id, req.user.id, req.user.rol));
});

paseosRouter.post("/:id/iniciar", auth(true), requireRol("paseador"), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  const denied = assertParticipante(p, req.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  if (p.paseador_id !== req.user.id) return res.status(403).json({ error: "Solo el paseador inicia el recorrido." });
  if (p.estado !== "acordado") return res.status(400).json({ error: "Este paseo ya no se puede iniciar." });
  const punto = puntoValido(req.body?.lat, req.body?.lng);
  if (!punto) return res.status(400).json({ error: "Activa la ubicación para compartir el recorrido." });

  db.prepare("UPDATE paseos SET estado = 'en_curso', iniciado_at = datetime('now') WHERE id = ?").run(p.id);
  guardarPunto(p.id, punto.lat, punto.lng);
  res.json(detallePaseo(p.id, req.user.id, req.user.rol));
});

paseosRouter.post("/:id/puntos", auth(true), requireRol("paseador"), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  const denied = assertParticipante(p, req.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  if (p.paseador_id !== req.user.id) return res.status(403).json({ error: "Solo el paseador envía el recorrido." });
  if (p.estado !== "en_curso") return res.status(400).json({ error: "El paseo no está en curso." });

  const lote = Array.isArray(req.body?.puntos) ? req.body.puntos : [req.body];
  let n = 0;
  for (const item of lote) {
    const punto = puntoValido(item?.lat, item?.lng);
    if (!punto) continue;
    guardarPunto(p.id, punto.lat, punto.lng);
    n += 1;
  }
  if (!n) return res.status(400).json({ error: "No llegó ninguna coordenada válida." });
  const puntos = rutaDe(p.id);
  db.prepare("UPDATE paseos SET distancia_m = ? WHERE id = ?").run(distanciaMetros(puntos), p.id);
  res.json({ ok: true, puntos: puntos.length, distancia_m: distanciaMetros(puntos) });
});

function cerrarPaseo(p, punto) {
  if (punto) guardarPunto(p.id, punto.lat, punto.lng);
  const puntos = rutaDe(p.id);
  const distancia = distanciaMetros(puntos);
  db.prepare("UPDATE paseos SET estado = 'completado', terminado_at = datetime('now'), distancia_m = ? WHERE id = ?").run(
    distancia,
    p.id
  );
  db.prepare("UPDATE paseadores SET paseos_completados = paseos_completados + 1 WHERE user_id = ?").run(p.paseador_id);
  return { puntos, distancia };
}

paseosRouter.post("/:id/terminar", auth(true), requireRol("paseador"), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  const denied = assertParticipante(p, req.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  if (p.paseador_id !== req.user.id) return res.status(403).json({ error: "Solo el paseador termina el recorrido." });
  if (p.estado !== "en_curso") {
    return res.status(400).json({ error: "Primero tenís que iniciar el paseo para compartir el recorrido." });
  }
  cerrarPaseo(p, puntoValido(req.body?.lat, req.body?.lng));
  res.json(detallePaseo(p.id, req.user.id, req.user.rol));
});

paseosRouter.post("/:id/completar", auth(true), (req, res) => {
  const p = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(req.params.id));
  const denied = assertParticipante(p, req.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  if (req.user.id !== p.paseador_id) {
    return res.status(403).json({ error: "El dueño ve el recorrido en la app; el paseador lo inicia y lo termina." });
  }
  if (p.estado === "acordado") {
    return res.status(400).json({ error: "Inicia el paseo con el botón para compartir el recorrido de principio a fin." });
  }
  if (p.estado !== "en_curso") return res.status(400).json({ error: "Este paseo ya está cerrado." });
  cerrarPaseo(p, puntoValido(req.body?.lat, req.body?.lng));
  res.json(detallePaseo(p.id, req.user.id, req.user.rol));
});
