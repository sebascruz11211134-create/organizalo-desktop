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
import { Plus, Trash2, Send, Save, FileText, ChevronDown, Printer, Search, Loader2 } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import SinpeQR from "../components/SinpeQR";
import { reducirInventario, crearCXC } from "../utils/clienteUtils";

const BACKEND = "https://organizalo-backend-production.up.railway.app";

// ── Constantes Hacienda ───────────────────────────────────────────────────────
const TIPOS_DOC = [
  { value: "01", label: "01 - Factura Electrónica" },
  { value: "02", label: "02 - Nota de Débito" },
  { value: "03", label: "03 - Nota de Crédito" },
  { value: "04", label: "04 - Tiquete Electrónico" },
  { value: "08", label: "08 - Fact. Elect. de Compra" },
  { value: "09", label: "09 - Fact. Elect. de Exportación" },
];

const CONDICIONES = [
  { value: "01", label: "01 - Contado" },
  { value: "02", label: "02 - Crédito" },
  { value: "03", label: "03 - Consignación" },
  { value: "04", label: "04 - Apartado" },
  { value: "05", label: "05 - Arrendamiento" },
  { value: "06", label: "06 - Otro" },
];

const MEDIOS_PAGO = [
  { value: "01", label: "01 - Efectivo" },
  { value: "02", label: "02 - Tarjeta" },
  { value: "03", label: "03 - Cheque" },
  { value: "04", label: "04 - Transferencia" },
  { value: "05", label: "05 - Recaudado por terceros" },
  { value: "99", label: "99 - Otro" },
];

const TIPOS_IVA = [
  { value: "01", label: "01 - Tarifa 0% (Exento)" },
  { value: "02", label: "02 - Tarifa 1%" },
  { value: "03", label: "03 - Tarifa 2%" },
  { value: "04", label: "04 - Tarifa 4% (Canasta)" },
  { value: "05", label: "05 - Tarifa 0% (Trans. no sujeta)" },
  { value: "06", label: "06 - Tarifa 4% (Med. y otros)" },
  { value: "07", label: "07 - Tarifa 8%" },
  { value: "08", label: "08 - Tarifa 13%" },
];

const IVA_PCT = { "01": 0, "02": 1, "03": 2, "04": 4, "05": 0, "06": 4, "07": 8, "08": 13 };

