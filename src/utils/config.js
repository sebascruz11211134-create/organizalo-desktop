/**
 * BACKEND URL centralizada.
 * - Dev mode (localhost): "" → URLs relativas, Vite hace proxy server-side → sin CORS.
 * - Producción (file:// o cualquier otro origen): URL absoluta directa al VPS.
 */
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1");

export const BACKEND = isLocalhost ? "" : "https://31.97.141.124";
