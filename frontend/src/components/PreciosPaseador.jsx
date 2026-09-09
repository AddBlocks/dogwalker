import { clp } from "../lib/api";
import { TIPOS_PASEO, precioPaseo } from "../lib/format";

export default function PreciosPaseador({ walker, compact = false }) {
  const filas = TIPOS_PASEO.map((t) => ({ ...t, monto: precioPaseo(walker, t.id) })).filter((t) => t.monto);
  if (!filas.length) return null;
  if (compact) {
    return (
      <p className="text-xs text-tinta/60 mt-1 space-y-0.5">
        {filas.map((t) => (
          <span key={t.id} className="block">
            {clp(t.monto)} · {t.label}
          </span>
        ))}
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-arena bg-white p-4 space-y-2">
      <p className="text-sm font-bold">Precios</p>
      {filas.map((t) => (
        <div key={t.id} className="flex justify-between gap-3 text-sm">
          <span>
            {t.label}
            <span className="block text-xs text-tinta/50 font-normal">{t.hint}</span>
          </span>
          <span className="font-bold text-bosque-claro whitespace-nowrap">{clp(t.monto)}</span>
        </div>
      ))}
      {!walker.precio_grupal_clp && (
        <p className="text-xs text-tinta/50">No ofrece paseos juntando perros de distintos dueños.</p>
      )}
    </div>
  );
}
