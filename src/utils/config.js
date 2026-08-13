/**
 * BACKEND URL centralizada.
 * Dev (localhost:5173): "" → URLs relativas → Vite proxy las envía a Railway.
 * Producción (file://): URL directa a Railway (HTTPS válido, sin problemas de nginx/firewall).
 */
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1");

export const BACKEND = isLocalhost
  ? ""
  : "https://organizalo-backend-production.up.railway.app";
