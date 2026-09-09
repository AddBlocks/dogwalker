import { clp } from "../lib/api";
import { TIPOS_PASEO, precioPaseo } from "../lib/format";

export default function TipoPaseo({ value, onChange, walker }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">Tipo de paseo</p>
      {TIPOS_PASEO.map((t) => {
        const monto = walker ? precioPaseo(walker, t.id) : null;
        const noOfrece = walker && t.id !== "uno" && !monto;
        return (
          <label
            key={t.id}
            className={`flex items-start gap-2 rounded-2xl border px-3 py-2 ${
              noOfrece ? "opacity-40" : value === t.id ? "border-bosque bg-white" : "border-arena bg-white"
            }`}
          >
            <input
              type="radio"
              name="tipo_paseo"
              className="mt-1"
              checked={value === t.id}
              disabled={noOfrece}
              onChange={() => onChange(t.id)}
            />
            <span className="flex-1">
              <span className="text-sm font-bold">{t.label}</span>
              <span className="block text-xs text-tinta/60">{t.hint}</span>
              {noOfrece && <span className="block text-xs text-greda">Este paseador no lo ofrece</span>}
            </span>
            {monto ? <span className="text-sm font-bold text-bosque-claro whitespace-nowrap">{clp(monto)}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
