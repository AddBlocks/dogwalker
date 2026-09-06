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
db.exec("PRAGMA busy_timeout = 5000");

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
      deleted_at TEXT,
      autorizado INTEGER DEFAULT 1,
      notify_email INTEGER DEFAULT 1,
      notify_sms INTEGER DEFAULT 0,
      perro_raza TEXT,
      perro_mezcla INTEGER DEFAULT 0,
      perro_agresivo INTEGER DEFAULT 0
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
      direccion_privada TEXT,
      lat REAL,
      lng REAL,
      radio_km REAL,
      calles_json TEXT,
      banco TEXT,
      tipo_cuenta TEXT,
      numero_cuenta TEXT,
      titular TEXT,
      rut_titular TEXT,
      email_transferencia TEXT,
      pago_momento TEXT,
      monto_anticipado_clp INTEGER,
      fecha_nacimiento TEXT,
      edad INTEGER,
      solo_no_peligrosas INTEGER DEFAULT 0,
      autorizacion_padres TEXT,
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
      raza TEXT,
      es_mezcla INTEGER DEFAULT 0,
      agresivo INTEGER DEFAULT 0,
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
  migrateZonaPaseo();
  migratePagoPaseador();
  migrateMarcaPatitas();
  migrateNotificaciones();
  migrateAvisos();
  migrateEdadYPerro();
  migrateClaveTemporal();
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

function migrateZonaPaseo() {
  if (!hasColumn("paseadores", "direccion_privada")) db.exec("ALTER TABLE paseadores ADD COLUMN direccion_privada TEXT");
  if (!hasColumn("paseadores", "lat")) db.exec("ALTER TABLE paseadores ADD COLUMN lat REAL");
  if (!hasColumn("paseadores", "lng")) db.exec("ALTER TABLE paseadores ADD COLUMN lng REAL");
  if (!hasColumn("paseadores", "radio_km")) db.exec("ALTER TABLE paseadores ADD COLUMN radio_km REAL");
  if (!hasColumn("paseadores", "calles_json")) db.exec("ALTER TABLE paseadores ADD COLUMN calles_json TEXT");
}

function migratePagoPaseador() {
  if (!hasColumn("paseadores", "banco")) db.exec("ALTER TABLE paseadores ADD COLUMN banco TEXT");
  if (!hasColumn("paseadores", "tipo_cuenta")) db.exec("ALTER TABLE paseadores ADD COLUMN tipo_cuenta TEXT");
  if (!hasColumn("paseadores", "numero_cuenta")) db.exec("ALTER TABLE paseadores ADD COLUMN numero_cuenta TEXT");
  if (!hasColumn("paseadores", "titular")) db.exec("ALTER TABLE paseadores ADD COLUMN titular TEXT");
  if (!hasColumn("paseadores", "rut_titular")) db.exec("ALTER TABLE paseadores ADD COLUMN rut_titular TEXT");
  if (!hasColumn("paseadores", "email_transferencia")) db.exec("ALTER TABLE paseadores ADD COLUMN email_transferencia TEXT");
  if (!hasColumn("paseadores", "pago_momento")) db.exec("ALTER TABLE paseadores ADD COLUMN pago_momento TEXT");
  if (!hasColumn("paseadores", "monto_anticipado_clp")) db.exec("ALTER TABLE paseadores ADD COLUMN monto_anticipado_clp INTEGER");
}

function migrateMarcaPatitas() {
  db.prepare(
    `UPDATE users SET email = replace(email, '@paseopatitas.cl', '@patitas.cl')
     WHERE email LIKE '%@paseopatitas.cl'`
  ).run();
  db.prepare(
    `UPDATE users SET nombre = replace(nombre, 'PaseoPatitas', 'Patitas')
     WHERE nombre LIKE '%PaseoPatitas%'`
  ).run();
  try {
    db.prepare(
      `UPDATE anuncios SET texto = replace(texto, 'PaseoPatitas', 'Patitas')
       WHERE texto LIKE '%PaseoPatitas%'`
    ).run();
  } catch {
    /* tabla puede no existir en migraciones parciales */
  }
}

function migrateNotificaciones() {
  if (!hasColumn("users", "autorizado")) {
    db.exec("ALTER TABLE users ADD COLUMN autorizado INTEGER DEFAULT 1");
    db.exec("UPDATE users SET autorizado = 1 WHERE deleted_at IS NULL");
  }
  if (!hasColumn("users", "notify_email")) db.exec("ALTER TABLE users ADD COLUMN notify_email INTEGER DEFAULT 1");
  if (!hasColumn("users", "notify_sms")) db.exec("ALTER TABLE users ADD COLUMN notify_sms INTEGER DEFAULT 0");
}

function migrateEdadYPerro() {
  if (!hasColumn("users", "perro_raza")) db.exec("ALTER TABLE users ADD COLUMN perro_raza TEXT");
  if (!hasColumn("users", "perro_mezcla")) db.exec("ALTER TABLE users ADD COLUMN perro_mezcla INTEGER DEFAULT 0");
  if (!hasColumn("users", "perro_agresivo")) db.exec("ALTER TABLE users ADD COLUMN perro_agresivo INTEGER DEFAULT 0");
  if (!hasColumn("paseadores", "fecha_nacimiento")) db.exec("ALTER TABLE paseadores ADD COLUMN fecha_nacimiento TEXT");
  if (!hasColumn("paseadores", "edad")) db.exec("ALTER TABLE paseadores ADD COLUMN edad INTEGER");
  if (!hasColumn("paseadores", "solo_no_peligrosas")) db.exec("ALTER TABLE paseadores ADD COLUMN solo_no_peligrosas INTEGER DEFAULT 0");
  if (!hasColumn("paseadores", "autorizacion_padres")) db.exec("ALTER TABLE paseadores ADD COLUMN autorizacion_padres TEXT");
  if (!hasColumn("solicitudes", "raza")) db.exec("ALTER TABLE solicitudes ADD COLUMN raza TEXT");
  if (!hasColumn("solicitudes", "es_mezcla")) db.exec("ALTER TABLE solicitudes ADD COLUMN es_mezcla INTEGER DEFAULT 0");
  if (!hasColumn("solicitudes", "agresivo")) db.exec("ALTER TABLE solicitudes ADD COLUMN agresivo INTEGER DEFAULT 0");
  db.prepare("UPDATE users SET autorizado = 1 WHERE rol != 'paseador' AND deleted_at IS NULL").run();
}

function migrateClaveTemporal() {
  if (!hasColumn("users", "temp_password_hash")) db.exec("ALTER TABLE users ADD COLUMN temp_password_hash TEXT");
  if (!hasColumn("users", "temp_password_expires_at")) db.exec("ALTER TABLE users ADD COLUMN temp_password_expires_at TEXT");
  if (!hasColumn("users", "debe_cambiar_clave")) db.exec("ALTER TABLE users ADD COLUMN debe_cambiar_clave INTEGER DEFAULT 0");
}

function migrateAvisos() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS avisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      enlace TEXT,
      leido INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS avisos_user_idx ON avisos(user_id, leido);
  `);
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
    autorizado: row.autorizado !== 0,
    debe_cambiar_clave: Boolean(row.debe_cambiar_clave),
    perro_raza: row.perro_raza || "",
    perro_mezcla: Boolean(row.perro_mezcla),
    perro_agresivo: Boolean(row.perro_agresivo),
    notify_email: row.notify_email !== 0,
    notify_sms: Boolean(row.notify_sms),
  };
}
