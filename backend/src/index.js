import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./db.js";
import { purgeExpiredIdDocuments } from "./services/retention.js";
import { authRouter } from "./routes/auth.js";
import { comunasRouter } from "./routes/comunas.js";
import { walkersRouter } from "./routes/walkers.js";
import { solicitudesRouter } from "./routes/solicitudes.js";
import { paseosRouter } from "./routes/paseos.js";
import { resenasRouter } from "./routes/resenas.js";
import { comerciosRouter } from "./routes/comercios.js";
import { anunciosRouter } from "./routes/anuncios.js";
import { adminRouter } from "./routes/admin.js";
import { usersRouter } from "./routes/users.js";

migrate();
purgeExpiredIdDocuments();
setInterval(purgeExpiredIdDocuments, 60 * 60 * 1000);

const app = express();
const origin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/salud", (_req, res) => {
  res.json({ ok: true, nombre: "Patitas", version: "1.0.0" });
});

app.use("/api/auth", authRouter);
app.use("/api/comunas", comunasRouter);
app.use("/api/paseadores", walkersRouter);
app.use("/api/solicitudes", solicitudesRouter);
app.use("/api/paseos", paseosRouter);
app.use("/api/resenas", resenasRouter);
app.use("/api/comercios", comerciosRouter);
app.use("/api/anuncios", anunciosRouter);
app.use("/api/admin", adminRouter);
app.use("/api/usuarios", usersRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontDist));
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontDist, "index.html"), (err) => (err ? next() : undefined));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Patitas API en http://localhost:${port}`);
});
