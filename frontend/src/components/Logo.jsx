export const HUELLAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true">
  <rect width="128" height="128" rx="28" fill="#F6F1E7"/>
  <g fill="#5C2C0E" transform="translate(6 24) rotate(-28 28 36)">
    <ellipse cx="8" cy="14" rx="8" ry="11"/>
    <ellipse cx="26" cy="6" rx="8.5" ry="11.5"/>
    <ellipse cx="46" cy="12" rx="8" ry="11"/>
    <ellipse cx="56" cy="30" rx="7" ry="9"/>
    <ellipse cx="28" cy="48" rx="22" ry="18"/>
  </g>
  <g fill="#8B4513" transform="translate(48 36) rotate(22 28 36)">
    <ellipse cx="8" cy="14" rx="8" ry="11"/>
    <ellipse cx="26" cy="6" rx="8.5" ry="11.5"/>
    <ellipse cx="46" cy="12" rx="8" ry="11"/>
    <ellipse cx="56" cy="30" rx="7" ry="9"/>
    <ellipse cx="28" cy="48" rx="22" ry="18"/>
  </g>
</svg>`;

export function pinHuellasHtml(destacado = false) {
  return `<div class="pin-paseador ${destacado ? "destacado" : ""}">${HUELLAS_SVG}</div>`;
}

export default function Logo({ className = "w-8 h-8" }) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-lg [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: HUELLAS_SVG }}
    />
  );
}
