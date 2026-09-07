import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { FRECUENCIAS } from "../lib/format";
import { PERRO_VACIO } from "../lib/avatares";
import { guardarPerro } from "../lib/perros";
import SelectorPerro from "../components/SelectorPerro";
import { useAuth } from "../lib/auth";

export default function PublicarSolicitud() {
  const nav = useNavigate();
  const { perros, refresh } = useAuth();
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({ comuna_id: "", horario: "", frecuencia: FRECUENCIAS[0], monto_clp: "", mensaje: "" });
  const [perroId, setPerroId] = useState(perros[0]?.id ?? null);
  const [nuevo, setNuevo] = useState({ ...PERRO_VACIO });
  const [error, setError] = useState("");

  useEffect(() => {
    setPerroId((id) => id ?? perros[0]?.id ?? null);
  }, [perros]);

  useEffect(() => {
    api("/api/comunas").then((rows) => {
      setComunas(rows);
      setForm((f) => ({ ...f, comuna_id: rows[0]?.id || "" }));
    });
  }, []);

  async function resolverPerroId() {
    if (perroId) return perroId;
    const created = await guardarPerro(nuevo);
    await refresh();
    return created.id;
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const idPerro = await resolverPerroId();
      await api("/api/solicitudes", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          monto_clp: Number(form.monto_clp),
          perro_id: idPerro,
        }),
      });
      nav("/solicitudes");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Publicar solicitud de paseo</h1>
      <p className="text-sm text-tinta/70">La ven los paseadores cuya zona de km cubre esa comuna.</p>
      <SelectorPerro perros={perros} selectedId={perroId} onSelect={setPerroId} nuevo={nuevo} onNuevoChange={setNuevo} />
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.comuna_id} onChange={(e) => setForm({ ...form, comuna_id: Number(e.target.value) })}>
        {comunas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Horario" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} required />
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
        {FRECUENCIAS.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <input className="w-full rounded-xl border border-arena px-3 py-2" type="number" placeholder="Monto dispuesto a pagar (CLP)" value={form.monto_clp} onChange={(e) => setForm({ ...form, monto_clp: e.target.value })} required />
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Punto de encuentro u otras indicaciones" value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
      {error && <p className="text-greda text-sm">{error}</p>}
      <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Publicar</button>
    </form>
  );
}
