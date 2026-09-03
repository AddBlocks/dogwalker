export default function Stars({ value = 0, size = "text-sm" }) {
  const n = Math.round(Number(value) || 0);
  return (
    <span className={`${size} tracking-tight text-oro`} aria-label={`${value} de 5`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-arena">{"★".repeat(Math.max(0, 5 - n))}</span>
      <span className="ml-1 text-xs text-bosque-claro">{Number(value || 0).toFixed(1)}</span>
    </span>
  );
}
