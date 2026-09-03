import { db } from "../db.js";
import { deleteFileSafe } from "./encryption.js";

/** Elimina cédulas y selfies 30 días después de la aprobación (Ley 21.719 / minimización). */
export function purgeExpiredIdDocuments() {
  const rows = db
    .prepare(
      `SELECT id, cedula_frente, cedula_reverso, selfie
       FROM paseadores
       WHERE docs_eliminar_at IS NOT NULL
         AND docs_eliminar_at <= datetime('now')
         AND (cedula_frente IS NOT NULL OR cedula_reverso IS NOT NULL OR selfie IS NOT NULL)`
    )
    .all();

  const update = db.prepare(
    `UPDATE paseadores
     SET cedula_frente = NULL, cedula_reverso = NULL, selfie = NULL
     WHERE id = ?`
  );

  for (const row of rows) {
    deleteFileSafe(row.cedula_frente);
    deleteFileSafe(row.cedula_reverso);
    deleteFileSafe(row.selfie);
    update.run(row.id);
  }
  return rows.length;
}

export function scheduleIdPurge(paseadorId) {
  db.prepare(
    `UPDATE paseadores
     SET docs_eliminar_at = datetime('now', '+30 days')
     WHERE id = ?`
  ).run(paseadorId);
}
