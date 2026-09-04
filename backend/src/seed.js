import bcrypt from "bcryptjs";
import { db, lastId, migrate } from "./db.js";
import { COMUNAS, comunaFeature } from "./data/comunas.js";

migrate();

const hash = bcrypt.hashSync("PaseoDemo123", 10);
const adminHash = bcrypt.hashSync("PaseoAdmin123", 10);

const insertComuna = db.prepare(
  `INSERT OR REPLACE INTO comunas (id, nombre, slug, lat, lng, radio_km, geojson)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const c of COMUNAS) {
  insertComuna.run(c.id, c.nombre, c.slug, c.lat, c.lng, c.radioKm, JSON.stringify(comunaFeature(c)));
}

function upsertUser({ email, password_hash, nombre, telefono, rol, calificacion_promedio = 0, calificacion_count = 0 }) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return existing.id;
  const r = db
    .prepare(
      `INSERT INTO users (email, password_hash, nombre, telefono, rol, consentimiento_at, calificacion_promedio, calificacion_count)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`
    )
    .run(email, password_hash, nombre, telefono, rol, calificacion_promedio, calificacion_count);
  return lastId(r);
}

const adminId = upsertUser({
  email: "admin@paseopatitas.cl",
  password_hash: adminHash,
  nombre: "Administración PaseoPatitas",
  telefono: "+56911111111",
  rol: "admin",
});

if (!process.argv.includes("--demo")) {
  console.log("Semilla base lista (32 comunas + admin). Sin cuentas de prueba.");
  console.log("Admin: admin@paseopatitas.cl / PaseoAdmin123");
  console.log("Para datos ficticios: npm run seed:demo");
  void adminId;
  db.close();
  process.exit(0);
}

const duenoId = upsertUser({
  email: "dueno@paseopatitas.cl",
  password_hash: hash,
  nombre: "Francisca Lagos",
  telefono: "+56922222222",
  rol: "dueno",
  calificacion_promedio: 4.8,
  calificacion_count: 6,
});

const walkers = [
  {
    email: "camila@paseopatitas.cl",
    nombre: "Camila Rojas",
    telefono: "+56932111111",
    descripcion: "Paseos tranquilos en Las Condes. Trabajo con perros chicos y medianos, ritmo según tu peludo.",
    precio: 12000,
    disponibilidad: "Lunes a viernes 8:00–13:00 y 16:00–19:00",
    comunas: [14, 32],
    destacado: 1,
    rating: 4.8,
    count: 47,
    paseos: 47,
  },
  {
    email: "matias@paseopatitas.cl",
    nombre: "Matías Soto",
    telefono: "+56932111112",
    descripcion: "Ñuñoa y alrededores. Me encantan los perros energéticos: pelota, trote corto y hartos olores.",
    precio: 9000,
    disponibilidad: "Todos los días 7:30–11:00 y 17:00–20:00",
    comunas: [20, 23],
    destacado: 0,
    rating: 4.6,
    count: 31,
    paseos: 31,
  },
  {
    email: "fernanda@paseopatitas.cl",
    nombre: "Fernanda Díaz",
    telefono: "+56932111113",
    descripcion: "Providencia y Santiago centro. Puntual, con reporte por WhatsApp al terminar.",
    precio: 11000,
    disponibilidad: "Lunes a sábado 9:00–18:00",
    comunas: [23, 1],
    destacado: 1,
    rating: 4.9,
    count: 62,
    paseos: 62,
  },
  {
    email: "diego@paseopatitas.cl",
    nombre: "Diego Muñoz",
    telefono: "+56932111114",
    descripcion: "Maipú y Cerrillos. Paseos de 45 a 60 minutos, también perros grandes.",
    precio: 8000,
    disponibilidad: "Martes a domingo 8:00–14:00",
    comunas: [19, 2],
    destacado: 0,
    rating: 4.4,
    count: 18,
    paseos: 18,
  },
  {
    email: "valentina@paseopatitas.cl",
    nombre: "Valentina Pérez",
    telefono: "+56932111115",
    descripcion: "La Florida y Peñalolén. Paciente con perros reactivos y primerizos.",
    precio: 8500,
    disponibilidad: "Lunes a viernes 12:00–20:00",
    comunas: [10, 22],
    destacado: 0,
    rating: 4.7,
    count: 25,
    paseos: 25,
  },
  {
    email: "nicolas@paseopatitas.cl",
    nombre: "Nicolás Castillo",
    telefono: "+56932111116",
    descripcion: "Santiago y Estación Central. Rutas por parques y calles tranquilas.",
    precio: 10000,
    disponibilidad: "Lunes a viernes 6:30–9:30 y 18:00–21:00",
    comunas: [1, 6],
    destacado: 0,
    rating: 4.5,
    count: 40,
    paseos: 40,
  },
  {
    email: "javiera@paseopatitas.cl",
    nombre: "Javiera Morales",
    telefono: "+56932111117",
    descripcion: "Ñuñoa y Macul. Estudio vet y cuido el ritmo de cada perro.",
    precio: 9500,
    disponibilidad: "Miércoles a domingo 10:00–16:00",
    comunas: [20, 18],
    destacado: 0,
    rating: 4.3,
    count: 12,
    paseos: 12,
  },
  {
    email: "felipe@paseopatitas.cl",
    nombre: "Felipe Contreras",
    telefono: "+56932111118",
    descripcion: "Recoleta e Independencia. Paseos urbanos, recojo y dejo en tu casa.",
    precio: 7500,
    disponibilidad: "Lunes a sábado 7:00–12:00",
    comunas: [27, 8],
    destacado: 0,
    rating: 4.2,
    count: 9,
    paseos: 9,
  },
  {
    email: "antonia@paseopatitas.cl",
    nombre: "Antonia Vega",
    telefono: "+56932111119",
    descripcion: "Vitacura y Lo Barnechea. Experiencia con razas grandes y senderos de cerro suave.",
    precio: 14000,
    disponibilidad: "Lunes a viernes 8:00–17:00",
    comunas: [32, 15],
    destacado: 1,
    rating: 4.9,
    count: 55,
    paseos: 55,
  },
  {
    email: "sebastian@paseopatitas.cl",
    nombre: "Sebastián Herrera",
    telefono: "+56932111120",
    descripcion: "Quilicura y Huechuraba. Partidas temprano, ideal si trabajai en oficina.",
    precio: 8000,
    disponibilidad: "Lunes a viernes 6:00–10:00",
    comunas: [25, 7],
    destacado: 0,
    rating: 4.1,
    count: 7,
    paseos: 7,
  },
];

const insertPaseador = db.prepare(
  `INSERT INTO paseadores
    (user_id, descripcion, precio_clp, disponibilidad, destacado, estado_verificacion, proveedor_verificacion, paseos_completados)
   VALUES (?, ?, ?, ?, ?, 'aprobado', 'seed', ?)`
);
const insertPC = db.prepare("INSERT OR IGNORE INTO paseador_comunas (paseador_id, comuna_id) VALUES (?, ?)");

for (const w of walkers) {
  const uid = upsertUser({
    email: w.email,
    password_hash: hash,
    nombre: w.nombre,
    telefono: w.telefono,
    rol: "paseador",
    calificacion_promedio: w.rating,
    calificacion_count: w.count,
  });
  const exists = db.prepare("SELECT id FROM paseadores WHERE user_id = ?").get(uid);
  let pid = exists?.id;
  if (!pid) {
    pid = lastId(insertPaseador.run(uid, w.descripcion, w.precio, w.disponibilidad, w.destacado, w.paseos));
  }
  for (const cid of w.comunas) insertPC.run(pid, cid);
}

const pendingUid = upsertUser({
  email: "pendiente@paseopatitas.cl",
  password_hash: hash,
  nombre: "Rodrigo Salinas",
  telefono: "+56932111121",
  rol: "paseador",
});
if (!db.prepare("SELECT id FROM paseadores WHERE user_id = ?").get(pendingUid)) {
  const pid = lastId(
    db
      .prepare(
        `INSERT INTO paseadores (user_id, descripcion, precio_clp, disponibilidad, estado_verificacion, proveedor_verificacion)
         VALUES (?, ?, ?, ?, 'pendiente', 'mock')`
      )
      .run(pendingUid, "Paseador nuevo en San Miguel, esperando aprobación.", 7000, "Fines de semana")
  );
  insertPC.run(pid, 30);
}

const negocios = [
  {
    nombre: "Vet Amiga Providencia",
    categoria: "veterinaria",
    comuna_id: 23,
    direccion: "Av. Providencia 1234",
    telefono: "+56222334455",
    horario: "Lun–Sáb 9:00–20:00",
    destacado: 1,
  },
  {
    nombre: "Baño y Corte Ñuñoa",
    categoria: "peluqueria",
    comuna_id: 20,
    direccion: "Irarrázaval 3450",
    telefono: "+56987654321",
    horario: "Mar–Sáb 10:00–18:00",
    destacado: 0,
  },
  {
    nombre: "Pet Shop Barrio Italia",
    categoria: "tienda",
    comuna_id: 23,
    direccion: "Av. Italia 1450",
    telefono: "+56976543210",
    horario: "Todos los días 10:00–21:00",
    destacado: 1,
  },
  {
    nombre: "Adiestra Ya Las Condes",
    categoria: "adiestrador",
    comuna_id: 14,
    direccion: "Apoquindo 4500",
    telefono: "+56965432109",
    horario: "Lun–Vie 8:00–19:00",
    destacado: 0,
  },
  {
    nombre: "Clínica Huella Maipú",
    categoria: "veterinaria",
    comuna_id: 19,
    direccion: "Av. Pajaritos 2100",
    telefono: "+56223445566",
    horario: "Lun–Dom 8:00–22:00",
    destacado: 0,
  },
];

const insertBiz = db.prepare(
  `INSERT INTO comercios (nombre, categoria, comuna_id, direccion, telefono, horario, destacado, estado, sugerido_por)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?)`
);
for (const b of negocios) {
  const exists = db.prepare("SELECT id FROM comercios WHERE nombre = ?").get(b.nombre);
  if (!exists) {
    insertBiz.run(b.nombre, b.categoria, b.comuna_id, b.direccion, b.telefono, b.horario, b.destacado, duenoId);
  }
}

const pendingBiz = db.prepare("SELECT id FROM comercios WHERE nombre = ?").get("Pet Express San Miguel");
if (!pendingBiz) {
  db.prepare(
    `INSERT INTO comercios (nombre, categoria, comuna_id, direccion, telefono, horario, estado, sugerido_por)
     VALUES (?, 'tienda', 30, 'Gran Avenida 4500', '+56951234567', 'Lun–Sáb 10:00–19:00', 'pendiente', ?)`
  ).run("Pet Express San Miguel", duenoId);
}

const ads = [
  {
    titulo: "Alimento premium con despacho en Santiago",
    texto: "10% de dcto. presentando PaseoPatitas. Solo esta semana.",
    imagen_url: "",
    enlace: "https://ejemplo.cl/alimento",
    ubicacion: "banner_mapa",
    comuna_id: 1,
    segmento: "ambos",
  },
  {
    titulo: "Seguro para perros urbanos",
    texto: "Cobertura de accidentes en el paseo. Cotiza en 2 minutos.",
    imagen_url: "",
    enlace: "https://ejemplo.cl/seguro",
    ubicacion: "tarjeta_busqueda",
    comuna_id: null,
    segmento: "duenos",
  },
  {
    titulo: "Vacuna antirrábica a domicilio",
    texto: "Agenda en veterinarias de la red PaseoPatitas.",
    imagen_url: "",
    enlace: "https://ejemplo.cl/vacuna",
    ubicacion: "superior_directorio",
    comuna_id: 23,
    segmento: "ambos",
  },
];

const insertAd = db.prepare(
  `INSERT INTO anuncios (titulo, texto, imagen_url, enlace, ubicacion, comuna_id, segmento, fecha_inicio, fecha_fin, activo)
   VALUES (?, ?, ?, ?, ?, ?, ?, date('now','-7 days'), date('now','+60 days'), 1)`
);
for (const a of ads) {
  const exists = db.prepare("SELECT id FROM anuncios WHERE titulo = ?").get(a.titulo);
  if (!exists) {
    insertAd.run(a.titulo, a.texto, a.imagen_url, a.enlace, a.ubicacion, a.comuna_id, a.segmento);
  }
}

console.log("Semilla lista.");
console.log("Admin:     admin@paseopatitas.cl / PaseoAdmin123");
console.log("Dueña:     dueno@paseopatitas.cl / PaseoDemo123");
console.log("Paseadora: camila@paseopatitas.cl / PaseoDemo123");
console.log("Paseador pendiente: pendiente@paseopatitas.cl / PaseoDemo123");
void adminId;
db.close();
