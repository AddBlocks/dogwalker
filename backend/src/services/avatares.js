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

export const AVATAR_SLUGS = Object.values(RAZA_AVATAR);

export function slugForRaza(raza, avatar) {
  if (avatar && AVATAR_SLUGS.includes(avatar)) return avatar;
  return RAZA_AVATAR[raza] || "mestizo";
}
