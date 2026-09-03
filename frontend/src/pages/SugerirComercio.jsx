import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORIAS } from "../lib/format";

export default function SugerirComercio() {
  const nav = useNavigate();
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({ nombre: "", categoria: "veterinaria", comuna_id: "", direccion: "", telefono: "", horario: "" });
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
      await api("/api/comercios", { method: "POST", body: JSON.stringify(form) });
      nav("/directorio");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Sugerir comercio</h1>
      <p className="text-sm">El administrador lo revisa antes de publicarlo.</p>
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
        {CATEGORIAS.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.comuna_id} onChange={(e) => setForm({ ...form, comuna_id: Number(e.target.value) })}>
        {comunas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Horario" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
      {error && <p className="text-greda text-sm">{error}</p>}
      <button className="w-full bg-greda text-white font-bold rounded-xl py-3">Enviar</button>
    </form>
  );
}
