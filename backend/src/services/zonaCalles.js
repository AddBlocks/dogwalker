import { haversineKm, normalizarBusquedaCalle } from "./geocode.js";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function norm(s) {
  return normalizarBusquedaCalle(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function tokens(nombre) {
  return norm(nombre)
    .replace(/\b(avenida|av\.?|calle|pasaje|psje\.?)\b/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["de", "del", "la", "el", "los", "las"].includes(t));
}

function scoreMatch(osmName, inputName) {
  const osmToks = tokens(osmName);
  const inToks = tokens(inputName);
  if (!inToks.length || !inToks.every((t) => osmToks.includes(t))) return -1;
  return 100 - osmToks.filter((t) => !inToks.includes(t)).length * 25;
}

function intersectSeg(a1, a2, b1, b2) {
  const dax = a2.lng - a1.lng;
  const day = a2.lat - a1.lat;
  const dbx = b2.lng - b1.lng;
  const dby = b2.lat - b1.lat;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-15) return null;
  const t = ((b1.lng - a1.lng) * dby - (b1.lat - a1.lat) * dbx) / den;
  const u = ((b1.lng - a1.lng) * day - (b1.lat - a1.lat) * dax) / den;
  if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;
  return { lat: a1.lat + t * day, lng: a1.lng + t * dax };
}

function segmentos(ways) {
  const out = [];
  for (const w of ways) {
    const g = w.geometry || [];
    for (let i = 0; i < g.length - 1; i++) {
      out.push({
        a: { lat: g[i].lat, lng: g[i].lon },
        b: { lat: g[i + 1].lat, lng: g[i + 1].lon },
      });
    }
  }
  return out;
}

function clusterCerca(puntos, radioKm = 0.08) {
  const clusters = [];
  for (const p of puntos) {
    const c = clusters.find((cl) => haversineKm(cl, p) < radioKm);
    if (c) {
      c.n += 1;
      c.lat = (c.lat * (c.n - 1) + p.lat) / c.n;
      c.lng = (c.lng * (c.n - 1) + p.lng) / c.n;
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, n: 1 });
    }
  }
  return clusters;
}

function cascoConvexo(puntos) {
  const pts = [...puntos].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  if (pts.length < 3) return pts;
  const cruz = (o, a, b) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cruz(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cruz(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function tokenBusqueda(nombre) {
  return tokens(nombre).sort((a, b) => b.length - a.length)[0] || "";
}

async function overpassVias(nombres, near) {
  const toks = [...new Set(nombres.map(tokenBusqueda).filter(Boolean))];
  if (!toks.length || !near) return [];
  const around = `(around:5000,${near.lat},${near.lng})`;
  const ways = toks
    .map((t) => `way["highway"]["name"~"${t}",i]${around};`)
    .join("\n  ");
  const q = `[out:json][timeout:25];\n(\n  ${ways}\n);\nout geom;`;
  let lastErr = null;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": "Patitas/1.0 (contacto@patitas.cl)" },
        body: new URLSearchParams({ data: q }),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith("{")) {
        lastErr = new Error(text.slice(0, 180));
        continue;
      }
      const data = JSON.parse(text);
      const found = (data.elements || []).filter((e) => e.type === "way" && e.geometry?.length);
      if (found.length) return found;
      lastErr = new Error(data.remark || "Overpass sin vías");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Overpass no disponible");
}

function cruzMasCercano(segsA, segsB, near) {
  const hits = [];
  for (const s of segsA) {
    for (const t of segsB) {
      const p = intersectSeg(s.a, s.b, t.a, t.b);
      if (p) hits.push(p);
    }
  }
  if (hits.length) {
    const clusters = clusterCerca(hits);
    return clusters.sort((a, b) => haversineKm(a, near) - haversineKm(b, near))[0];
  }
  let best = null;
  let bestD = Infinity;
  for (const s of segsA) {
    for (const t of segsB) {
      for (const p of [s.a, s.b]) {
        for (const q of [t.a, t.b]) {
          const d = haversineKm(p, q);
          if (d < bestD) {
            bestD = d;
            best = { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 };
          }
        }
      }
    }
  }
  if (best && bestD <= 0.05) return best;
  return null;
}

export function parseZona(json) {
  try {
    const raw = JSON.parse(json || "[]");
    if (Array.isArray(raw)) return { calles: raw, vertices: [], poligono: null };
    const calles = Array.isArray(raw.calles) ? raw.calles : [];
    const vertices = Array.isArray(raw.vertices) ? raw.vertices : [];
    const poligono = Array.isArray(raw.poligono) && raw.poligono.length >= 3 ? raw.poligono : null;
    return { calles, vertices, poligono };
  } catch {
    return { calles: [], vertices: [], poligono: null };
  }
}

export function puntoEnPoligono(lat, lng, ring) {
  if (!ring?.length) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = Number(ring[i][0]);
    const xi = Number(ring[i][1]);
    const yj = Number(ring[j][0]);
    const xj = Number(ring[j][1]);
    const cruza = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (cruza) inside = !inside;
  }
  return inside;
}

export function nombresDesdeZona(json) {
  return parseZona(json)
    .calles.map((c) => (typeof c === "string" ? c : c.nombre))
    .filter(Boolean);
}

/** Cruza las calles en OSM; los cruces son las esquinas de la zona. */
export async function armarZonaCalles(nombres, { near } = {}) {
  const unicas = [...new Set(nombres.map((n) => String(n).trim()).filter(Boolean))].slice(0, 12);
  if (!unicas.length) return { calles: [], vertices: [], poligono: null, sinUbicacion: [] };

  const ways = await overpassVias(unicas, near);
  const grupos = unicas.map((nombre) => {
    const scored = ways.map((w) => ({ w, score: scoreMatch(w.tags?.name, nombre) })).filter((x) => x.score >= 0);
    const max = Math.max(-1, ...scored.map((x) => x.score));
    const chosen = max >= 75 ? scored.filter((x) => x.score === max).map((x) => x.w) : [];
    return { nombre, ways: chosen, osm: chosen[0]?.tags?.name || null };
  });

  const vertices = [];
  for (let i = 0; i < grupos.length; i++) {
    for (let j = i + 1; j < grupos.length; j++) {
      if (!grupos[i].ways.length || !grupos[j].ways.length) continue;
      const cruz = cruzMasCercano(segmentos(grupos[i].ways), segmentos(grupos[j].ways), near);
      if (cruz) {
        vertices.push({
          lat: cruz.lat,
          lng: cruz.lng,
          a: grupos[i].nombre,
          b: grupos[j].nombre,
        });
      }
    }
  }

  const unicos = clusterCerca(vertices, 0.03).map((c) => {
    const src = vertices.find((v) => haversineKm(v, c) < 0.03) || c;
    return { lat: c.lat, lng: c.lng, a: src.a, b: src.b };
  });

  const casco = cascoConvexo(unicos);
  const poligono = casco.length >= 3 ? casco.map((p) => [p.lat, p.lng]) : null;

  const calles = grupos.map((g) => {
    const v = unicos.find((x) => x.a === g.nombre || x.b === g.nombre);
    return { nombre: g.nombre, lat: v?.lat ?? null, lng: v?.lng ?? null, osm: g.osm };
  });

  return {
    calles,
    vertices: unicos,
    poligono,
    sinUbicacion: grupos.filter((g) => !g.ways.length).map((g) => g.nombre),
  };
}
