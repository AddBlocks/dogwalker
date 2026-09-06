import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, CircleMarker, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { centroide, zonaVisible } from "../lib/zona";
import AdSlot from "../components/AdSlot";
import WalkerCard from "../components/WalkerCard";
import Stars from "../components/Stars";
import { pinHuellasHtml } from "../components/Logo";

function pinIcon(destacado) {
  return L.divIcon({
    className: "",
    html: pinHuellasHtml(destacado),
    iconSize: [27, 27],
    iconAnchor: [14, 14],
  });
}

function AjustarMapa({ walkers, center, comuna }) {
  const map = useMap();
  useEffect(() => {
    const ajustar = () => {
      map.invalidateSize();
      const pts = walkers.flatMap((w) => zonaVisible(w) || []);
      if (pts.length >= 3) {
        map.fitBounds(pts, { padding: [28, 28], maxZoom: 15, animate: false });
        return;
      }
      if (center) map.setView(center, 13, { animate: false });
    };
    const t = setTimeout(ajustar, 200);
    const t2 = setTimeout(ajustar, 800);
    window.addEventListener("resize", ajustar);
    window.addEventListener("orientationchange", ajustar);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("orientationchange", ajustar);
    };
  }, [walkers, center, comuna, map]);
  return null;
}

export default function Mapa() {
  const { user } = useAuth();
  const [comunas, setComunas] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [filtros, setFiltros] = useState({ comuna: "", precio_max: "", calificacion_min: "" });
  const [ad, setAd] = useState(null);
  const [center, setCenter] = useState([-33.4372, -70.6506]);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    api("/api/comunas").then(setComunas);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (filtros.comuna) q.set("comuna", filtros.comuna);
    if (filtros.precio_max) q.set("precio_max", filtros.precio_max);
    if (filtros.calificacion_min) q.set("calificacion_min", filtros.calificacion_min);
    api(`/api/paseadores?${q}`).then(setWalkers);
    api(`/api/anuncios?ubicacion=banner_mapa&comuna=${filtros.comuna || ""}`)
      .then((rows) => setAd(rows[0] || null))
      .catch(() => {});
  }, [filtros]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  function onComuna(id) {
    const c = comunas.find((x) => String(x.id) === String(id));
    setFiltros((f) => ({ ...f, comuna: id }));
    if (c) setCenter([c.lat, c.lng]);
  }

  return (
    <div className="flex flex-col">
      <MapContainer
        center={center}
        zoom={13}
        preferCanvas
        className="h-[52dvh] min-h-[280px] w-full"
        zoomControl={false}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {walkers.map((w) => {
          const poligono = zonaVisible(w);
          const color = w.destacado ? "#C45C26" : "#8B4513";
          if (poligono) {
            return (
              <Polygon
                key={`zona-${w.id}`}
                positions={poligono}
                pathOptions={{ color, weight: 3, fillColor: color, fillOpacity: 0.35 }}
              >
                <Popup>
                  <p className="font-bold m-0">{w.nombre}</p>
                  <p className="m-0 text-sm">{clp(w.precio_clp)} · zona de {w.nombre}</p>
                  <Link to={`/paseador/${w.id}`}>Ver perfil</Link>
                </Popup>
              </Polygon>
            );
          }
          if (w.lat && w.lng && w.radio_km) {
            return (
              <Circle
                key={`zona-${w.id}`}
                center={[w.lat, w.lng]}
                radius={Number(w.radio_km) * 1000}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.1 }}
              >
                <Popup>
                  <p className="font-bold m-0">{w.nombre}</p>
                  <p className="m-0 text-sm">
                    {clp(w.precio_clp)} · zona {w.radio_km} km
                  </p>
                  <Link to={`/paseador/${w.id}`}>Ver perfil</Link>
                </Popup>
              </Circle>
            );
          }
          return null;
        })}
        {walkers.flatMap((w) =>
          (w.vertices || []).map((v, i) => (
            <CircleMarker
              key={`cruz-${w.id}-${i}`}
              center={[v.lat, v.lng]}
              radius={6}
              pathOptions={{ color: "#5C2C0E", fillColor: "#E9B44C", fillOpacity: 1, weight: 1 }}
            >
              <Tooltip>{[v.a, v.b].filter(Boolean).join(" × ")}</Tooltip>
            </CircleMarker>
          ))
        )}
        {walkers.map((w) => {
          const poligono = zonaVisible(w);
          const pin = (poligono && centroide(poligono)) || (w.lat && w.lng ? [w.lat, w.lng] : null);
          return pin ? (
            <Marker key={w.id} position={pin} icon={pinIcon(w.destacado)}>
              <Popup>
                <p className="font-bold m-0">{w.nombre}</p>
                {w.destacado && <p className="text-xs text-amber-700 m-0">Destacado</p>}
                <Stars value={w.calificacion} />
                <p className="m-0 text-sm">
                  {clp(w.precio_clp)} · zona {w.radio_km} km
                </p>
                {w.calles?.length > 0 && (
                  <p className="m-0 text-xs">{w.calles.map((c) => c.nombre).join(" · ")}</p>
                )}
                <Link to={`/paseador/${w.id}`}>Ver perfil</Link>
              </Popup>
            </Marker>
          ) : null;
        })}
        <AjustarMapa walkers={walkers} center={center} comuna={filtros.comuna} />
      </MapContainer>

      <div className="px-3 py-2 space-y-2">
        {ad && <AdSlot ad={ad} compact />}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-bosque">{walkers.length} paseadores</p>
          <div className="flex gap-2">
            {user?.rol === "dueno" && (
              <Link to="/publicar" className="text-xs font-bold bg-greda text-white px-3 py-1.5 rounded-full">
                Publicar solicitud
              </Link>
            )}
            <button className="text-xs font-bold underline" onClick={() => setLista((v) => !v)}>
              {lista ? "Ocultar lista" : "Ver lista"}
            </button>
          </div>
        </div>
        {walkers.length === 0 && (
          <p className="text-xs text-tinta/50">
            Aún no hay paseadores con zona de km publicada
            {user?.rol === "paseador" ? ". Completa tu dirección y radio en Mi oferta para aparecer." : "."}
          </p>
        )}
        {lista && (
          <div className="space-y-3 max-h-[28vh] overflow-auto">
            {walkers.map((w, i) => (
              <div key={w.id}>
                <WalkerCard walker={w} />
                {i === 0 && walkers.length > 1 && <SearchAd comuna={filtros.comuna} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-20 z-[500] bg-white border-t border-arena px-3 py-3 shadow-[0_-8px_24px_rgba(27,67,50,0.12)]">
        <div className="grid grid-cols-2 gap-2">
          <select className="col-span-2 rounded-xl border border-arena px-2 py-2 text-sm" value={filtros.comuna} onChange={(e) => onComuna(e.target.value)}>
            <option value="">Todas las zonas</option>
            {comunas.map((c) => (
              <option key={c.id} value={c.id}>
                Llegan a {c.nombre}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-arena px-2 py-2 text-sm"
            type="number"
            placeholder="Precio máx. CLP"
            value={filtros.precio_max}
            onChange={(e) => setFiltros((f) => ({ ...f, precio_max: e.target.value }))}
          />
          <select className="rounded-xl border border-arena px-2 py-2 text-sm" value={filtros.calificacion_min} onChange={(e) => setFiltros((f) => ({ ...f, calificacion_min: e.target.value }))}>
            <option value="">Cualquier nota</option>
            <option value="4">4.0 o más</option>
            <option value="4.5">4.5 o más</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function SearchAd({ comuna }) {
  const [ad, setAd] = useState(null);
  useEffect(() => {
    api(`/api/anuncios?ubicacion=tarjeta_busqueda&comuna=${comuna || ""}`)
      .then((rows) => setAd(rows[0] || null))
      .catch(() => {});
  }, [comuna]);
  return ad ? (
    <div className="my-3">
      <AdSlot ad={ad} compact />
    </div>
  ) : null;
}
