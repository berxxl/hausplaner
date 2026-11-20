/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// npm run dev startet zuerst den API-Server und übergibt dessen Port (server/dev.ts).
const apiPort = process.env.HAUSPLANER_API_PORT;

export default defineConfig({
  plugins: [react()],
  // lokale App: three.js (≈ 1 MB) wird erst beim Öffnen der 3D-Ansicht nachgeladen
  build: { chunkSizeWarningLimit: 1500 },
  // vorab bündeln: sonst entdeckt der Dev-Server sie erst beim Öffnen der 3D-Ansicht bzw. eines Plans
  // und lädt die Seite neu
  optimizeDeps: {
    include: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "pdfjs-dist/legacy/build/pdf.mjs",
    ],
  },
  server: {
    host: "127.0.0.1",
    proxy: apiPort
      ? { "/api": { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } }
      : undefined,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});
