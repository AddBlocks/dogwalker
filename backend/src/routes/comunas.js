import { Router } from "express";
import { db } from "../db.js";
import { nearestComuna } from "../data/comunas.js";

export const comunasRouter = Router();

comunasRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT id, nombre, slug, lat, lng, radio_km FROM comunas ORDER BY nombre").all();
  res.json(rows);
});

comunasRouter.get("/geojson", (_req, res) => {
  const rows = db.prepare("SELECT geojson FROM comunas").all();
  res.json({
    type: "FeatureCollection",
    features: rows.map((r) => JSON.parse(r.geojson)),
  });
});

comunasRouter.get("/cercana", (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "Faltan coordenadas." });
  }
  const c = nearestComuna(lat, lng);
  res.json(c);
});
