/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// npm run dev startet zuerst den API-Server und übergibt dessen Port (server/dev.ts).
const apiPort = process.env.HAUSPLANER_API_PORT;

export default defineConfig({
  plugins: [react()],
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
