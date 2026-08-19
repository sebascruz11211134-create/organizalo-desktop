/**
 * KardexScreen — Historial de movimientos de inventario por producto
 * Entradas: compras, ajuste manual
 * Salidas:  facturas, POS, órdenes de trabajo, ajuste manual
 */
import React, { useState, useEffect, useCallback } from "react";
import { Package, Search, Printer, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function mesActual() { return new Date().toISOString().slice(0, 7); }

function buildKardex(producto, facturas, compras, ordenes, settings) {
  const movs = [];

  // ── Entradas desde Compras ────────────────────────────────────────────────
  compras.forEach(c => {
    (c.lineas || []).forEach(l => {
      const nombre = (l.nombre || l.producto || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:  (c.fecha || c.creadoEn || "").slice(0,10),
          tipo:   "Entrada",
          origen: "Compra",
          ref:    c.numeroFactura || c.numero || "—",
          detalle: c.proveedor || "Proveedor",
          cant:   parseFloat(l.cantidad || 1),
          costo:  parseFloat(l.precio || l.precioUnit || 0),
        });
      }
    });
    // Compra sin líneas pero con nombre que coincide (legacy)
    if (!c.lineas || c.lineas.length === 0) {
      const prov = (c.proveedor || "").toLowerCase();
      if (prov.includes((producto.nombre||"").toLowerCase().slice(0,5))) {
        movs.push({
          fecha:  (c.fecha || c.creadoEn || "").slice(0,10),
          tipo:   "Entrada", origen: "Compra",
          ref:    c.numero || "—", detalle: c.proveedor || "",
          cant: 1, costo: 0,
        });
      }
    }
  });

  // ── Salidas desde Facturas ────────────────────────────────────────────────
  facturas.forEach(f => {
    (f.lineas || f.items || []).forEach(l => {
      const nombre = (l.nombre || l.producto || l.descripcion || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:  (f.fecha || f.creadoEn || "").slice(0,10),
          tipo:   "Salida",
          origen: "Factura",
          ref:    f.numero || f.numeroConsecutivo || "—",
          detalle: f.clienteNombre || f.cliente?.nombre || "Cliente",
          cant:   parseFloat(l.cantidad || 1),
          costo:  parseFloat(l.precio || l.precioUnit || l.precioUnitario || 0),
        });
      }
    });
  });

  // ── Salidas desde Órdenes de Trabajo ─────────────────────────────────────
  ordenes.forEach(o => {
    (o.repuestos || []).forEach(r => {
      const nombre = (r.nombre || r.producto || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:  (o.fecha || o.creadoEn || "").slice(0,10),
          tipo:   "Salida",
          origen: "Orden Trabajo",
          ref:    o.numero || "—",
          detalle: o.cliente || "—",
          cant:   parseFloat(r.cantidad || 1),
          costo:  parseFloat(r.precio || 0),
        });
      }
    });
  });

  // Ordenar por fecha
  movs.sort((a,b) => a.fecha.localeCompare(b.fecha));

  // Calcular saldo acumulado
  let saldo = parseFloat(producto.stockInicial || 0);
  return movs.map(m => {
    if (m.tipo === "Entrada") saldo += m.cant;
    else saldo -= m.cant;
    return { ...m, saldo };
  });
}

