import { urlAvatar, urlFotoPerro } from "../lib/avatares";

export default function FotoPerro({ perro, className = "w-14 h-14", alt }) {
  return (
    <img
      src={urlFotoPerro(perro)}
      alt={alt || perro?.nombre || perro?.raza || "Perro"}
      className={`rounded-full object-cover bg-arena shrink-0 ${className}`}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = urlAvatar(perro?.raza, perro?.avatar);
      }}
    />
  );
}
