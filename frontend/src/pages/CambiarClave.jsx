import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function CambiarClave() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [otra, setOtra] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== otra) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    try {
      await api("/api/auth/cambiar-clave", { method: "POST", body: JSON.stringify({ password }) });
      await refresh();
      nav(user?.rol === "paseador" ? "/solicitudes" : "/mapa");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-crema px-5 py-10">
      <h1 className="font-display text-3xl text-bosque">Cambiá tu clave</h1>
      <p className="text-sm text-tinta/70 mt-2">Entraste con una clave temporal. Elegí una nueva para seguir.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          className="w-full rounded-xl border border-arena px-3 py-2"
          type="password"
          placeholder="Nueva contraseña (mín. 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <input
          className="w-full rounded-xl border border-arena px-3 py-2"
          type="password"
          placeholder="Repetí la contraseña"
          value={otra}
          onChange={(e) => setOtra(e.target.value)}
          required
          minLength={8}
        />
        {error && <p className="text-sm text-greda">{error}</p>}
        <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Guardar clave</button>
      </form>
    </div>
  );
}
