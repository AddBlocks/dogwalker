import { useEffect } from "react";
import { api } from "../lib/api";

export default function AdSlot({ ad, compact = false }) {
  useEffect(() => {
    if (!ad) return;
    api(`/api/anuncios/${ad.id}/impresion`, { method: "POST" }).catch(() => {});
  }, [ad]);

  if (!ad) return null;

  async function onClick() {
    try {
      await api(`/api/anuncios/${ad.id}/clic`, { method: "POST" });
    } catch {
      /* métrica no bloquea */
    }
    if (ad.enlace) window.open(ad.enlace, "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-oro/40 bg-gradient-to-r from-oro/20 to-crema ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-greda font-bold">Publicidad</p>
      <p className="font-display text-lg text-bosque leading-tight">{ad.titulo}</p>
      {ad.texto && <p className="text-sm text-tinta/70 mt-1">{ad.texto}</p>}
    </button>
  );
}
