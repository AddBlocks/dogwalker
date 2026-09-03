import { useEffect, useState } from "react";
import { api } from "../lib/api";

const TABS = ["Paseadores", "Comercios", "Anuncios", "Métricas"];

export default function Admin() {
  const [tab, setTab] = useState("Paseadores");
  return (
    <div className="px-4 py-5">
      <h1 className="font-display text-2xl text-bosque">Panel administrador</h1>
      <div className="flex gap-1 overflow-auto my-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-sm font-bold ${tab === t ? "bg-bosque text-crema" : "bg-white border border-arena"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Paseadores" && <PaseadoresAdmin />}
      {tab === "Comercios" && <ComerciosAdmin />}
      {tab === "Anuncios" && <AnunciosAdmin />}
      {tab === "Métricas" && <MetricasAdmin />}
    </div>
  );
}

function PaseadoresAdmin() {
  const [rows, setRows] = useState([]);
  function load() {
    api("/api/admin/paseadores").then(setRows);
  }
  useEffect(load, []);
  return (
    <div className="space-y-3">
      {rows.map((p) => (
        <article key={p.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{p.nombre}</p>
          <p className="text-xs">{p.email} · {p.estado_verificacion} {p.destacado ? "· Destacado" : ""}</p>
          <p className="text-sm">{p.descripcion}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
            {p.estado_verificacion !== "aprobado" && (
              <button className="bg-bosque text-crema px-3 py-1 rounded-full" onClick={() => api(`/api/admin/paseadores/${p.id}/aprobar`, { method: "POST" }).then(load)}>
                Aprobar
              </button>
            )}
            {p.estado_verificacion !== "rechazado" && (
              <button className="border border-greda text-greda px-3 py-1 rounded-full" onClick={() => api(`/api/admin/paseadores/${p.id}/rechazar`, { method: "POST" }).then(load)}>
                Rechazar
              </button>
            )}
            <button
              className="border px-3 py-1 rounded-full"
              onClick={() => api(`/api/admin/paseadores/${p.id}/destacado`, { method: "POST", body: JSON.stringify({ destacado: !p.destacado }) }).then(load)}
            >
              {p.destacado ? "Quitar destacado" : "Marcar destacado"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ComerciosAdmin() {
  const [rows, setRows] = useState([]);
  function load() {
    api("/api/admin/comercios").then(setRows);
  }
  useEffect(load, []);
  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <article key={c.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{c.nombre}</p>
          <p className="text-xs">{c.categoria} · {c.comuna} · {c.estado}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
            <button className="bg-bosque text-crema px-3 py-1 rounded-full" onClick={() => api(`/api/admin/comercios/${c.id}/aprobar`, { method: "POST" }).then(load)}>
              Aprobar
            </button>
            <button className="border border-greda text-greda px-3 py-1 rounded-full" onClick={() => api(`/api/admin/comercios/${c.id}/rechazar`, { method: "POST" }).then(load)}>
              Rechazar
            </button>
            <button className="border px-3 py-1 rounded-full" onClick={() => api(`/api/admin/comercios/${c.id}/destacado`, { method: "POST", body: JSON.stringify({ destacado: !c.destacado }) }).then(load)}>
              {c.destacado ? "Quitar pago/destacado" : "Destacado (pagado)"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function AnunciosAdmin() {
  const [rows, setRows] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [form, setForm] = useState({
    titulo: "",
    texto: "",
    enlace: "",
    ubicacion: "banner_mapa",
    segmento: "ambos",
    comuna_id: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  function load() {
    api("/api/admin/anuncios").then(setRows);
  }
  useEffect(() => {
    load();
    api("/api/comunas").then(setComunas);
  }, []);

  async function crear(e) {
    e.preventDefault();
    await api("/api/admin/anuncios", {
      method: "POST",
      body: JSON.stringify({ ...form, comuna_id: form.comuna_id ? Number(form.comuna_id) : null }),
    });
    setForm((f) => ({ ...f, titulo: "", texto: "", enlace: "" }));
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="bg-white border border-arena rounded-2xl p-3 space-y-2">
        <p className="font-bold">Nuevo anuncio</p>
        <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
        <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Texto" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
        <input className="w-full rounded-xl border border-arena px-3 py-2" placeholder="Enlace" value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} />
        <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}>
          <option value="banner_mapa">Banner inferior del mapa</option>
          <option value="tarjeta_busqueda">Tarjeta entre resultados</option>
          <option value="superior_directorio">Superior del directorio</option>
        </select>
        <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
          <option value="ambos">Dueños y paseadores</option>
          <option value="duenos">Solo dueños</option>
          <option value="paseadores">Solo paseadores</option>
        </select>
        <select className="w-full rounded-xl border border-arena px-3 py-2" value={form.comuna_id} onChange={(e) => setForm({ ...form, comuna_id: e.target.value })}>
          <option value="">Todas las comunas</option>
          {comunas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="rounded-xl border border-arena px-2 py-2" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          <input type="date" className="rounded-xl border border-arena px-2 py-2" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
        </div>
        <button className="w-full bg-greda text-white rounded-xl py-2 font-bold">Crear anuncio</button>
      </form>
      {rows.map((a) => (
        <article key={a.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{a.titulo}</p>
          <p className="text-xs">{a.ubicacion} · {a.segmento} · {a.comuna || "Todas"}</p>
          <p className="text-sm">{a.fecha_inicio} → {a.fecha_fin}</p>
          <p className="text-sm font-bold text-bosque-claro">{a.impresiones} impresiones · {a.clics} clics</p>
        </article>
      ))}
    </div>
  );
}

function MetricasAdmin() {
  const [m, setM] = useState(null);
  useEffect(() => {
    api("/api/admin/metricas").then(setM);
  }, []);
  if (!m) return <p>Cargando…</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-bold">Usuarios</p>
      {m.users.map((u) => (
        <p key={u.rol}>{u.rol}: {u.n}</p>
      ))}
      <p className="font-bold mt-3">Paseos</p>
      {m.paseos.map((p) => (
        <p key={p.estado}>{p.estado}: {p.n}</p>
      ))}
      <p className="font-bold mt-3">Publicidad</p>
      <p>{m.ads.impresiones || 0} impresiones · {m.ads.clics || 0} clics</p>
    </div>
  );
}
