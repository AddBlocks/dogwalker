import { api } from "./api";

export async function guardarPerro(value, id) {
  const fd = new FormData();
  fd.append("nombre", value.nombre || "");
  fd.append("raza", value.raza || "");
  fd.append("es_mezcla", value.es_mezcla ? "1" : "0");
  if (value.agresivo === true || value.agresivo === false) fd.append("agresivo", value.agresivo ? "1" : "0");
  if (value.avatar) fd.append("avatar", value.avatar);
  if (value.foto instanceof File) fd.append("foto", value.foto);
  if (value.quitar_foto) fd.append("quitar_foto", "1");
  return api(id ? `/api/perros/${id}` : "/api/perros", {
    method: id ? "PUT" : "POST",
    body: fd,
  });
}

export async function borrarPerro(id) {
  return api(`/api/perros/${id}`, { method: "DELETE" });
}
