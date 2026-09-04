import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { estadoLabel } from "../lib/format";

export default function Paseos() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  function load() {
    api("/api/paseos").then(setRows);
  }
  useEffect(load, []);

  return (
    <div className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Paseos</h1>
      {rows.length === 0 && <p className="text-sm text-tinta/60">Cuando acepten una solicitud, el paseo aparece acá.</p>}
      {rows.map((p) => (
        <article key={p.id} className="bg-white rounded-2xl border border-arena p-4">
          <p className="text-xs font-bold uppercase text-bosque-claro">{estadoLabel(p.estado)}</p>
          <p className="font-display text-lg">{p.comuna} · {p.fecha}</p>
          <p>{p.dueno_nombre} ↔ {p.paseador_nombre}</p>
          <p className="font-bold">{clp(p.monto_clp)}</p>
          {p.estado !== "cancelado" && (
            <p className="text-sm">Teléfonos: {p.dueno_telefono} / {p.paseador_telefono}</p>
          )}
          {p.estado === "acordado" && user.rol === "paseador" && (
            <p className="text-sm mt-2">Al cerrar el trato tenís que compartir el recorrido en la app.</p>
          )}
          {p.estado === "acordado" && user.rol === "dueno" && (
            <p className="text-sm mt-2">El paseador va a compartir el GPS de principio a fin acá.</p>
          )}
          {["acordado", "en_curso", "completado"].includes(p.estado) && (
            <Link
              to={`/paseos/${p.id}`}
              className={`mt-2 block text-center font-bold rounded-xl py-2 ${
                p.estado === "en_curso" || (p.estado === "acordado" && user.rol === "paseador")
                  ? "bg-greda text-white"
                  : "bg-bosque text-crema"
              }`}
            >
              {p.estado === "acordado" && user.rol === "paseador" && "Paseo iniciado"}
              {p.estado === "acordado" && user.rol !== "paseador" && "Ver recorrido"}
              {p.estado === "en_curso" && (user.rol === "paseador" ? "Paseo en curso · terminar" : "Ver recorrido en vivo")}
              {p.estado === "completado" && "Ver recorrido completo"}
            </Link>
          )}
          {p.puede_resenar && (
            <Link to={`/resena/${p.id}`} className="mt-2 block text-center border border-bosque text-bosque rounded-xl py-2 font-bold">
              Dejar reseña
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
