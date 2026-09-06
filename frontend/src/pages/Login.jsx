import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, setToken } from "../lib/api";
import Logo from "../components/Logo";

export default function Login() {
  const { login, refresh, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") === "google"
      ? "No pudimos entrar con Google."
      : params.get("pendiente")
        ? "Si sos paseador, tu cuenta está en revisión. El administrador debe autorizarla."
        : ""
  );
  const [googleUrl, setGoogleUrl] = useState(null);
  const [loginFallo, setLoginFallo] = useState(false);
  const [recuperar, setRecuperar] = useState(null);
  const [msgRecuperar, setMsgRecuperar] = useState("");

  useEffect(() => {
    const gt = params.get("google_token");
    if (gt) {
      setToken(gt);
      refresh().then(() => nav("/mapa"));
    }
  }, [params, refresh, nav]);

  useEffect(() => {
    if (!user) return;
    if (user.debe_cambiar_clave) nav("/cambiar-clave");
    else nav("/mapa");
  }, [user, nav]);

  useEffect(() => {
    api("/api/auth/google/url")
      .then((d) => setGoogleUrl(d.url))
      .catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoginFallo(false);
    setRecuperar(null);
    setMsgRecuperar("");
    try {
      const u = await login(email, password);
      nav(u.debe_cambiar_clave ? "/cambiar-clave" : u.rol === "paseador" ? "/solicitudes" : "/mapa");
    } catch (err) {
      setError(err.message);
      setLoginFallo(true);
    }
  }

  async function enviarTemporal() {
    setMsgRecuperar("");
    try {
      const data = await api("/api/auth/recuperar", { method: "POST", body: JSON.stringify({ email }) });
      setMsgRecuperar(data.mensaje);
      setRecuperar(null);
      setLoginFallo(false);
    } catch (err) {
      setMsgRecuperar(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-bosque text-crema px-5 py-10 flex flex-col">
      <Logo className="w-16 h-16 mb-4" />
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
        {loginFallo && recuperar !== "preguntar" && (
          <button
            type="button"
            className="w-full text-sm font-bold text-greda underline"
            onClick={() => {
              if (!email.trim()) {
                setError("Ingresá tu correo para recuperarla.");
                return;
              }
              setRecuperar("preguntar");
            }}
          >
            ¿Olvidaste tu clave?
          </button>
        )}
        {recuperar === "preguntar" && (
          <div className="rounded-2xl bg-arena/60 p-3 space-y-2">
            <p className="text-sm font-bold">¿El correo {email} es el correcto?</p>
            <div className="flex gap-2">
              <button type="button" className="flex-1 bg-bosque text-crema font-bold rounded-xl py-2" onClick={enviarTemporal}>
                Sí, enviame la clave
              </button>
              <button
                type="button"
                className="flex-1 border border-bosque font-bold rounded-xl py-2"
                onClick={() => {
                  setRecuperar(null);
                  setLoginFallo(true);
                }}
              >
                No, corregirlo
              </button>
            </div>
          </div>
        )}
        {msgRecuperar && <p className="text-sm text-bosque">{msgRecuperar}</p>}
        <button className="w-full bg-bosque text-crema font-bold rounded-xl py-3">Entrar</button>
        {googleUrl && (
          <a href={googleUrl} className="block text-center w-full border border-bosque rounded-xl py-3 font-bold">
            Continuar con Google
          </a>
        )}
        <p className="text-sm text-center">
          ¿No tenís cuenta? <Link className="text-greda font-bold" to="/registro">Regístrate</Link>
        </p>
        <button
          type="button"
          className="w-full text-sm font-bold text-bosque underline py-1"
          onClick={() => nav("/mapa")}
        >
          Seguir sin entrar y ver el mapa
        </button>
        <p className="text-xs text-center text-tinta/50">
          ¿Eres paseador? Regístrate y espera la aprobación para aparecer en el mapa.
        </p>
      </form>
    </div>
  );
}
