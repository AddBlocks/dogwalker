import { clp } from "../lib/api";
import { TIPOS_CUENTA, pagoMomentoLabel } from "../lib/format";

export default function PagoPaseador({ walker }) {
  const cuando = pagoMomentoLabel(walker.pago_momento, walker.monto_anticipado_clp);
  const tieneDatos = walker.banco || walker.numero_cuenta || walker.titular;
  if (!cuando && !tieneDatos) return null;
  const tipo = TIPOS_CUENTA.find((t) => t.id === walker.tipo_cuenta)?.label;
  return (
    <section className="rounded-2xl border border-arena bg-white p-4 space-y-2">
      <h2 className="font-display text-xl text-bosque">Pago por transferencia</h2>
      {cuando && <p className="text-sm">{cuando}</p>}
      {walker.pago_momento === "mixto" && walker.monto_anticipado_clp && (
        <p className="text-sm text-tinta/70">Anticipo: {clp(walker.monto_anticipado_clp)}</p>
      )}
      {tieneDatos && (
        <dl className="text-sm grid grid-cols-[7.5rem_1fr] gap-y-1">
          {walker.banco && (
            <>
              <dt className="text-tinta/50">Banco</dt>
              <dd className="font-bold m-0">{walker.banco}</dd>
            </>
          )}
          {tipo && (
            <>
              <dt className="text-tinta/50">Cuenta</dt>
              <dd className="font-bold m-0">{tipo}</dd>
            </>
          )}
          {walker.numero_cuenta && (
            <>
              <dt className="text-tinta/50">Número</dt>
              <dd className="font-bold m-0 break-all">{walker.numero_cuenta}</dd>
            </>
          )}
          {walker.titular && (
            <>
              <dt className="text-tinta/50">Titular</dt>
              <dd className="font-bold m-0">{walker.titular}</dd>
            </>
          )}
          {walker.rut_titular && (
            <>
              <dt className="text-tinta/50">RUT</dt>
              <dd className="font-bold m-0">{walker.rut_titular}</dd>
            </>
          )}
          {walker.email_transferencia && (
            <>
              <dt className="text-tinta/50">Correo</dt>
              <dd className="font-bold m-0 break-all">{walker.email_transferencia}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
