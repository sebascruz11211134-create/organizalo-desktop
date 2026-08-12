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
        target: "http://31.97.141.124",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://31.97.141.124",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
