import { Link } from "react-router-dom";

export default function Privacidad() {
  return (
    <article className="max-w-xl mx-auto px-5 py-8 prose prose-sm">
      <h1 className="font-display text-3xl text-bosque">Política de privacidad</h1>
      <p className="text-sm text-tinta/70">PaseoPatitas · Santiago de Chile · Ley 21.719</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>
          Recogemos tu nombre, correo, celular y, si eres paseador, imágenes de cédula y selfie solo para verificar
          identidad. El consentimiento es explícito al registrarte.
        </p>
        <p>
          Las fotos de cédula se cifran en reposo (AES-256-GCM) y se eliminan 30 días después de la aprobación. No
          vendemos tus datos. Los teléfonos se muestran solo cuando ambas partes aceptan un paseo.
        </p>
        <p>
          Puedes pedir la eliminación de tu cuenta y datos desde Perfil. Conservamos registros de paseos de forma
          anonimizada si hay una obligación legal o contable.
        </p>
        <p>Responsable: el operador de PaseoPatitas. Contacto: privacidad@paseopatitas.cl</p>
      </div>
      <Link to="/registro" className="inline-block mt-6 font-bold text-greda">
        Volver al registro
      </Link>
    </article>
  );
}
