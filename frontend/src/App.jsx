import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Verificacion from "./pages/Verificacion";
import Privacidad from "./pages/Privacidad";
import Mapa from "./pages/Mapa";
import PaseadorPerfil from "./pages/PaseadorPerfil";
import Solicitar from "./pages/Solicitar";
import Solicitudes from "./pages/Solicitudes";
import PublicarSolicitud from "./pages/PublicarSolicitud";
import MiOferta from "./pages/MiOferta";
import Paseos from "./pages/Paseos";
import Recorrido from "./pages/Recorrido";
import Resena from "./pages/Resena";
import Directorio from "./pages/Directorio";
import Comercio from "./pages/Comercio";
import SugerirComercio from "./pages/SugerirComercio";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import CambiarClave from "./pages/CambiarClave";

function Gate({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-center text-bosque">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.debe_cambiar_clave) return <Navigate to="/cambiar-clave" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/mapa" replace />;
  return children;
}

function GateClave({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-center text-bosque">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-center text-bosque">Cargando…</p>;
  if (user?.debe_cambiar_clave) return <Navigate to="/cambiar-clave" replace />;
  if (user) return <Navigate to="/mapa" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/cambiar-clave"
        element={
          <GateClave>
            <CambiarClave />
          </GateClave>
        }
      />
      <Route path="/registro" element={<Registro />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route
        path="/verificacion"
        element={
          <Gate roles={["paseador"]}>
            <Verificacion />
          </Gate>
        }
      />
      <Route element={<Layout />}>
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/paseador/:id" element={<PaseadorPerfil />} />
        <Route
          path="/solicitar/:id"
          element={
            <Gate roles={["dueno"]}>
              <Solicitar />
            </Gate>
          }
        />
        <Route
          path="/publicar"
          element={
            <Gate roles={["dueno"]}>
              <PublicarSolicitud />
            </Gate>
          }
        />
        <Route
          path="/solicitudes"
          element={
            <Gate>
              <Solicitudes />
            </Gate>
          }
        />
        <Route
          path="/mi-oferta"
          element={
            <Gate roles={["paseador"]}>
              <MiOferta />
            </Gate>
          }
        />
        <Route
          path="/paseos"
          element={
            <Gate>
              <Paseos />
            </Gate>
          }
        />
        <Route
          path="/paseos/:id"
          element={
            <Gate>
              <Recorrido />
            </Gate>
          }
        />
        <Route
          path="/resena/:id"
          element={
            <Gate>
              <Resena />
            </Gate>
          }
        />
        <Route path="/directorio" element={<Directorio />} />
        <Route path="/directorio/:id" element={<Comercio />} />
        <Route
          path="/directorio/sugerir"
          element={
            <Gate>
              <SugerirComercio />
            </Gate>
          }
        />
        <Route
          path="/perfil"
          element={
            <Gate>
              <Perfil />
            </Gate>
          }
        />
        <Route
          path="/admin"
          element={
            <Gate roles={["admin"]}>
              <Admin />
            </Gate>
          }
        />
      </Route>
    </Routes>
  );
}
