import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const volume = process.env.DATA_DIR;

export const dataDir = volume || path.join(backendRoot, "data");
export const uploadsDir = process.env.UPLOADS_DIR || (volume ? path.join(volume, "uploads") : path.join(backendRoot, "uploads"));
export const uploadIdsDir = path.join(uploadsDir, "ids");
export const uploadPerrosDir = path.join(uploadsDir, "perros");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadIdsDir, { recursive: true });
fs.mkdirSync(uploadPerrosDir, { recursive: true });
