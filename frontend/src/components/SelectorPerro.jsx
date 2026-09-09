import { PERRO_VACIO } from "../lib/avatares";
import DatosPerro from "./DatosPerro";
import FotoPerro from "./FotoPerro";

export default function SelectorPerro({
  perros,
  selectedId,
  selectedIds,
  onSelect,
  onSelectMany,
  multiple = false,
  nuevo,
  onNuevoChange,
}) {
  const ids = multiple ? selectedIds || [] : [];
  const agregar = !multiple && selectedId == null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{multiple ? "¿Qué perros paseamos?" : "¿Qué perro paseamos?"}</p>
      {multiple && <p className="text-xs text-tinta/60">Elegí al menos dos.</p>}
      {perros.map((p) => {
        const activo = multiple ? ids.includes(p.id) : selectedId === p.id;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              if (multiple) {
                const next = ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id];
                onSelectMany(next);
              } else {
                onSelect(p.id);
              }
            }}
            className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2 text-left ${
              activo ? "border-bosque bg-white" : "border-arena bg-white"
            }`}
          >
            <FotoPerro perro={p} className="w-12 h-12" />
            <div>
              <p className="font-bold">{p.nombre || "Sin nombre"}</p>
              <p className="text-xs text-tinta/60">
                {p.raza}
                {p.es_mezcla ? " · mezcla" : ""}
                {p.agresivo ? " · peligroso/agresivo" : ""}
              </p>
            </div>
          </button>
        );
      })}
      {!multiple && (
        <>
          <button
            type="button"
            className={`w-full rounded-2xl border px-3 py-2 text-sm font-bold ${agregar ? "border-bosque bg-white" : "border-arena bg-white"}`}
            onClick={() => {
              onSelect(null);
              if (!nuevo?.raza) onNuevoChange({ ...PERRO_VACIO, ...nuevo });
            }}
          >
            {perros.length ? "Agregar otro perro" : "Datos de tu perro"}
          </button>
          {agregar && <DatosPerro value={nuevo} onChange={onNuevoChange} titulo="" />}
        </>
      )}
    </div>
  );
}
