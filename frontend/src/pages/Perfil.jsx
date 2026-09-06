import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Stars from "../components/Stars";
import { BANCOS_CL, TIPOS_CUENTA } from "../lib/format";
import DatosPerro from "../components/DatosPerro";

export default function Perfil() {
  const { user, paseador, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [nombre, setNombre] = useState(user.nombre);
  const [telefono, setTelefono] = useState(user.telefono || "");
  const [pago, setPago] = useState({
    banco: paseador?.banco || "",
    tipo_cuenta: paseador?.tipo_cuenta || "",
    numero_cuenta: paseador?.numero_cuenta || "",
    titular: paseador?.titular || "",
    rut_titular: paseador?.rut_titular || "",
    email_transferencia: paseador?.email_transferencia || "",
    pago_momento: paseador?.pago_momento || "",
    monto_anticipado_clp: paseador?.monto_anticipado_clp || "",
  });
  const [perro, setPerro] = useState({
    raza: user.perro_raza || "",
    es_mezcla: Boolean(user.perro_mezcla),
    agresivo: user.perro_agresivo ? true : user.perro_mezcla ? false : undefined,
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paseador) return;
    setPago({
      banco: paseador.banco || "",
      tipo_cuenta: paseador.tipo_cuenta || "",
      numero_cuenta: paseador.numero_cuenta || "",
      titular: paseador.titular || "",
      rut_titular: paseador.rut_titular || "",
      email_transferencia: paseador.email_transferencia || "",
      pago_momento: paseador.pago_momento || "",
      monto_anticipado_clp: paseador.monto_anticipado_clp || "",
    });
  }, [paseador]);

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/api/usuarios/me", {
        method: "PUT",
        body: JSON.stringify({
          nombre,
          telefono,
          ...(user.rol === "dueno"
            ? { perro_raza: perro.raza, perro_mezcla: perro.es_mezcla, perro_agresivo: Boolean(perro.agresivo) }
            : {}),
        }),
      });
      if (user.rol === "paseador") {
        await api("/api/paseadores/mi-pago", {
          method: "PUT",
          body: JSON.stringify({
            ...pago,
            monto_anticipado_clp: pago.monto_anticipado_clp === "" ? null : Number(pago.monto_anticipado_clp),
          }),
        });
      }
      await refresh();
      setMsg("Datos guardados.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar() {
    if (!confirm("¿Eliminar tu cuenta y datos personales? Esta acción no se puede deshacer.")) return;
    await api("/api/usuarios/me/eliminar", { method: "POST" });
    logout();
    nav("/login");
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="font-display text-2xl text-bosque">Hola, {user.nombre}</h1>
      <p className="text-sm capitalize">Rol: {user.rol === "dueno" ? "Dueño" : user.rol}</p>
      <Stars value={user.calificacion_promedio} />
      <form onSubmit={save} className="space-y-2">
        <input className="w-full rounded-xl border border-arena px-3 py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="w-full rounded-xl border border-arena px-3 py-2" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Celular" />
        {user.rol === "dueno" && <DatosPerro value={perro} onChange={setPerro} />}
        <p className="text-xs text-tinta/50">Los matches y pedidos se avisan acá en la app, en Solicitudes o Bandeja.</p>

        {user.rol === "paseador" && (
          <div className="pt-3 space-y-2">
            <p className="text-sm font-bold">Transferencia</p>
            <p className="text-xs text-tinta/60">Estos datos se muestran en tu perfil para que el dueño te pague por fuera de la app.</p>
            <select
              className="w-full rounded-xl border border-arena px-3 py-2"
              value={pago.banco}
              onChange={(e) => setPago({ ...pago, banco: e.target.value })}
            >
              <option value="">Banco</option>
              {BANCOS_CL.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-arena px-3 py-2"
              value={pago.tipo_cuenta}
              onChange={(e) => setPago({ ...pago, tipo_cuenta: e.target.value })}
            >
              <option value="">Tipo de cuenta</option>
              {TIPOS_CUENTA.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-xl border border-arena px-3 py-2"
              placeholder="Número de cuenta"
              value={pago.numero_cuenta}
              onChange={(e) => setPago({ ...pago, numero_cuenta: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-arena px-3 py-2"
              placeholder="Nombre del titular"
              value={pago.titular}
              onChange={(e) => setPago({ ...pago, titular: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-arena px-3 py-2"
              placeholder="RUT del titular"
              value={pago.rut_titular}
              onChange={(e) => setPago({ ...pago, rut_titular: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-arena px-3 py-2"
              type="email"
              placeholder="Correo para avisar la transferencia"
              value={pago.email_transferencia}
              onChange={(e) => setPago({ ...pago, email_transferencia: e.target.value })}
            />
            <p className="text-sm font-bold pt-2">¿Cuándo se paga el paseo?</p>
            {[
              { id: "", label: "Aún no lo indico" },
              { id: "antes", label: "Antes de pasear" },
              { id: "despues", label: "Después de pasear" },
              { id: "mixto", label: "Una parte antes y otra después" },
            ].map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pago_momento"
                  checked={pago.pago_momento === o.id}
                  onChange={() => setPago({ ...pago, pago_momento: o.id })}
                />
                {o.label}
              </label>
            ))}
            {pago.pago_momento === "mixto" && (
              <label className="block text-sm font-bold">
                Monto anticipado (CLP)
                <input
                  className="mt-1 w-full rounded-xl border border-arena px-3 py-2 font-normal"
                  type="number"
                  min="1000"
                  step="500"
                  placeholder="Ej. 5000"
                  value={pago.monto_anticipado_clp}
                  onChange={(e) => setPago({ ...pago, monto_anticipado_clp: e.target.value })}
                  required
                />
              </label>
            )}
          </div>
        )}

        <button className="w-full bg-bosque text-crema rounded-xl py-2 font-bold">Guardar</button>
      </form>
      {error && <p className="text-sm text-greda">{error}</p>}
      {msg && <p className="text-sm text-bosque-claro">{msg}</p>}
      <div className="grid gap-2 text-sm font-bold">
        <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/paseos">Mis paseos</Link>
        {user.rol === "paseador" && (
          <>
            <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/mi-oferta">Mi oferta</Link>
            {paseador?.estado_verificacion !== "aprobado" && (
              <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/verificacion">
                Completar verificación
              </Link>
            )}
          </>
        )}
        {user.rol === "admin" && (
          <Link className="bg-greda text-white rounded-xl px-3 py-3" to="/admin">
            Panel administrador
          </Link>
        )}
        <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/privacidad">
          Política de privacidad
        </Link>
      </div>
      <button className="w-full text-greda font-bold" onClick={() => { logout(); nav("/login"); }}>
        Cerrar sesión
      </button>
      <button className="w-full text-xs text-tinta/50" onClick={eliminar}>
        Eliminar cuenta y datos (Ley 21.719)
      </button>
    </div>
  );
}