export default function KardexScreen() {
  const [productos,  setProductos]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [ordenes,    setOrdenes]    = useState([]);
  const [settings,   setSettings]   = useState({});
  const [busq,       setBusq]       = useState("");
  const [selected,   setSelected]   = useState(null);
  const [desde,      setDesde]      = useState(mesActual() + "-01");
  const [hasta,      setHasta]      = useState(hoy());

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [p, f, c, o, s] = await Promise.all([
      db.getProductos(), db.getFacturas(), db.getCompras(), db.getOrdenes(), db.getSettings(),
    ]);
    setProductos(p);
    setFacturas(f);
    setCompras(c);
    setOrdenes(o);
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = productos.filter(p =>
    !busq.trim() || (p.nombre||"").toLowerCase().includes(busq.toLowerCase())
  );

  const producto = selected ? productos.find(p => p.id === selected) : null;
  const movimientos = producto
    ? buildKardex(producto, facturas, compras, ordenes, settings)
        .filter(m => m.fecha >= desde && m.fecha <= hasta)
    : [];

  const totalEntradas = movimientos.filter(m => m.tipo==="Entrada").reduce((s,m) => s+m.cant, 0);
  const totalSalidas  = movimientos.filter(m => m.tipo==="Salida").reduce((s,m) => s+m.cant, 0);

  const exportar = () => {
    const rows = movimientos.map(m => ({
      Fecha: fmtDate(m.fecha), Tipo: m.tipo, Origen: m.origen,
      Referencia: m.ref, Detalle: m.detalle,
      Cantidad: m.tipo==="Entrada" ? `+${m.cant}` : `-${m.cant}`,
      "Saldo": m.saldo,
    }));
    exportExcel(rows, `kardex-${producto?.nombre?.replace(/\s/g,"-")}`);
  };

  return (
    <div className="flex h-full">
      {/* Panel izquierdo: lista de productos */}
      <div className="w-64 border-r border-slate-200 flex flex-col bg-white shrink-0">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
            <Search size={13} className="text-slate-400"/>
            <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto…"
              className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Sin productos</p>}
          {filtrados.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                ${selected===p.id ? "bg-emerald-50 border-l-2 border-l-emerald-600" : ""}`}>
              <p className="text-xs font-semibold text-slate-800 truncate">{p.nombre}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Stock: {p.stock ?? "—"} {p.unidad||""}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho: kardex */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
          <Package size={13} className="text-emerald-400"/>
          <span className="text-white text-xs font-semibold">
            {producto ? producto.nombre : "Seleccioná un producto"}
          </span>
          {producto && <>
            <div className="w-px h-5 bg-slate-500 mx-1"/>
            <label className="text-slate-300 text-xs">Desde:</label>
            <input type="date" value={desde} onChange={e=>setDesde(e.target.value)}
              className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
            <label className="text-slate-300 text-xs">Hasta:</label>
            <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}
              className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
            <div className="flex-1"/>
            <button onClick={exportar} className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
              <FileSpreadsheet size={13}/> Excel
            </button>
          </>}
        </div>

        {!producto ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Package size={40} className="mx-auto mb-3 text-slate-200"/>
              <p className="text-sm">Seleccioná un producto del panel izquierdo</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border-b border-slate-200">
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Entradas</p>
                <p className="text-xl font-bold text-emerald-700">+{totalEntradas}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Salidas</p>
                <p className="text-xl font-bold text-rose-600">-{totalSalidas}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Stock actual</p>
                <p className="text-xl font-bold text-slate-800">{producto.stock ?? "—"}</p>
              </div>
            </div>

            {/* Tabla */}
            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto">
                <table className="table-base w-full">
                  <thead><tr>
                    <th>Fecha</th><th>Tipo</th><th>Origen</th><th>Referencia</th>
                    <th>Detalle</th><th className="text-right">Cantidad</th><th className="text-right">Saldo</th>
                  </tr></thead>
                  <tbody>
                    {movimientos.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-10">
                        Sin movimientos en el período seleccionado
                      </td></tr>
                    )}
                    {movimientos.map((m,i) => (
                      <tr key={i}>
                        <td>{fmtDate(m.fecha)}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                            ${m.tipo==="Entrada"?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="text-slate-500 text-xs">{m.origen}</td>
                        <td className="font-mono text-xs">{m.ref}</td>
                        <td className="text-slate-600 max-w-[160px] truncate">{m.detalle}</td>
                        <td className={`text-right font-bold ${m.tipo==="Entrada"?"text-emerald-700":"text-rose-600"}`}>
                          {m.tipo==="Entrada"?"+":"-"}{m.cant}
                        </td>
                        <td className="text-right font-semibold">{m.saldo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
