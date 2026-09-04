import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { db, lastId, migrate } from "./db.js";
import { COMUNAS, comunaFeature } from "./data/comunas.js";

migrate();

db.exec(`
  DELETE FROM anuncio_eventos;
  DELETE FROM anuncios;
  DELETE FROM comercio_resenas;
  DELETE FROM comercios;
  DELETE FROM resenas;
  DELETE FROM paseo_puntos;
  DELETE FROM paseos;
  DELETE FROM solicitudes;
  DELETE FROM paseador_comunas;
  DELETE FROM paseadores;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const insertComuna = db.prepare(
  `INSERT OR REPLACE INTO comunas (id, nombre, slug, lat, lng, radio_km, geojson)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const c of COMUNAS) {
  insertComuna.run(c.id, c.nombre, c.slug, c.lat, c.lng, c.radioKm, JSON.stringify(comunaFeature(c)));
}

const adminHash = bcrypt.hashSync("PaseoAdmin123", 10);
const admin = db
  .prepare(
    `INSERT INTO users (email, password_hash, nombre, telefono, rol, consentimiento_at)
     VALUES (?, ?, ?, ?, 'admin', datetime('now'))`
  )
  .run("admin@paseopatitas.cl", adminHash, "Administración PaseoPatitas", "+56911111111");

const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads", "ids");
if (fs.existsSync(uploadDir)) {
  for (const name of fs.readdirSync(uploadDir)) {
    fs.unlinkSync(path.join(uploadDir, name));
  }
}

const nUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
const nWalkers = db.prepare("SELECT COUNT(*) AS n FROM paseadores").get().n;
const nComunas = db.prepare("SELECT COUNT(*) AS n FROM comunas").get().n;

console.log("Base limpia. Listo para personas reales.");
console.log(`Comunas: ${nComunas} · usuarios: ${nUsers} · paseadores: ${nWalkers}`);
console.log("Admin: admin@paseopatitas.cl / PaseoAdmin123");
void lastId(admin);
db.close();
