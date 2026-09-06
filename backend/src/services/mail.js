import { spawn } from "node:child_process";
import os from "node:os";
import nodemailer from "nodemailer";

let transporter;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && (process.env.SMTP_HOST || process.env.SMTP_SERVICE));
}

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const host = String(process.env.SMTP_HOST || "");
  const service =
    process.env.SMTP_SERVICE ||
    (host.includes("gmail") ? "gmail" : host.includes("outlook") || host.includes("office365") || host.includes("hotmail") ? "outlook" : "");
  const auth = { user, pass };

  if (service === "gmail") {
    transporter = nodemailer.createTransport({ service: "gmail", auth });
  } else if (service === "outlook" || service === "hotmail") {
    transporter = nodemailer.createTransport({
      host: host || "smtp-mail.outlook.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      requireTLS: true,
      auth,
    });
  } else {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_SECURE !== "true",
      auth,
    });
  }
  return transporter;
}

function enviarViaOutlook({ to, subject, text, html }) {
  if (os.platform() !== "win32") {
    return Promise.reject(new Error("Outlook solo está disponible en Windows."));
  }
  const payload = JSON.stringify({ to, subject, text, html: html || "" });
  const ps = `
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$ErrorActionPreference = 'Stop'
$json = [Console]::In.ReadToEnd()
$data = $json | ConvertFrom-Json
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = [string]$data.to
$mail.Subject = [string]$data.subject
if ($data.html) { $mail.HTMLBody = [string]$data.html }
else { $mail.Body = [string]$data.text }
$mail.Send()
$ns = $outlook.GetNamespace('MAPI')
try { $ns.SendAndReceive($true) } catch {}
Start-Sleep -Seconds 3
Write-Output 'sent'
`;

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Outlook tardó demasiado. Si aparece un aviso de seguridad, aceptalo y reintentá."));
    }, 45000);
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && out.includes("sent")) resolve({ ok: true, via: "outlook" });
      else reject(new Error((err || out || `Outlook salió con código ${code}`).trim()));
    });
    child.stdin.write(payload, "utf8");
    child.stdin.end();
  });
}

export async function enviarCorreo({ to, subject, text, html }) {
  if (!to) return { ok: false, skipped: true };

  if (smtpConfigured()) {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || `Patitas <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || `<pre>${text}</pre>`,
    });
    console.log(`[Patitas] correo SMTP a ${to} id=${info.messageId}`);
    return { ok: true, via: "smtp", id: info.messageId };
  }

  if (os.platform() === "win32") {
    try {
      const r = await enviarViaOutlook({ to, subject, text, html });
      console.log(`[Patitas] correo Outlook a ${to}`);
      return r;
    } catch (e) {
      console.error("[Patitas] Outlook no pudo enviar:", e.message);
      throw e;
    }
  }

  console.error(`[Patitas] SMTP no configurado. Correo a ${to}: ${subject}\n${text}`);
  return { ok: false, mock: true };
}
