import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.paseopatitas.app",
  appName: "Patitas",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
