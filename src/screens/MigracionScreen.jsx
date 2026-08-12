/**
 * MigracionScreen — Importar datos desde Excel o Hacienda ATV
 * Convierte empresas de otros sistemas a Organízalo en minutos.
 */
import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet, Download, Upload, CheckCircle, AlertTriangle,
  X, ChevronRight, Loader2, Globe, ArrowRight, RefreshCw,
  Users, Package, DollarSign, Receipt,
} from "lucide-react";
import db from "../utils/db";
import { genId, hoy } from "../utils/fmt";

const BACKEND = "https://organizalo-backend-production.up.railway.app";

// ── Definición de módulos ───────────────────────────────────────────────────

const MODULOS = [
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    desc: "Importa tu cartera de clientes y proveedores con sus datos de contacto y cédula.",
    columnas: ["nombre*", "cedula", "tipo (Física/Jurídica)", "telefono", "correo", "direccion", "notas"],
    ejemplo: [
      { "nombre*": "Ferretería El Clavo S.A.", cedula: "3-101-123456", "tipo (Física/Jurídica)": "Jurídica", telefono: "2222-3333", correo: "info@elclavo.cr", direccion: "San José, Escazú", notas: "" },
      { "nombre*": "Juan Pérez Rodríguez",    cedula: "1-0987-0654",  "tipo (Física/Jurídica)": "Física",   telefono: "8888-9999", correo: "juan@gmail.com",   direccion: "Heredia",          notas: "Cliente VIP" },
    ],
    mapear: (row) => ({
      id:        genId(),
      nombre:    row["nombre*"] || row["nombre"] || "",
      cedula:    row["cedula"] || "",
      tipo:      row["tipo (Física/Jurídica)"] || row["tipo"] || "Física",
      telefono:  row["telefono"] || "",
      correo:    row["correo"] || "",
      direccion: row["direccion"] || "",
      notas:     row["notas"] || "",
      creadoEn:  new Date().toISOString(),
    }),
    validar: (r) => !r.nombre ? "Nombre requerido" : null,
    guardar: async (items) => {
      const existing = await db.getContactos();
      const nombres = new Set(existing.map((x) => x.nombre?.toLowerCase()));
      const nuevos  = items.filter((x) => !nombres.has(x.nombre?.toLowerCase()));
      await db.setContactos([...existing, ...nuevos]);
      return { total: items.length, nuevos: nuevos.length, duplicados: items.length - nuevos.length };
    },
  },
  {
    id: "productos",
    label: "Productos",
    icon: Package,
    desc: "Importa tu catálogo de productos con precios, costos, CABYS y stock.",
    columnas: ["nombre*", "codigoInterno", "codigoCabys", "precio*", "costo", "stock", "stockMin", "unidad", "categoria"],
    ejemplo: [
      { "nombre*": "Pintura Látex Blanca", codigoInterno: "PINT-001", codigoCabys: "3210101010000", "precio*": 5800, costo: 3500, stock: 120, stockMin: 20, unidad: "L",     categoria: "Producto" },
      { "nombre*": "Instalación eléctrica", codigoInterno: "SRV-001", codigoCabys: "4310001010000", "precio*": 25000, costo: 0,  stock: 0,   stockMin: 0,  unidad: "Servicio", categoria: "Servicio" },
    ],
    mapear: (row) => ({
      id:            genId(),
      nombre:        row["nombre*"] || row["nombre"] || "",
      codigoInterno: row["codigoInterno"] || row["codigo"] || "",
      codigoCabys:   row["codigoCabys"] || row["cabys"] || "",
      precio:        parseFloat(row["precio*"] || row["precio"] || 0),
      costo:         parseFloat(row["costo"] || 0),
      stock:         parseFloat(row["stock"] || 0),
      stockMin:      parseFloat(row["stockMin"] || 0),
      unidad:        row["unidad"] || "Unid",
      categoria:     row["categoria"] || "Producto",
      activo:        true,
      creadoEn:      new Date().toISOString(),
    }),
    validar: (r) => !r.nombre ? "Nombre requerido" : isNaN(r.precio) ? "Precio inválido" : null,
    guardar: async (items) => {
      const existing = await db.getProductos();
      const codigos  = new Set(existing.map((x) => x.codigoInterno).filter(Boolean));
      const nuevos   = items.filter((x) => !x.codigoInterno || !codigos.has(x.codigoInterno));
      await db.setProductos([...existing, ...nuevos]);
      return { total: items.length, nuevos: nuevos.length, duplicados: items.length - nuevos.length };
    },
  },
  {
    id: "cxc",
    label: "CXC",
    icon: DollarSign,
    desc: "Importa tus cuentas por cobrar pendientes — saldos que clientes aún te deben.",
    columnas: ["nombre* (cliente)", "total*", "pagado", "fechaVencimiento (AAAA-MM-DD)", "moneda (CRC/USD)", "notas"],
    ejemplo: [
      { "nombre* (cliente)": "Ferretería El Clavo", "total*": 350000, pagado: 100000, "fechaVencimiento (AAAA-MM-DD)": "2026-09-30", "moneda (CRC/USD)": "CRC", notas: "Factura FE-00123" },
      { "nombre* (cliente)": "Juan Pérez",          "total*": 1200,   pagado: 0,      "fechaVencimiento (AAAA-MM-DD)": "2026-08-15", "moneda (CRC/USD)": "USD", notas: "" },
    ],
    mapear: (row) => ({
      id:              genId(),
      nombre:          row["nombre* (cliente)"] || row["nombre"] || row["cliente"] || "",
      total:           parseFloat(row["total*"] || row["total"] || 0),
      pagado:          parseFloat(row["pagado"] || 0),
      fechaVencimiento:row["fechaVencimiento (AAAA-MM-DD)"] || row["vencimiento"] || "",
      moneda:          row["moneda (CRC/USD)"] || row["moneda"] || "CRC",
      notas:           row["notas"] || "",
      tipo:            "cobrar",
      creadoEn:        new Date().toISOString(),
    }),
    validar: (r) => !r.nombre ? "Cliente requerido" : isNaN(r.total) || r.total <= 0 ? "Total inválido" : null,
    guardar: async (items) => {
      const existing = await db.getDebts();
      await db.setDebts([...existing, ...items]);
      return { total: items.length, nuevos: items.length, duplicados: 0 };
    },
  },
  {
    id: "recibos",
    label: "Recibos",
    icon: Receipt,
    desc: "Importa pagos recibidos históricamente — ingresos de caja de períodos anteriores.",
    columnas: ["cliente*", "monto*", "fecha (AAAA-MM-DD)", "metodo (Efectivo/SINPE Móvil/Transferencia/Tarjeta)", "moneda (CRC/USD)", "concepto"],
    ejemplo: [
      { "cliente*": "Ferretería El Clavo", "monto*": 100000, "fecha (AAAA-MM-DD)": "2026-07-15", "metodo (Efectivo/SINPE Móvil/Transferencia/Tarjeta)": "SINPE Móvil", "moneda (CRC/USD)": "CRC", concepto: "Abono factura julio" },
      { "cliente*": "Juan Pérez",          "monto*": 500,    "fecha (AAAA-MM-DD)": "2026-07-22", "metodo (Efectivo/SINPE Móvil/Transferencia/Tarjeta)": "Efectivo",    "moneda (CRC/USD)": "USD", concepto: "Pago consultoría" },
    ],
    mapear: (row, idx) => ({
      id:      genId(),
      numero:  `R-${String(idx + 1).padStart(5, "0")}`,
      cliente: row["cliente*"] || row["cliente"] || "",
      monto:   parseFloat(row["monto*"] || row["monto"] || 0),
      fecha:   row["fecha (AAAA-MM-DD)"] || row["fecha"] || hoy(),
      metodo:  row["metodo (Efectivo/SINPE Móvil/Transferencia/Tarjeta)"] || row["metodo"] || "Efectivo",
      moneda:  row["moneda (CRC/USD)"] || row["moneda"] || "CRC",
      concepto:row["concepto"] || "",
      tipo:    "Caja",
      creadoEn:new Date().toISOString(),
    }),
    validar: (r) => !r.cliente ? "Cliente requerido" : isNaN(r.monto) || r.monto <= 0 ? "Monto inválido" : null,
    guardar: async (items) => {
      const existing = await db.getRecibos();
      const offset   = existing.length;
      const conNumero = items.map((r, i) => ({ ...r, numero: `R-${String(offset + i + 1).padStart(5, "0")}` }));
      await db.setRecibos([...existing, ...conNumero]);
      return { total: items.length, nuevos: items.length, duplicados: 0 };
    },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function descargarPlantilla(modulo) {
  const encabezado = modulo.columnas;
  const datos      = modulo.ejemplo.map((r) => encabezado.map((col) => r[col] ?? ""));
  const ws         = XLSX.utils.aoa_to_sheet([encabezado, ...datos]);
  ws["!cols"]      = encabezado.map(() => ({ wch: 24 }));
  const wb         = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, modulo.label);
  XLSX.writeFile(wb, `plantilla_${modulo.id}.xlsx`);
}

function leerExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Componente ImportarExcel ────────────────────────────────────────────────

function ImportarExcel() {
  const [moduloId, setModuloId] = useState("clientes");
  const [filas,    setFilas]    = useState(null);   // null | []
  const [errors,   setErrors]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [resultado,setResultado]= useState(null);
  const inputRef = useRef();

  const modulo = MODULOS.find((m) => m.id === moduloId);

  const cambiarModulo = (id) => {
    setModuloId(id);
    setFilas(null);
    setErrors([]);
    setResultado(null);
  };

  const onFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultado(null);
    try {
      const rows   = await leerExcel(file);
      const mapped = rows.map((r, i) => modulo.mapear(r, i));
      const errs   = mapped.map((r) => modulo.validar(r));
      setFilas(mapped);
      setErrors(errs);
    } catch { alert("No se pudo leer el archivo. Asegurate de que sea un .xlsx válido."); }
    e.target.value = "";
  }, [modulo]);

  const confirmar = async () => {
    if (!filas?.length) return;
    setLoading(true);
    try {
      const validas  = filas.filter((_, i) => !errors[i]);
      const res      = await modulo.guardar(validas);
      setResultado(res);
      setFilas(null);
      setErrors([]);
    } catch (err) { alert("Error al guardar: " + err.message); }
    setLoading(false);
  };

  const errCount   = errors.filter(Boolean).length;
  const validCount = filas ? filas.length - errCount : 0;

  return (
    <div className="space-y-6">
      {/* Selector de módulo */}
      <div className="flex gap-2 flex-wrap">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            onClick={() => cambiarModulo(m.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${moduloId === m.id
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Card del módulo */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">{modulo.label}</h3>
            <p className="text-sm text-slate-500 max-w-lg">{modulo.desc}</p>
          </div>
          <button
            onClick={() => descargarPlantilla(modulo)}
            className="flex items-center gap-2 shrink-0 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download size={14} /> Descargar plantilla
          </button>
        </div>

        {/* Columnas */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {modulo.columnas.map((col) => (
            <span key={col}
              className={`px-2 py-0.5 rounded text-xs font-mono
                ${col.includes("*") ? "bg-blue-50 text-blue-700 font-bold" : "bg-slate-100 text-slate-500"}`}>
              {col}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Los campos en <span className="text-blue-600 font-bold">azul</span> son obligatorios.</p>

        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className="mt-5 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <Upload size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Arrastrá o hacé clic para subir tu Excel</p>
          <p className="text-xs text-slate-400 mt-1">Formato .xlsx — máx. 5000 filas</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
        </div>
      </div>

      {/* Preview + validación */}
      {filas && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Header preview */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">
              {filas.length} filas leídas
            </span>
            {errCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> {errCount} con errores (se omitirán)
              </span>
            )}
            {validCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle size={11} /> {validCount} válidas
              </span>
            )}
            <span className="flex-1" />
            <button onClick={() => { setFilas(null); setErrors([]); }} className="text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>

          {/* Table preview (primeras 10) */}
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="table-base text-xs w-full">
              <thead>
                <tr>
                  <th className="w-6">#</th>
                  {Object.keys(filas[0] || {}).filter((k) => k !== "id" && k !== "creadoEn" && k !== "tipo" && k !== "activo").slice(0, 6).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 10).map((row, i) => (
                  <tr key={i} className={errors[i] ? "bg-red-50" : ""}>
                    <td className="text-slate-400">{i + 1}</td>
                    {Object.entries(row).filter(([k]) => k !== "id" && k !== "creadoEn" && k !== "tipo" && k !== "activo" && k !== "numero").slice(0, 6).map(([k, v]) => (
                      <td key={k} className="truncate max-w-[120px]">{String(v)}</td>
                    ))}
                    <td>
                      {errors[i]
                        ? <span className="text-red-600 font-semibold">{errors[i]}</span>
                        : <span className="text-green-700">✓</span>}
                    </td>
                  </tr>
                ))}
                {filas.length > 10 && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-2">... y {filas.length - 10} filas más</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Botón confirmar */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Se importarán <strong className="text-slate-900">{validCount}</strong> {modulo.label.toLowerCase()} válidos.
              {errCount > 0 && ` Las ${errCount} con errores se omitirán.`}
            </p>
            <button
              onClick={confirmar}
              disabled={loading || validCount === 0}
              className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Confirmar importación
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl p-5">
          <CheckCircle size={24} className="text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">¡Importación exitosa!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {resultado.nuevos} {modulo.label.toLowerCase()} importados.
              {resultado.duplicados > 0 && ` ${resultado.duplicados} omitidos (ya existían).`}
            </p>
          </div>
          <button onClick={() => setResultado(null)} className="ml-auto text-green-500 hover:text-green-700">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Componente ImportarHacienda ─────────────────────────────────────────────

function ImportarHacienda() {
  const [form,     setForm]     = useState({ usuario: "", password: "", desde: "2024-01-01", hasta: hoy() });
  const [loading,  setLoading]  = useState(false);
  const [resultado,setResultado]= useState(null);
  const [error,    setError]    = useState("");
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const importar = async () => {
    if (!form.usuario || !form.password) { setError("Usuario y contraseña requeridos."); return; }
    setError("");
    setLoading(true);
    setResultado(null);
    try {
      const res = await fetch(`${BACKEND}/api/hacienda/import-atv`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Guardar lo que llegó
      if (data.contactos?.length) {
        const existing = await db.getContactos();
        const nombres  = new Set(existing.map((x) => x.nombre?.toLowerCase()));
        const nuevos   = data.contactos.filter((x) => !nombres.has(x.nombre?.toLowerCase()));
        await db.setContactos([...existing, ...nuevos]);
      }
      if (data.facturas?.length) {
        const existing = await db.getFacturas();
        const ids = new Set(existing.map((x) => x.clave));
        const nuevas = data.facturas.filter((x) => !ids.has(x.clave));
        await db.setFacturas([...existing, ...nuevas]);
      }
      if (data.debts?.length) {
        const existing = await db.getDebts();
        await db.setDebts([...existing, ...data.debts]);
      }

      setResultado(data.resumen || {
        facturas:  data.facturas?.length  || 0,
        contactos: data.contactos?.length || 0,
      });
    } catch (err) {
      setError(err.message || "Error conectando con Hacienda. Verificá las credenciales.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Explicación */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex gap-3">
          <Globe size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 text-sm">¿Qué importa desde Hacienda?</p>
            <p className="text-sm text-blue-700 mt-1">
              Con tus credenciales de ATV (Administración Tributaria Virtual) jala automáticamente
              todas tus facturas electrónicas emitidas y recibidas, crea los clientes/proveedores
              y genera el historial de CXC — sin escribir nada a mano.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-900">Credenciales ATV de Hacienda</h3>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Usuario ATV *</span>
            <input value={form.usuario} onChange={(e) => u("usuario", e.target.value)}
              placeholder="cédula o usuario"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Contraseña ATV *</span>
            <input type="password" value={form.password} onChange={(e) => u("password", e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Desde</span>
            <input type="date" value={form.desde} onChange={(e) => u("desde", e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Hasta</span>
            <input type="date" value={form.hasta} onChange={(e) => u("hasta", e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={importar}
          disabled={loading}
          className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Conectando con Hacienda…</>
            : <><RefreshCw size={14} /> Importar desde Hacienda</>}
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl p-5">
          <CheckCircle size={24} className="text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">¡Importación desde Hacienda exitosa!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {resultado.facturas} facturas · {resultado.contactos} clientes/proveedores importados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen principal ────────────────────────────────────────────────────────

const TABS = [
  { id: "excel",    label: "Importar Excel",          icon: FileSpreadsheet },
  { id: "hacienda", label: "Importar desde Hacienda", icon: Globe },
];

export default function MigracionScreen() {
  const [tab, setTab] = useState("excel");

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Hero */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-3xl">
          <h1 className="text-xl font-bold text-slate-900">Importar datos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Migrá desde cualquier sistema en minutos. Descargá una plantilla Excel, pegá tus datos y confirmá —
            o conectá tu ATV de Hacienda y jalamos todo automáticamente.
          </p>
        </div>

        {/* Pasos */}
        <div className="flex items-center gap-3 mt-5 text-xs text-slate-500">
          {["Elegí el módulo", "Descargá la plantilla", "Pegá tus datos", "Subí y confirmá"].map((s, i) => (
            <React.Fragment key={s}>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                {s}
              </span>
              {i < 3 && <ChevronRight size={12} className="text-slate-300" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-8 pt-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors
              ${tab === t.id
                ? "border-slate-800 text-slate-900 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-8 pb-8 pt-4">
        {tab === "excel"    && <ImportarExcel />}
        {tab === "hacienda" && <ImportarHacienda />}
      </div>
    </div>
  );
}
