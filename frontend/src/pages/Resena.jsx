import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PREGUNTA_PASEADOR, PREGUNTAS_DUENO } from "../lib/format";

function Score({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} onClick={() => onChange(n)} className={`w-9 h-9 rounded-full ${value >= n ? "bg-oro" : "bg-arena"}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Resena() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const esDueno = user.rol === "dueno";
  const [p, setP] = useState({ p1: 5, p2: 5, p3: 5, p4: 5, p5: 5, comentario: "" });
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/resenas", { method: "POST", body: JSON.stringify({ paseo_id: Number(id), ...p }) });
      nav("/paseos");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-5 space-y-4">
      <h1 className="font-display text-2xl text-bosque">Encuesta del paseo</h1>
      {(esDueno ? PREGUNTAS_DUENO : [PREGUNTA_PASEADOR]).map((q, i) => (
        <div key={q}>
          <p className="text-sm font-bold mb-1">{q}</p>
          <Score value={p[`p${i + 1}`]} onChange={(n) => setP((s) => ({ ...s, [`p${i + 1}`]: n }))} />
        </div>
      ))}
      <textarea className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Comentario (opcional)" value={p.comentario} onChange={(e) => setP({ ...p, comentario: e.target.value })} />
      {error && <p className="text-greda text-sm">{error}</p>}
      <button className="w-full bg-greda text-white font-bold rounded-xl py-3">Enviar</button>
    </form>
  );
}
