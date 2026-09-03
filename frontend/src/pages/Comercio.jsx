import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Stars from "../components/Stars";

export default function Comercio() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [puntaje, setPuntaje] = useState(5);
  const [comentario, setComentario] = useState("");

  function load() {
    api(`/api/comercios/${id}`).then(setC);
  }
  useEffect(load, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    await api(`/api/comercios/${id}/resenas`, { method: "POST", body: JSON.stringify({ puntaje, comentario }) });
    setComentario("");
    load();
  }

  if (!c) return <p className="p-5">Cargando…</p>;

  return (
    <div className="px-4 py-5 space-y-3">
      <h1 className="font-display text-3xl text-bosque">{c.nombre}</h1>
      <p className="text-sm uppercase">{c.categoria} · {c.comuna}</p>
      <Stars value={c.calificacion} />
      <p>{c.direccion}</p>
      <p>{c.telefono}</p>
      <p className="text-sm">{c.horario}</p>
      {user && (
        <form onSubmit={onSubmit} className="bg-white border border-arena rounded-2xl p-3 space-y-2">
          <p className="font-bold text-sm">Tu reseña</p>
          <input type="number" min="1" max="5" className="w-full rounded-xl border border-arena px-3 py-2" value={puntaje} onChange={(e) => setPuntaje(Number(e.target.value))} />
          <textarea className="w-full rounded-xl border border-arena px-3 py-2" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="¿Cómo te trataron?" />
          <button className="w-full bg-bosque text-crema rounded-xl py-2 font-bold">Publicar</button>
        </form>
      )}
      {c.resenas?.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl p-3 border border-arena">
          <p className="font-bold text-sm">{r.nombre}</p>
          <Stars value={r.puntaje} />
          <p className="text-sm">{r.comentario}</p>
        </div>
      ))}
    </div>
  );
}
