/**
 * Navegación del celular: barra inferior con 3 favoritos que elige cada
 * usuario, botón "+" de acciones rápidas en el centro y "Más" con todas
 * las herramientas del ERP (pantalla /mas).
 */
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus, LayoutGrid, Receipt, Layers, HandCoins, ShoppingCart, UserPlus,
  PackagePlus, ScanBarcode, X,
} from "lucide-react";
import { herramientas } from "../navegacion";
import { useIdioma } from "../utils/idioma";
import EscanerCodigo from "./EscanerCodigo";

// ── Favoritos de la barra (preferencia de cada usuario en este dispositivo) ──
const CLAVE_FAVORITOS = "monki_barra_favoritos";
export const MAX_FAVORITOS = 3;
const FAVORITOS_INICIALES = ["/", "/facturacion", "/cxc"];

export function leerFavoritos() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_FAVORITOS));
    if (Array.isArray(v) && v.length) return v.slice(0, MAX_FAVORITOS);
  } catch { /* sin almacenamiento: se usan los de fábrica */ }
  return FAVORITOS_INICIALES;
}

export function guardarFavoritos(lista) {
  try { localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(lista.slice(0, MAX_FAVORITOS))); } catch { /* ignorar */ }
  window.dispatchEvent(new Event("monki:favoritos"));
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState(leerFavoritos);
  useEffect(() => {
    const actualizar = () => setFavoritos(leerFavoritos());
    window.addEventListener("monki:favoritos", actualizar);
    return () => window.removeEventListener("monki:favoritos", actualizar);
  }, []);
  return favoritos;
}

// Nombres cortos para que quepan en la barra
const CORTOS = {
  "/": "Inicio", "/facturacion": "Facturar", "/cxc": "Cobrar", "/cxp": "Pagar",
  "/facturas-historial": "Facturas", "/pos": "Caja POS", "/compras": "Compras",
  "/contactos": "Clientes", "/crm-clientes": "CRM", "/catalogo-cuentas": "Cuentas",
  "/control-bancario": "Bancos", "/reporte-cxc": "Rep. CXC", "/d104": "D-104",
};
export const nombreCorto = h => CORTOS[h.path] || h.label.split(/[\s(—/]/)[0];

// ── Acciones rápidas del botón "+" ───────────────────────────────────────────
const ACCIONES = [
  { label: "Nueva factura",    detalle: "Electrónica o tiquete",       icon: Receipt,      ir: "/facturacion" },
  { label: "Venta rápida",     detalle: "Punto de venta",              icon: Layers,       ir: "/pos" },
  { label: "Registrar cobro",  detalle: "Recibo de un cliente",        icon: HandCoins,    ir: "/recibos?accion=nuevo" },
  { label: "Registrar gasto",  detalle: "Factura de proveedor con foto", icon: ShoppingCart, ir: "/compras?accion=nuevo" },
  { label: "Nuevo cliente",    detalle: "Contacto con cédula y teléfono", icon: UserPlus,  ir: "/contactos?accion=nuevo" },
  { label: "Nuevo producto",   detalle: "Al inventario",               icon: PackagePlus,  ir: "/inventario?accion=nuevo" },
  { label: "Escanear producto", detalle: "Buscar por código de barras", icon: ScanBarcode, escanear: true },
];

function AccionesRapidas({ onCerrar }) {
  const { tr } = useIdioma();
  const navigate = useNavigate();
  const [escaneando, setEscaneando] = useState(false);

  if (escaneando) {
    return <EscanerCodigo titulo="Escanear producto" onCerrar={onCerrar}
      onDetectado={codigo => { onCerrar(); navigate(`/inventario?buscar=${encodeURIComponent(codigo)}`); }} />;
  }
  return (
    <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label={tr("Cerrar")} className="absolute inset-0 bg-monki-k/50 backdrop-blur-sm animate-entrar" onClick={onCerrar} />
      <div className="relative animate-desplegar bg-monki-cream rounded-t-[26px] border-t-2 border-monki-k px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>
        <div className="w-10 h-1.5 rounded-full bg-black/15 mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[20px] font-black tracking-[-0.03em] text-monki-k">{tr("¿Qué querés hacer?")}</h2>
          <button onClick={onCerrar} className="w-9 h-9 rounded-full bg-white border-2 border-black/10 flex items-center justify-center" aria-label={tr("Cerrar")}><X size={16} /></button>
        </div>
        <div className="ui-rejilla grid grid-cols-2 gap-2">
          {ACCIONES.map((a, i) => (
            <button key={a.label} style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => a.escanear ? setEscaneando(true) : (onCerrar(), navigate(a.ir))}
              className={`animate-entrar text-left bg-white rounded-2xl border-2 border-black/10 active:border-monki-k active:bg-monki-y p-3 flex gap-2.5 items-start ${i === ACCIONES.length - 1 ? "col-span-2" : ""}`}>
              <span className="w-9 h-9 shrink-0 rounded-full bg-monki-y flex items-center justify-center"><a.icon size={17} className="text-monki-k" /></span>
              <span className="min-w-0">
                <b className="block text-[13px] leading-tight text-monki-k">{tr(a.label)}</b>
                <span className="block text-[11px] leading-tight text-monki-k/55 mt-0.5">{tr(a.detalle)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Barra inferior ───────────────────────────────────────────────────────────
export default function BarraInferior({ modulos }) {
  const { tr } = useIdioma();
  const navigate = useNavigate();
  const location = useLocation();
  const favoritos = useFavoritos();
  const [acciones, setAcciones] = useState(false);

  useEffect(() => { setAcciones(false); }, [location.pathname]);

  const disponibles = herramientas(modulos);
  const fav = favoritos.map(p => disponibles.find(h => h.path === p)).filter(Boolean);
  const activo = path => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const Pestana = ({ path, icon: Icono, label }) => (
    <button onClick={() => navigate(path)}
      className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 gap-0.5 text-[10px] font-bold transition-colors duration-200 ${activo(path) ? "text-monki-y" : "text-white/55"}`}>
      <span className={`w-11 h-7 rounded-full flex items-center justify-center transition-all duration-300 ease-monki ${activo(path) ? "bg-monki-y text-monki-k" : ""}`}>
        <Icono size={19} />
      </span>
      <span className="max-w-full truncate px-0.5">{tr(label)}</span>
    </button>
  );

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-monki-k flex items-end px-1 pt-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4px)" }}>
        {fav.slice(0, 2).map(h => <Pestana key={h.path} path={h.path} icon={h.icon} label={nombreCorto(h)} />)}
        <div className="flex-1 flex justify-center">
          <button onClick={() => setAcciones(a => !a)} aria-label={tr("Acciones rápidas")}
            className={`-mt-5 mb-1 w-14 h-14 rounded-full bg-monki-y text-monki-k border-[3px] border-monki-k shadow-[0_4px_0_#000] flex items-center justify-center transition-transform duration-300 ease-monki active:scale-95 ${acciones ? "rotate-45" : ""}`}>
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>
        {fav.slice(2, 3).map(h => <Pestana key={h.path} path={h.path} icon={h.icon} label={nombreCorto(h)} />)}
        <Pestana path="/mas" icon={LayoutGrid} label="Más" />
      </nav>
      {acciones && <AccionesRapidas onCerrar={() => setAcciones(false)} />}
    </>
  );
}
