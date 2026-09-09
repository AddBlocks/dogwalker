import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, clp } from "../lib/api";
import { FRECUENCIAS, precioPaseo } from "../lib/format";
import { PERRO_VACIO } from "../lib/avatares";
import { guardarPerro } from "../lib/perros";
import PagoPaseador from "../components/PagoPaseador";
import SelectorPerro from "../components/SelectorPerro";
import TipoPaseo from "../components/TipoPaseo";
import { useAuth } from "../lib/auth";

export default function Solicitar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { perros, refresh } = useAuth();
  const [w, setW] = useState(null);
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({ comuna_id: "", horario: "", frecuencia: FRECUENCIAS[0], monto_clp: "", mensaje: "" });
  const [tipoPaseo, setTipoPaseo] = useState("uno");
  const [perroId, setPerroId] = useState(perros[0]?.id ?? null);
  const [perroIds, setPerroIds] = useState(perros.slice(0, 2).map((p) => p.id));
  const [nuevo, setNuevo] = useState({ ...PERRO_VACIO });
  const [error, setError] = useState("");

  useEffect(() => {
    setPerroId((idActual) => idActual ?? perros[0]?.id ?? null);
    setPerroIds((ids) => (ids.length ? ids : perros.slice(0, 2).map((p) => p.id)));
  }, [perros]);

  useEffect(() => {
    api("/api/comunas").then(setComunas);
    api(`/api/paseadores/${id}`).then((data) => {
      setW(data);
      setForm((f) => ({
        ...f,
        monto_clp: precioPaseo(data, "uno") || "",
      }));
    });
  }, [id]);

  useEffect(() => {
    if (comunas.length && !form.comuna_id) {
      setForm((f) => ({ ...f, comuna_id: comunas[0].id }));
    }
  }, [comunas, form.comuna_id]);

  function elegirTipo(tipo) {
    setTipoPaseo(tipo);
    if (w) setForm((f) => ({ ...f, monto_clp: precioPaseo(w, tipo) || f.monto_clp }));
  }

  async function resolverPerroIds() {
    if (tipoPaseo === "varios") return perroIds;
    if (perroId) return [perroId];
    const created = await guardarPerro(nuevo);
    await refresh();
    return [created.id];
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const ids = await resolverPerroIds();
      await api("/api/solicitudes", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          paseador_id: Number(id),
          monto_clp: Number(form.monto_clp),
          tipo_paseo: tipoPaseo,
          perro_id: ids[0],
          perro_ids: ids,
        }),
      });
      nav("/solicitudes");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!w) return <p className="p-5">Cargando…</p>;

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-3">
      <h1 className="font-display text-2xl text-bosque">Solicitar a {w.nombre}</h1>
      {w.radio_km && <p className="text-sm">Pasea hasta {w.radio_km} km desde su zona.</p>}
      {w.solo_no_peligrosas && (
        <p className="text-sm text-greda">Este paseador es menor de 18 y solo pasea razas no peligrosas.</p>
      )}
      <PagoPaseador walker={w} />
      <TipoPaseo value={tipoPaseo} onChange={elegirTipo} walker={w} />
      <SelectorPerro
        perros={perros}
        selectedId={perroId}
        selectedIds={perroIds}
        onSelect={setPerroId}
        onSelectMany={setPerroIds}
        multiple={tipoPaseo === "varios"}
        nuevo={nuevo}
        onNuevoChange={setNuevo}
      />
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.comuna_id} onChange={(e) => setForm({ ...form, comuna_id: Number(e.target.value) })}>
        {comunas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Horario (ej. lunes 18:00)" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} required />
      <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
        {FRECUENCIAS.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <input className="w-full rounded-xl border border-arena px-3 py-2" type="number" placeholder="Monto en CLP" value={form.monto_clp} onChange={(e) => setForm({ ...form, monto_clp: e.target.value })} required />
      <p className="text-xs text-tinta/50">Referencia del paseador: {clp(precioPaseo(w, tipoPaseo) || w.precio_clp)}</p>
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Datos de tu perro, punto de encuentro…" value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
      {error && <p className="text-greda text-sm">{error}</p>}
      <button className="w-full bg-greda text-white font-bold rounded-xl py-3">Enviar solicitud</button>
    </form>
  );
}
