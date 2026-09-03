import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function MiOferta() {
  const { paseador, refresh } = useAuth();
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({ descripcion: "", precio_clp: "", disponibilidad: "", comunas: [] });
  const [ok, setOk] = useState("");

  useEffect(() => {
    api("/api/comunas").then(setComunas);
  }, []);
  useEffect(() => {
    if (paseador) {
      setForm({
        descripcion: paseador.descripcion || "",
        precio_clp: paseador.precio_clp || "",
        disponibilidad: paseador.disponibilidad || "",
        comunas: (paseador.comunas || []).map((c) => c.id),
      });
    }
  }, [paseador]);

  function toggle(id) {
    setForm((f) => ({
      ...f,
      comunas: f.comunas.includes(id) ? f.comunas.filter((x) => x !== id) : [...f.comunas, id],
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    await api("/api/paseadores/mi-oferta", {
      method: "PUT",
      body: JSON.stringify({ ...form, precio_clp: Number(form.precio_clp) }),
    });
    await refresh();
    setOk("Oferta actualizada.");
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Mi oferta</h1>
      {paseador && (
        <p className="text-sm">
          Estado: <strong>{paseador.estado_verificacion}</strong>
          {paseador.destacado ? " · Destacado" : ""}
        </p>
      )}
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" type="number" placeholder="Precio por paseo (CLP)" value={form.precio_clp} onChange={(e) => setForm({ ...form, precio_clp: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Disponibilidad" value={form.disponibilidad} onChange={(e) => setForm({ ...form, disponibilidad: e.target.value })} />
      <p className="text-sm font-bold">Comunas de cobertura</p>
      <div className="grid grid-cols-2 gap-1 max-h-56 overflow-auto">
        {comunas.map((c) => (
          <label key={c.id} className="text-sm flex gap-2">
            <input type="checkbox" checked={form.comunas.includes(c.id)} onChange={() => toggle(c.id)} />
            {c.nombre}
          </label>
        ))}
      </div>
      {ok && <p className="text-bosque-claro text-sm">{ok}</p>}
      <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Guardar</button>
    </form>
  );
}
