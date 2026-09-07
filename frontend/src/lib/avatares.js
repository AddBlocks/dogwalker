export const RAZA_AVATAR = {
  Labrador: "labrador",
  "Golden Retriever": "golden",
  "Poodle / Caniche": "poodle",
  "Pastor Alemán": "pastor-aleman",
  "Bulldog Francés": "bulldog-frances",
  Chihuahua: "chihuahua",
  Beagle: "beagle",
  Boxer: "boxer",
  "Husky Siberiano": "husky",
  "Border Collie": "border-collie",
  "Cocker Spaniel": "cocker",
  "Yorkshire Terrier": "yorkshire",
  "Dachshund / Salchicha": "salchicha",
  Rottweiler: "rottweiler",
  "Pitbull / Staffordshire": "pitbull",
  Akita: "akita",
  "Dogo Argentino": "dogo",
  "Fila Brasileiro": "fila",
  "Mezcla / mestizo": "mestizo",
  Otra: "otra",
};

export const AVATARES = Object.entries(RAZA_AVATAR).map(([raza, slug]) => ({
  raza,
  slug,
  src: `/avatares/avatar-${slug}.png`,
}));

export function slugAvatar(raza, avatar) {
  if (avatar && AVATARES.some((a) => a.slug === avatar)) return avatar;
  return RAZA_AVATAR[raza] || "mestizo";
}

export function urlAvatar(raza, avatar) {
  return `/avatares/avatar-${slugAvatar(raza, avatar)}.png`;
}

export function urlFotoPerro(perro) {
  if (!perro) return urlAvatar("Mezcla / mestizo");
  if (perro.fotoPreview) return perro.fotoPreview;
  if (perro.tiene_foto && perro.id && !perro.quitar_foto) return `/api/perros/${perro.id}/foto`;
  return urlAvatar(perro.raza, perro.avatar);
}

export const PERRO_VACIO = {
  nombre: "",
  raza: "",
  es_mezcla: false,
  agresivo: undefined,
  avatar: "",
  foto: null,
  fotoPreview: null,
  tiene_foto: false,
  quitar_foto: false,
};
