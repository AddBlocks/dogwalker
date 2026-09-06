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

export const BANCOS_CL = [
  "BancoEstado",
  "Banco de Chile",
  "Santander",
  "BCI",
  "Itaú",
  "Scotiabank",
  "Banco Falabella",
  "Banco Ripley",
  "Banco BICE",
  "Banco Security",
  "Coopeuch",
  "Tenpo",
  "Mercado Pago",
  "Otro",
];

export const TIPOS_CUENTA = [
  { id: "corriente", label: "Cuenta corriente" },
  { id: "vista", label: "Cuenta vista" },
  { id: "rut", label: "Cuenta RUT" },
  { id: "ahorro", label: "Cuenta de ahorro" },
];

export function pagoMomentoLabel(momento, monto) {
  if (momento === "antes") return "El pago se hace antes de pasear.";
  if (momento === "despues") return "El pago se hace después de pasear.";
  if (momento === "mixto") {
    return monto
      ? `Se paga una parte antes (${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(monto)}) y el resto después.`
      : "Se paga una parte antes y otra después de pasear.";
  }
  return null;
}

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
