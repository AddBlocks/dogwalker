import { PERRO_VACIO } from "../lib/avatares";
import DatosPerro from "./DatosPerro";
import FotoPerro from "./FotoPerro";

export default function SelectorPerro({ perros, selectedId, onSelect, nuevo, onNuevoChange }) {
  const agregar = selectedId == null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">¿Qué perro paseamos?</p>
      {perros.map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2 text-left ${
            selectedId === p.id ? "border-bosque bg-white" : "border-arena bg-white"
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
      ))}
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
    </div>
  );
}
