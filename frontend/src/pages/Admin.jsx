import { useEffect, useState } from "react";
import { api, apiBlob } from "../lib/api";

const TABS = ["Usuarios", "Paseadores", "Comercios", "Anuncios", "Métricas"];

const ROL_LABEL = { dueno: "Dueño", paseador: "Paseador", admin: "Admin" };

async function borrarUsuario(userId, nombre) {
  if (!confirm(`¿Eliminar la cuenta de ${nombre}? Se borran sus datos personales y no podrá entrar.`)) return false;
  await api(`/api/admin/usuarios/${userId}`, { method: "DELETE" });
  return true;
}

export default function Admin() {
  const [tab, setTab] = useState("Usuarios");
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
      {tab === "Usuarios" && <UsuariosAdmin />}
      {tab === "Paseadores" && <PaseadoresAdmin />}
      {tab === "Comercios" && <ComerciosAdmin />}
      {tab === "Anuncios" && <AnunciosAdmin />}
      {tab === "Métricas" && <MetricasAdmin />}
    </div>
  );
}

function UsuariosAdmin() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  function load() {
    api("/api/admin/usuarios").then(setRows);
  }
  useEffect(load, []);

  const filtrados = rows.filter((u) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [u.nombre, u.email, u.telefono, ROL_LABEL[u.rol]].filter(Boolean).join(" ").toLowerCase().includes(t);
  });

  async function onDelete(u) {
    setError("");
    try {
      if (await borrarUsuario(u.id, u.nombre)) load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-xl border border-arena px-3 py-2 text-sm"
        placeholder="Buscar por nombre, correo o celular"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p className="text-sm text-greda">{error}</p>}
      {filtrados.length === 0 && <p className="text-sm text-tinta/60">No hay usuarios para mostrar.</p>}
      {filtrados.map((u) => (
        <article key={u.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{u.nombre}</p>
          <p className="text-xs">
            {ROL_LABEL[u.rol] || u.rol} · {u.email} · {u.telefono || "sin celular"}
          </p>
          {u.rol === "paseador" && (
            <p className="text-xs text-tinta/50">Verificación: {u.estado_verificacion || "—"}</p>
          )}
          <button
            className="mt-2 text-xs font-bold border border-greda text-greda px-3 py-1 rounded-full"
            onClick={() => onDelete(u)}
          >
            Eliminar usuario
          </button>
        </article>
      ))}
    </div>
  );
}

function PaseadoresAdmin() {
  const [rows, setRows] = useState([]);
  const [viendo, setViendo] = useState(null);
  const [error, setError] = useState("");
  function load() {
    api("/api/admin/paseadores").then(setRows);
  }
  useEffect(load, []);

  async function onDelete(p) {
    setError("");
    try {
      if (await borrarUsuario(p.user_id, p.nombre)) load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-greda">{error}</p>}
      {rows.length === 0 && <p className="text-sm text-tinta/60">Cuando un paseador se registre, aparece acá para revisión.</p>}
      {rows.map((p) => (
        <article key={p.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{p.nombre}</p>
          <p className="text-xs">{p.email} · {p.telefono || "sin celular"} · {p.estado_verificacion} {p.destacado ? "· Destacado" : ""}</p>
          <p className="text-xs text-tinta/50">Proveedor: {p.proveedor_verificacion || "—"} {p.tiene_documentos ? "· documentos subidos" : "· sin documentos"}</p>
          <p className="text-sm">{p.descripcion}</p>
          <p className="text-xs text-tinta/50">{p.radio_km ? `Zona de ${p.radio_km} km (la dirección queda privada)` : "Sin zona de paseo"}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
            <button className="border border-bosque text-bosque px-3 py-1 rounded-full" onClick={() => setViendo(viendo === p.id ? null : p.id)}>
              {viendo === p.id ? "Ocultar documentos" : "Ver documentos"}
            </button>
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
            <button className="border border-greda text-greda px-3 py-1 rounded-full" onClick={() => onDelete(p)}>
              Eliminar usuario
            </button>
          </div>
          {viendo === p.id && <DocumentosPaseador paseador={p} />}
        </article>
      ))}
    </div>
  );
}

const DOC_LABELS = [
  ["cedula_frente", "Cédula — frente"],
  ["cedula_reverso", "Cédula — reverso"],
  ["selfie", "Selfie"],
];

function DocumentosPaseador({ paseador }) {
  const [imgs, setImgs] = useState({});
  const [error, setError] = useState("");
  useEffect(() => {
    let cancel = false;
    const urls = [];
    setError("");
    setImgs({});
    (async () => {
      try {
        const next = {};
        for (const [tipo] of DOC_LABELS) {
          if (!paseador.docs?.[tipo]) continue;
          const url = await apiBlob(`/api/admin/paseadores/${paseador.id}/documento/${tipo}`);
          urls.push(url);
          next[tipo] = url;
        }
        if (!cancel) setImgs(next);
      } catch (e) {
        if (!cancel) setError(e.message);
      }
    })();
    return () => {
      cancel = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [paseador.id, paseador.docs]);

  if (!paseador.tiene_documentos) {
    return <p className="text-sm text-greda mt-3">Este paseador aún no sube cédula ni selfie.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-tinta/60">Revisa que la cédula coincida con la selfie y con el nombre de la cuenta. Después aprueba o rechaza.</p>
      {error && <p className="text-sm text-greda">{error}</p>}
      {DOC_LABELS.map(([tipo, label]) => (
        <figure key={tipo} className="bg-crema rounded-xl p-2">
          <figcaption className="text-xs font-bold mb-1">{label}</figcaption>
          {imgs[tipo] ? (
            <img src={imgs[tipo]} alt={label} className="w-full max-h-80 object-contain rounded-lg bg-white" />
          ) : paseador.docs?.[tipo] ? (
            <p className="text-xs">Cargando…</p>
          ) : (
            <p className="text-xs text-tinta/50">No se subió este lado.</p>
          )}
        </figure>
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
