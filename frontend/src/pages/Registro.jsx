import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, setToken } from "../lib/api";

export default function Registro() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    rol: "dueno",
    consentimiento: false,
    fecha_nacimiento: "",
  });
  const [files, setFiles] = useState({
    cedula_frente: null,
    cedula_reverso: null,
    selfie: null,
    autorizacion_padres: null,
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      if (form.rol === "paseador") {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (k === "consentimiento") fd.append(k, v ? "true" : "false");
          else fd.append(k, v ?? "");
        });
        if (files.cedula_frente) fd.append("cedula_frente", files.cedula_frente);
        if (files.cedula_reverso) fd.append("cedula_reverso", files.cedula_reverso);
        if (files.selfie) fd.append("selfie", files.selfie);
        if (files.autorizacion_padres) fd.append("autorizacion_padres", files.autorizacion_padres);
        const data = await api("/api/auth/registro", { method: "POST", body: fd });
        setOk(data.mensaje);
        setTimeout(() => nav("/login?pendiente=1"), 2200);
      } else {
        const data = await api("/api/auth/registro", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setToken(data.token);
        await refresh();
        nav("/mapa");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-crema px-5 py-8">
      <h1 className="font-display text-3xl text-bosque">Crea tu cuenta</h1>
      <p className="text-sm text-tinta/70 mt-1">
        {form.rol === "paseador"
          ? "Los paseadores quedan en revisión. El administrador recibe un correo y puede autorizarte desde ahí."
          : "Si sos dueño, entras al toque. No pedimos autorización."}
      </p>
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

        {form.rol === "paseador" && (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-bold">Identidad</p>
            <p className="text-xs text-tinta/60">Leemos la fecha de nacimiento de la cédula. Menos de 15 años no puede inscribirse; entre 15 y 17 necesita autorización de los padres y solo pasea razas no peligrosas.</p>
            <label className="block text-sm font-bold">
              Cédula — frente
              <input className="mt-1 block w-full font-normal" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFiles((f) => ({ ...f, cedula_frente: e.target.files[0] }))} />
            </label>
            <label className="block text-sm font-bold">
              Cédula — reverso
              <input className="mt-1 block w-full font-normal" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles((f) => ({ ...f, cedula_reverso: e.target.files[0] }))} />
            </label>
            <label className="block text-sm font-bold">
              Selfie
              <input className="mt-1 block w-full font-normal" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles((f) => ({ ...f, selfie: e.target.files[0] }))} />
            </label>
            <label className="block text-sm font-bold">
              Fecha de nacimiento (si no se lee de la cédula)
              <input className="mt-1 w-full rounded-xl border border-arena px-3 py-2 font-normal" type="date" value={form.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} />
            </label>
            <label className="block text-sm font-bold">
              Autorización de padres (si sos menor de 18)
              <input className="mt-1 block w-full font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles((f) => ({ ...f, autorizacion_padres: e.target.files[0] }))} />
            </label>
          </div>
        )}

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
        {ok && <p className="text-sm text-bosque">{ok}</p>}
        <button disabled={saving} className="w-full bg-greda text-white font-bold rounded-xl py-3">
          {saving ? "Registrando…" : "Registrarme"}
        </button>
        <p className="text-sm text-center">
          ¿Ya tenís cuenta? <Link className="font-bold text-bosque" to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
