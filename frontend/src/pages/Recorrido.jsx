import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { estadoLabel } from "../lib/format";
import { pinHuellasHtml } from "../components/Logo";

const SANTIAGO = [-33.4372, -70.6506];

function pinPaseador(destacado = false) {
  return L.divIcon({
    className: "",
    html: pinHuellasHtml(destacado),
    iconSize: [27, 27],
    iconAnchor: [14, 14],
  });
}

function pinInicio() {
  return L.divIcon({
    className: "",
    html: `<div class="pin-paseador" style="display:flex;align-items:center;justify-content:center;font-weight:800;color:#6B3410;background:#F6F1E7">A</div>`,
    iconSize: [27, 27],
    iconAnchor: [14, 14],
  });
}

function FitRoute({ puntos }) {
  const map = useMap();
  const last = puntos[puntos.length - 1];
  useEffect(() => {
    if (!puntos.length) return;
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lng], 16);
      return;
    }
    map.fitBounds(
      puntos.map((p) => [p.lat, p.lng]),
      { padding: [28, 28], maxZoom: 17 }
    );
  }, [puntos.length, last?.lat, last?.lng, map, puntos]);
  return null;
}

function leerGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este celular no entrega GPS. Probá en uno con ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject(new Error("Tenís que permitir la ubicación para compartir el recorrido en la app."));
        else reject(new Error("No pude leer tu ubicación. Revisá el GPS e intentá de nuevo."));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  });
}

function fmtDist(m) {
  if (!m) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export default function Recorrido() {
  const { id } = useParams();
  const { user } = useAuth();
  const [paseo, setPaseo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const watchRef = useRef(null);
  const lastSent = useRef(0);

  const cargar = useCallback(async () => {
    const data = await api(`/api/paseos/${id}`);
    setPaseo(data);
    return data;
  }, [id]);

  useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [cargar]);

  const soyPaseador = user?.id === paseo?.paseador_id;
  const enCurso = paseo?.estado === "en_curso";

  useEffect(() => {
    if (!paseo || soyPaseador || paseo.estado !== "en_curso") return undefined;
    const t = setInterval(() => cargar().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [paseo, soyPaseador, cargar]);

  const enviarPunto = useCallback(
    async (coords) => {
      const now = Date.now();
      if (now - lastSent.current < 4000) return;
      lastSent.current = now;
      await api(`/api/paseos/${id}/puntos`, { method: "POST", body: JSON.stringify(coords) });
    },
    [id]
  );

  useEffect(() => {
    if (!soyPaseador || !enCurso) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return undefined;
    }
    if (!navigator.geolocation || watchRef.current != null) return undefined;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        enviarPunto(coords)
          .then(() => cargar())
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
    let wake;
    if (navigator.wakeLock) {
      navigator.wakeLock.request("screen").then((l) => {
        wake = l;
      }).catch(() => {});
    }
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      wake?.release?.();
    };
  }, [soyPaseador, enCurso, enviarPunto, cargar]);

  async function iniciar() {
    setError("");
    setBusy(true);
    try {
      const coords = await leerGps();
      const data = await api(`/api/paseos/${id}/iniciar`, { method: "POST", body: JSON.stringify(coords) });
      lastSent.current = Date.now();
      setPaseo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function terminar() {
    setError("");
    setBusy(true);
    try {
      let coords = null;
      try {
        coords = await leerGps();
      } catch {
        coords = null;
      }
      const data = await api(`/api/paseos/${id}/terminar`, {
        method: "POST",
        body: JSON.stringify(coords || {}),
      });
      setPaseo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !paseo) return <p className="p-5 text-greda">{error}</p>;
  if (!paseo) return <p className="p-5">Cargando recorrido…</p>;

  const puntos = paseo.puntos || [];
  const path = puntos.map((p) => [p.lat, p.lng]);
  const centro = path[path.length - 1] || [paseo.comuna_lat || SANTIAGO[0], paseo.comuna_lng || SANTIAGO[1]];
  const inicio = puntos[0];
  const actual = puntos[puntos.length - 1];

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <Link to="/paseos" className="text-sm font-bold text-bosque-claro">
          ← Paseos
        </Link>
        <h1 className="font-display text-2xl text-bosque mt-1">Recorrido en la app</h1>
        <p className="text-sm text-tinta/70">
          {paseo.comuna} · {paseo.dueno_nombre} ↔ {paseo.paseador_nombre} · {clp(paseo.monto_clp)}
        </p>
        <p className="text-xs font-bold uppercase text-bosque-claro mt-1">
          {estadoLabel(paseo.estado)}
          {puntos.length > 0 && ` · ${fmtDist(paseo.distancia_m)} · ${puntos.length} puntos`}
        </p>
      </div>

      <MapContainer center={centro} zoom={15} className="h-[46vh] w-full" zoomControl={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {path.length > 1 && <Polyline positions={path} pathOptions={{ color: "#C45C26", weight: 5, opacity: 0.9 }} />}
        {inicio && <Marker position={[inicio.lat, inicio.lng]} icon={pinInicio()} />}
        {actual && <Marker position={[actual.lat, actual.lng]} icon={pinPaseador(enCurso)} />}
        <FitRoute puntos={puntos} />
      </MapContainer>

      <div className="px-4 py-4 space-y-3">
        {soyPaseador && paseo.estado === "acordado" && (
          <p className="text-sm">
            El trato ya está cerrado. Tenís que compartir el recorrido de principio a fin acá adentro, no por WhatsApp.
          </p>
        )}
        {!soyPaseador && paseo.estado === "acordado" && (
          <p className="text-sm">Esperando que {paseo.paseador_nombre} inicie el paseo y comparta su GPS.</p>
        )}
        {!soyPaseador && enCurso && (
          <p className="text-sm font-bold text-greda">Paseo en curso. El mapa se actualiza solo.</p>
        )}
        {paseo.estado === "completado" && (
          <p className="text-sm">Recorrido completo, de la partida al término.</p>
        )}
        {error && <p className="text-sm text-greda">{error}</p>}

        {soyPaseador && paseo.estado === "acordado" && (
          <button disabled={busy} onClick={iniciar} className="w-full bg-bosque text-crema font-bold rounded-2xl py-4 text-lg">
            {busy ? "Ubicando…" : "Paseo iniciado"}
          </button>
        )}
        {soyPaseador && enCurso && (
          <button disabled={busy} onClick={terminar} className="w-full bg-greda text-white font-bold rounded-2xl py-4 text-lg">
            {busy ? "Cerrando…" : "Paseo terminado"}
          </button>
        )}
        {paseo.puede_resenar && (
          <Link to={`/resena/${paseo.id}`} className="block text-center bg-bosque text-crema rounded-xl py-3 font-bold">
            Dejar reseña
          </Link>
        )}
      </div>
    </div>
  );
}
