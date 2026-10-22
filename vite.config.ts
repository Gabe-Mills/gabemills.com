import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // the inbox Worker (inbox/) in dev: `npx wrangler dev --config inbox/wrangler.jsonc --env dev --port 8803`
    proxy: { "/api/inbox": "http://127.0.0.1:8803" },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // three came back on 20 Oct 2026 for the home wall (WallHero); it ships
          // in the main chunk because the wall is the first thing on the page.
          motion: ["framer-motion", "gsap"],
        },
      },
    },
  },
});
