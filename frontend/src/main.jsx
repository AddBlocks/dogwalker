import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";

const LOGO_GEN = "zona-poligono-v2";
if (typeof window !== "undefined" && localStorage.getItem("pp_logo_gen") !== LOGO_GEN) {
  localStorage.setItem("pp_logo_gen", LOGO_GEN);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (regs.length) window.location.reload();
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
