import { RAZAS } from "../lib/format";

export function esMezclaRaza(raza) {
  return /mezcla|mestizo/i.test(String(raza || ""));
}

export default function DatosPerro({ value, onChange }) {
  const mezcla = Boolean(value.es_mezcla) || esMezclaRaza(value.raza);
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">Tu perro</p>
      <select
        className="w-full rounded-xl border border-arena px-3 py-2"
        value={value.raza || ""}
        onChange={(e) => {
          const raza = e.target.value;
          onChange({
            ...value,
            raza,
            es_mezcla: esMezclaRaza(raza) ? true : value.es_mezcla,
          });
        }}
        required
      >
        <option value="">Raza</option>
        {RAZAS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mezcla}
          onChange={(e) => onChange({ ...value, es_mezcla: e.target.checked })}
        />
        Es mezcla / mestizo
      </label>
      {mezcla && (
        <div className="space-y-1">
          <p className="text-sm font-bold">¿Es peligroso o agresivo?</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="perro_agresivo"
              checked={value.agresivo === true}
              onChange={() => onChange({ ...value, agresivo: true })}
              required
            />
            Sí
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="perro_agresivo"
              checked={value.agresivo === false}
              onChange={() => onChange({ ...value, agresivo: false })}
              required
            />
            No
          </label>
        </div>
      )}
    </div>
  );
}
