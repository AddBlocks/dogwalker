import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function MiOferta() {
  const { paseador, refresh } = useAuth();
  const [form, setForm] = useState({
    descripcion: "",
    precio_clp: "",
    disponibilidad: "",
    direccion: "",
    radio_km: "3",
    calles: [],
  });
  const [calleNueva, setCalleNueva] = useState("");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (paseador) {
      setForm({
        descripcion: paseador.descripcion || "",
        precio_clp: paseador.precio_clp || "",
        disponibilidad: paseador.disponibilidad || "",
        direccion: paseador.direccion_privada || "",
        radio_km: paseador.radio_km || "3",
        calles: paseador.calles || [],
      });
    }
  }, [paseador]);

  function addCalle() {
    const n = calleNueva.trim();
    if (!n || form.calles.includes(n)) return;
    setForm((f) => ({ ...f, calles: [...f.calles, n] }));
    setCalleNueva("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      const data = await api("/api/paseadores/mi-oferta", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          precio_clp: Number(form.precio_clp),
          radio_km: Number(form.radio_km),
        }),
      });
      await refresh();
      if (data.calles_sin_ubicacion?.length) {
        setOk(
          `Zona guardada, pero no ubicamos: ${data.calles_sin_ubicacion.join(", ")}. Probá con el nombre completo y la comuna.`
        );
      } else if ((data.zona?.vertices || 0) >= 3) {
        setOk("Zona guardada. En el mapa se pinta el rectángulo que forman los cruces de tus calles.");
      } else {
        setOk("Zona guardada. Tu dirección no se muestra a nadie; en el mapa se ve el radio de paseo.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Mi oferta</h1>
      {paseador && (
        <p className="text-sm">
          Estado: <strong>{paseador.estado_verificacion}</strong>
          {paseador.destacado ? " · Destacado" : ""}
          {paseador.tiene_zona ? " · zona en el mapa" : " · falta zona para aparecer en el mapa"}
        </p>
      )}
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" type="number" placeholder="Precio por paseo (CLP)" value={form.precio_clp} onChange={(e) => setForm({ ...form, precio_clp: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Disponibilidad" value={form.disponibilidad} onChange={(e) => setForm({ ...form, disponibilidad: e.target.value })} />

      <p className="text-sm font-bold">Dirección (privada)</p>
      <p className="text-xs text-tinta/60">No se comparte con dueños ni en el perfil. Solo sirve como centro de tu zona de paseo.</p>
      <input
        className="w-full rounded-xl border border-arena px-3 py-2"
        placeholder="Calle, número y comuna"
        value={form.direccion}
        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
        required
      />
      <label className="block text-sm font-bold">
        Kilómetros que caminas desde tu casa
        <input
          className="mt-1 w-full rounded-xl border border-arena px-3 py-2 font-normal"
          type="number"
          min="0.5"
          max="20"
          step="0.5"
          value={form.radio_km}
          onChange={(e) => setForm({ ...form, radio_km: e.target.value })}
          required
        />
      </label>

      <p className="text-sm font-bold">Calles que encierran tu zona (opcional)</p>
      <p className="text-xs text-tinta/60">
        Indicá las calles que se cruzan. Esos cruces son las esquinas de tu zona en el mapa. No se muestra tu casa.
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-arena px-3 py-2"
          placeholder="Ej. Av. Italia"
          value={calleNueva}
          onChange={(e) => setCalleNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCalle();
            }
          }}
        />
        <button type="button" className="px-3 rounded-xl border border-bosque font-bold" onClick={addCalle}>
          Añadir
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {form.calles.map((c) => (
          <button
            type="button"
            key={c}
            className="text-xs bg-arena rounded-full px-3 py-1"
            onClick={() => setForm((f) => ({ ...f, calles: f.calles.filter((x) => x !== c) }))}
          >
            {c} ×
          </button>
        ))}
      </div>

      {error && <p className="text-greda text-sm">{error}</p>}
      {ok && <p className="text-bosque-claro text-sm">{ok}</p>}
      <button disabled={saving} className="w-full bg-bosque text-crema font-bold rounded-xl py-3">
        {saving ? "Ubicando dirección…" : "Guardar"}
      </button>
    </form>
  );
}
