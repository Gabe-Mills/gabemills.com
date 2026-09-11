import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // three removed 11 Sep 2026 — nothing imports it since the WebGL core
          // was replaced by ConstellationField, and keeping the entry emitted an
          // empty 0-byte chunk. The package is still in package.json; uninstall
          // it whenever you're sure you don't want the old CoreScene back.
          motion: ["framer-motion", "gsap"],
        },
      },
    },
  },
});
