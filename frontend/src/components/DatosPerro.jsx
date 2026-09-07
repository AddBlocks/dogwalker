import { useId } from "react";
import { RAZAS } from "../lib/format";
import { AVATARES, slugAvatar, urlFotoPerro } from "../lib/avatares";

export function esMezclaRaza(raza) {
  return /mezcla|mestizo/i.test(String(raza || ""));
}

export default function DatosPerro({ value, onChange, titulo = "Tu perro" }) {
  const radioName = useId();
  const mezcla = Boolean(value.es_mezcla) || esMezclaRaza(value.raza);
  const preview = urlFotoPerro(value);

  function setRaza(raza) {
    onChange({
      ...value,
      raza,
      es_mezcla: esMezclaRaza(raza) ? true : value.es_mezcla,
      avatar: value.avatarManual ? value.avatar : slugAvatar(raza),
    });
  }

  function setFoto(file) {
    if (value.fotoPreview) URL.revokeObjectURL(value.fotoPreview);
    onChange({
      ...value,
      foto: file || null,
      fotoPreview: file ? URL.createObjectURL(file) : null,
      quitar_foto: false,
    });
  }

  return (
    <div className="space-y-2">
      {titulo && <p className="text-sm font-bold">{titulo}</p>}
      <div className="flex items-center gap-3">
        <img src={preview} alt="" className="w-16 h-16 rounded-full object-cover bg-arena border border-arena" />
        <div className="flex-1 space-y-1">
          <input
            className="w-full rounded-xl border border-arena px-3 py-2"
            placeholder="Nombre (opcional)"
            value={value.nombre || ""}
            onChange={(e) => onChange({ ...value, nombre: e.target.value })}
          />
          <label className="block text-xs text-tinta/60">
            Subí una foto
            <input
              className="mt-1 block w-full font-normal"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFoto(e.target.files[0])}
            />
          </label>
          {value.tiene_foto && !value.quitar_foto && !value.foto && (
            <button
              type="button"
              className="text-xs text-greda font-bold"
              onClick={() => onChange({ ...value, quitar_foto: true, foto: null, fotoPreview: null })}
            >
              Quitar foto y usar avatar
            </button>
          )}
        </div>
      </div>
      <select
        className="w-full rounded-xl border border-arena px-3 py-2"
        value={value.raza || ""}
        onChange={(e) => setRaza(e.target.value)}
        required
      >
        <option value="">Raza</option>
        {RAZAS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <p className="text-xs text-tinta/60">O elegí un avatar según la raza</p>
      <div className="grid grid-cols-5 gap-2">
        {AVATARES.map((a) => (
          <button
            type="button"
            key={a.slug}
            title={a.raza}
            onClick={() => onChange({ ...value, avatar: a.slug, avatarManual: true })}
            className={`rounded-xl overflow-hidden border-2 ${
              slugAvatar(value.raza, value.avatar) === a.slug ? "border-bosque" : "border-transparent"
            }`}
          >
            <img src={a.src} alt={a.raza} className="w-full aspect-square object-cover bg-[#F6F1E7]" />
          </button>
        ))}
      </div>
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
              name={radioName}
              checked={value.agresivo === true}
              onChange={() => onChange({ ...value, agresivo: true })}
              required
            />
            Sí
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={radioName}
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
