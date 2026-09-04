import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, clp } from "../lib/api";
import { useAuth } from "../lib/auth";
import AdSlot from "../components/AdSlot";
import WalkerCard from "../components/WalkerCard";
import Stars from "../components/Stars";
import { pinHuellasHtml } from "../components/Logo";

function pinIcon(destacado) {
  return L.divIcon({
    className: "",
    html: pinHuellasHtml(destacado),
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13, { duration: 0.6 });
  }, [center, map]);
  return null;
}

function offset(lat, lng, i) {
  const a = i * 0.9;
  return [lat + Math.sin(a) * 0.004, lng + Math.cos(a) * 0.004];
}

export default function Mapa() {
  const { user } = useAuth();
  const [comunas, setComunas] = useState([]);
  const [geo, setGeo] = useState(null);
  const [walkers, setWalkers] = useState([]);
  const [filtros, setFiltros] = useState({ comuna: "", precio_max: "", calificacion_min: "" });
  const [ad, setAd] = useState(null);
  const [center, setCenter] = useState([-33.4372, -70.6506]);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    api("/api/comunas").then(setComunas);
    api("/api/comunas/geojson").then(setGeo);
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
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const c = await api(`/api/comunas/cercana?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        setFiltros((f) => (f.comuna ? f : { ...f, comuna: String(c.id) }));
        setCenter([c.lat, c.lng]);
      } catch {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
      }
    });
  }, []);

  const markers = useMemo(() => {
    const count = {};
    return walkers.flatMap((w) => {
      const base = w.comunas?.[0];
      if (!base) return [];
      if (filtros.comuna) {
        const match = w.comunas.find((c) => String(c.id) === String(filtros.comuna));
        if (!match) return [];
        const key = match.id;
        count[key] = (count[key] || 0) + 1;
        return [{ w, pos: offset(match.lat, match.lng, count[key]) }];
      }
      count[base.id] = (count[base.id] || 0) + 1;
      return [{ w, pos: offset(base.lat, base.lng, count[base.id]) }];
    });
  }, [walkers, filtros.comuna]);

  function onComuna(id) {
    const c = comunas.find((x) => String(x.id) === String(id));
    setFiltros((f) => ({ ...f, comuna: id }));
    if (c) setCenter([c.lat, c.lng]);
  }

  return (
    <div className="flex flex-col">
      <MapContainer center={center} zoom={12} className="h-[calc(100dvh-19.5rem)] min-h-[42vh] w-full" zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && (
          <GeoJSON
            data={geo}
            style={() => ({ color: "#2D6A4F", weight: 1, fillColor: "#40916C", fillOpacity: 0.12 })}
          />
        )}
        {markers.map(({ w, pos }) => (
          <Marker key={w.id} position={pos} icon={pinIcon(w.destacado)}>
            <Popup>
              <p className="font-bold m-0">{w.nombre}</p>
              {w.destacado && <p className="text-xs text-amber-700 m-0">Destacado</p>}
              <Stars value={w.calificacion} />
              <p className="m-0 text-sm">{clp(w.precio_clp)} · {w.paseos} paseos</p>
              <Link to={`/paseador/${w.id}`}>Ver perfil</Link>
            </Popup>
          </Marker>
        ))}
        <FlyTo center={center} />
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
            <option value="">Todas las comunas</option>
            {comunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
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
