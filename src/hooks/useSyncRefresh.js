/**
 * useSyncRefresh — Recarga automática al recibir sync en tiempo real.
 *
 * Uso en cualquier pantalla:
 *   useSyncRefresh(cargar);
 *
 * Esto hace que la pantalla recargue sus datos cada vez que otro
 * dispositivo o pestaña guarde algo y el servidor notifique via WebSocket.
 */
import { useEffect } from "react";

export function useSyncRefresh(cargar) {
  useEffect(() => {
    const handler = () => {
      try { cargar(); } catch {}
    };
    window.addEventListener("organizalo:sync", handler);
    return () => window.removeEventListener("organizalo:sync", handler);
  }, [cargar]);
}
