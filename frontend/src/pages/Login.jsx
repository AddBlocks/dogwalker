import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, setToken } from "../lib/api";

export default function Login() {
  const { login, refresh, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") === "google" ? "No pudimos entrar con Google." : "");
  const [googleUrl, setGoogleUrl] = useState(null);

  useEffect(() => {
    const gt = params.get("google_token");
    if (gt) {
      setToken(gt);
      refresh().then(() => nav("/mapa"));
    }
  }, [params, refresh, nav]);

  useEffect(() => {
    if (user) nav("/mapa");
  }, [user, nav]);

  useEffect(() => {
    api("/api/auth/google/url")
      .then((d) => setGoogleUrl(d.url))
      .catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const u = await login(email, password);
      nav(u.rol === "paseador" ? "/solicitudes" : "/mapa");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-bosque text-crema px-5 py-10 flex flex-col">
      <img src="/logo.svg" alt="" className="w-16 h-16 rounded-2xl mb-4" />
      <h1 className="font-display text-4xl leading-tight">Paseos de confianza en Santiago</h1>
      <p className="mt-2 text-crema/75">Conecta dueños y paseadores. Sin hospedaje ni pagos por la app.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-3 bg-crema text-tinta rounded-3xl p-5">
        <label className="block text-sm font-bold">
          Correo
          <input className="mt-1 w-full rounded-xl border border-arena px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm font-bold">
          Contraseña
          <input className="mt-1 w-full rounded-xl border border-arena px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-greda">{error}</p>}
        <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Entrar</button>
        {googleUrl && (
          <a href={googleUrl} className="block text-center w-full border border-bosque rounded-xl py-3 font-bold">
            Continuar con Google
          </a>
        )}
        <p className="text-sm text-center">
          ¿No tenís cuenta? <Link className="text-greda font-bold" to="/registro">Regístrate</Link>
        </p>
        <p className="text-xs text-center text-tinta/50">
          Demo: dueno@paseopatitas.cl · PaseoDemo123
        </p>
      </form>
    </div>
  );
}
