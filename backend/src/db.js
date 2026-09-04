import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "paseopatitas.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comunas (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radio_km REAL NOT NULL,
      geojson TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      rol TEXT NOT NULL CHECK(rol IN ('dueno','paseador','admin')),
      avatar_url TEXT,
      consentimiento_at TEXT,
      calificacion_promedio REAL DEFAULT 0,
      calificacion_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS paseadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      descripcion TEXT,
      precio_clp INTEGER,
      disponibilidad TEXT,
      destacado INTEGER DEFAULT 0,
      estado_verificacion TEXT DEFAULT 'pendiente'
        CHECK(estado_verificacion IN ('pendiente','aprobado','rechazado')),
      proveedor_verificacion TEXT,
      id_externo_verificacion TEXT,
      cedula_frente TEXT,
      cedula_reverso TEXT,
      selfie TEXT,
      docs_eliminar_at TEXT,
      paseos_completados INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paseador_comunas (
      paseador_id INTEGER NOT NULL REFERENCES paseadores(id) ON DELETE CASCADE,
      comuna_id INTEGER NOT NULL REFERENCES comunas(id),
      PRIMARY KEY (paseador_id, comuna_id)
    );

    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dueno_id INTEGER NOT NULL REFERENCES users(id),
      paseador_id INTEGER REFERENCES users(id),
      comuna_id INTEGER NOT NULL REFERENCES comunas(id),
      horario TEXT NOT NULL,
      frecuencia TEXT NOT NULL,
      monto_clp INTEGER NOT NULL,
      mensaje TEXT,
      estado TEXT DEFAULT 'abierta'
        CHECK(estado IN ('abierta','pendiente','aceptada','rechazada','cancelada')),
      created_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS paseos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER REFERENCES solicitudes(id),
      dueno_id INTEGER NOT NULL REFERENCES users(id),
      paseador_id INTEGER NOT NULL REFERENCES users(id),
      comuna_id INTEGER NOT NULL REFERENCES comunas(id),
      fecha TEXT NOT NULL,
      monto_clp INTEGER NOT NULL,
      estado TEXT DEFAULT 'acordado'
        CHECK(estado IN ('acordado','en_curso','completado','cancelado')),
      iniciado_at TEXT,
      terminado_at TEXT,
      distancia_m REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paseo_puntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paseo_id INTEGER NOT NULL REFERENCES paseos(id) ON DELETE CASCADE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resenas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paseo_id INTEGER NOT NULL REFERENCES paseos(id),
      autor_id INTEGER NOT NULL REFERENCES users(id),
      destino_id INTEGER NOT NULL REFERENCES users(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('dueno_a_paseador','paseador_a_dueno')),
      p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER,
      comentario TEXT,
      promedio REAL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(paseo_id, tipo)
    );

    CREATE TABLE IF NOT EXISTS comercios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL
        CHECK(categoria IN ('veterinaria','peluqueria','tienda','adiestrador')),
      comuna_id INTEGER NOT NULL REFERENCES comunas(id),
      direccion TEXT,
      telefono TEXT,
      horario TEXT,
      destacado INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'pendiente'
        CHECK(estado IN ('pendiente','aprobado','rechazado')),
      sugerido_por INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comercio_resenas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comercio_id INTEGER NOT NULL REFERENCES comercios(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      puntaje INTEGER NOT NULL,
      comentario TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS anuncios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      texto TEXT,
      imagen_url TEXT,
      enlace TEXT,
      ubicacion TEXT NOT NULL
        CHECK(ubicacion IN ('banner_mapa','tarjeta_busqueda','superior_directorio')),
      comuna_id INTEGER REFERENCES comunas(id),
      segmento TEXT NOT NULL CHECK(segmento IN ('duenos','paseadores','ambos')),
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      activo INTEGER DEFAULT 1,
      impresiones INTEGER DEFAULT 0,
      clics INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS anuncio_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anuncio_id INTEGER NOT NULL REFERENCES anuncios(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('impresion','clic')),
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  migratePaseoTracking();
}

function tableSql(name) {
  return db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name)?.sql || "";
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

/** Bases ya creadas sin en_curso / puntos GPS. */
function migratePaseoTracking() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS paseo_puntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paseo_id INTEGER NOT NULL REFERENCES paseos(id) ON DELETE CASCADE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS paseo_puntos_paseo_idx ON paseo_puntos(paseo_id);
  `);
  if (!hasColumn("paseos", "iniciado_at")) db.exec("ALTER TABLE paseos ADD COLUMN iniciado_at TEXT");
  if (!hasColumn("paseos", "terminado_at")) db.exec("ALTER TABLE paseos ADD COLUMN terminado_at TEXT");
  if (!hasColumn("paseos", "distancia_m")) db.exec("ALTER TABLE paseos ADD COLUMN distancia_m REAL DEFAULT 0");

  const sql = tableSql("paseos");
  if (sql.includes("en_curso")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(`
    CREATE TABLE paseos_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER REFERENCES solicitudes(id),
      dueno_id INTEGER NOT NULL REFERENCES users(id),
      paseador_id INTEGER NOT NULL REFERENCES users(id),
      comuna_id INTEGER NOT NULL REFERENCES comunas(id),
      fecha TEXT NOT NULL,
      monto_clp INTEGER NOT NULL,
      estado TEXT DEFAULT 'acordado'
        CHECK(estado IN ('acordado','en_curso','completado','cancelado')),
      iniciado_at TEXT,
      terminado_at TEXT,
      distancia_m REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO paseos_mig (id, solicitud_id, dueno_id, paseador_id, comuna_id, fecha, monto_clp, estado, iniciado_at, terminado_at, distancia_m, created_at)
    SELECT id, solicitud_id, dueno_id, paseador_id, comuna_id, fecha, monto_clp, estado, iniciado_at, terminado_at, distancia_m, created_at FROM paseos;
    DROP TABLE paseos;
    ALTER TABLE paseos_mig RENAME TO paseos;
  `);
  db.exec("PRAGMA foreign_keys = ON");
}

export function lastId(result) {
  return Number(result.lastInsertRowid);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    telefono: row.telefono,
    rol: row.rol,
    avatar_url: row.avatar_url,
    calificacion_promedio: row.calificacion_promedio,
    calificacion_count: row.calificacion_count,
    consentimiento_at: row.consentimiento_at,
    created_at: row.created_at,
  };
}
