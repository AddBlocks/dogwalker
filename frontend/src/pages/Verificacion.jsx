import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Verificacion() {
  const nav = useNavigate();
  const { paseador } = useAuth();
  const docs = paseador?.docs || {};
  const [files, setFiles] = useState({ cedula_frente: null, cedula_reverso: null, selfie: null, autorizacion_padres: null });
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    for (const k of Object.keys(files)) {
      if (k !== "autorizacion_padres" && !files[k] && !docs[k]) {
        return setError("Subí las tres fotos: cédula frente, reverso y selfie. Si ya están, solo reemplazá las que quieras actualizar.");
      }
      if (files[k]) fd.append(k, files[k]);
    }
    if (fechaNacimiento) fd.append("fecha_nacimiento", fechaNacimiento);
    try {
      const data = await api("/api/paseadores/verificacion", { method: "POST", body: fd });
      setMsg(data.mensaje);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-crema px-5 py-8">
      <h1 className="font-display text-3xl text-bosque">Verificación de identidad</h1>
      <p className="text-sm mt-2 text-tinta/70">
        Subí tu cédula por ambos lados y una selfie. Las imágenes se cifran. Podés reemplazarlas, pero no borrarlas:
        la versión anterior queda hasta que el administrador autorice eliminarla. No aparecés en el mapa hasta que te aprueben.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {[
          ["cedula_frente", "Cédula — frente"],
          ["cedula_reverso", "Cédula — reverso"],
          ["selfie", "Selfie"],
          ["autorizacion_padres", "Autorización de padres (si sos menor de 18)"],
        ].map(([k, label]) => (
          <label key={k} className="block text-sm font-bold">
            {label}
            {docs[k] && <span className="ml-2 font-normal text-tinta/50">ya subido · reemplazar</span>}
            <input className="mt-1 block w-full" type="file" accept={k === "autorizacion_padres" ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"} onChange={(e) => setFiles((f) => ({ ...f, [k]: e.target.files[0] }))} />
          </label>
        ))}
        <label className="block text-sm font-bold">
          Fecha de nacimiento (si no se lee de la cédula)
          <input className="mt-1 w-full rounded-xl border border-arena px-3 py-2 font-normal" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
        </label>
        {error && <p className="text-greda text-sm">{error}</p>}
        {msg && <p className="text-bosque-claro text-sm">{msg}</p>}
        <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Enviar documentos</button>
        <button type="button" className="w-full" onClick={() => nav("/perfil")}>
          Seguir después
        </button>
      </form>
    </div>
  );
}
