/**
 * BACKEND URL centralizada.
 * Dev (localhost:5173): "" → URLs relativas → Vite proxy las envía a https://31.97.141.124
 *   El proxy corre en Node.js, ignora el cert inválido, evita CORS por ser mismo origen.
 * Producción (file://): https directo → Electron acepta cert con ignore-certificate-errors.
 */
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1");

export const BACKEND = isLocalhost ? "" : "https://31.97.141.124";
