import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg", "favicon.svg"],
      manifest: {
        name: "Patitas",
        short_name: "Patitas",
        description: "Paseos de perros de confianza en Santiago",
        lang: "es-CL",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F6F1E7",
        theme_color: "#1B4332",
        icons: [
          { src: "logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.+\.tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000,
        configure(proxy) {
          proxy.on("error", (err, _req, res) => {
            console.error("[vite proxy]", err.message);
            if (res && !res.headersSent && typeof res.writeHead === "function") {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "La API no responde. ¿Está corriendo el backend?" }));
            }
          });
        },
      },
    },
  },
});
