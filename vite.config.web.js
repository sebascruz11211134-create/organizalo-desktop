import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config para build web/PWA — distinto al build de Electron
// Diferencias clave:
//   base: "/" en vez de "./" (rutas absolutas para el servidor)
//   outDir: "dist-web" para no pisar el build de Electron
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  define: {
    // Evita errores de process.env en el browser
    "process.env": {},
  },
});
