export function puntosCalle(calles = []) {
  return calles.filter((c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
}

export function cascoConvexo(puntos) {
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

export function poligonoCalles(calles) {
  const pts = puntosCalle(calles);
  if (pts.length < 3) return null;
  return cascoConvexo(pts).map((p) => [p.lat, p.lng]);
}

export function zonaVisible(w) {
  if (Array.isArray(w?.poligono) && w.poligono.length >= 3) return w.poligono;
  return poligonoCalles(w?.calles);
}

export function centroide(posiciones) {
  if (!posiciones?.length) return null;
  const lat = posiciones.reduce((s, p) => s + p[0], 0) / posiciones.length;
  const lng = posiciones.reduce((s, p) => s + p[1], 0) / posiciones.length;
  return [lat, lng];
}
