export const PREGUNTAS_DUENO = [
  "¿El paseador llegó puntual?",
  "¿Trató bien a tu perro?",
  "¿Siguió las indicaciones que le diste?",
  "¿Cómo evalúas la comunicación?",
  "¿Lo recomendarías a otros dueños?",
];

export const PREGUNTA_PASEADOR = "¿Cómo fue tu experiencia con este dueño?";

export const CATEGORIAS = [
  { id: "veterinaria", label: "Veterinarias" },
  { id: "peluqueria", label: "Peluquerías" },
  { id: "tienda", label: "Tiendas" },
  { id: "adiestrador", label: "Adiestradores" },
];

export const FRECUENCIAS = ["Una vez", "2 a 3 veces por semana", "Lunes a viernes", "Todos los días"];

export function estadoLabel(estado) {
  return (
    {
      abierta: "Abierta",
      pendiente: "Pendiente",
      aceptada: "Aceptada",
      rechazada: "Rechazada",
      cancelada: "Cancelada",
      acordado: "Acordado",
      en_curso: "En curso",
      completado: "Completado",
      cancelado: "Cancelado",
      pendiente_verif: "En revisión",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    }[estado] || estado
  );
}
