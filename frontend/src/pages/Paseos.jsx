import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, clp } from "../lib/api";
import { estadoLabel } from "../lib/format";

export default function Paseos() {
  const [rows, setRows] = useState([]);
  function load() {
    api("/api/paseos").then(setRows);
  }
  useEffect(load, []);

  async function completar(id) {
    await api(`/api/paseos/${id}/completar`, { method: "POST" });
    load();
  }

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
          {p.estado === "acordado" && (
            <button className="mt-2 w-full bg-bosque text-crema rounded-xl py-2 font-bold" onClick={() => completar(p.id)}>
              Marcar como terminado
            </button>
          )}
          {p.puede_resenar && (
            <Link to={`/resena/${p.id}`} className="mt-2 block text-center bg-greda text-white rounded-xl py-2 font-bold">
              Dejar reseña
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
