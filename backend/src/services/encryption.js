import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KEY_HEX = process.env.FILE_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function key() {
  return Buffer.from(KEY_HEX.slice(0, 64), "hex");
}

export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptBuffer(payload) {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const enc = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function writeEncrypted(dir, filename, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, filename);
  fs.writeFileSync(full, encryptBuffer(buffer));
  return full;
}

export function deleteFileSafe(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
