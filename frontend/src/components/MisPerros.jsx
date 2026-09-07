import { useState } from "react";
import { useAuth } from "../lib/auth";
import { PERRO_VACIO } from "../lib/avatares";
import { borrarPerro, guardarPerro } from "../lib/perros";
import DatosPerro from "./DatosPerro";
import FotoPerro from "./FotoPerro";

export default function MisPerros() {
  const { perros, refresh } = useAuth();
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(PERRO_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrirNuevo() {
    setError("");
    setForm({ ...PERRO_VACIO });
    setEditando("nuevo");
  }

  function abrirEditar(p) {
    setError("");
    setForm({
      ...PERRO_VACIO,
      ...p,
      agresivo: p.agresivo ? true : p.es_mezcla ? false : undefined,
      foto: null,
      fotoPreview: null,
      quitar_foto: false,
    });
    setEditando(p.id);
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await guardarPerro(form, editando === "nuevo" ? undefined : editando);
      await refresh();
      setEditando(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p) {
    const quien = p.nombre || p.raza || "este perro";
    if (!confirm(`¿Eliminar a ${quien} de tu lista?`)) return;
    setError("");
    try {
      await borrarPerro(p.id);
      await refresh();
      if (editando === p.id) setEditando(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Tus perros</p>
        {editando !== "nuevo" && (
          <button type="button" className="text-sm font-bold text-greda" onClick={abrirNuevo}>
            Agregar perro
          </button>
        )}
      </div>
      {perros.length === 0 && editando !== "nuevo" && (
        <p className="text-sm text-tinta/60">Podés agregar varios. El nombre y la foto son opcionales.</p>
      )}
      {perros.map((p) => (
        <div key={p.id} className="rounded-2xl border border-arena bg-white p-3 space-y-2">
          {editando === p.id ? (
            <form onSubmit={guardar} className="space-y-2">
              <DatosPerro value={form} onChange={setForm} titulo="Editar perro" />
              {error && <p className="text-sm text-greda">{error}</p>}
              <div className="flex gap-2">
                <button className="flex-1 bg-bosque text-crema rounded-xl py-2 font-bold" disabled={guardando}>
                  Guardar
                </button>
                <button type="button" className="flex-1 border border-arena rounded-xl py-2 font-bold" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <FotoPerro perro={p} className="w-14 h-14" />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{p.nombre || "Sin nombre"}</p>
                <p className="text-xs text-tinta/60">
                  {p.raza}
                  {p.es_mezcla ? " · mezcla" : ""}
                  {p.agresivo ? " · peligroso/agresivo" : ""}
                </p>
              </div>
              <button type="button" className="text-xs font-bold text-bosque" onClick={() => abrirEditar(p)}>
                Editar
              </button>
              <button type="button" className="text-xs font-bold text-greda" onClick={() => eliminar(p)}>
                Eliminar
              </button>
            </div>
          )}
        </div>
      ))}
      {editando === "nuevo" && (
        <form onSubmit={guardar} className="rounded-2xl border border-arena bg-white p-3 space-y-2">
          <DatosPerro value={form} onChange={setForm} titulo="Nuevo perro" />
          {error && <p className="text-sm text-greda">{error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 bg-bosque text-crema rounded-xl py-2 font-bold" disabled={guardando}>
              Guardar perro
            </button>
            <button type="button" className="flex-1 border border-arena rounded-xl py-2 font-bold" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
