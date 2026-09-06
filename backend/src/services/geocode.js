const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NOMINATIM_HEADERS = {
  "User-Agent": "Patitas/1.0 (contacto@patitas.cl)",
  "Accept-Language": "es",
};

let lastNominatim = 0;

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function nominatimJson(url) {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  return res.json();
}

function searchUrl(query, { near, limit = 1, bounded = false } = {}) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Región Metropolitana, Chile`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "cl");
  url.searchParams.set("addressdetails", "0");
  if (near) {
    const d = 0.08;
    url.searchParams.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    if (bounded) url.searchParams.set("bounded", "1");
  }
  return url;
}

function elegirCerca(results, near, maxKm = 12) {
  if (!results?.length) return null;
  if (!near) return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
  let best = null;
  let bestD = Infinity;
  for (const r of results) {
    const p = { lat: Number(r.lat), lng: Number(r.lon) };
    const d = haversineKm(p, near);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best && bestD > maxKm) return null;
  return best;
}

/** Corrige typos frecuentes al buscar, sin cambiar el nombre que se muestra. */
export function normalizarBusquedaCalle(nombre) {
  return String(nombre || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bsause\b/gi, "sauce")
    .replace(/\bnorete\b/gi, "norte");
}

/** Nominatim (OSM). Sin Google. Máx. 1 consulta por segundo. */
export async function geocodeSantiago(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return null;
  const data = await nominatimJson(searchUrl(q, { near: opts.near, limit: opts.limit || 1, bounded: opts.bounded }));
  return elegirCerca(data, opts.near, opts.maxKm);
}

export async function comunaCercanaOSM(lat, lng) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "14");
  const data = await nominatimJson(url);
  const a = data?.address || {};
  return a.suburb || a.city_district || a.town || a.city || null;
}

export async function geocodeCalle(nombre, opts = {}) {
  const original = String(nombre || "").trim();
  if (!original) return { nombre: original, lat: null, lng: null };
  const limpio = normalizarBusquedaCalle(original);
  const variantes = [
    { q: limpio, bounded: true, limit: 5 },
    { q: `Avenida ${limpio}`, bounded: true, limit: 5 },
    opts.comuna ? { q: `${limpio}, ${opts.comuna}`, bounded: true, limit: 5 } : null,
    { q: limpio, bounded: false, limit: 5 },
  ].filter(Boolean);

  const seen = new Set();
  for (const v of variantes) {
    const key = `${v.q}|${v.bounded}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const geo = await geocodeSantiago(v.q, { near: opts.near, limit: v.limit, bounded: v.bounded, maxKm: 12 });
    if (geo) return { nombre: original, lat: geo.lat, lng: geo.lng };
  }
  return { nombre: original, lat: null, lng: null };
}

export async function geocodeLista(queries, opts = {}) {
  const out = [];
  for (const nombre of queries) {
    out.push(await geocodeCalle(nombre, opts));
  }
  return out;
}
