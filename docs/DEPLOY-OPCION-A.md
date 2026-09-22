# Opción A — Patitas en un solo servidor (Railway)

Checklist para publicar la app completa (web + API + SQLite) en **un solo origen HTTPS**. Tachá cada casilla cuando esté hecha. No uses `seed:demo` en producción.

Plataforma de esta guía: [Railway](https://railway.app). Render o un VPS sirven igual; el orden de los pasos no cambia.

---

## 0. Código listo (en el repo)

- [x] Express sirve `frontend/dist` y `/api` en el mismo puerto
- [x] Disco configurable con `DATA_DIR` (SQLite + uploads)
- [x] `Dockerfile` + Node 22 (`railway.json`, `.nvmrc`)
- [ ] Cambios pusheados a GitHub (`main`)

```bash
git add package.json railway.json nixpacks.toml .nvmrc backend/src/paths.js backend/src/db.js backend/src/routes/walkers.js backend/src/routes/perros.js backend/src/limpiar.js backend/.env.example docs/DEPLOY-OPCION-A.md
git commit -m "Prepare single-server deploy with persistent data dir."
git push origin main
```

---

## 1. Secretos (en tu PC, no los subas)

- [X] `JWT_SECRET` generado (texto largo aleatorio)
- [X] `FILE_KEY` de 64 caracteres hex (32 bytes), **distinto** al de local

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

El primero → `JWT_SECRET`. El segundo → `FILE_KEY`. Guardalos en un gestor de claves. Si cambiás `FILE_KEY` después, las cédulas ya cifradas no se pueden leer.

---

## 2. Correo SMTP (obligatorio en la nube)

Outlook de Windows no existe en Railway.

- [ ] Cuenta Gmail (o SMTP de tu dominio)
- [ ] Verificación en 2 pasos de Google activa
- [ ] Contraseña de aplicación: [Google Account → Seguridad → Contraseñas de aplicaciones](https://myaccount.google.com/apppasswords)
- [ ] Anotaste: usuario, contraseña de 16 caracteres, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`

`SMTP_FROM` puede ser `Patitas <tu@gmail.com>`.

---

## 3. Cuenta Railway

- [ ] Cuenta en https://railway.app (GitHub login)
- [ ] Tarjeta o trial (el plan hobby alcanza para el MVP)
- [ ] New Project → **Deploy from GitHub repo** → `AddBlocks/dogwalker` (o el fork que uses)
- [ ] Root Directory: vacío (repo raíz)
- [ ] Esperá el primer deploy (puede fallar hasta poner env y volumen; está bien)

---

## 4. Volumen persistente (si no, cada deploy borra usuarios)

- [ ] En el servicio: **Settings → Volumes → Add volume**
- [ ] Mount path: `/data`
- [ ] Variable `DATA_DIR` = `/data`

Sin esto la base y las fotos de cédula/perros se pierden al redesplegar.

---

## 5. Variables de entorno

En el servicio → **Variables**. Pegá (valores reales, no los de `.env.example`).

**No agregues** `NODE_ENV`, `NIXPACKS_NODE_VERSION` ni `RAILPACK_NODE_VERSION`. El build es un Dockerfile (Node 22); esas variables no hacen falta.

- [ ] `JWT_SECRET` = (paso 1)
- [ ] `FILE_KEY` = (paso 1)
- [ ] `DATA_DIR` = `/data`
- [ ] `VERIFY_PROVIDER` = `mock`
- [ ] `ADMIN_NOTIFY_EMAIL` = tu correo
- [ ] `SMTP_HOST` = `smtp.gmail.com`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_SECURE` = `false`
- [ ] `SMTP_USER` = tu Gmail
- [ ] `SMTP_PASS` = contraseña de aplicación (sin espacios)
- [ ] `SMTP_FROM` = `Patitas <tu@gmail.com>`

Después del primer dominio público:

- [ ] `FRONTEND_URL` = `https://TU-SERVICIO.up.railway.app` (sin barra final)
- [ ] `API_PUBLIC_URL` = el mismo URL

Google (opcional, más adelante):

- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_REDIRECT_URI` = `https://TU-DOMINIO/api/auth/google/callback`

No copies `TWILIO_*` del example a producción si no los usás (SMS está apagado).

---

## 6. Build y arranque

El repo usa **Dockerfile** (no Railpack). Así el build no pide secretos.

- Build: instala front + back y genera `frontend/dist`
- Start: `npm start --prefix backend`
- Healthcheck: `GET /api/salud`

- [ ] Settings → Build → Builder = **Dockerfile** (si el panel sigue en Railpack, cambialo)
- [ ] **Deploy** / Redeploy
- [ ] Deploy **Success**
- [ ] Settings → Networking → **Generate domain** (queda `algo.up.railway.app`)
- [ ] Abrís `https://TU-SERVICIO.up.railway.app/api/salud` y ves `{"ok":true,...}`

Si el healthcheck falla: logs. Causa típica: Node &lt; 22 o faltó el build del frontend (`Cannot GET /`).

---

## 7. Semilla de producción (una vez)

En Railway → servicio → **+** → **One-off command** / Shell:

```bash
npm run seed --prefix backend
```

- [ ] Corrió sin error
- [ ] **No** ejecutaste `seed:demo`
- [ ] Entrás a `https://TU-SERVICIO.up.railway.app/login`
- [ ] Admin: el correo/clave que dejó el seed (cámbiala en cuanto entres)

Si el login no anda: `FRONTEND_URL` tiene que ser exactamente la URL HTTPS que ves en el navegador.

---

## 8. Prueba de humo (como usuario real)

- [ ] Login admin OK
- [ ] Registro de un dueño OK (entra al toque)
- [ ] Mapa carga (OSM)
- [ ] “Olvidé mi clave” llega el mail (revisá spam)
- [ ] Registro de un paseador de prueba: el admin recibe mail con link de documentos
- [ ] Subís una foto de perro en Perfil
- [ ] Tras un **Redeploy**, el dueño y la foto **siguen ahí** (volumen OK)

---

## 9. Dominio propio (cuando el MVP ya anda)

- [ ] Compraste `patitas.cl` (o el que uses)
- [ ] Railway → Settings → Networking → Custom domain
- [ ] DNS: CNAME `app` → el dominio Railway (te lo indica la consola)
- [ ] HTTPS verde
- [ ] Actualizaste `FRONTEND_URL` y `API_PUBLIC_URL` al dominio propio
- [ ] Redeploy
- [ ] Login y `/api/salud` en el dominio nuevo

---

## 10. Seguridad mínima antes de invitar gente

- [ ] Cambiaste la clave del admin
- [ ] No hay cuentas `*@patitas.cl` de demo
- [ ] `.env` no está en GitHub
- [ ] Política `/privacidad` se abre
- [ ] Cerraste túneles `trycloudflare` viejos

---

## 11. Listo para mercado (web)

- [ ] Les pasás `https://app.patitas.cl` (o el `.up.railway.app`)
- [ ] Play Store es **después**: `docs/MANUAL-GOOGLE-PLAY.md` (PWA en HTTPS ya es el requisito)

---

## Si algo se rompe

| Síntoma | Qué mirar |
| --- | --- |
| Deploy rojo, `secret … not found` | El servicio sigue en Railpack. Settings → Build → Builder = **Dockerfile** y redesplegá el commit con `Dockerfile`. |
| Deploy rojo, `vite: not found` | El build omitió `devDependencies`. Ya está corregido en `package.json`; redesplegá ese commit. |
| Página en blanco / 404 | No se buildeó `frontend/dist` |
| Login 403 CORS | `FRONTEND_URL` no coincide con la URL del navegador |
| Usuarios desaparecen al deploy | Falta volumen `/data` o `DATA_DIR` |
| Mails no llegan | SMTP; en Railway no hay Outlook |
| Cédulas no se ven | Cambiaste `FILE_KEY` |
| Healthcheck timeout | Puerto: Railway inyecta `PORT`; Express ya lo usa |
