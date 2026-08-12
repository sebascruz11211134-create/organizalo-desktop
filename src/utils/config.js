/**
 * BACKEND URL centralizada.
 * - Dev mode (Vite): "" → URLs relativas, Vite hace proxy server-side → sin CORS.
 * - Producción (Electron empaquetado): URL absoluta directa al VPS.
 */
export const BACKEND = import.meta.env.DEV ? "" : "http://31.97.141.124";
