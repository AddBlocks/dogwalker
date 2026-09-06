const MESES = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

export function edadEnAnios(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad -= 1;
  return edad;
}

function isoValido(y, m, d) {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fechasEnTexto(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  const out = [];
  const num = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g;
  let m;
  while ((m = num.exec(t))) {
    const iso = isoValido(Number(m[3]), Number(m[2]), Number(m[1]));
    if (iso) out.push({ iso, idx: m.index });
  }
  const isoRe = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g;
  while ((m = isoRe.exec(t))) {
    const iso = isoValido(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.push({ iso, idx: m.index });
  }
  const mesRe = /(\d{1,2})\s+(?:de\s+)?([A-Za-záéíóúñ]+)(?:\s+de)?\s+(\d{4})/gi;
  while ((m = mesRe.exec(t))) {
    const mes = MESES[m[2].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")];
    if (!mes) continue;
    const iso = isoValido(Number(m[3]), mes, Number(m[1]));
    if (iso) out.push({ iso, idx: m.index });
  }
  return out;
}

export function extraerNacimiento(ocrText) {
  const raw = String(ocrText || "");
  const fechas = fechasEnTexto(raw);
  if (!fechas.length) return null;
  const lower = raw.toLowerCase();
  const ancla = lower.search(/nacim|birth|fecha de nac/);
  const candidatas = fechas
    .map((f) => ({ ...f, edad: edadEnAnios(f.iso) }))
    .filter((f) => f.edad != null && f.edad >= 5 && f.edad <= 90);
  if (!candidatas.length) return null;
  if (ancla >= 0) {
    candidatas.sort((a, b) => Math.abs(a.idx - ancla) - Math.abs(b.idx - ancla));
    return candidatas[0].iso;
  }
  candidatas.sort((a, b) => a.iso.localeCompare(b.iso));
  return candidatas[0].iso;
}

export async function leerFechaNacimiento(buffer) {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa+eng");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return extraerNacimiento(data?.text || "");
  } catch (err) {
    console.error("[Patitas] OCR cédula", err.message || err);
    return null;
  }
}

export function resolverEdad({ ocrIso, fechaFormulario }) {
  const iso = ocrIso || (fechaFormulario && /^\d{4}-\d{2}-\d{2}$/.test(fechaFormulario) ? fechaFormulario : null);
  const edad = edadEnAnios(iso);
  return { fecha_nacimiento: iso, edad };
}

export function validarEdadPaseador(edad) {
  if (edad == null) {
    return { error: "No pudimos leer la fecha de nacimiento de la cédula. Ingresala a mano." };
  }
  if (edad < 15) {
    return { error: "Tenés que tener al menos 15 años para inscribirte en Patitas." };
  }
  return { ok: true, menor: edad < 18 };
}
