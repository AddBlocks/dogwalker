import { db } from "../db.js";
import { deleteFileSafe } from "./encryption.js";

export const DOC_TIPOS = ["cedula_frente", "cedula_reverso", "selfie", "autorizacion_padres"];

export function archivarDoc(paseadorId, userId, tipo, filePath) {
  if (!filePath) return;
  db.prepare(
    `INSERT INTO documentos_historico (paseador_id, user_id, tipo, file_path, reemplazado_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(paseadorId, userId, tipo, filePath);
}

/** Guarda los archivos vigentes que se van a reemplazar. No borra nada. */
export function archivarReemplazos(paseador, nextPaths) {
  for (const tipo of DOC_TIPOS) {
    const next = nextPaths[tipo];
    const prev = paseador[tipo];
    if (next && prev && next !== prev) archivarDoc(paseador.id, paseador.user_id, tipo, prev);
  }
}

export function archivarVigentes(paseador) {
  if (!paseador) return;
  for (const tipo of DOC_TIPOS) {
    if (paseador[tipo]) archivarDoc(paseador.id, paseador.user_id, tipo, paseador[tipo]);
  }
}

export function listarPendientes() {
  return db
    .prepare(
      `SELECT h.id, h.paseador_id, h.user_id, h.tipo, h.reemplazado_at, u.nombre, u.email, u.deleted_at
       FROM documentos_historico h
       JOIN users u ON u.id = h.user_id
       WHERE h.borrado_at IS NULL
       ORDER BY h.reemplazado_at DESC`
    )
    .all();
}

export function listarPendientesDe(paseadorId) {
  return db
    .prepare(
      `SELECT id, tipo, reemplazado_at FROM documentos_historico
       WHERE paseador_id = ? AND borrado_at IS NULL
       ORDER BY reemplazado_at DESC`
    )
    .all(paseadorId);
}

export function getHistorico(id) {
  return db.prepare("SELECT * FROM documentos_historico WHERE id = ?").get(Number(id));
}

export function autorizarBorrado(id, adminId) {
  const row = db.prepare("SELECT * FROM documentos_historico WHERE id = ? AND borrado_at IS NULL").get(Number(id));
  if (!row) return { error: "Ese archivo ya no está pendiente.", status: 404 };
  deleteFileSafe(row.file_path);
  db.prepare(
    `UPDATE documentos_historico SET borrado_at = datetime('now'), autorizado_por = ? WHERE id = ?`
  ).run(adminId, row.id);
  return { ok: true };
}

/** El admin autoriza borrar todos los archivos (viejos y vigentes) de un usuario. */
export function borrarArchivosDeUsuario(userId, adminId) {
  const p = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(Number(userId));
  if (p) archivarVigentes(p);
  const pending = db
    .prepare("SELECT * FROM documentos_historico WHERE user_id = ? AND borrado_at IS NULL")
    .all(Number(userId));
  for (const row of pending) {
    deleteFileSafe(row.file_path);
    db.prepare(
      `UPDATE documentos_historico SET borrado_at = datetime('now'), autorizado_por = ? WHERE id = ?`
    ).run(adminId, row.id);
  }
}
