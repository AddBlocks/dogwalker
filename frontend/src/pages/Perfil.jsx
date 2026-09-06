import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Stars from "../components/Stars";

export default function Perfil() {
  const { user, paseador, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [nombre, setNombre] = useState(user.nombre);
  const [telefono, setTelefono] = useState(user.telefono || "");
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    await api("/api/usuarios/me", { method: "PUT", body: JSON.stringify({ nombre, telefono }) });
    await refresh();
    setMsg("Datos guardados.");
  }

  async function eliminar() {
    if (!confirm("¿Eliminar tu cuenta y datos personales? Esta acción no se puede deshacer.")) return;
    await api("/api/usuarios/me/eliminar", { method: "POST" });
    logout();
    nav("/login");
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="font-display text-2xl text-bosque">Hola, {user.nombre}</h1>
      <p className="text-sm capitalize">Rol: {user.rol === "dueno" ? "Dueño" : user.rol}</p>
      <Stars value={user.calificacion_promedio} />
      <form onSubmit={save} className="space-y-2">
        <input className="w-full rounded-xl border border-arena px-3 py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="w-full rounded-xl border border-arena px-3 py-2" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Celular" />
        <p className="text-xs text-tinta/50">Los matches y pedidos se avisan acá en la app, en Solicitudes o Bandeja.</p>
        <button className="w-full bg-bosque text-crema rounded-xl py-2 font-bold">Guardar</button>
      </form>
      {msg && <p className="text-sm text-bosque-claro">{msg}</p>}
      <div className="grid gap-2 text-sm font-bold">
        <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/paseos">Mis paseos</Link>
        {user.rol === "paseador" && (
          <>
            <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/mi-oferta">Mi oferta</Link>
            {paseador?.estado_verificacion !== "aprobado" && (
              <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/verificacion">
                Completar verificación
              </Link>
            )}
          </>
        )}
        {user.rol === "admin" && (
          <Link className="bg-greda text-white rounded-xl px-3 py-3" to="/admin">
            Panel administrador
          </Link>
        )}
        <Link className="bg-white border border-arena rounded-xl px-3 py-3" to="/privacidad">
          Política de privacidad
        </Link>
      </div>
      <button className="w-full text-greda font-bold" onClick={() => { logout(); nav("/login"); }}>
        Cerrar sesión
      </button>
      <button className="w-full text-xs text-tinta/50" onClick={eliminar}>
        Eliminar cuenta y datos (Ley 21.719)
      </button>
    </div>
  );
}
