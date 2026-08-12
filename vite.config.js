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
        secure: false,          // acepta cert autofirmado — corre en Node.js, no en browser
        followRedirects: true,  // sigue 301/302 server-side → el browser nunca ve ni cachea el redirect
      },
      "/socket.io": {
        target: "https://31.97.141.124",
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        ws: true,
      },
    },
  },
});
