import { Router } from "express";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";

export const resenasRouter = Router();

function refreshRating(userId, tipo) {
  const row = db
    .prepare("SELECT AVG(promedio) AS avg, COUNT(*) AS n FROM resenas WHERE destino_id = ? AND tipo = ?")
    .get(userId, tipo);
  db.prepare("UPDATE users SET calificacion_promedio = ?, calificacion_count = ? WHERE id = ?").run(
    Math.round((row.avg || 0) * 10) / 10,
    row.n,
    userId
  );
}

resenasRouter.post("/", auth(true), (req, res) => {
  const { paseo_id, p1, p2, p3, p4, p5, comentario } = req.body || {};
  const paseo = db.prepare("SELECT * FROM paseos WHERE id = ?").get(Number(paseo_id));
  if (!paseo || paseo.estado !== "completado") {
    return res.status(400).json({ error: "Solo se puede reseñar un paseo terminado." });
  }

  let tipo;
  let destino;
  if (req.user.id === paseo.dueno_id) {
    tipo = "dueno_a_paseador";
    destino = paseo.paseador_id;
    const scores = [p1, p2, p3, p4, p5].map(Number);
    if (scores.some((n) => n < 1 || n > 5)) {
      return res.status(400).json({ error: "Responde las 5 preguntas con puntaje de 1 a 5." });
    }
    const promedio = scores.reduce((a, b) => a + b, 0) / 5;
    try {
      db.prepare(
        `INSERT INTO resenas (paseo_id, autor_id, destino_id, tipo, p1, p2, p3, p4, p5, comentario, promedio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(paseo.id, req.user.id, destino, tipo, scores[0], scores[1], scores[2], scores[3], scores[4], comentario || null, promedio);
    } catch {
      return res.status(409).json({ error: "Ya dejaste tu reseña de este paseo." });
    }
    refreshRating(destino, tipo);
    return res.status(201).json({ ok: true, promedio });
  }

  if (req.user.id === paseo.paseador_id) {
    tipo = "paseador_a_dueno";
    destino = paseo.dueno_id;
    const score = Number(p1);
    if (score < 1 || score > 5) return res.status(400).json({ error: "Califica al dueño de 1 a 5." });
    try {
      db.prepare(
        `INSERT INTO resenas (paseo_id, autor_id, destino_id, tipo, p1, comentario, promedio)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(paseo.id, req.user.id, destino, tipo, score, comentario || null, score);
    } catch {
      return res.status(409).json({ error: "Ya calificaste a este dueño." });
    }
    refreshRating(destino, tipo);
    return res.status(201).json({ ok: true, promedio: score });
  }

  res.status(403).json({ error: "No participaste en este paseo." });
});
