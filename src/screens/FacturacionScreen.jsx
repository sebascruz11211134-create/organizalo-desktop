import { getAutorSync, getCurrentUserSync } from "../utils/auth";
/**
 * FacturacionScreen — Factura electrónica Hacienda v4.4 (desktop)
 *
 * Flujo:
 *  1. Llenar encabezado (cliente, moneda, tipo, condición de pago)
 *  2. Agregar líneas (producto, cantidad, precio, descuento, IVA)
 *  3. Calcular totales automáticamente
 *  4. Guardar localmente + enviar a Hacienda vía Railway backend
 *
 * El envío a Hacienda usa el endpoint del backend Railway que ya
 * implementa la firma digital y el envío XML (via facturae-cr o similar).
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Send, Save, FileText, ChevronDown, Printer, Search, Loader2, MessageCircle } from "lucide-react";
import db from "../utils/db";
import { useCurrency } from "../contexts/CurrencyContext";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import SinpeQR from "../components/SinpeQR";
import { guardarFacturaVenta } from "../utils/efectosVenta";
import { Modulo, Boton } from "../components/ui";
import { compartirFactura } from "../utils/contacto";

import { emitir, etiquetaEstado, camposFactura, idempotencyFactura, facturaReintentable, reintentarFactura, emisionesEnCurso, registrarEmision, quitarEmision, propietarioDe, payloadVigente, cotizacionOficialDeHoy, esCredito } from "../utils/comprobantes";

// ── Constantes Hacienda ───────────────────────────────────────────────────────
// Esta pantalla emite solo factura (01) y tiquete (04): /api/invoices no conoce
// otros tipos y una "nota de crédito" elegida aquí salía como factura nueva.
// Las notas tienen su propia pantalla (Notas de crédito / Nota de débito).
const TIPOS_DOC = [
  { value: "01", label: "01 - Factura Electrónica" },
  { value: "04", label: "04 - Tiquete Electrónico" },
];

// Catálogo CondicionVenta v4.4 (antes "06" figuraba como "Otro": en Hacienda es
// arrendamiento en función financiera; "Otros" es 99).
const CONDICIONES = [
  { value: "01", label: "01 - Contado" },
  { value: "02", label: "02 - Crédito" },
  { value: "10", label: "10 - Venta a crédito hasta 90 días" },
  { value: "03", label: "03 - Consignación" },
  { value: "04", label: "04 - Apartado" },
  { value: "05", label: "05 - Arrendamiento con opción de compra" },
  { value: "06", label: "06 - Arrendamiento en función financiera" },
  { value: "07", label: "07 - Cobro a favor de un tercero" },
  { value: "99", label: "99 - Otros" },
];

const MEDIOS_PAGO = [
  { value: "01", label: "01 - Efectivo" },
  { value: "02", label: "02 - Tarjeta" },
  { value: "03", label: "03 - Cheque" },
  { value: "04", label: "04 - Transferencia" },
  { value: "05", label: "05 - Recaudado por terceros" },
  { value: "99", label: "99 - Otro" },
];

// Catálogo CodigoTarifaIVA v4.4 (XSD de Hacienda). "10" es exento; "01" es tarifa 0% (gravada).
const TIPOS_IVA = [
  { value: "08", label: "08 - Tarifa general 13%" },
  { value: "07", label: "07 - Tarifa reducida 8%" },
  { value: "04", label: "04 - Tarifa reducida 4%" },
  { value: "06", label: "06 - Tarifa transitoria 4%" },
  { value: "03", label: "03 - Tarifa reducida 2%" },
  { value: "02", label: "02 - Tarifa reducida 1%" },
  { value: "09", label: "09 - Tarifa reducida 0,5%" },
  { value: "01", label: "01 - Tarifa 0%" },
  { value: "05", label: "05 - Tarifa transitoria 0%" },
  { value: "11", label: "11 - Tarifa 0% sin derecho a crédito" },
  { value: "10", label: "10 - Exento" },
];

const IVA_PCT = { "01": 0, "02": 1, "03": 2, "04": 4, "05": 0, "06": 4, "07": 8, "08": 13, "09": 0.5, "10": 0, "11": 0 };

const UNIDADES = ["Unid", "Kg", "g", "L", "mL", "m", "cm", "h", "Días", "Servicio", "Otro"];

// ── Helpers ───────────────────────────────────────────────────────────────────
// Mismos redondeos y en el mismo orden que el backend (xmlBuilder: 5 decimales
// por línea); si no, el total guardado aquí difería del que va a Hacienda.
const r5 = n => { const v = Number(n) || 0; return Number((v + Math.sign(v) * 1e-9).toFixed(5)); };
function calcLinea(l) {
  const cant     = parseFloat(l.cantidad) || 0;
  const precio   = r5(parseFloat(l.precioUnit) || 0);
  const pctDesc  = parseFloat(l.pctDesc) || 0;
  const bruto     = r5(cant * precio);
  const montoDesc = r5((bruto * pctDesc) / 100);
  const subTotal  = r5(bruto - montoDesc);
  const pctIVA    = IVA_PCT[l.codigoIVA] ?? 13;
  const montoIVA  = r5((subTotal * pctIVA) / 100);
  const total     = r5(subTotal + montoIVA);
  return { ...l, montoDesc, subTotal, pctIVA, montoIVA, total };
}

function lineaVacia() {
  return { id: genId(), descripcion: "", cantidad: "1", unidad: "Unid", codigoCabys: "", precioUnit: "", pctDesc: "0", codigoIVA: "08", montoDesc: 0, subTotal: 0, pctIVA: 13, montoIVA: 0, total: 0 };
}

// ── Fila de línea ─────────────────────────────────────────────────────────────
function LineaRow({ linea, productos, onChange, onDelete }) {
  const [showProd, setShowProd] = useState(false);
  const busqProd = (val) => {
    const p = productos.find((x) => x.nombre === val || x.codigoInterno === val);
    if (p) onChange({ ...linea, descripcion: p.nombre, productoId: p.id, codigoCabys: p.codigoCabys || "", precioUnit: String(p.precio || ""), unidad: p.unidad || "Unid" });
    else    onChange({ ...linea, descripcion: val, productoId: null });
    setShowProd(false);
  };
  const l = calcLinea(linea);

  return (
    <tr className="group">
      {/* Descripción con autocomplete */}
      <td className="relative min-w-[180px]">
        <input value={linea.descripcion}
          onChange={(e) => { onChange({ ...linea, descripcion: e.target.value }); setShowProd(true); }}
          onFocus={() => setShowProd(true)}
          onBlur={() => setTimeout(() => setShowProd(false), 150)}
          placeholder="Descripción / producto…"
          className="w-full border-0 bg-transparent text-sm outline-none py-1 px-2 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8]" />
        {showProd && productos.filter((p) => p.nombre?.toLowerCase().includes(linea.descripcion?.toLowerCase() || "")).length > 0 && (
          <div className="absolute top-full left-0 w-64 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-10 max-h-40 overflow-auto">
            {productos.filter((p) => p.nombre?.toLowerCase().includes((linea.descripcion || "").toLowerCase())).slice(0, 8).map((p) => (
              <button key={p.id} onMouseDown={() => busqProd(p.nombre)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-monki-y border-b border-black/5 last:border-0">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-monki-k/45 ml-2">{p.codigoCabys || "—"}</span>
                <span className="text-monki-k ml-2">{fmtMoney(p.precio, "CRC")}</span>
              </button>
            ))}
          </div>
        )}
      </td>
      <td>
        <input value={linea.codigoCabys} onChange={(e) => onChange({ ...linea, codigoCabys: e.target.value })}
          placeholder="CABYS" className="w-24 border-0 bg-transparent text-xs outline-none py-1 px-2 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8] text-monki-k/45" />
      </td>
      <td>
        <input value={linea.cantidad} onChange={(e) => onChange({ ...linea, cantidad: e.target.value })}
          type="number" min="0" step="any"
          className="w-16 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8] text-center" />
      </td>
      <td>
        <select value={linea.unidad} onChange={(e) => onChange({ ...linea, unidad: e.target.value })}
          className="border-0 bg-transparent text-xs outline-none py-1 px-1 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8]">
          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td>
        <input value={linea.precioUnit} onChange={(e) => onChange({ ...linea, precioUnit: e.target.value })}
          type="number" min="0" step="any" placeholder="0"
          className="w-24 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8] text-right" />
      </td>
      <td>
        <input value={linea.pctDesc} onChange={(e) => onChange({ ...linea, pctDesc: e.target.value })}
          type="number" min="0" max="100" step="0.01" placeholder="0"
          className="w-14 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8] text-center" />
      </td>
      <td>
        <select value={linea.codigoIVA} onChange={(e) => onChange({ ...linea, codigoIVA: e.target.value })}
          className="border-0 bg-transparent text-xs outline-none py-1 px-1 rounded-lg hover:bg-black/5 focus:bg-[#FFF4B8]">
          {TIPOS_IVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td className="text-right text-xs text-monki-k/60">{fmtMoney(l.montoIVA, "CRC")}</td>
      <td className="text-right font-semibold text-sm">{fmtMoney(l.total, "CRC")}</td>
      <td>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-600 hover:text-white text-red-500 transition-colors">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Línea como tarjeta (móvil) ────────────────────────────────────────────────
function LineaCard({ linea, productos, onChange, onDelete, idx }) {
  const [showProd, setShowProd] = useState(false);
  const busqProd = (val) => {
    const p = productos.find((x) => x.nombre === val || x.codigoInterno === val);
    if (p) onChange({ ...linea, descripcion: p.nombre, productoId: p.id, codigoCabys: p.codigoCabys || "", precioUnit: String(p.precio || ""), unidad: p.unidad || "Unid" });
    else    onChange({ ...linea, descripcion: val, productoId: null });
    setShowProd(false);
  };
  const l = calcLinea(linea);

  return (
    <div className="border-2 border-black/10 rounded-[18px] p-3 space-y-2 bg-white relative">
      <div className="flex items-center justify-between mb-1">
        <span className="monki-tag text-monki-k/55">Línea {idx + 1}</span>
        <button onClick={onDelete} className="p-1.5 rounded-full hover:bg-red-600 hover:text-white text-red-500 transition-colors"><Trash2 size={13}/></button>
      </div>
      {/* Descripción */}
      <div className="relative">
        <label className="monki-tag text-monki-k/55">Descripción / producto</label>
        <input value={linea.descripcion}
          onChange={(e) => { onChange({ ...linea, descripcion: e.target.value }); setShowProd(true); }}
          onFocus={() => setShowProd(true)}
          onBlur={() => setTimeout(() => setShowProd(false), 150)}
          placeholder="Buscar o escribir…"
          className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5"/>
        {showProd && productos.filter((p) => p.nombre?.toLowerCase().includes(linea.descripcion?.toLowerCase() || "")).length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-36 overflow-auto">
            {productos.filter((p) => p.nombre?.toLowerCase().includes((linea.descripcion || "").toLowerCase())).slice(0, 6).map((p) => (
              <button key={p.id} onMouseDown={() => busqProd(p.nombre)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-monki-y border-b border-black/5 last:border-0">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-monki-k ml-2">{fmtMoney(p.precio, "CRC")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* CABYS */}
      <div>
        <label className="monki-tag text-monki-k/55">Código CABYS</label>
        <input value={linea.codigoCabys} onChange={(e) => onChange({ ...linea, codigoCabys: e.target.value })}
          placeholder="Código CABYS (opcional)"
          className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5"/>
      </div>
      {/* Cant + Unid + Precio */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="monki-tag text-monki-k/55">Cant.</label>
          <input value={linea.cantidad} onChange={(e) => onChange({ ...linea, cantidad: e.target.value })}
            type="number" min="0" step="any"
            className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5 text-center"/>
        </div>
        <div>
          <label className="monki-tag text-monki-k/55">Unidad</label>
          <select value={linea.unidad} onChange={(e) => onChange({ ...linea, unidad: e.target.value })}
            className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5">
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="monki-tag text-monki-k/55">Precio unit.</label>
          <input value={linea.precioUnit} onChange={(e) => onChange({ ...linea, precioUnit: e.target.value })}
            type="number" min="0" step="any" placeholder="0"
            className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5 text-right"/>
        </div>
      </div>
      {/* Desc + IVA */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="monki-tag text-monki-k/55">Desc. %</label>
          <input value={linea.pctDesc} onChange={(e) => onChange({ ...linea, pctDesc: e.target.value })}
            type="number" min="0" max="100" step="0.01" placeholder="0"
            className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5 text-center"/>
        </div>
        <div>
          <label className="monki-tag text-monki-k/55">Tarifa IVA</label>
          <select value={linea.codigoIVA} onChange={(e) => onChange({ ...linea, codigoIVA: e.target.value })}
            className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors mt-0.5">
            {TIPOS_IVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {/* Totales */}
      <div className="flex justify-between text-xs text-monki-k/60 pt-1 border-t border-black/10">
        <span>IVA: {fmtMoney(l.montoIVA, "CRC")}</span>
        <span className="font-bold text-monki-k text-sm">Total: {fmtMoney(l.total, "CRC")}</span>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function FacturacionScreen() {
  const [settings,   setSettings]   = useState({});
  const [contactos,  setContactos]  = useState([]);
  const [productos,  setProductos]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [proyectos,  setProyectos]  = useState([]);
  const [empleados,  setEmpleados]  = useState([]);
  const [sending,    setSending]    = useState(false);
  const { tipoCambio, recargar: recargarTipoCambio } = useCurrency();
  const [enviada,    setEnviada]    = useState(null); // factura recién enviada
  const propietario = propietarioDe(getCurrentUserSync());
  const [enCurso,    setEnCurso]    = useState(() => emisionesEnCurso(propietario)); // emisiones que quedaron a medias
  const [authToken,  setAuthToken]  = useState(null);
  const [proyectoId, setProyectoId] = useState("");
  const [activeTab, setActiveTab] = useState("lineas"); // tab activo en móvil

  // Encabezado
  const [tipoDoc,    setTipoDoc]    = useState("01");
  const [condPago,   setCondPago]   = useState("01");
  const [medioPago,  setMedioPago]  = useState("01");
  const [moneda,     setMoneda]     = useState("CRC");
  const [plazo,      setPlazo]      = useState(""); // días crédito si cond=02
  const [fechaEm,    setFechaEm]    = useState(hoy());
  const [busqCliente,setBusqCliente]= useState("");
  const [cliente,    setCliente]    = useState({ nombre: "", cedula: "", email: "", tipo: "01" });
  const [notas,      setNotas]      = useState("");

  // Líneas
  const [lineas, setLineas] = useState([lineaVacia()]);

  const cargar = useCallback(async () => {
    const [s, c, p, f, pr, em] = await Promise.all([db.getSettings(), db.getContactos(), db.getProductos(), db.getFacturas(), db.getProyectos(), db.getEmpleados()]);
    setSettings(s);
    setContactos(c);
    setProductos(p);
    setFacturas(f);
    setProyectos(pr || []);
    setEmpleados(em || []);
    if (s.moneda) setMoneda(s.moneda);
    // Prefill desde OT si existe
    const ot = sessionStorage.getItem("ot_prefill");
    if (ot) {
      try {
        const d = JSON.parse(ot);
        sessionStorage.removeItem("ot_prefill");
        if (d.cliente) setBusqCliente(d.cliente);
        if (d.notas)   setNotas(d.notas);
        if (d.lineas?.length) {
          const { genId: gid } = await import("../utils/fmt");
          setLineas(d.lineas.map(l => ({ ...lineaVacia(), ...l, id: gid() })));
        }
      } catch {}
    }
    import("../utils/auth").then(m => m.getToken()).then(setAuthToken);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Autocompletar cliente ─────────────────────────────────────────────────
  const [showClientes,    setShowClientes]    = useState(false);
  const [buscandoCedula,  setBuscandoCedula]  = useState(false);
  const [cedulaError,     setCedulaError]     = useState("");
  const [situacionFiscal, setSituacionFiscal] = useState(null); // null | { moroso, omiso, estado }

  const clientesFiltrados = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCliente.toLowerCase()) ||
    c.cedula?.includes(busqCliente) ||
    c.codigoCliente?.toUpperCase().includes(busqCliente.toUpperCase())
  ).slice(0, 6);

  // Busca en contactos locales primero, luego en API de Hacienda
  const buscarPorCedula = async () => {
    const cedula = cliente.cedula.trim().replace(/\D/g, "");
    if (!cedula) return;
    setCedulaError("");
    setSituacionFiscal(null);

    // 1. Buscar en contactos locales
    const local = contactos.find((c) => c.cedula?.replace(/\D/g, "") === cedula);
    if (local) {
      setCliente({ nombre: local.nombre, cedula: local.cedula || cedula, email: local.email || "", tipo: local.tipoCedula || "01", dias_credito: local.dias_credito || 0 });
      setBusqCliente(local.nombre);
      // Auto-setear plazo de crédito si el cliente tiene uno configurado
      if (local.dias_credito > 0) {
        setCondPago("02"); // crédito
        setPlazo(String(local.dias_credito));
      }
      // Igual consultar Hacienda para situación fiscal actualizada
    }

    // 2. Consultar API pública de Hacienda CR
    setBuscandoCedula(true);
    try {
      const res  = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data?.nombre) {
        const tipo = data.tipoIdentificacion || (cedula.length === 9 ? "01" : cedula.length === 10 ? "02" : "03");
        if (!local) {
          setCliente((p) => ({ ...p, nombre: data.nombre, tipo, email: "" }));
          setBusqCliente(data.nombre);
        }
        // Guardar situación fiscal
        const sit = data.situacion || {};
        setSituacionFiscal({
          moroso: sit.moroso ?? false,
          omiso:  sit.omiso  ?? false,
          estado: sit.estado || (sit.moroso ? "Moroso" : "Al día"),
        });
      } else if (!local) {
        setCedulaError("Cédula no encontrada en el registro de Hacienda");
      }
    } catch {
      if (!local) setCedulaError("No se pudo consultar Hacienda — verificá la conexión");
    } finally {
      setBuscandoCedula(false);
    }
  };

  // ── Totales ───────────────────────────────────────────────────────────────
  const lineasCalc = lineas.map(calcLinea);
  const subtotal   = r5(lineasCalc.reduce((s, l) => s + l.subTotal, 0));
  const totalDesc  = lineasCalc.reduce((s, l) => s + l.montoDesc, 0);
  const totalIVA   = r5(lineasCalc.reduce((s, l) => s + l.montoIVA, 0));
  const totalFact  = r5(lineasCalc.reduce((s, l) => s + l.total, 0));

  // ── Acciones ──────────────────────────────────────────────────────────────
  const agregarLinea = () => setLineas((p) => [...p, lineaVacia()]);

  const updateLinea = (idx, val) => setLineas((p) => p.map((l, i) => i === idx ? val : l));

  const deleteLinea = (idx) => setLineas((p) => p.filter((_, i) => i !== idx));

  const resetForm = () => {
    setLineas([lineaVacia()]);
    setBusqCliente("");
    setCliente({ nombre: "", cedula: "", email: "", tipo: "01" });
    setNotas("");
    setCondPago("01");
    setPlazo("");
    setSituacionFiscal(null);
    setCedulaError("");
  };

  // Guarda la factura y aplica inventario, CxC y asiento una sola vez (ver efectosVenta.js).
  const guardarLocal = async (factura) => {
    await guardarFacturaVenta(factura, authToken);
    cargar();
  };

  const armarFactura = () => {
    const num = `FE-${String(facturas.length + 1).padStart(5, "0")}`;
    return {
      id: genId(),
      numero: num,
      tipoDoc,
      fecha: fechaEm,
      condPago,
      medioPago,
      plazo: esCredito(condPago) ? parseInt(plazo) || 30 : 0,
      moneda,
      cliente: { ...cliente, nombre: cliente.nombre || "Consumidor Final" },
      lineas: lineasCalc,
      subtotal,
      totalDescuento: totalDesc,
      totalIVA,
      total: totalFact,
      notas,
      proyectoId: proyectoId || null,
      estado: "borrador",
      creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
  };

  const handleGuardar = async () => {
    const f = armarFactura();
    await guardarLocal({ ...f, estado: "guardada" });
    setEnviada(f);
  };

  const handleEnviar = async () => {
    if (!cliente.cedula && tipoDoc !== "04") {
      alert("Para documentos distintos al tiquete, ingrese la cédula del receptor.");
      return;
    }
    const f = armarFactura();
    if (f.moneda === "USD" && !cotizacionOficialDeHoy(tipoCambio)) {
      recargarTipoCambio?.();
      alert("Para facturar en dólares se necesita el tipo de cambio oficial del BCCR de hoy, y no está disponible" +
        (tipoCambio?.fuente && !tipoCambio.oficial ? ` (solo hay una referencia de mercado: ${tipoCambio.fuente})` : "") +
        ". Se está consultando de nuevo; intentá en unos segundos.");
      return;
    }
    let condicionVentaOtros;
    if (f.condPago === "99") {
      condicionVentaOtros = (prompt("Describí la condición de venta (Hacienda lo exige para \"Otros\"):") || "").trim();
      if (condicionVentaOtros.length < 5) { alert("La descripción de la condición de venta necesita al menos 5 caracteres."); return; }
    }
    let medioPagoOtros;
    if (!esCredito(f.condPago) && f.medioPago === "99") {
      medioPagoOtros = (prompt("Describí el medio de pago (Hacienda lo exige para \"Otro\"):") || "").trim();
      if (medioPagoOtros.length < 3) { alert("La descripción del medio de pago necesita al menos 3 caracteres."); return; }
    }
    setSending(true);
    try {
      // POST /api/invoices con el formato que espera el backend
      const payload = {
        cliente: {
          nombre: f.cliente.nombre || "Consumidor Final",
          cedula: f.cliente.cedula || undefined,
          cedulaTipo: f.cliente.tipo || undefined, // 05/06 conservan letras; antes el tipo se ignoraba
          correo:  f.cliente.email || f.cliente.correo || undefined,
        },
        // Todo lo que se ve en pantalla va al XML: descuento, tarifa, CABYS y
        // unidad por línea (antes solo cantidad/precio/%IVA: con descuento el
        // total enviado a Hacienda no coincidía con el cobrado).
        items: f.lineas.map(l => ({
          descripcion:     l.descripcion,
          cantidad:        Number(l.cantidad),
          precioUnitario:  Number(l.precioUnit),
          descuento:       l.montoDesc || 0, // ya redondeado igual que en el backend
          codigoTarifaIva: l.codigoIVA || "08",
          codigoCabys:     l.codigoCabys || undefined,
          unidadMedida:    l.unidad || "Unid",
        })),
        moneda:         f.moneda,
        tipoCambio:     f.moneda === "USD" ? tipoCambio?.venta : 1,
        tipoCambioFecha: f.moneda === "USD" ? tipoCambio?.fecha : undefined,
        tipoDoc:        f.tipoDoc, // "04" = tiquete; antes no se enviaba y todo salía como factura
        condicionVenta: f.condPago || "01",
        plazoCredito:   esCredito(f.condPago) ? f.plazo : undefined,
        // En crédito Hacienda no lleva medio de pago; no se manda "99" sin descripción.
        medioPago:      esCredito(f.condPago) ? "01" : (f.medioPago || "01"),
        medioPagoOtros,
        condicionVentaOtros,
      };
      const intento = { ...f, payload };
      // Se anota ANTES de llamar al backend: si la app se cierra a la mitad se
      // puede reanudar con la misma Idempotency-Key (no se crea otra factura).
      try {
        registrarEmision(intento, propietario);
      } catch (err) {
        alert(`No se pudo preparar la emisión en este equipo (${err.message}). No se envió nada; intentá de nuevo.`);
        return;
      }
      const r = await emitir("/api/invoices", payload, { token: authToken, idempotencyKey: idempotencyFactura(intento) });
      if (await procesarResultado(intento, r)) resetForm();
    } finally {
      setSending(false);
      setEnCurso(emisionesEnCurso(propietario));
    }
  };

  // Guarda la factura según la respuesta. Devuelve false si el backend la
  // rechazó por validación (no se guardó nada allá) para dejar el formulario.
  const procesarResultado = async (intento, r) => {
    if (!r.ok && !r.comprobante && r.status && r.status < 500) {
      quitarEmision(intento.id);
      alert(`${r.error}${r.faltantes?.length ? `\n\nFalta: ${r.faltantes.join(", ")}` : ""}`);
      return false;
    }
    // Inventario, CxC y asiento se aplican una sola vez aunque el envío falle;
    // los reintentos actualizan esta misma factura.
    const { propietario: _p, ...datos } = intento;
    // Si la factura ya existe localmente (p. ej. al reanudar), sus datos
    // fiscales mandan: un error de red no reemplaza un estado conocido.
    const local = (await db.getFacturas()).find(x => x.id === intento.id);
    const factura = { ...datos, ...(local || {}) };
    // camposFactura trae tipo y total del comprobante emitido (CxC y asiento usan esos).
    const guardada = { ...factura, ...camposFactura(r, factura) };
    try {
      await guardarLocal(guardada);
    } catch (err) {
      // El comprobante ya existe en el backend: NO se deja volver a emitir este
      // formulario (crearía otra clave). Se muestra el resultado, la emisión
      // sigue en la cola para "Reanudar" y se puede completar el registro.
      setEnviada({ ...guardada, errorLocal: err.message });
      alert(`${etiquetaEstado(guardada.estado)}, pero no se pudo completar el registro local (${err.message}).\n\nNo la vuelvas a emitir: usá "Completar registro".`);
      return true;
    }
    quitarEmision(intento.id);
    setEnviada(guardada);
    if (!r.ok) alert(`${etiquetaEstado(guardada.estado)}\n${r.error}\n\nLa factura quedó guardada. Usá "Reintentar envío" (aquí o en el historial); no la vuelvas a emitir.`);
    return true;
  };

  // Completa el registro local (inventario, CxC, asiento) de una factura ya emitida.
  const completarRegistro = async (factura) => {
    setSending(true);
    try {
      const { errorLocal: _e, ...limpia } = factura;
      await guardarLocal(limpia);
      quitarEmision(limpia.id);
      setEnviada(limpia);
    } catch (err) {
      alert(`Todavía no se pudo completar el registro: ${err.message}`);
    } finally {
      setSending(false);
      setEnCurso(emisionesEnCurso(propietario));
    }
  };

  // Reanuda una emisión que quedó a medias (app cerrada durante el envío).
  const reanudarEmision = async (intentoOriginal) => {
    let intento = intentoOriginal;
    if (!propietario || intento.propietario !== propietario) return; // solo la cuenta que la inició
    const local = (await db.getFacturas()).find(x => x.id === intento.id);
    // Ya tiene comprobante confirmado y no hay nada que reenviar: solo completar lo local.
    if (local?.haciendaId && !facturaReintentable(local)) return completarRegistro(local);
    setSending(true);
    try {
      let r;
      if (local?.haciendaId) r = (await reintentarFactura(local, authToken, tipoCambio)).r; // reenviar: no usa cotización
      else {
        const { payload, error, requiereCotizacion } = payloadVigente(intento.payload, tipoCambio);
        if (error) { if (requiereCotizacion) recargarTipoCambio?.(); alert(error); return; }
        r = await emitir("/api/invoices", payload, { token: authToken, idempotencyKey: idempotencyFactura(intento) });
        intento = { ...intento, payload };
      }
      await procesarResultado(intento, r);
    } finally {
      setSending(false);
      setEnCurso(emisionesEnCurso(propietario));
    }
  };

  // Retoma una factura guardada que quedó a medias, con la misma clave.
  const reintentarEnvio = async (factura) => {
    setSending(true);
    try {
      const { r, campos, requiereCotizacion } = await reintentarFactura(factura, authToken, tipoCambio);
      if (requiereCotizacion) recargarTipoCambio?.();
      const actualizada = { ...factura, ...campos };
      await guardarLocal(actualizada);
      setEnviada(actualizada);
      if (!r.ok) alert(`${etiquetaEstado(actualizada.estado)}\n${r.error}`);
    } finally {
      setSending(false);
    }
  };

  // ── Imprimir factura en ventana del OS ───────────────────────────────────
  const imprimirFactura = async (factura) => {
    const s = await db.getSettings();
    const sinpe = s?.sinpe || s?.telefono || "8302-6613";
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(`sinpe://506${sinpe.replace(/\D/g,"")}?amount=${factura.total}&description=${factura.numero}`)}&size=200&margin=1&format=png`;
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${factura.numero}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;max-width:800px;margin:0 auto;padding:24px;color:#111}
  h1{font-size:22px;margin:0}h2{font-size:16px;margin:8px 0 4px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
  .negocio{font-size:10px;color:#555;line-height:1.6}
  .badge{background:#0f172a;color:#fff;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold;display:inline-block;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#f1f5f9;text-align:left;padding:6px 8px;font-size:11px;border-bottom:1px solid #cbd5e1}
  td{padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px}
  .totales{margin-top:8px;text-align:right}
  .total-final{font-size:18px;font-weight:900;color:#0f172a;margin-top:6px}
  .footer{margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .qr-box{text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:inline-block}
  .qr-box p{margin:4px 0;font-size:10px;color:#666}
  .qr-box strong{font-size:14px;color:#0f172a}
  @media print{body{padding:0}}
</style></head><body>
<div class="header">
  <div>
    <div class="badge">${factura.numero}</div>
    <h1>${s?.nombreNegocio||"Mi negocio"}</h1>
    <div class="negocio">
      ${s?.cedula?`Cédula: ${s.cedula}<br>`:""}
      ${s?.correo?`${s.correo}<br>`:""}
      ${s?.telefono?`Tel: ${s.telefono}<br>`:""}
      ${s?.direccion||""}
    </div>
  </div>
  <div style="text-align:right;font-size:11px;color:#555">
    <p style="margin:2px 0">Fecha: ${fmtDate(factura.fechaEmision)}</p>
    ${factura.vencimiento?`<p style="margin:2px 0">Vence: ${fmtDate(factura.vencimiento)}</p>`:""}
    <p style="margin:2px 0">Cliente: <strong>${factura.nombreReceptor||"Consumidor Final"}</strong></p>
    ${factura.cedulaReceptor?`<p style="margin:2px 0">Cédula: ${factura.cedulaReceptor}</p>`:""}
  </div>
</div>

<table>
  <thead><tr><th>#</th><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio unit.</th><th style="text-align:right">IVA</th><th style="text-align:right">Subtotal</th></tr></thead>
  <tbody>
    ${(factura.lineas||[]).map((l,i)=>`<tr><td>${i+1}</td><td>${l.descripcion||l.nombre||""}</td><td style="text-align:right">${l.cantidad}</td><td style="text-align:right">${fmtMoney(l.precioUnitario,factura.moneda)}</td><td style="text-align:right">${fmtMoney(l.montoImpuesto||0,factura.moneda)}</td><td style="text-align:right">${fmtMoney(l.subtotal||l.montoTotal,factura.moneda)}</td></tr>`).join("")}
  </tbody>
</table>

<div class="totales">
  <p>Subtotal: ${fmtMoney(factura.totalVenta||factura.total,factura.moneda)}</p>
  ${factura.totalImpuesto?`<p>IVA: ${fmtMoney(factura.totalImpuesto,factura.moneda)}</p>`:""}
  <p class="total-final">TOTAL: ${fmtMoney(factura.totalGeneral||factura.total,factura.moneda)}</p>
</div>

<div class="footer">
  <div style="font-size:10px;color:#888;max-width:400px">
    ${factura.observaciones?`<p>${factura.observaciones}</p>`:""}
    <p>Gracias por su preferencia.</p>
  </div>
  <div class="qr-box">
    <img src="${qrUrl}" width="100" height="100" alt="QR SINPE"/>
    <p>Pago por SINPE Móvil</p>
    <strong>${sinpe}</strong>
  </div>
</div>
</body></html>`;

    const w = window.open("","_blank","width=850,height=700");
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(), 600);
  };

  // ── Banner de confirmación ────────────────────────────────────────────────
  if (enviada) {
    const esEnviada  = ["enviado","simulado","aceptado","aceptada"].includes(enviada.estado);
    const estadoLabel = etiquetaEstado(enviada.estado);
    const puedeReintentar = facturaReintentable(enviada);
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 fade-in overflow-y-auto py-6 px-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${esEnviada ? "bg-monki-y shadow-[4px_4px_0_#111] animate-flotar" : "bg-monki-cream border-2 border-black/10"}`}>
          {esEnviada ? "✓" : "⏳"}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-monki-k">{enviada.numero}</h2>
          <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${esEnviada ? "bg-monki-k text-monki-y" : "bg-[#FFF4B8] text-monki-k"}`}>
            {estadoLabel}
          </span>
          {enviada.modoSimulacion && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs bg-monki-cream text-monki-k border-2 border-black/10 font-semibold">MODO PRUEBA</span>
          )}
          <p className="text-2xl font-black text-monki-k mt-2">{fmtMoney(enviada.total, enviada.moneda)}</p>
          {esEnviada && !enviada.modoSimulacion && (
            <p className="text-xs text-monki-k/55 mt-2 max-w-xs mx-auto">
              {(enviada.cliente?.email || enviada.cliente?.correo)
                ? `✉ Se envía sola a ${enviada.cliente.email || enviada.cliente.correo} (PDF y XML), y después la respuesta de Hacienda.`
                : "✉ El cliente no tiene correo: podés enviarla desde el Historial de facturas."}
            </p>
          )}
        </div>

        {/* Datos de Hacienda */}
        {(enviada.clave || enviada.numeroConsecutivo || enviada.haciendaRes) && (
          <div className="w-full max-w-md bg-white border-2 border-black/10 rounded-[18px] p-4 space-y-2 text-xs">
            <p className="monki-tag text-monki-k/55 font-semibold">Respuesta de Hacienda</p>
            {enviada.numeroConsecutivo && (
              <div className="flex justify-between">
                <span className="text-monki-k/60">Consecutivo</span>
                <span className="font-mono font-semibold text-monki-k">{enviada.numeroConsecutivo}</span>
              </div>
            )}
            {enviada.clave && (
              <div>
                <span className="text-monki-k/60">Clave numérica</span>
                <p className="font-mono text-[10px] text-monki-k/75 break-all mt-0.5">{enviada.clave}</p>
              </div>
            )}
            {enviada.haciendaRes?.nota && (
              <p className="text-monki-k/75 italic">{enviada.haciendaRes.nota}</p>
            )}
            {enviada.haciendaRes?.message && (
              <p className="text-monki-k/75 italic">{enviada.haciendaRes.message}</p>
            )}
          </div>
        )}

        {enviada.errorLocal && (
          <div className="w-full max-w-md bg-[#FFF4B8] border-2 border-monki-k rounded-2xl p-3 text-xs text-monki-k">
            La factura se emitió, pero falta completar inventario, CxC o asiento: {enviada.errorLocal}
          </div>
        )}
        {enviada.error && (
          <div className="w-full max-w-md bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-xs text-red-700">
            {enviada.error}
          </div>
        )}
        {enviada.errorLocal && (
          <button onClick={() => completarRegistro(enviada)} disabled={sending}
            className="ui-boton flex items-center gap-2 bg-monki-y text-monki-k px-5 py-2.5 rounded-full text-[13px] font-bold hover:shadow-[4px_4px_0_#111] transition-all disabled:opacity-50">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Completar registro
          </button>
        )}
        {!enviada.errorLocal && puedeReintentar && (
          <button onClick={() => reintentarEnvio(enviada)} disabled={sending}
            className="ui-boton flex items-center gap-2 bg-monki-k text-monki-y px-5 py-2.5 rounded-full text-[13px] font-bold hover:shadow-[4px_4px_0_#FFD600] transition-all disabled:opacity-50">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Reintentar envío
          </button>
        )}

        {/* QR de SINPE */}
        <div className="flex flex-col items-center gap-1 border-2 border-black/10 rounded-[18px] p-4 bg-white">
          <SinpeQR
            telefono={settings?.sinpe || settings?.telefono || "8302-6613"}
            monto={enviada.totalGeneral || enviada.total}
            descripcion={enviada.numero}
            size={130}
          />
          <p className="text-xs text-monki-k/45 mt-1">Escaneá para pagar por SINPE Móvil</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => compartirFactura(enviada, { settings, contactos, fmtMoney })}
            className="ui-boton flex items-center gap-2 bg-monki-y text-monki-k px-5 py-2.5 rounded-full text-[13px] font-bold hover:shadow-[4px_4px_0_#111] transition-all">
            <MessageCircle size={15}/> Enviar por WhatsApp
          </button>
          <button onClick={() => imprimirFactura(enviada)}
            className="ui-boton flex items-center gap-2 bg-white text-monki-k shadow-[inset_0_0_0_2px_#111] px-5 py-2.5 rounded-full text-[13px] font-bold hover:bg-monki-k hover:text-monki-y transition-colors">
            <Printer size={15}/> Imprimir / PDF
          </button>
          <button onClick={() => setEnviada(null)}
            className="ui-boton flex items-center gap-2 bg-monki-k text-monki-y px-6 py-2.5 rounded-full text-[13px] font-bold hover:shadow-[4px_4px_0_#FFD600] transition-all">
            <Plus size={16} /> Nueva factura
          </button>
        </div>
      </div>
    );
  }

  // ── Vendedor / lista precio (nuevos campos) ──────────────────────────────
  // Estos estados se declaran aquí para no modificar la zona de state arriba
  // (ya existe activeTab arriba)

  return (
    <Modulo
      seccion="Ventas"
      titulo="Facturación"
      descripcion="Factura electrónica y tiquete Hacienda v4.4 — se firma y envía desde el servidor."
      acciones={<>
        <div className="flex items-center gap-3 bg-monki-k text-white rounded-full pl-4 pr-1.5 py-1.5 text-xs">
          {totalDesc > 0 && <span className="text-red-300">Desc −{fmtMoney(totalDesc, moneda)}</span>}
          <span className="text-white/60">IVA {fmtMoney(totalIVA, moneda)}</span>
          <span className="bg-monki-y text-monki-k font-black text-sm rounded-full px-3 py-1 tabular-nums">{fmtMoney(totalFact, moneda)}</span>
        </div>
        {situacionFiscal && (
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
            situacionFiscal.moroso === "SI" || situacionFiscal.omiso === "SI"
              ? "bg-red-600 text-white" : "bg-monki-y text-monki-k"}`}>
            {situacionFiscal.moroso === "SI" ? "⚠ Moroso" : situacionFiscal.omiso === "SI" ? "⚠ Omiso" : "✓ Al día"}
          </span>
        )}
        <Boton variante="fantasma" icono={Plus} onClick={resetForm}>Nueva</Boton>
        <Boton variante="secundario" icono={Save} onClick={handleGuardar} disabled={sending}>Guardar</Boton>
        <Boton icono={Send} cargando={sending} onClick={handleEnviar} disabled={sending || totalFact === 0}>{sending ? "Enviando…" : "Emitir"}</Boton>
      </>}
    >

      {enCurso.length > 0 && (
        <div className="shrink-0 mb-3 px-4 py-3 bg-[#FFF4B8] border-2 border-monki-k rounded-2xl text-xs text-monki-k space-y-1.5">
          <p className="font-bold">⚠ {enCurso.length === 1 ? "Una factura no terminó" : `${enCurso.length} facturas no terminaron`} de emitirse (se cerró la app o se cortó la conexión). Reanudala: no se va a duplicar.</p>
          {enCurso.map(i => (
            <div key={i.id} className="flex items-center gap-3">
              <span className="font-mono">{i.numero}</span>
              <span>{i.cliente?.nombre || "Consumidor Final"}</span>
              <span className="font-semibold">{fmtMoney(i.total, i.moneda)}</span>
              <Boton tamano="sm" className="ml-auto" onClick={() => reanudarEmision(i)} disabled={sending}>Reanudar</Boton>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB BAR — solo móvil/iPad ────────────────────────────────────── */}
      <div className="xl:hidden flex shrink-0 gap-1 p-1 mb-3 bg-white rounded-full border-2 border-black/10">
        {["encabezado","lineas"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`ui-boton flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ease-monki
              ${activeTab === t ? "bg-monki-k text-monki-y" : "text-monki-k/60"}`}>
            {t === "lineas" ? `Líneas (${lineas.length})` : "Encabezado"}
          </button>
        ))}
      </div>

      {/* ── BODY — 3 columnas en desktop, tabs en móvil ─────────────────── */}
      <div className="ui-tarjeta flex-1 min-h-0 flex overflow-hidden bg-white rounded-[18px] border-2 border-black/10">

        {/* ═══ PANEL IZQUIERDO: Encabezado (desktop fijo, móvil tab) ════════ */}
        <div className={`
          xl:flex xl:flex-col xl:w-72 xl:shrink-0 xl:border-r-2 xl:border-black/10 xl:bg-monki-cream/50 xl:overflow-y-auto
          ${activeTab === "encabezado" ? "flex flex-col flex-1 overflow-y-auto bg-white" : "hidden xl:flex"}
        `}>
          <div className="px-3 py-3 space-y-3">

            {/* Cliente */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Cliente</label>
              <div className="relative">
                <input value={busqCliente}
                  onChange={(e) => { setBusqCliente(e.target.value); setCliente((p) => ({ ...p, nombre: e.target.value })); setShowClientes(true); }}
                  onFocus={() => setShowClientes(true)}
                  onBlur={() => setTimeout(() => setShowClientes(false), 150)}
                  placeholder="Nombre, código CLI-XXXX…"
                  autoComplete="off"
                  className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"/>
                {showClientes && clientesFiltrados.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-40 overflow-auto">
                    {clientesFiltrados.map((c) => (
                      <button key={c.id} onMouseDown={() => {
                        setCliente({ nombre: c.nombre, cedula: c.cedula || "", email: c.email || "", tipo: c.tipoCedula || "01", dias_credito: c.dias_credito || 0 });
                        setBusqCliente(c.nombre); setShowClientes(false);
                        if (c.dias_credito > 0) { setCondPago("02"); setPlazo(String(c.dias_credito)); }
                      }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-monki-y border-b border-black/5 last:border-0">
                        {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-k text-monki-y px-1 rounded mr-1">{c.codigoCliente}</span>}
                        <span className="font-semibold">{c.nombre}</span>
                        <span className="text-monki-k/45 ml-1.5 text-[10px]">{c.cedula}</span>
                        {c.dias_credito > 0 && <span className="ml-1.5 text-[10px] text-monki-k font-semibold">{c.dias_credito}d</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cédula */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Cédula / ID</label>
              <div className="flex gap-1">
                <select value={cliente.tipo} onChange={(e) => setCliente((p) => ({ ...p, tipo: e.target.value }))}
                  className="w-20 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                  <option value="01">Física</option><option value="02">Jurídica</option>
                  <option value="03">DIMEX</option><option value="04">NITE</option>
                  <option value="05">Extranjero</option><option value="06">No contrib.</option>
                </select>
                <input value={cliente.cedula}
                  onChange={(e) => { setCliente((p) => ({ ...p, cedula: e.target.value })); setCedulaError(""); setSituacionFiscal(null); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarPorCedula()}
                  placeholder="Número…"
                  className="flex-1 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"/>
                <button onClick={buscarPorCedula} disabled={buscandoCedula || !cliente.cedula.trim()}
                  className="flex items-center justify-center w-9 shrink-0 rounded-xl bg-monki-k text-monki-y hover:shadow-[3px_3px_0_#FFD600] transition-all disabled:opacity-40">
                  {buscandoCedula ? <Loader2 size={12} className="animate-spin"/> : <Search size={12}/>}
                </button>
              </div>
              {cedulaError && <p className="text-[10px] text-red-500 mt-0.5">{cedulaError}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Correo</label>
              <input value={cliente.email} onChange={(e) => setCliente((p) => ({ ...p, email: e.target.value }))}
                placeholder="cliente@empresa.com"
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"/>
            </div>

            <div className="border-t border-black/10"/>

            {/* Tipo de documento */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Tipo de documento</label>
              <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Fecha + Moneda en fila */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block monki-tag text-monki-k/55 mb-1.5">Fecha</label>
                <input type="date" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)}
                  className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors"/>
              </div>
              <div className="w-20">
                <label className="block monki-tag text-monki-k/55 mb-1.5">Moneda</label>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                  className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                  <option value="CRC">₡ CRC</option><option value="USD">$ USD</option>
                </select>
              </div>
            </div>

            {/* Condición + Medio pago */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Condición de pago</label>
              <select value={condPago} onChange={(e) => setCondPago(e.target.value)}
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                {CONDICIONES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {esCredito(condPago) && (
              <div>
                <label className="block monki-tag text-monki-k/55 mb-1.5">Plazo (días)</label>
                <input type="number" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="30" min="1"
                  className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"/>
              </div>
            )}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Medio de pago</label>
              <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                {MEDIOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="border-t border-black/10"/>

            {/* Vendedor */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Vendedor / Agente</label>
              <select value={cliente.vendedor || ""} onChange={(e) => setCliente((p) => ({ ...p, vendedor: e.target.value }))}
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                <option value="">— Sin asignar —</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.nombre}>{e.nombre}{e.puesto ? ` · ${e.puesto}` : ""}</option>
                ))}
              </select>
            </div>

            {/* Lista de precio */}
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Lista de precio</label>
              <select value={cliente.listaPrecio || "normal"} onChange={(e) => setCliente((p) => ({ ...p, listaPrecio: e.target.value }))}
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                <option value="normal">Normal</option>
                <option value="especial">Especial</option>
                <option value="superespecial">Superespecial</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </div>

            {/* Proyecto */}
            {proyectos.length > 0 && (
              <div>
                <label className="block monki-tag text-monki-k/55 mb-1.5">Proyecto</label>
                <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
                  className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors">
                  <option value="">— Sin proyecto —</option>
                  {proyectos.filter(p => p.estado === "Activo").map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ═══ PANEL CENTRAL: Líneas ══════════════════════════════════════════ */}
        <div className={`flex-1 overflow-auto flex flex-col ${activeTab === "lineas" ? "" : "hidden xl:flex"}`}>
          {/* Móvil: tarjetas */}
          <div className="block xl:hidden px-3 py-2 space-y-3 flex-1">
            {lineas.map((l, i) => (
              <LineaCard key={l.id} linea={l} idx={i} productos={productos}
                onChange={(v) => updateLinea(i, v)} onDelete={() => deleteLinea(i)} />
            ))}
            <button onClick={agregarLinea}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-black/20 text-monki-k text-sm font-bold py-3 rounded-[18px] hover:border-monki-k hover:bg-monki-y transition-colors">
              <Plus size={15}/> Agregar línea
            </button>
          </div>
          {/* Desktop: tabla */}
          <div className="hidden xl:flex xl:flex-col flex-1">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 bg-white border-b-2 border-black/10 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 monki-tag text-monki-k/55 font-semibold min-w-[200px]">Descripción</th>
                    <th className="text-left px-2 py-2 monki-tag text-monki-k/55 font-semibold w-28">CABYS</th>
                    <th className="text-center px-2 py-2 monki-tag text-monki-k/55 font-semibold w-16">Cant.</th>
                    <th className="text-left px-2 py-2 monki-tag text-monki-k/55 font-semibold w-20">Unid.</th>
                    <th className="text-right px-2 py-2 monki-tag text-monki-k/55 font-semibold w-24">P. Unit.</th>
                    <th className="text-center px-2 py-2 monki-tag text-monki-k/55 font-semibold w-16">Desc %</th>
                    <th className="text-left px-2 py-2 monki-tag text-monki-k/55 font-semibold w-28">IVA</th>
                    <th className="text-right px-2 py-2 monki-tag text-monki-k/55 font-semibold w-24">Mto. IVA</th>
                    <th className="text-right px-3 py-2 monki-tag text-monki-k/55 font-semibold w-28">Total</th>
                    <th className="w-6"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {lineas.map((l, i) => (
                    <LineaRow key={l.id} linea={l} productos={productos}
                      onChange={(v) => updateLinea(i, v)} onDelete={() => deleteLinea(i)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-black/10 px-4 py-2">
              <button onClick={agregarLinea}
                className="ui-boton flex items-center gap-2 bg-monki-y text-monki-k text-[13px] font-bold rounded-full px-4 py-1.5 hover:shadow-[3px_3px_0_#111] transition-all">
                <Plus size={14}/> Agregar línea
              </button>
            </div>
          </div>
        </div>

        {/* ═══ PANEL DERECHO: Totales + Notas (solo desktop) ════════════════ */}
        <div className="hidden xl:flex xl:flex-col xl:w-56 xl:shrink-0 xl:border-l-2 xl:border-black/10 xl:bg-white xl:overflow-y-auto">
          <div className="px-4 py-4 space-y-2">
            <p className="monki-tag text-monki-k/55 mb-3">Resumen</p>
            <div className="flex justify-between text-xs text-monki-k/75">
              <span>Subtotal</span><span>{fmtMoney(subtotal, moneda)}</span>
            </div>
            {totalDesc > 0 && (
              <div className="flex justify-between text-xs text-red-500">
                <span>Descuentos</span><span>− {fmtMoney(totalDesc, moneda)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-monki-k/75">
              <span>IVA</span><span>{fmtMoney(totalIVA, moneda)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-monki-k border-t border-black/10 pt-2 mt-1">
              <span>TOTAL</span><span className="text-monki-k">{fmtMoney(totalFact, moneda)}</span>
            </div>

            <div className="border-t border-black/10 pt-3">
              <label className="block monki-tag text-monki-k/55 mb-1.5">Observaciones</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
                rows={4} placeholder="Notas, condiciones…"
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3 py-2 text-xs text-monki-k placeholder:text-monki-k/35 transition-colors resize-none"/>
            </div>

            {/* QR SINPE mini */}
            <div className="border-t border-black/10 pt-3 flex flex-col items-center gap-1">
              <p className="text-[10px] text-monki-k/45">SINPE Móvil</p>
              <SinpeQR
                telefono={settings?.sinpe || settings?.telefono || ""}
                monto={totalFact}
                descripcion="Factura"
                size={90}
              />
            </div>
          </div>
        </div>

      </div>{/* fin body */}
    </Modulo>
  );
}
