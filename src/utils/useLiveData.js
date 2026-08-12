/**
 * useLiveData — Hook React que recarga datos cuando llega un evento de sync.
 *
 * Uso:
 *   const { data: facturas, reload } = useLiveData(
 *     () => db.getFacturas(),   // función async que carga los datos
 *   );
 *
 * Cuando el celular guarda un cambio vía WebSocket, este hook lo detecta
 * y vuelve a llamar la función de carga sin que la pantalla haga nada extra.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { onSyncUpdate } from "./sync";

export function useLiveData(loaderFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const mountedRef            = useRef(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loaderFn();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Carga inicial
  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // Recarga automática al recibir datos nuevos vía WebSocket
  useEffect(() => {
    const unsubscribe = onSyncUpdate(() => {
      if (mountedRef.current) load();
    });
    return unsubscribe;
  }, [load]);

  return { data, loading, error, reload: load };
}
