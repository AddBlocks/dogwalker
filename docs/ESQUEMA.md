# Esquema de base de datos — Patitas

El MVP corre en **SQLite**. Este documento es el contrato para migrar a **Postgres + PostGIS** (Supabase) cuando crezca el tráfico.

## Entidades

```
comunas (32 de la Provincia de Santiago)
users (dueno | paseador | admin)
paseadores 1—1 users
paseador_comunas N—N
solicitudes (abierta | pendiente | aceptada | rechazada | cancelada)
paseos (acordado | en_curso | completado | cancelado)
paseo_puntos (recorrido GPS del paseador, de principio a fin)
resenas (dueno_a_paseador: 5 preguntas; paseador_a_dueno: 1)
comercios + comercio_resenas
anuncios + anuncio_eventos
```

## SQLite (fuente de verdad local)

Definida en `backend/src/db.js` (`migrate()`).

## Postgres / PostGIS (producción)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE comunas (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX comunas_geom_gix ON comunas USING GIST (geom);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('dueno','paseador','admin')),
  avatar_url TEXT,
  consentimiento_at TIMESTAMPTZ,
  calificacion_promedio NUMERIC(3,1) DEFAULT 0,
  calificacion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE paseadores (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
  descripcion TEXT,
  precio_clp INTEGER,
  disponibilidad TEXT,
  destacado BOOLEAN DEFAULT FALSE,
  estado_verificacion TEXT DEFAULT 'pendiente'
    CHECK (estado_verificacion IN ('pendiente','aprobado','rechazado')),
  proveedor_verificacion TEXT,
  id_externo_verificacion TEXT,
  cedula_frente TEXT,
  cedula_reverso TEXT,
  selfie TEXT,
  docs_eliminar_at TIMESTAMPTZ,
  paseos_completados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paseador_comunas (
  paseador_id BIGINT REFERENCES paseadores(id) ON DELETE CASCADE,
  comuna_id INTEGER REFERENCES comunas(id),
  PRIMARY KEY (paseador_id, comuna_id)
);

CREATE TABLE solicitudes (
  id BIGSERIAL PRIMARY KEY,
  dueno_id BIGINT NOT NULL REFERENCES users(id),
  paseador_id BIGINT REFERENCES users(id),
  comuna_id INTEGER NOT NULL REFERENCES comunas(id),
  horario TEXT NOT NULL,
  frecuencia TEXT NOT NULL,
  monto_clp INTEGER NOT NULL,
  mensaje TEXT,
  estado TEXT DEFAULT 'abierta'
    CHECK (estado IN ('abierta','pendiente','aceptada','rechazada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE paseos (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT REFERENCES solicitudes(id),
  dueno_id BIGINT NOT NULL REFERENCES users(id),
  paseador_id BIGINT NOT NULL REFERENCES users(id),
  comuna_id INTEGER NOT NULL REFERENCES comunas(id),
  fecha DATE NOT NULL,
  monto_clp INTEGER NOT NULL,
  estado TEXT DEFAULT 'acordado'
    CHECK (estado IN ('acordado','en_curso','completado','cancelado')),
  iniciado_at TIMESTAMPTZ,
  terminado_at TIMESTAMPTZ,
  distancia_m NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paseo_puntos (
  id BIGSERIAL PRIMARY KEY,
  paseo_id BIGINT NOT NULL REFERENCES paseos(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX paseo_puntos_paseo_idx ON paseo_puntos (paseo_id);

CREATE TABLE resenas (
  id BIGSERIAL PRIMARY KEY,
  paseo_id BIGINT NOT NULL REFERENCES paseos(id),
  autor_id BIGINT NOT NULL REFERENCES users(id),
  destino_id BIGINT NOT NULL REFERENCES users(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('dueno_a_paseador','paseador_a_dueno')),
  p1 SMALLINT, p2 SMALLINT, p3 SMALLINT, p4 SMALLINT, p5 SMALLINT,
  comentario TEXT,
  promedio NUMERIC(3,1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (paseo_id, tipo)
);

CREATE TABLE comercios (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL
    CHECK (categoria IN ('veterinaria','peluqueria','tienda','adiestrador')),
  comuna_id INTEGER NOT NULL REFERENCES comunas(id),
  direccion TEXT,
  telefono TEXT,
  horario TEXT,
  destacado BOOLEAN DEFAULT FALSE,
  estado TEXT DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aprobado','rechazado')),
  sugerido_por BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE comercio_resenas (
  id BIGSERIAL PRIMARY KEY,
  comercio_id BIGINT NOT NULL REFERENCES comercios(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  puntaje SMALLINT NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE anuncios (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT,
  imagen_url TEXT,
  enlace TEXT,
  ubicacion TEXT NOT NULL
    CHECK (ubicacion IN ('banner_mapa','tarjeta_busqueda','superior_directorio')),
  comuna_id INTEGER REFERENCES comunas(id),
  segmento TEXT NOT NULL CHECK (segmento IN ('duenos','paseadores','ambos')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  impresiones INTEGER DEFAULT 0,
  clics INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE anuncio_eventos (
  id BIGSERIAL PRIMARY KEY,
  anuncio_id BIGINT NOT NULL REFERENCES anuncios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('impresion','clic')),
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Consulta de paseadores por comuna con PostGIS (cuando `geom` esté cargado desde el GeoJSON oficial):

```sql
SELECT p.*
FROM paseadores p
JOIN paseador_comunas pc ON pc.paseador_id = p.id
JOIN comunas c ON c.id = pc.comuna_id
WHERE p.estado_verificacion = 'aprobado'
  AND ST_Contains(c.geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326));
```

En el MVP, la capa de comunas usa polígonos aproximados (círculos de radio por comuna) para no depender de un shapefile pesado. Reemplazar `geojson` por el recorte oficial de la RM cuando se active PostGIS.
