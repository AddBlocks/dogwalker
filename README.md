# Patitas

PWA en español chileno para conectar **paseadores** y **dueños de perros** en Santiago. Solo paseos. Sin hospedaje, sin pagos en la app y sin chat externo.

Mapa con Leaflet + OpenStreetMap, 32 comunas de la Provincia de Santiago, verificación de paseadores, solicitudes, reseñas, directorio local, publicidad por comuna y panel de administrador.

## Requisitos

- Node.js 22 o superior (recomendado 24; usa `node:sqlite` del runtime)
- Un solo desarrollador puede correr todo en local. Costo inicial estimado: **USD 0** en local; en la nube, **menos de USD 30/mes** (Vercel Hobby + Railway trial o VPS pequeño).

## Instalación local

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173

### Cuenta inicial

Después de `npm run seed` o `npm run reset` solo queda el administrador. Dueños y paseadores se registran en la app con datos reales.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | christian.aird@gmail.com | PPkrs130! |

Para volver a cargar cuentas ficticias de desarrollo: `npm run seed:demo`.

## Qué incluye cada fase

1. **Registro y mapa.** Correo, consentimiento Ley 21.719, Google opcional, verificación de cédula + selfie (adaptador `mock` / Truora / TOC), mapa de comunas, filtros, pins y destacados.
2. **Solicitudes y reseñas.** Dueño publica o envía solicitud. Paseador acepta o rechaza. Al aceptar se ven los teléfonos. Paseo concretado + encuesta 5 preguntas (dueño) y 1 pregunta (paseador).
3. **Directorio.** Veterinarias, peluquerías, tiendas y adiestradores. Sugerencias de usuarios, aprobación admin, destacados pagados, reseñas.
4. **Publicidad y panel.** Banner en mapa, tarjeta entre resultados, superior del directorio. Segmento, comuna, fechas, impresiones y clics.

## Variables de entorno (backend)

Ver `backend/.env.example`.

- `VERIFY_PROVIDER=mock|truora|toc` — adaptador de verificación.
- `FILE_KEY` — 32 bytes en hex para cifrar cédulas (AES-256-GCM).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — opcional. Si faltan, solo hay registro por correo.

Las imágenes de cédula se guardan cifradas en `backend/uploads/ids/` y se borran **30 días después de la aprobación**.

## Despliegue (menos de USD 30)

1. **Frontend:** Vercel. Build: `cd frontend && npm run build`. Output: `frontend/dist`. Proxy `/api` al backend o configura `VITE` no es necesario: el API se sirve desde el mismo origen si usas el Express para estáticos.
2. **Backend:** Railway, Render o un VPS. `npm start` en `backend`. Define `FRONTEND_URL`, `JWT_SECRET` y `FILE_KEY`.
3. **Base de datos:** SQLite viaja con el servicio (ok para MVP). Para crecer, migra a Postgres/Supabase con `docs/ESQUEMA.md` (incluye notas PostGIS).
4. Tras el build del frontend, Express también sirve `frontend/dist` en el mismo puerto.

```bash
cd frontend && npm run build
cd ../backend && npm start
```

## Android / Google Play

Ver [docs/MANUAL-GOOGLE-PLAY.md](docs/MANUAL-GOOGLE-PLAY.md) (Trusted Web Activity o Capacitor).

## Cumplimiento Ley 21.719

- Consentimiento explícito en el registro.
- Política de privacidad en `/privacidad`.
- Eliminación de cuenta y datos desde Perfil.
- Cifrado de cédulas y retención de 30 días post-aprobación.

## Stack

React 18 + Vite + Tailwind + Leaflet · Express + SQLite (`node:sqlite`) · PWA (vite-plugin-pwa).
