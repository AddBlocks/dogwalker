/** Normaliza un celular chileno a E.164 (+56…). */
export function telefonoE164(raw) {
  if (!raw) return null;
  let d = String(raw).trim();
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  const digits = d.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("56")) n = n;
  else if (n.startsWith("9") && n.length === 9) n = `56${n}`;
  else if (n.length === 8) n = `569${n}`;
  else return null;
  if (n.length < 11) return null;
  if (/^56(0+|1{8,}|9?1{8,})$/.test(n)) return null;
  return `+${n}`;
}

/*
function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function twilioMessage({ to, from, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Twilio rechazó el mensaje.");
  }
  return data;
}

export async function enviarSms(toRaw, body) {
  const to = telefonoE164(toRaw);
  if (!to) return { ok: false, skipped: true };
  if (!twilioConfigured() || !process.env.TWILIO_SMS_FROM) {
    console.warn(`[Patitas] SMS no configurado. A ${to}: ${body}`);
    return { ok: true, mock: true };
  }
  await twilioMessage({ to, from: process.env.TWILIO_SMS_FROM, body });
  return { ok: true };
}

export async function enviarWhatsapp(toRaw, body) {
  const to = telefonoE164(toRaw);
  if (!to) return { ok: false, skipped: true };
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!twilioConfigured() || !from) {
    console.warn(`[Patitas] WhatsApp no configurado. A ${to}: ${body}`);
    return { ok: true, mock: true };
  }
  const fromWa = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  await twilioMessage({ to: `whatsapp:${to}`, from: fromWa, body });
  return { ok: true };
}
*/

export async function enviarSms() {
  return { ok: false, skipped: true };
}

export async function enviarWhatsapp() {
  return { ok: false, skipped: true };
}
