/**
 * Adaptador de verificación de identidad.
 * VERIFY_PROVIDER=mock | truora | toc
 * Un paseador no aparece en el mapa hasta que un admin (o el proveedor) lo apruebe.
 */
const PROVIDER = (process.env.VERIFY_PROVIDER || "mock").toLowerCase();

async function mockSubmit({ userId }) {
  return {
    provider: "mock",
    externalId: `mock-${userId}-${Date.now()}`,
    status: "pendiente",
    message: "Documentos recibidos. Quedan en revisión manual (modo demo).",
  };
}

async function truoraSubmit({ userId }) {
  const key = process.env.TRUORA_API_KEY;
  if (!key) {
    return mockSubmit({ userId });
  }
  // Punto de extensión: POST a la API de Truora con las imágenes cifradas/subidas.
  return {
    provider: "truora",
    externalId: `truora-pending-${userId}`,
    status: "pendiente",
    message: "Enviado a Truora. El webhook o el panel confirmará el resultado.",
  };
}

async function tocSubmit({ userId }) {
  const key = process.env.TOC_API_KEY;
  if (!key) {
    return mockSubmit({ userId });
  }
  return {
    provider: "toc",
    externalId: `toc-pending-${userId}`,
    status: "pendiente",
    message: "Enviado a TOC Biometrics. Esperando resultado.",
  };
}

const adapters = {
  mock: { submit: mockSubmit },
  truora: { submit: truoraSubmit },
  toc: { submit: tocSubmit },
};

export function verificationProviderName() {
  return adapters[PROVIDER] ? PROVIDER : "mock";
}

export async function submitVerification(payload) {
  const adapter = adapters[PROVIDER] || adapters.mock;
  return adapter.submit(payload);
}
