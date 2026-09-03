import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { FRECUENCIAS } from "../lib/format";

export default function PublicarSolicitud() {
  const nav = useNavigate();
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({ comuna_id: "", horario: "", frecuencia: FRECUENCIAS[0], monto_clp: "", mensaje: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/comunas").then((rows) => {
      setComunas(rows);
      setForm((f) => ({ ...f, comuna_id: rows[0]?.id || "" }));
    });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/solicitudes", {
        method: "POST",
        body: JSON.stringify({ ...form, monto_clp: Number(form.monto_clp) }),
      });
      nav("/solicitudes");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Publicar solicitud de paseo</h1>
      <p className="text-sm text-tinta/70">Los paseadores de esa comuna pueden tomarla.</p>
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
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Sobre tu perro" value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
      {error && <p className="text-greda text-sm">{error}</p>}
      <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Publicar</button>
    </form>
  );
}
