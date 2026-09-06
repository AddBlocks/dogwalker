import { db } from "../db.js";
import { deleteFileSafe } from "./encryption.js";

export function eliminarCuenta(userId, { actorId } = {}) {
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL").get(Number(userId));
  if (!user) return { error: "Usuario no encontrado.", status: 404 };
  if (user.rol === "admin") {
    return { error: "No se puede eliminar una cuenta administradora.", status: 400 };
  }
  if (actorId && Number(actorId) === user.id) {
    return { error: "No podés eliminar tu propia cuenta desde el panel.", status: 400 };
  }

  const p = db.prepare("SELECT * FROM paseadores WHERE user_id = ?").get(user.id);
  if (p) {
    deleteFileSafe(p.cedula_frente);
    deleteFileSafe(p.cedula_reverso);
    deleteFileSafe(p.selfie);
    deleteFileSafe(p.autorizacion_padres);
    db.prepare(
      `UPDATE paseadores SET cedula_frente=NULL, cedula_reverso=NULL, selfie=NULL,
        descripcion=NULL, disponibilidad=NULL, direccion_privada=NULL, lat=NULL, lng=NULL,
        radio_km=NULL, calles_json=NULL, banco=NULL, tipo_cuenta=NULL, numero_cuenta=NULL,
        titular=NULL, rut_titular=NULL, email_transferencia=NULL, pago_momento=NULL,
        monto_anticipado_clp=NULL, fecha_nacimiento=NULL, edad=NULL, solo_no_peligrosas=0,
        autorizacion_padres=NULL, estado_verificacion='rechazado' WHERE id=?`
    ).run(p.id);
  }

  db.prepare(
    `UPDATE solicitudes SET estado = 'cancelada', responded_at = datetime('now')
     WHERE dueno_id = ? AND estado IN ('abierta','pendiente')`
  ).run(user.id);
  db.prepare(
    `UPDATE solicitudes SET estado = 'rechazada', responded_at = datetime('now')
     WHERE paseador_id = ? AND estado IN ('abierta','pendiente')`
  ).run(user.id);
  db.prepare(
    `UPDATE paseos SET estado = 'cancelado'
     WHERE (dueno_id = ? OR paseador_id = ?) AND estado IN ('acordado','en_curso')`
  ).run(user.id, user.id);

  const anon = `eliminado-${user.id}@eliminado.local`;
  db.prepare(
    `UPDATE users SET email = ?, password_hash = NULL, google_id = NULL, nombre = 'Cuenta eliminada',
      telefono = NULL, avatar_url = NULL, temp_password_hash = NULL, temp_password_expires_at = NULL,
      debe_cambiar_clave = 0, deleted_at = datetime('now')
     WHERE id = ?`
  ).run(anon, user.id);

  return { ok: true };
}
