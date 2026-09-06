import { Link } from "react-router-dom";

export default function Privacidad() {
  return (
    <article className="max-w-xl mx-auto px-5 py-8 prose prose-sm">
      <h1 className="font-display text-3xl text-bosque">Política de privacidad</h1>
      <p className="text-sm text-tinta/70">Patitas · Santiago de Chile · Ley 21.719</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>
          Recogemos tu nombre, correo, celular y, si eres paseador, imágenes de cédula y selfie solo para verificar
          identidad. El consentimiento es explícito al registrarte.
        </p>
        <p>
          Las fotos de cédula se cifran en reposo (AES-256-GCM). Podés reemplazarlas, pero no borrarlas: la versión
          anterior se elimina solo si el administrador lo autoriza. No vendemos tus datos. Los teléfonos se muestran
          solo cuando ambas partes aceptan un paseo.
        </p>
        <p>
          Puedes pedir la eliminación de tu cuenta y datos desde Perfil. Conservamos registros de paseos de forma
          anonimizada si hay una obligación legal o contable.
        </p>
        <p>Responsable: el operador de Patitas. Contacto: privacidad@patitas.cl</p>
      </div>
      <Link to="/registro" className="inline-block mt-6 font-bold text-greda">
        Volver al registro
      </Link>
    </article>
  );
}
