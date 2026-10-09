import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "src"),
  base: "/",
  plugins: [react()],
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "..", "dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    // P1-14: the API (backend/src/serve.ts, port 8787) answers /api same-
    // origin so the app and Playwright talk to one origin (CORS stays happy).
    // With no API running these requests fail — the offline-first store just
    // keeps its outbox, which is the designed behavior.
    proxy: {
      "/api": { target: "http://127.0.0.1:8787" },
    },
  },
});
