/** 32 comunas de la Provincia de Santiago (Región Metropolitana). */
export const COMUNAS = [
  { id: 1, nombre: "Santiago", slug: "santiago", lat: -33.4372, lng: -70.6506, radioKm: 2.4 },
  { id: 2, nombre: "Cerrillos", slug: "cerrillos", lat: -33.5025, lng: -70.7119, radioKm: 2.1 },
  { id: 3, nombre: "Cerro Navia", slug: "cerro-navia", lat: -33.4225, lng: -70.735, radioKm: 2.0 },
  { id: 4, nombre: "Conchalí", slug: "conchali", lat: -33.3847, lng: -70.6747, radioKm: 2.0 },
  { id: 5, nombre: "El Bosque", slug: "el-bosque", lat: -33.5619, lng: -70.6764, radioKm: 2.0 },
  { id: 6, nombre: "Estación Central", slug: "estacion-central", lat: -33.4636, lng: -70.6989, radioKm: 2.0 },
  { id: 7, nombre: "Huechuraba", slug: "huechuraba", lat: -33.3681, lng: -70.6369, radioKm: 2.6 },
  { id: 8, nombre: "Independencia", slug: "independencia", lat: -33.415, lng: -70.665, radioKm: 1.5 },
  { id: 9, nombre: "La Cisterna", slug: "la-cisterna", lat: -33.5286, lng: -70.6628, radioKm: 1.6 },
  { id: 10, nombre: "La Florida", slug: "la-florida", lat: -33.5225, lng: -70.595, radioKm: 3.2 },
  { id: 11, nombre: "La Granja", slug: "la-granja", lat: -33.5389, lng: -70.6222, radioKm: 1.7 },
  { id: 12, nombre: "La Pintana", slug: "la-pintana", lat: -33.5831, lng: -70.6342, radioKm: 2.2 },
  { id: 13, nombre: "La Reina", slug: "la-reina", lat: -33.4436, lng: -70.5322, radioKm: 2.4 },
  { id: 14, nombre: "Las Condes", slug: "las-condes", lat: -33.408, lng: -70.568, radioKm: 3.4 },
  { id: 15, nombre: "Lo Barnechea", slug: "lo-barnechea", lat: -33.3533, lng: -70.5167, radioKm: 3.8 },
  { id: 16, nombre: "Lo Espejo", slug: "lo-espejo", lat: -33.5222, lng: -70.6958, radioKm: 1.5 },
  { id: 17, nombre: "Lo Prado", slug: "lo-prado", lat: -33.4442, lng: -70.7256, radioKm: 1.6 },
  { id: 18, nombre: "Macul", slug: "macul", lat: -33.485, lng: -70.6042, radioKm: 1.8 },
  { id: 19, nombre: "Maipú", slug: "maipu", lat: -33.5111, lng: -70.7581, radioKm: 3.6 },
  { id: 20, nombre: "Ñuñoa", slug: "nunoa", lat: -33.4544, lng: -70.5986, radioKm: 2.0 },
  { id: 21, nombre: "Pedro Aguirre Cerda", slug: "pedro-aguirre-cerda", lat: -33.4939, lng: -70.6761, radioKm: 1.6 },
  { id: 22, nombre: "Peñalolén", slug: "penalolen", lat: -33.4822, lng: -70.5389, radioKm: 2.8 },
  { id: 23, nombre: "Providencia", slug: "providencia", lat: -33.4319, lng: -70.6172, radioKm: 1.8 },
  { id: 24, nombre: "Pudahuel", slug: "pudahuel", lat: -33.4361, lng: -70.7642, radioKm: 3.4 },
  { id: 25, nombre: "Quilicura", slug: "quilicura", lat: -33.3611, lng: -70.7292, radioKm: 2.8 },
  { id: 26, nombre: "Quinta Normal", slug: "quinta-normal", lat: -33.4281, lng: -70.6994, radioKm: 1.8 },
  { id: 27, nombre: "Recoleta", slug: "recoleta", lat: -33.4061, lng: -70.6403, radioKm: 2.0 },
  { id: 28, nombre: "Renca", slug: "renca", lat: -33.4036, lng: -70.7258, radioKm: 2.2 },
  { id: 29, nombre: "San Joaquín", slug: "san-joaquin", lat: -33.4911, lng: -70.6283, radioKm: 1.6 },
  { id: 30, nombre: "San Miguel", slug: "san-miguel", lat: -33.4989, lng: -70.6517, radioKm: 1.5 },
  { id: 31, nombre: "San Ramón", slug: "san-ramon", lat: -33.5417, lng: -70.6431, radioKm: 1.5 },
  { id: 32, nombre: "Vitacura", slug: "vitacura", lat: -33.39, lng: -70.5728, radioKm: 2.4 },
];

export function circlePolygon(lat, lng, radiusKm, steps = 28) {
  const coords = [];
  const latR = radiusKm / 111;
  const lngR = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + lngR * Math.cos(a), lat + latR * Math.sin(a)]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

export function comunaFeature(comuna) {
  return {
    type: "Feature",
    properties: { id: comuna.id, nombre: comuna.nombre, slug: comuna.slug },
    geometry: circlePolygon(comuna.lat, comuna.lng, comuna.radioKm),
  };
}

export function nearestComuna(lat, lng) {
  let best = COMUNAS[0];
  let bestD = Infinity;
  for (const c of COMUNAS) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
