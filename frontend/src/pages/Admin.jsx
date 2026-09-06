import { useEffect, useState } from "react";
import { api, apiBlob } from "../lib/api";

const TABS = ["Usuarios", "Paseadores", "Comercios", "Anuncios", "Métricas"];

const ROL_LABEL = { dueno: "Dueño", paseador: "Paseador", admin: "Admin" };

const DOC_LABELS = [
  ["cedula_frente", "Cédula — frente"],
  ["cedula_reverso", "Cédula — reverso"],
  ["selfie", "Selfie"],
  ["autorizacion_padres", "Autorización de padres"],
];

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
  const [viendo, setViendo] = useState(null);
  const [ocultos, setOcultos] = useState({});

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
      try {
        const next = await api("/api/admin/usuarios");
        setRows(next);
        if (!next.some((x) => x.id === u.id)) return;
      } catch {
        /* el listado también falló */
      }
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
            {u.rol === "paseador" && !u.autorizado ? " · espera autorización" : u.rol === "paseador" ? " · autorizado" : ""}
          </p>
          {u.rol === "paseador" && (
            <p className="text-xs text-tinta/50">
              Verificación: {u.estado_verificacion || "—"}
              {u.edad != null ? ` · ${u.edad} años` : ""}
              {u.solo_no_peligrosas ? " · solo razas no peligrosas" : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {u.rol === "paseador" && u.paseador_id && (
              <button
                className="text-xs font-bold border border-bosque text-bosque px-3 py-1 rounded-full"
                onClick={() => {
                  if (u.autorizado) setViendo(viendo === u.id ? null : u.id);
                  else setOcultos((o) => ({ ...o, [u.id]: !o[u.id] }));
                }}
              >
                {(u.autorizado ? viendo === u.id : !ocultos[u.id]) ? "Ocultar documentos" : "Ver documentos"}
              </button>
            )}
            {u.rol === "paseador" && !u.autorizado && (
              <button
                className="text-xs font-bold bg-bosque text-crema px-3 py-1 rounded-full disabled:opacity-40"
                disabled={!u.tiene_documentos}
                onClick={() =>
                  api(`/api/admin/usuarios/${u.id}/autorizar`, { method: "POST" })
                    .then(load)
                    .catch((e) => setError(e.message))
                }
              >
                Autorizar
              </button>
            )}
            <button
              className="text-xs font-bold border border-greda text-greda px-3 py-1 rounded-full"
              onClick={() => onDelete(u)}
            >
              Eliminar usuario
            </button>
          </div>
          {u.rol === "paseador" && u.paseador_id && (u.autorizado ? viendo === u.id : !ocultos[u.id]) && (
            <DocumentosPaseador
              paseador={{
                id: u.paseador_id,
                docs: u.docs,
                docs_viejos: u.docs_viejos,
                tiene_documentos: u.tiene_documentos,
              }}
            />
          )}
        </article>
      ))}
    </div>
  );
}

function PaseadoresAdmin() {
  const [rows, setRows] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [viendo, setViendo] = useState(null);
  const [ocultos, setOcultos] = useState({});
  const [error, setError] = useState("");
  function load() {
    api("/api/admin/paseadores").then(setRows);
    api("/api/admin/documentos-historico").then(setPendientes).catch(() => setPendientes([]));
  }
  useEffect(load, []);

  async function onDelete(p) {
    setError("");
    try {
      if (await borrarUsuario(p.user_id, p.nombre)) load();
    } catch (e) {
      try {
        const next = await api("/api/admin/paseadores");
        setRows(next);
        if (!next.some((x) => x.user_id === p.user_id)) return;
      } catch {
        /* el listado también falló */
      }
      setError(e.message);
    }
  }

  const sueltos = pendientes.filter((d) => d.deleted_at || !rows.some((p) => p.id === d.paseador_id));
  const DOC_NOMBRE = Object.fromEntries(DOC_LABELS);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-greda">{error}</p>}
      {sueltos.length > 0 && (
        <article className="bg-white border border-greda/40 rounded-2xl p-3 space-y-2">
          <p className="font-bold text-sm">Archivos anteriores pendientes de borrar</p>
          <p className="text-xs text-tinta/60">Cuentas ya eliminadas o archivos reemplazados. Solo se borran si lo autorizás.</p>
          {sueltos.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                {d.nombre} · {d.email} · {DOC_NOMBRE[d.tipo] || d.tipo}
                {d.deleted_at ? " · cuenta eliminada" : ""}
              </span>
              <button
                className="font-bold border border-greda text-greda px-3 py-1 rounded-full"
                onClick={() => {
                  if (!confirm("¿Autorizar el borrado de este archivo anterior?")) return;
                  api(`/api/admin/documentos-historico/${d.id}/autorizar-borrado`, { method: "POST" })
                    .then(load)
                    .catch((e) => setError(e.message));
                }}
              >
                Autorizar borrado
              </button>
            </div>
          ))}
        </article>
      )}
      {rows.length === 0 && <p className="text-sm text-tinta/60">Cuando un paseador se registre, aparece acá para revisión.</p>}
      {rows.map((p) => (
        <article key={p.id} className="bg-white border border-arena rounded-2xl p-3">
          <p className="font-bold">{p.nombre}</p>
          <p className="text-xs">{p.email} · {p.telefono || "sin celular"} · {p.estado_verificacion} {p.destacado ? "· Destacado" : ""}</p>
          <p className="text-xs text-tinta/50">
            {p.edad != null ? `${p.edad} años` : "Edad no leída"}
            {p.solo_no_peligrosas ? " · solo razas no peligrosas" : ""}
            {p.fecha_nacimiento ? ` · nac. ${p.fecha_nacimiento}` : ""}
          </p>
          <p className="text-xs text-tinta/50">Proveedor: {p.proveedor_verificacion || "—"} {p.tiene_documentos ? "· documentos vigentes" : "· sin documentos"}{p.docs_viejos?.length ? ` · ${p.docs_viejos.length} anterior${p.docs_viejos.length === 1 ? "" : "es"} pendiente${p.docs_viejos.length === 1 ? "" : "s"} de borrar` : ""}</p>
          <p className="text-sm">{p.descripcion}</p>
          <p className="text-xs text-tinta/50">{p.radio_km ? `Zona de ${p.radio_km} km (la dirección queda privada)` : "Sin zona de paseo"}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
            <button
              className="border border-bosque text-bosque px-3 py-1 rounded-full"
              onClick={() => {
                if (p.estado_verificacion === "pendiente") setOcultos((o) => ({ ...o, [p.id]: !o[p.id] }));
                else setViendo(viendo === p.id ? null : p.id);
              }}
            >
              {(p.estado_verificacion === "pendiente" ? !ocultos[p.id] : viendo === p.id) ? "Ocultar documentos" : "Ver documentos"}
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
          {(p.estado_verificacion === "pendiente" ? !ocultos[p.id] : viendo === p.id) && <DocumentosPaseador paseador={p} onChange={load} />}
        </article>
      ))}
    </div>
  );
}

