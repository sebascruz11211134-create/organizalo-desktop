import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://31.97.141.124",
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        headers: {
          // nginx en 443 tiene server_name api.organizalo.ai — sin este header devuelve 404
          host: "api.organizalo.ai",
        },
      },
      "/socket.io": {
        target: "https://31.97.141.124",
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        ws: true,
        headers: { host: "api.organizalo.ai" },
      },
    },
  },
});
