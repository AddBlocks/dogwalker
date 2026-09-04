const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Nominatim (OSM). Sin Google. Máx. 1 consulta por segundo. */
export async function geocodeSantiago(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${q}, Región Metropolitana, Chile`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "cl");
  url.searchParams.set("addressdetails", "0");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PaseoPatitas/1.0 (contacto@paseopatitas.cl)",
      "Accept-Language": "es",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.[0]) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

export async function geocodeLista(queries) {
  const out = [];
  for (const nombre of queries) {
    await sleep(1100);
    const geo = await geocodeSantiago(nombre);
    out.push(geo ? { nombre, lat: geo.lat, lng: geo.lng } : { nombre, lat: null, lng: null });
  }
  return out;
}
