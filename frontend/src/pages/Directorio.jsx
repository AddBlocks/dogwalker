import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORIAS } from "../lib/format";
import AdSlot from "../components/AdSlot";
import Stars from "../components/Stars";

export default function Directorio() {
  const [comunas, setComunas] = useState([]);
  const [filtros, setFiltros] = useState({ comuna: "", categoria: "" });
  const [rows, setRows] = useState([]);
  const [ad, setAd] = useState(null);

  useEffect(() => {
    api("/api/comunas").then(setComunas);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (filtros.comuna) q.set("comuna", filtros.comuna);
    if (filtros.categoria) q.set("categoria", filtros.categoria);
    api(`/api/comercios?${q}`).then(setRows);
    api(`/api/anuncios?ubicacion=superior_directorio&comuna=${filtros.comuna || ""}`)
      .then((r) => setAd(r[0] || null))
      .catch(() => {});
  }, [filtros]);

  return (
    <div className="px-4 py-5 space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-2xl text-bosque">Directorio local</h1>
        <Link to="/directorio/sugerir" className="text-sm font-bold text-greda">
          Sugerir
        </Link>
      </div>
      {ad && <AdSlot ad={ad} />}
      <div className="grid grid-cols-2 gap-2">
        <select className="rounded-xl border border-arena px-2 py-2 text-sm" value={filtros.comuna} onChange={(e) => setFiltros({ ...filtros, comuna: e.target.value })}>
          <option value="">Todas las comunas</option>
          {comunas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select className="rounded-xl border border-arena px-2 py-2 text-sm" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>
          <option value="">Todos los rubros</option>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      {rows.map((c) => (
        <Link key={c.id} to={`/directorio/${c.id}`} className="block bg-white rounded-2xl border border-arena p-4">
          <div className="flex justify-between">
            <h2 className="font-display text-lg text-bosque">{c.nombre}</h2>
            {c.destacado && <span className="text-[10px] uppercase font-bold bg-oro text-tinta px-2 py-0.5 rounded-full h-fit">Destacado</span>}
          </div>
          <p className="text-xs uppercase text-tinta/50">{c.categoria} · {c.comuna}</p>
          <Stars value={c.calificacion} />
          <p className="text-sm">{c.direccion}</p>
        </Link>
      ))}
    </div>
  );
}
