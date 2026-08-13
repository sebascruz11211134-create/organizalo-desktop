/**
 * CurrencyContext — Tipo de cambio diario del BCCR + selector ₡ / $
 *
 * Uso en cualquier componente:
 *   const { formatear, moneda, setMoneda, tipoCambio } = useCurrency();
 *   <p>{formatear(factura.total)}</p>
 *
 * formatear(monto) devuelve automáticamente ₡ o $ según la moneda activa.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { getToken } from "../utils/auth";

const CurrencyContext = createContext(null);

const STORAGE_KEY = "organizalo_moneda";

export function CurrencyProvider({ children }) {
  const [moneda,      setMonedaState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "CRC"
  );
  const [tipoCambio,  setTipoCambio]  = useState(null); // { compra, venta, fecha }
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState(null);

  // Persistir selección de moneda
  const setMoneda = useCallback((m) => {
    setMonedaState(m);
    localStorage.setItem(STORAGE_KEY, m);
  }, []);

  // Consultar tipo de cambio al backend (que a su vez consulta el BCCR)
  const cargarTipoCambio = useCallback(async () => {
    try {
      setCargando(true);
      const token = await getToken();
      if (!token) return; // Sin sesión, no consultar

      const res = await api.get("/api/tipocambio", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.compra) {
        setTipoCambio({
          compra: res.data.compra,
          venta:  res.data.venta,
          fecha:  res.data.fecha,
        });
        setError(null);
      }
    } catch (e) {
      console.warn("[CurrencyContext] No se pudo obtener tipo de cambio:", e.message);
      setError("Sin conexión al BCCR");
    } finally {
      setCargando(false);
    }
  }, []);

  // Cargar al montar y luego cada hora
  useEffect(() => {
    cargarTipoCambio();
    const intervalo = setInterval(cargarTipoCambio, 60 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [cargarTipoCambio]);

  /**
   * Formatea un monto según la moneda activa.
   *
   * formatear(150000)        → "₡150.000" (CRC)
   * formatear(150000)        → "$281.25"  (USD, usando tipo de cambio compra)
   * formatear(150000, "USD") → siempre en dólares independiente del selector
   * formatear(150000, "CRC") → siempre en colones
   */
  const formatear = useCallback((monto, forzarMoneda) => {
    const m = forzarMoneda || moneda;
    const n = Number(monto) || 0;

    if (m === "USD") {
      const tc = tipoCambio?.compra || 530; // fallback razonable
      const usd = n / tc;
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // CRC — formato costarricense
    return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }, [moneda, tipoCambio]);

  /**
   * Convierte un monto de CRC a USD (o lo devuelve sin cambiar si ya es USD).
   */
  const aCRC = useCallback((monto) => Number(monto) || 0, []);
  const aUSD = useCallback((monto) => {
    const tc = tipoCambio?.compra || 530;
    return (Number(monto) || 0) / tc;
  }, [tipoCambio]);

  const value = {
    moneda,
    setMoneda,
    tipoCambio,    // { compra, venta, fecha } o null
    cargando,
    error,
    formatear,
    aCRC,
    aUSD,
    recargar: cargarTipoCambio,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook principal. Usar en cualquier componente:
 *   const { formatear, moneda, tipoCambio } = useCurrency();
 */
export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency debe usarse dentro de <CurrencyProvider>");
  return ctx;
}

export default CurrencyContext;