function DocumentosPaseador({ paseador, onChange }) {
  const [imgs, setImgs] = useState({});
  const [viejos, setViejos] = useState({});
  const [error, setError] = useState("");
  useEffect(() => {
    let cancel = false;
    const urls = [];
    setError("");
    setImgs({});
    setViejos({});
    (async () => {
      try {
        const next = {};
        const fallos = [];
        for (const [tipo, label] of DOC_LABELS) {
          if (!paseador.docs?.[tipo]) continue;
          try {
            const url = await apiBlob(`/api/admin/paseadores/${paseador.id}/documento/${tipo}`);
            urls.push(url);
            next[tipo] = url;
          } catch (e) {
            fallos.push(`${label}: ${e.message}`);
          }
        }
        const prev = {};
        for (const doc of paseador.docs_viejos || []) {
          try {
            const url = await apiBlob(`/api/admin/documentos-historico/${doc.id}`);
            urls.push(url);
            prev[doc.id] = url;
          } catch (e) {
            fallos.push(`Anterior ${doc.tipo}: ${e.message}`);
          }
        }
        if (!cancel) {
          setImgs(next);
          setViejos(prev);
          if (fallos.length) setError(fallos.join(" · "));
        }
      } catch (e) {
        if (!cancel) setError(e.message);
      }
    })();
    return () => {
      cancel = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [paseador.id, paseador.docs, paseador.docs_viejos]);

  const labels = Object.fromEntries(DOC_LABELS);

  if (!paseador.tiene_documentos && !paseador.docs_viejos?.length) {
    return <p className="text-sm text-greda mt-3">Este paseador aún no sube cédula ni selfie.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-tinta/60">Revisá que la cédula coincida con la selfie y con el nombre. Sin ver estos archivos no se autoriza al paseador.</p>
      {error && <p className="text-sm text-greda">{error}</p>}
      {DOC_LABELS.map(([tipo, label]) => (
        <figure key={tipo} className="bg-crema rounded-xl p-2">
          <figcaption className="text-xs font-bold mb-1">{label} (vigente)</figcaption>
          {imgs[tipo] ? (
            <img src={imgs[tipo]} alt={label} className="w-full max-h-80 object-contain rounded-lg bg-white" />
          ) : paseador.docs?.[tipo] ? (
            <p className="text-xs">Cargando…</p>
          ) : (
            <p className="text-xs text-tinta/50">No se subió este lado.</p>
          )}
        </figure>
      ))}
      {(paseador.docs_viejos || []).map((doc) => (
        <figure key={doc.id} className="bg-white border border-greda/40 rounded-xl p-2">
          <figcaption className="text-xs font-bold mb-1 text-greda">
            Anterior: {labels[doc.tipo] || doc.tipo} · {doc.reemplazado_at}
          </figcaption>
          {viejos[doc.id] ? (
            <img src={viejos[doc.id]} alt={doc.tipo} className="w-full max-h-80 object-contain rounded-lg bg-crema" />
          ) : (
            <p className="text-xs">Cargando…</p>
          )}
          <button
            className="mt-2 text-xs font-bold border border-greda text-greda px-3 py-1 rounded-full"
            onClick={() => {
              if (!confirm("¿Autorizar el borrado de este archivo anterior? No se puede deshacer.")) return;
              api(`/api/admin/documentos-historico/${doc.id}/autorizar-borrado`, { method: "POST" })
                .then(() => onChange?.())
                .catch((e) => setError(e.message));
            }}
          >
            Autorizar borrado
          </button>
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
