# Publicar Patitas en Google Play (1 página)

La app es una **PWA**. En Play entra como **Trusted Web Activity (Bubblewrap)** o como **Capacitor**. Ambas opciones reutilizan el mismo frontend.

## Antes de empaquetar

1. Publica el frontend en HTTPS (Vercel) con manifiesto PWA y service worker (`vite-plugin-pwa`).
2. Verifica Lighthouse PWA ≥ 80 y que `/manifest.webmanifest` tenga `name`, `start_url`, `display: standalone`, icono 512×512 PNG.
3. Genera iconos PNG desde `frontend/public/logo.svg` (192 y 512). Play no acepta solo SVG.
4. Dominio propio (ej. `app.patitas.cl`) y `assetlinks.json` en `https://DOMINIO/.well-known/assetlinks.json`.

## Opción A — Trusted Web Activity (recomendada, más liviana)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://DOMINIO/manifest.webmanifest
bubblewrap build
```

- Firma con un keystore propio (`patitas.keystore`). Guarda la contraseña fuera del repo.
- Sube el `.aab` a Play Console → aplicación nueva → ficha en español (Chile).
- Clasificación: herramientas de estilo de vida. Sin pagos in-app en el MVP.
- Política de privacidad: URL pública `/privacidad`.
- En `.well-known/assetlinks.json` publica el SHA-256 de la firma (Play App Signing te lo da).

## Opción B — Capacitor

```bash
cd frontend
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init Patitas cl.paseopatitas.app --web-dir dist
npm run build
npx cap add android
npx cap sync
npx cap open android
```

En Android Studio: genera AAB firmado (Build → Generate Signed Bundle). El `capacitor.config.ts` del repo ya apunta a `cl.paseopatitas.app` (id técnico de la app) y el nombre visible es **Patitas**.

## Ficha de Play (texto listo)

- **Nombre:** Patitas
- **Descripción corta:** Paseos de perros de confianza en Santiago.
- **Descripción:** Encuentra paseadores verificados por comuna, acuerda el paseo y califica. Directorio de veterinarias y tiendas. Sin pagos dentro de la app.
- **Categoría:** Estilo de vida
- **Contacto:** hola@patitas.cl
- **Privacidad:** https://DOMINIO/privacidad

## Checklist

- [ ] Iconos 512 y feature graphic 1024×500
- [ ] Capturas móvil del mapa, perfil y solicitudes
- [ ] Cuenta de desarrollador Google (USD 25, pago único)
- [ ] targetSdk actual (Android 14+)
- [ ] Texto de permisos: ubicación solo para detectar comuna; cámara solo en verificación
- [ ] No pidas SMS ni contactos
