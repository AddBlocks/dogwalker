import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Logo from "./Logo";

const item = ({ isActive }) =>
  `flex flex-col items-center text-[11px] font-bold ${isActive ? "text-oro" : "text-white/70"}`;

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 bg-bosque text-crema px-4 py-3 flex items-center gap-2">
        <Logo className="w-8 h-8" />
        <div>
          <p className="font-display text-lg leading-none">PaseoPatitas</p>
          <p className="text-[11px] text-crema/70">Santiago · solo paseos</p>
        </div>
      </header>
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-bosque text-white border-t border-white/10 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-4">
        <NavLink to="/mapa" className={item}>
          <span className="text-lg">🗺️</span>
          Mapa
        </NavLink>
        <NavLink to="/solicitudes" className={item}>
          <span className="text-lg">🐾</span>
          {user?.rol === "paseador" ? "Bandeja" : "Solicitudes"}
        </NavLink>
        <NavLink to="/directorio" className={item}>
          <span className="text-lg">🏪</span>
          Directorio
        </NavLink>
        <NavLink to="/perfil" className={item}>
          <span className="text-lg">👤</span>
          Perfil
        </NavLink>
      </nav>
    </div>
  );
}