const UNIDADES = ["Unid", "Kg", "g", "L", "mL", "m", "cm", "h", "Días", "Servicio", "Otro"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcLinea(l) {
  const cant     = parseFloat(l.cantidad) || 0;
  const precio   = parseFloat(l.precioUnit) || 0;
  const pctDesc  = parseFloat(l.pctDesc) || 0;
  const montoDesc = (cant * precio * pctDesc) / 100;
  const subTotal  = cant * precio - montoDesc;
  const pctIVA    = IVA_PCT[l.codigoIVA] ?? 13;
  const montoIVA  = (subTotal * pctIVA) / 100;
  const total     = subTotal + montoIVA;
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
          className="w-full border-0 bg-transparent text-sm outline-none py-1 px-2 rounded focus:bg-green-50" />
        {showProd && productos.filter((p) => p.nombre?.toLowerCase().includes(linea.descripcion?.toLowerCase() || "")).length > 0 && (
          <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-40 overflow-auto">
            {productos.filter((p) => p.nombre?.toLowerCase().includes((linea.descripcion || "").toLowerCase())).slice(0, 8).map((p) => (
              <button key={p.id} onMouseDown={() => busqProd(p.nombre)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 border-b border-gray-50 last:border-0">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-slate-400 ml-2">{p.codigoCabys || "—"}</span>
                <span className="text-emerald-700 ml-2">{fmtMoney(p.precio, "CRC")}</span>
              </button>
            ))}
          </div>
        )}
      </td>
      <td>
        <input value={linea.codigoCabys} onChange={(e) => onChange({ ...linea, codigoCabys: e.target.value })}
          placeholder="CABYS" className="w-24 border-0 bg-transparent text-xs outline-none py-1 px-2 rounded focus:bg-green-50 text-slate-400" />
      </td>
      <td>
        <input value={linea.cantidad} onChange={(e) => onChange({ ...linea, cantidad: e.target.value })}
          type="number" min="0" step="any"
          className="w-16 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded focus:bg-green-50 text-center" />
      </td>
      <td>
        <select value={linea.unidad} onChange={(e) => onChange({ ...linea, unidad: e.target.value })}
          className="border-0 bg-transparent text-xs outline-none py-1 px-1 rounded focus:bg-green-50">
          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td>
        <input value={linea.precioUnit} onChange={(e) => onChange({ ...linea, precioUnit: e.target.value })}
          type="number" min="0" step="any" placeholder="0"
          className="w-24 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded focus:bg-green-50 text-right" />
      </td>
      <td>
        <input value={linea.pctDesc} onChange={(e) => onChange({ ...linea, pctDesc: e.target.value })}
          type="number" min="0" max="100" step="0.01" placeholder="0"
          className="w-14 border-0 bg-transparent text-sm outline-none py-1 px-2 rounded focus:bg-green-50 text-center" />
      </td>
      <td>
        <select value={linea.codigoIVA} onChange={(e) => onChange({ ...linea, codigoIVA: e.target.value })}
          className="border-0 bg-transparent text-xs outline-none py-1 px-1 rounded focus:bg-green-50">
          {TIPOS_IVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td className="text-right text-xs text-slate-500">{fmtMoney(l.montoIVA, "CRC")}</td>
      <td className="text-right font-semibold text-sm">{fmtMoney(l.total, "CRC")}</td>
      <td>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
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
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-400 uppercase">Línea {idx + 1}</span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
      </div>
      {/* Descripción */}
      <div className="relative">
        <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción / producto</label>
        <input value={linea.descripcion}
          onChange={(e) => { onChange({ ...linea, descripcion: e.target.value }); setShowProd(true); }}
          onFocus={() => setShowProd(true)}
          onBlur={() => setTimeout(() => setShowProd(false), 150)}
          placeholder="Buscar o escribir…"
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5"/>
        {showProd && productos.filter((p) => p.nombre?.toLowerCase().includes(linea.descripcion?.toLowerCase() || "")).length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg z-20 max-h-36 overflow-auto">
            {productos.filter((p) => p.nombre?.toLowerCase().includes((linea.descripcion || "").toLowerCase())).slice(0, 6).map((p) => (
              <button key={p.id} onMouseDown={() => busqProd(p.nombre)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-gray-50 last:border-0">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-emerald-700 ml-2">{fmtMoney(p.precio, "CRC")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* CABYS */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase">Código CABYS</label>
        <input value={linea.codigoCabys} onChange={(e) => onChange({ ...linea, codigoCabys: e.target.value })}
          placeholder="Código CABYS (opcional)"
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5"/>
      </div>
      {/* Cant + Unid + Precio */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Cant.</label>
          <input value={linea.cantidad} onChange={(e) => onChange({ ...linea, cantidad: e.target.value })}
            type="number" min="0" step="any"
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5 text-center"/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Unidad</label>
          <select value={linea.unidad} onChange={(e) => onChange({ ...linea, unidad: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5">
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Precio unit.</label>
          <input value={linea.precioUnit} onChange={(e) => onChange({ ...linea, precioUnit: e.target.value })}
            type="number" min="0" step="any" placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5 text-right"/>
        </div>
      </div>
      {/* Desc + IVA */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Desc. %</label>
          <input value={linea.pctDesc} onChange={(e) => onChange({ ...linea, pctDesc: e.target.value })}
            type="number" min="0" max="100" step="0.01" placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5 text-center"/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Tarifa IVA</label>
          <select value={linea.codigoIVA} onChange={(e) => onChange({ ...linea, codigoIVA: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-0.5">
            {TIPOS_IVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {/* Totales */}
      <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
        <span>IVA: {fmtMoney(l.montoIVA, "CRC")}</span>
        <span className="font-bold text-slate-800 text-sm">Total: {fmtMoney(l.total, "CRC")}</span>
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
  const [enviada,    setEnviada]    = useState(null); // factura recién enviada
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
          setCliente((p) => ({ ...p, nombre: data.nombre, tipo }));
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
  const subtotal   = lineasCalc.reduce((s, l) => s + l.subTotal, 0);
  const totalDesc  = lineasCalc.reduce((s, l) => s + l.montoDesc, 0);
  const totalIVA   = lineasCalc.reduce((s, l) => s + l.montoIVA, 0);
  const totalFact  = lineasCalc.reduce((s, l) => s + l.total, 0);

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

  // ── Asiento contable automático por factura ──────────────────────────────
  const crearAsientoFactura = async (factura) => {
    try {
      const asientos = await db.getAsientos();
      const num  = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
      const sub  = parseFloat(factura.subtotal  || 0);
      const iva  = parseFloat(factura.totalIVA  || 0);
      const tot  = parseFloat(factura.total     || 0);
      if (tot <= 0) return;

      const lineas = [];
      if (factura.condPago === "02") {
        lineas.push({ cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar", debe: tot, haber: 0 });
      } else {
        lineas.push({ cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",    debe: tot, haber: 0 });
      }
      if (sub > 0) lineas.push({ cuentaCodigo: "4101", cuentaNombre: "Ingresos por ventas", debe: 0, haber: sub });
      if (iva > 0) lineas.push({ cuentaCodigo: "2301", cuentaNombre: "IVA por pagar",       debe: 0, haber: iva });

      const totalDebe  = lineas.reduce((s, l) => s + l.debe,  0);
      const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
      if (Math.abs(totalDebe - totalHaber) > 0.02) return;

      await db.setAsientos([...asientos, {
        id: genId(), numero: num, estado: "confirmado", autoGenerado: true,
        descripcion: `Factura ${factura.numero} — ${factura.cliente?.nombre || "Consumidor Final"}`,
        fecha: factura.fecha, totalDebe, totalHaber, lineas,
        facturaRef: factura.numero, creadoEn: new Date().toISOString(),
      }]);
    } catch (e) {
      console.warn("[Facturacion] No se pudo crear asiento:", e.message);
    }
  };

  const guardarLocal = async (factura) => {
    const all = await db.getFacturas();
    await db.setFacturas([...all, factura]);

    // ── Conexiones lógicas ───────────────────────────────────────────────────
    // 1. Reducir inventario por los productos vendidos
    await reducirInventario(factura.lineas);

    // 2. Si es a crédito (condPago "02"), crear CXC + evento calendario
    if (factura.condPago === "02") {
      await crearCXC({
        cliente:    factura.cliente,
        total:      factura.total,
        moneda:     factura.moneda,
        plazo:      factura.plazo || 30,
        facturaRef: factura.numero,
        token:      authToken,
      });
    }

    // 3. Asiento contable automático
    await crearAsientoFactura(factura);

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
      plazo: condPago === "02" ? parseInt(plazo) || 30 : 0,
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
      creadoEn: new Date().toISOString(),
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
    setSending(true);
    try {
      const res = await fetch(`${BACKEND}/api/facturas/emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, empresaId: settings.empresaId }),
      });
      const json = await res.json();
      const estado = json.ok ? "aceptada" : "pendiente";
      const guardada = { ...f, estado, haciendaRes: json };
      await guardarLocal(guardada);
      setEnviada(guardada);
      resetForm();
    } catch (err) {
      // Si falla la conexión, guardar como pendiente para reenvío
      const guardada = { ...f, estado: "pendiente", error: err.message };
      await guardarLocal(guardada);
      setEnviada(guardada);
      alert(`Guardada localmente. Se enviará cuando haya conexión.\n${err.message}`);
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
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 fade-in">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${enviada.estado === "aceptada" ? "bg-green-100" : "bg-amber-100"}`}>
          {enviada.estado === "aceptada" ? "✓" : "⏳"}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900">{enviada.numero}</h2>
          <p className="text-slate-500 mt-1">
            {enviada.estado === "aceptada" ? "Enviada a Hacienda exitosamente" :
             enviada.estado === "guardada" ? "Guardada como borrador" :
             "Guardada — pendiente de envío"}
          </p>
          <p className="text-2xl font-black text-emerald-700 mt-3">{fmtMoney(enviada.total, enviada.moneda)}</p>
        </div>

        {/* QR de SINPE */}
        <div className="flex flex-col items-center gap-1 border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
          <SinpeQR
            telefono={settings?.sinpe || settings?.telefono || "8302-6613"}
            monto={enviada.totalGeneral || enviada.total}
            descripcion={enviada.numero}
            size={130}
          />
          <p className="text-xs text-slate-400 mt-1">Escaneá para pagar por SINPE Móvil</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => imprimirFactura(enviada)}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 px-5 py-2 rounded-lg font-semibold hover:bg-gray-50">
            <Printer size={15}/> Imprimir / PDF
          </button>
          <button onClick={() => setEnviada(null)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-700">
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
    <div className="flex flex-col h-full">

      {/* ── TOOLBAR OSCURO ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 shrink-0">
        <button onClick={handleGuardar} disabled={sending}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Save size={13}/> Guardar
        </button>
        <button onClick={handleEnviar} disabled={sending || totalFact === 0}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          {sending ? <span className="animate-spin text-xs">⏳</span> : <Send size={13}/>}
          {sending ? "Enviando…" : "Emitir"}
        </button>
        <button onClick={resetForm}
          className="flex items-center gap-1.5 border border-slate-500 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13}/> Nueva
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        {/* Totales en toolbar — siempre visibles */}
        <div className="flex items-center gap-3 text-xs">
          {totalDesc > 0 && <span className="text-red-300">Desc: −{fmtMoney(totalDesc, moneda)}</span>}
          <span className="text-slate-300">IVA: {fmtMoney(totalIVA, moneda)}</span>
          <span className="text-white font-black text-sm">{fmtMoney(totalFact, moneda)}</span>
        </div>
        {/* Badge situación fiscal (si está disponible) */}
        {situacionFiscal && (
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            situacionFiscal.moroso === "SI" || situacionFiscal.omiso === "SI"
              ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
            {situacionFiscal.moroso === "SI" ? "⚠ Moroso" : situacionFiscal.omiso === "SI" ? "⚠ Omiso" : "✓ Al día"}
          </span>
        )}
      </div>

      {/* ── TAB BAR — solo móvil/iPad ────────────────────────────────────── */}
      <div className="xl:hidden flex shrink-0 bg-white border-b border-gray-200">
        {["encabezado","lineas"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize
              ${activeTab === t ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400"}`}>
            {t === "lineas" ? `Líneas (${lineas.length})` : "Encabezado"}
          </button>
        ))}
      </div>

      {/* ── BODY — 3 columnas en desktop, tabs en móvil ─────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ PANEL IZQUIERDO: Encabezado (desktop fijo, móvil tab) ════════ */}
        <div className={`
          xl:flex xl:flex-col xl:w-72 xl:shrink-0 xl:border-r xl:border-slate-200 xl:bg-slate-50 xl:overflow-y-auto
          ${activeTab === "encabezado" ? "flex flex-col flex-1 overflow-y-auto bg-white" : "hidden xl:flex"}
        `}>
          <div className="px-3 py-3 space-y-3">

            {/* Cliente */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente</label>
              <div className="relative">
                <input value={busqCliente}
                  onChange={(e) => { setBusqCliente(e.target.value); setCliente((p) => ({ ...p, nombre: e.target.value })); setShowClientes(true); }}
                  onFocus={() => setShowClientes(true)}
                  onBlur={() => setTimeout(() => setShowClientes(false), 150)}
                  placeholder="Nombre, código CLI-XXXX…"
                  autoComplete="off"
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"/>
                {showClientes && clientesFiltrados.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded shadow-lg z-20 max-h-40 overflow-auto">
                    {clientesFiltrados.map((c) => (
                      <button key={c.id} onMouseDown={() => {
                        setCliente({ nombre: c.nombre, cedula: c.cedula || "", email: c.email || "", tipo: c.tipoCedula || "01", dias_credito: c.dias_credito || 0 });
                        setBusqCliente(c.nombre); setShowClientes(false);
                        if (c.dias_credito > 0) { setCondPago("02"); setPlazo(String(c.dias_credito)); }
                      }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 border-b last:border-0">
                        {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 rounded mr-1">{c.codigoCliente}</span>}
                        <span className="font-semibold">{c.nombre}</span>
                        <span className="text-slate-400 ml-1.5 text-[10px]">{c.cedula}</span>
                        {c.dias_credito > 0 && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">{c.dias_credito}d</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cédula */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cédula / ID</label>
              <div className="flex gap-1">
                <select value={cliente.tipo} onChange={(e) => setCliente((p) => ({ ...p, tipo: e.target.value }))}
                  className="w-20 border border-slate-200 rounded px-1.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  <option value="01">Física</option><option value="02">Jurídica</option>
                  <option value="03">DIMEX</option><option value="04">NITE</option>
                </select>
                <input value={cliente.cedula}
                  onChange={(e) => { setCliente((p) => ({ ...p, cedula: e.target.value })); setCedulaError(""); setSituacionFiscal(null); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarPorCedula()}
                  placeholder="Número…"
                  className="flex-1 border border-slate-200 rounded-l px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
                <button onClick={buscarPorCedula} disabled={buscandoCedula || !cliente.cedula.trim()}
                  className="flex items-center justify-center w-8 border border-slate-200 rounded-r bg-slate-100 hover:bg-emerald-50 text-slate-500 disabled:opacity-40">
                  {buscandoCedula ? <Loader2 size={12} className="animate-spin"/> : <Search size={12}/>}
                </button>
              </div>
              {cedulaError && <p className="text-[10px] text-red-500 mt-0.5">{cedulaError}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo</label>
              <input value={cliente.email} onChange={(e) => setCliente((p) => ({ ...p, email: e.target.value }))}
                placeholder="cliente@empresa.com"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
            </div>

            <div className="border-t border-slate-200"/>

            {/* Tipo de documento */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de documento</label>
              <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Fecha + Moneda en fila */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha</label>
                <input type="date" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
              </div>
              <div className="w-20">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Moneda</label>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                  className="w-full border border-slate-200 rounded px-1.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  <option value="CRC">₡ CRC</option><option value="USD">$ USD</option>
                </select>
              </div>
            </div>

            {/* Condición + Medio pago */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Condición de pago</label>
              <select value={condPago} onChange={(e) => setCondPago(e.target.value)}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {CONDICIONES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {condPago === "02" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plazo (días)</label>
                <input type="number" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="30" min="1"
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de pago</label>
              <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {MEDIOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="border-t border-slate-200"/>

            {/* Vendedor */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendedor / Agente</label>
              <select value={cliente.vendedor || ""} onChange={(e) => setCliente((p) => ({ ...p, vendedor: e.target.value }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">— Sin asignar —</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.nombre}>{e.nombre}{e.puesto ? ` · ${e.puesto}` : ""}</option>
                ))}
              </select>
            </div>

            {/* Lista de precio */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lista de precio</label>
              <select value={cliente.listaPrecio || "normal"} onChange={(e) => setCliente((p) => ({ ...p, listaPrecio: e.target.value }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="normal">Normal</option>
                <option value="especial">Especial</option>
                <option value="superespecial">Superespecial</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </div>

            {/* Proyecto */}
            {proyectos.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Proyecto</label>
                <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
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
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-semibold py-3 rounded-xl hover:bg-emerald-50">
              <Plus size={15}/> Agregar línea
            </button>
          </div>
          {/* Desktop: tabla */}
          <div className="hidden xl:flex xl:flex-col flex-1">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase min-w-[200px]">Descripción</th>
                    <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-28">CABYS</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-16">Cant.</th>
                    <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-20">Unid.</th>
                    <th className="text-right px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-24">P. Unit.</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-16">Desc %</th>
                    <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-28">IVA</th>
                    <th className="text-right px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-24">Mto. IVA</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-28">Total</th>
                    <th className="w-6"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.map((l, i) => (
                    <LineaRow key={l.id} linea={l} productos={productos}
                      onChange={(v) => updateLinea(i, v)} onDelete={() => deleteLinea(i)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2">
              <button onClick={agregarLinea}
                className="flex items-center gap-2 text-emerald-700 text-sm font-semibold hover:text-emerald-900">
                <Plus size={14}/> Agregar línea
              </button>
            </div>
          </div>
        </div>

        {/* ═══ PANEL DERECHO: Totales + Notas (solo desktop) ════════════════ */}
        <div className="hidden xl:flex xl:flex-col xl:w-56 xl:shrink-0 xl:border-l xl:border-slate-200 xl:bg-white xl:overflow-y-auto">
          <div className="px-4 py-4 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Resumen</p>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal</span><span>{fmtMoney(subtotal, moneda)}</span>
            </div>
            {totalDesc > 0 && (
              <div className="flex justify-between text-xs text-red-500">
                <span>Descuentos</span><span>− {fmtMoney(totalDesc, moneda)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-600">
              <span>IVA</span><span>{fmtMoney(totalIVA, moneda)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2 mt-1">
              <span>TOTAL</span><span className="text-emerald-700">{fmtMoney(totalFact, moneda)}</span>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
                rows={4} placeholder="Notas, condiciones…"
                className="w-full border border-slate-200 rounded px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
            </div>

            {/* QR SINPE mini */}
            <div className="border-t border-slate-100 pt-3 flex flex-col items-center gap-1">
              <p className="text-[10px] text-slate-400">SINPE Móvil</p>
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
    </div>
  );
}
