import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import Stars from "../components/Stars";

export default function PaseadorPerfil() {
  const { id } = useParams();
  const { user } = useAuth();
  const [w, setW] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/paseadores/${id}`).then(setW).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="p-5 text-greda">{error}</p>;
  if (!w) return <p className="p-5">Cargando…</p>;

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-bosque">{w.nombre}</h1>
          {w.destacado && <span className="text-xs font-bold bg-greda text-white px-2 py-0.5 rounded-full">Destacado</span>}
          <Stars value={w.calificacion} />
          <p className="text-sm text-tinta/60">{w.paseos} paseos · {w.cantidad_reseñas} reseñas</p>
        </div>
        <p className="font-bold text-xl text-bosque-claro">{clp(w.precio_clp)}</p>
      </div>
      <p>{w.descripcion}</p>
      <p className="text-sm"><strong>Disponibilidad:</strong> {w.disponibilidad}</p>
      <p className="text-sm"><strong>Zona de paseo:</strong> {w.radio_km ? `${w.radio_km} km a la redonda` : "Sin zona publicada"}</p>
      {w.calles?.length > 0 && (
        <p className="text-sm"><strong>Calles de referencia:</strong> {w.calles.map((c) => c.nombre || c).join(", ")}</p>
      )}
      {user?.rol === "dueno" && (
        <Link to={`/solicitar/${w.id}`} className="block text-center bg-greda text-white font-bold rounded-xl py-3">
          Solicitar paseo
        </Link>
      )}
      {!user && (
        <Link to="/login" className="block text-center bg-bosque text-crema font-bold rounded-xl py-3">
          Entra para solicitar
        </Link>
      )}
      <section>
        <h2 className="font-display text-xl text-bosque">Reseñas</h2>
        <div className="space-y-3 mt-2">
          {w.resenas?.length === 0 && <p className="text-sm text-tinta/50">Aún no tiene reseñas.</p>}
          {w.resenas?.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-arena">
              <p className="font-bold text-sm">{r.autor}</p>
              <Stars value={r.promedio} />
              <p className="text-sm">{r.comentario}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
