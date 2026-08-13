import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",       // Web: rutas absolutas (no "./")
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: false,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: false,
        secure: false,
        ws: true,
      },
    },
  },
});
