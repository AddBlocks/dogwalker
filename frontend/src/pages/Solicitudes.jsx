import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { estadoLabel } from "../lib/format";

export default function Solicitudes() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [phones, setPhones] = useState(null);

  function load() {
    api("/api/solicitudes/mias").then(setRows);
  }
  useEffect(load, []);

  async function act(id, action) {
    const data = await api(`/api/solicitudes/${id}/${action}`, { method: "POST" });
    if (data.telefonos) setPhones(data);
    load();
  }

  return (
    <div className="px-4 py-5 space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-2xl text-bosque">{user.rol === "paseador" ? "Bandeja" : "Mis solicitudes"}</h1>
        {user.rol === "dueno" && (
          <Link to="/publicar" className="text-sm font-bold text-greda">
            Nueva
          </Link>
        )}
      </div>
      {phones && (
        <div className="rounded-2xl bg-bosque text-crema p-4">
          <p className="font-bold">Paseo aceptado</p>
          <p>Dueño: {phones.nombres.dueno} · {phones.telefonos.dueno || "sin número"}</p>
          <p>Paseador: {phones.nombres.paseador} · {phones.telefonos.paseador || "sin número"}</p>
          <Link className="underline" to="/paseos">Ver paseos</Link>
        </div>
      )}
      {rows.length === 0 && <p className="text-sm text-tinta/60">No hay solicitudes todavía.</p>}
      {rows.map((s) => (
        <article key={s.id} className="bg-white rounded-2xl border border-arena p-4 space-y-1">
          <p className="text-xs uppercase font-bold text-bosque-claro">{estadoLabel(s.estado)}</p>
          <p className="font-display text-lg">{s.comuna}</p>
          <p className="text-sm">{s.horario} · {s.frecuencia}</p>
          <p className="font-bold">{clp(s.monto_clp)}</p>
          {s.mensaje && <p className="text-sm text-tinta/70">{s.mensaje}</p>}
          {user.rol === "dueno" && s.paseador_nombre && <p className="text-sm">Paseador: {s.paseador_nombre}</p>}
          {user.rol === "paseador" && <p className="text-sm">Dueño: {s.dueno_nombre}</p>}
          {s.estado === "aceptada" && (
            <p className="text-sm bg-arena/50 rounded-xl p-2">
              Teléfono: {user.rol === "dueno" ? s.paseador_telefono : s.dueno_telefono}
            </p>
          )}
          {user.rol === "paseador" && (s.estado === "pendiente" || s.estado === "abierta") && (
            <div className="flex gap-2 pt-2">
              <button className="flex-1 bg-bosque text-crema rounded-xl py-2 font-bold" onClick={() => act(s.id, "aceptar")}>
                Aceptar
              </button>
              {s.estado === "pendiente" && (
                <button className="flex-1 border border-greda text-greda rounded-xl py-2 font-bold" onClick={() => act(s.id, "rechazar")}>
                  Rechazar
                </button>
              )}
            </div>
          )}
          {user.rol === "dueno" && ["abierta", "pendiente"].includes(s.estado) && (
            <button className="text-sm text-greda font-bold" onClick={() => act(s.id, "cancelar")}>
              Cancelar
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
