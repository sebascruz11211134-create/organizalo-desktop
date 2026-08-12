/**
 * fetchWithTimeout — wrapper de fetch con AbortController.
 * Lanza AbortError si el servidor no responde en `ms` milisegundos.
 */
export async function fetchWithTimeout(url, options = {}, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
