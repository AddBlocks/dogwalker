import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Registro() {
  const { registro } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    rol: "dueno",
    consentimiento: false,
  });
  const [error, setError] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const u = await registro(form);
      nav(u.rol === "paseador" ? "/verificacion" : "/mapa");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-crema px-5 py-8">
      <h1 className="font-display text-3xl text-bosque">Crea tu cuenta</h1>
      <p className="text-sm text-tinta/70 mt-1">Los dueños entran altiro. Los paseadores pasan por verificación.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["dueno", "Soy dueño"],
            ["paseador", "Soy paseador"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              onClick={() => set("rol", id)}
              className={`rounded-2xl py-3 font-bold border ${form.rol === id ? "bg-bosque text-crema border-bosque" : "bg-white border-arena"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
        <input className="w-full rounded-xl border border-arena px-3 py-2" type="email" placeholder="Correo" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Celular (+569…)" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
        <input className="w-full rounded-xl border border-arena px-3 py-2" type="password" placeholder="Contraseña (mín. 8)" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
        <label className="flex gap-2 text-sm items-start">
          <input type="checkbox" checked={form.consentimiento} onChange={(e) => set("consentimiento", e.target.checked)} required className="mt-1" />
          <span>
            Acepto el tratamiento de mis datos personales según la{" "}
            <Link className="underline text-greda" to="/privacidad">
              Política de privacidad
            </Link>{" "}
            y la Ley 21.719.
          </span>
        </label>
        {error && <p className="text-sm text-greda">{error}</p>}
        <button className="w-full bg-greda text-white font-bold rounded-xl py-3">Registrarme</button>
        <p className="text-sm text-center">
          ¿Ya tenís cuenta? <Link className="font-bold text-bosque" to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
