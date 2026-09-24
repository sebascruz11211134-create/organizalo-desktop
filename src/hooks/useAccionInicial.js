import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Ejecuta una acción al abrir la pantalla desde un atajo, por ejemplo
 * "#/contactos?accion=nuevo" o "#/inventario?buscar=7441001". Luego limpia
 * la dirección para que recargar la página no repita la acción.
 *   useAccionInicial({ accion: v => v === "nuevo" && abrirModal(), buscar: setBusq })
 */
export function useAccionInicial(acciones) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    let usada = false;
    for (const [clave, fn] of Object.entries(acciones)) {
      const valor = params.get(clave);
      if (valor != null) { fn(valor); usada = true; }
    }
    if (usada) navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
}
