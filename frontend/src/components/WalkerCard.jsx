import { Link } from "react-router-dom";
import { pagoMomentoLabel } from "../lib/format";
import Stars from "./Stars";
import PreciosPaseador from "./PreciosPaseador";

export default function WalkerCard({ walker }) {
  const pago = pagoMomentoLabel(walker.pago_momento, walker.monto_anticipado_clp);
  return (
    <Link
      to={`/paseador/${walker.id}`}
      className="block rounded-2xl bg-white p-4 shadow-ficha border border-arena"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl text-bosque">{walker.nombre}</h3>
            {walker.destacado && (
              <span className="text-[10px] uppercase font-bold bg-greda text-white px-2 py-0.5 rounded-full">
                Destacado
              </span>
            )}
          </div>
          <Stars value={walker.calificacion} />
          <p className="text-sm text-tinta/60 mt-1">{walker.paseos} paseos concretados</p>
        </div>
      </div>
      <PreciosPaseador walker={walker} compact />
      {walker.radio_km && (
        <p className="text-xs text-tinta/50 mt-2">
          Zona de {walker.radio_km} km
          {walker.calles?.length ? ` · ${walker.calles.map((c) => c.nombre || c).join(" · ")}` : ""}
        </p>
      )}
      {pago && <p className="text-xs text-tinta/60 mt-1">{pago}</p>}
    </Link>
  );
}
