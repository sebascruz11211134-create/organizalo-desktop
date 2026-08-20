/**
 * KardexScreen — Historial de movimientos de inventario por producto
 * Entradas: compras, ajuste manual
 * Salidas:  facturas, POS, órdenes de trabajo, ajuste manual
 * Ajuste:   corrección directa de stock
 */
import React, { useState, useEffect, useCallback } from "react";
import { Package, Search, FileSpreadsheet, Plus, X, ChevronDown } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtDate, hoy, genId } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function mesActual() { return new Date().toISOString().slice(0, 7); }

const MOTIVOS = {
  Entrada: ["Compra directa", "Devolución de cliente", "Ajuste inicial de stock", "Donación / regalo", "Producción propia", "Otro"],
  Salida:  ["Merma / daño", "Muestra / regalo", "Consumo interno", "Robo / pérdida", "Vencimiento", "Otro"],
  Ajuste:  ["Corrección de inventario", "Conteo físico", "Error de sistema", "Otro"],
};

function buildKardex(producto, facturas, compras, ordenes, manuales) {
  const movs = [];

  // ── Entradas desde Compras ────────────────────────────────────────────────
  compras.forEach(c => {
    (c.lineas || []).forEach(l => {
      const nombre    = (l.nombre || l.producto || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:   (c.fecha || c.creadoEn || "").slice(0, 10),
          tipo:    "Entrada",
          origen:  "Compra",
          ref:     c.numeroFactura || c.numero || "—",
          detalle: c.proveedor || "Proveedor",
          cant:    parseFloat(l.cantidad || 1),
        });
      }
    });
  });

  // ── Salidas desde Facturas ────────────────────────────────────────────────
  facturas.forEach(f => {
    (f.lineas || f.items || []).forEach(l => {
      const nombre    = (l.nombre || l.producto || l.descripcion || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:   (f.fecha || f.creadoEn || "").slice(0, 10),
          tipo:    "Salida",
          origen:  "Factura",
          ref:     f.numero || f.numeroConsecutivo || "—",
          detalle: f.clienteNombre || f.cliente?.nombre || "Cliente",
          cant:    parseFloat(l.cantidad || 1),
        });
      }
    });
  });

  // ── Salidas desde Órdenes de Trabajo ─────────────────────────────────────
  ordenes.forEach(o => {
    (o.repuestos || []).forEach(r => {
      const nombre    = (r.nombre || r.producto || "").toLowerCase().trim();
      const prodNombre = (producto.nombre || "").toLowerCase().trim();
      if (nombre && prodNombre && (nombre.includes(prodNombre) || prodNombre.includes(nombre))) {
        movs.push({
          fecha:   (o.fecha || o.creadoEn || "").slice(0, 10),
          tipo:    "Salida",
          origen:  "Orden Trabajo",
          ref:     o.numero || "—",
          detalle: o.cliente || "—",
          cant:    parseFloat(r.cantidad || 1),
        });
      }
    });
  });

  // ── Movimientos manuales ──────────────────────────────────────────────────
  manuales
    .filter(m => m.productoId === producto.id)
    .forEach(m => {
      movs.push({
        fecha:   m.fecha,
        tipo:    m.tipo,
        origen:  "Manual",
        ref:     m.id.slice(0, 8).toUpperCase(),
        detalle: m.motivo + (m.nota ? ` — ${m.nota}` : ""),
        cant:    parseFloat(m.cantidad),
        esAjuste: m.tipo === "Ajuste",
        stockFinal: m.tipo === "Ajuste" ? parseFloat(m.stockFinal) : undefined,
      });
    });

  // Ordenar por fecha
  movs.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Calcular saldo acumulado
  let saldo = parseFloat(producto.stockInicial || producto.stock || 0);
  return movs.map(m => {
    if (m.esAjuste) {
      saldo = m.stockFinal;
    } else if (m.tipo === "Entrada") {
      saldo += m.cant;
    } else {
      saldo -= m.cant;
    }
    return { ...m, saldo };
  });
}

// ── Modal de nuevo movimiento ─────────────────────────────────────────────────
function ModalMovimiento({ productos, onClose, onGuardar }) {
  const [tipo,       setTipo]       = useState("Entrada");
  const [busqProd,   setBusqProd]   = useState("");
  const [showDrop,   setShowDrop]   = useState(false);
  const [prodSel,    setProdSel]    = useState(null);
  const [cantidad,   setCantidad]   = useState("");
  const [stockFinal, setStockFinal] = useState("");
  const [motivo,     setMotivo]     = useState(MOTIVOS["Entrada"][0]);
  const [nota,       setNota]       = useState("");
  const [fecha,      setFecha]      = useState(hoy());
  const [guardando,  setGuardando]  = useState(false);

  const filtrados = productos.filter(p =>
    !busqProd.trim() || (p.nombre || "").toLowerCase().includes(busqProd.toLowerCase())
  ).slice(0, 6);

  const seleccionar = (p) => {
    setProdSel(p);
    setBusqProd(p.nombre);
    setShowDrop(false);
    if (tipo === "Ajuste") setStockFinal(String(p.stock ?? ""));
  };

  const handleTipo = (t) => {
    setTipo(t);
    setMotivo(MOTIVOS[t][0]);
    if (t === "Ajuste" && prodSel) setStockFinal(String(prodSel.stock ?? ""));
  };

  const handleGuardar = async () => {
    if (!prodSel) return alert("Seleccioná un producto");
    if (tipo !== "Ajuste" && (!cantidad || parseFloat(cantidad) <= 0))
      return alert("Ingresá una cantidad válida");
    if (tipo === "Ajuste" && stockFinal === "")
      return alert("Ingresá el stock final correcto");

    setGuardando(true);
    try {
      const mov = {
        id: genId(),
        productoId: prodSel.id,
        productoNombre: prodSel.nombre,
        tipo,
        fecha,
        cantidad: tipo === "Ajuste" ? Math.abs(parseFloat(stockFinal) - parseFloat(prodSel.stock ?? 0)) : parseFloat(cantidad),
        stockFinal: tipo === "Ajuste" ? parseFloat(stockFinal) : undefined,
        motivo,
        nota,
        creadoEn: new Date().toISOString(),
      };

      // Guardar el movimiento
      const todos = await db.getMovimientosInv();
      await db.setMovimientosInv([...todos, mov]);

      // Actualizar stock del producto
      const prods = await db.getProductos();
      const nuevoStock = tipo === "Entrada"
        ? (parseFloat(prodSel.stock ?? 0) + parseFloat(cantidad))
        : tipo === "Salida"
        ? (parseFloat(prodSel.stock ?? 0) - parseFloat(cantidad))
        : parseFloat(stockFinal);

      await db.setProductos(prods.map(p =>
        p.id === prodSel.id ? { ...p, stock: Math.max(0, nuevoStock) } : p
      ));

      onGuardar();
    } finally {
      setGuardando(false);
    }
  };

  const tipoColor = tipo === "Entrada" ? "bg-amber-500" : tipo === "Salida" ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={`${tipoColor} rounded-t-2xl px-5 py-4 flex items-center justify-between`}>
          <h2 className="text-white font-bold text-base">Nuevo movimiento de inventario</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {["Entrada", "Salida", "Ajuste"].map(t => (
                <button key={t} onClick={() => handleTipo(t)}
                  className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors
                    ${tipo === t
                      ? t === "Entrada" ? "border-amber-500 bg-amber-50 text-amber-700"
                        : t === "Salida" ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {tipo === "Entrada" ? "Sube el stock del producto" :
               tipo === "Salida"  ? "Baja el stock del producto" :
               "Establece el stock exacto (ideal para conteo físico)"}
            </p>
          </div>

          {/* Producto */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-500 uppercase">Producto</label>
            <input
              value={busqProd}
              onChange={e => { setBusqProd(e.target.value); setShowDrop(true); setProdSel(null); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Buscar producto…"
              className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {showDrop && filtrados.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-auto">
                {filtrados.map(p => (
                  <button key={p.id} onMouseDown={() => seleccionar(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 border-b border-gray-50 last:border-0">
                    <span className="font-semibold">{p.nombre}</span>
                    <span className="text-slate-400 ml-2">Stock: {p.stock ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cantidad / Stock final */}
          {tipo === "Ajuste" ? (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Stock final correcto</label>
              {prodSel && (
                <p className="text-[10px] text-slate-400">Stock actual: {prodSel.stock ?? "—"}</p>
              )}
              <input
                type="number" min="0" step="any" value={stockFinal}
                onChange={e => setStockFinal(e.target.value)}
                placeholder="Ej: 50"
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Cantidad</label>
              <input
                type="number" min="0.01" step="any" value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                placeholder="Ej: 10"
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {MOTIVOS[tipo].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Nota + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nota (opcional)</label>
              <input value={nota} onChange={e => setNota(e.target.value)}
                placeholder="Referencia, orden…"
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={guardando}
              className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${tipoColor}`}>
              {guardando ? "Guardando…" : "Guardar movimiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function KardexScreen() {
  const [productos,  setProductos]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [ordenes,    setOrdenes]    = useState([]);
  const [manuales,   setManuales]   = useState([]);
  const [busq,       setBusq]       = useState("");
  const [selected,   setSelected]   = useState(null);
  const [desde,      setDesde]      = useState(mesActual() + "-01");
  const [hasta,      setHasta]      = useState(hoy());
  const [showModal,  setShowModal]  = useState(false);

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [p, f, c, o, m] = await Promise.all([
      db.getProductos(), db.getFacturas(), db.getCompras(),
      db.getOrdenes(), db.getMovimientosInv(),
    ]);
    setProductos(p);
    setFacturas(f);
    setCompras(c);
    setOrdenes(o);
    setManuales(m);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = productos.filter(p =>
    !busq.trim() || (p.nombre || "").toLowerCase().includes(busq.toLowerCase())
  );

  const producto = selected ? productos.find(p => p.id === selected) : null;
  const movimientos = producto
    ? buildKardex(producto, facturas, compras, ordenes, manuales)
        .filter(m => m.fecha >= desde && m.fecha <= hasta)
    : [];

  const totalEntradas = movimientos.filter(m => m.tipo === "Entrada").reduce((s, m) => s + m.cant, 0);
  const totalSalidas  = movimientos.filter(m => m.tipo === "Salida").reduce((s, m) => s + m.cant, 0);

  const exportar = () => {
    const rows = movimientos.map(m => ({
      Fecha:      fmtDate(m.fecha),
      Tipo:       m.tipo,
      Origen:     m.origen,
      Referencia: m.ref,
      Detalle:    m.detalle,
      Cantidad:   m.tipo === "Entrada" ? `+${m.cant}` : m.tipo === "Ajuste" ? `=${m.saldo}` : `-${m.cant}`,
      Saldo:      m.saldo,
    }));
    exportExcel(rows, `kardex-${producto?.nombre?.replace(/\s/g, "-")}`);
  };

  return (
    <div className="flex h-full">
      {/* Panel izquierdo: lista de productos */}
      <div className="w-56 md:w-64 border-r border-slate-200 flex flex-col bg-white shrink-0">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
            <Search size={13} className="text-slate-400"/>
            <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar…"
              className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 && (
            <p className="text-center text-slate-400 text-xs py-8">Sin productos</p>
          )}
          {filtrados.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                ${selected === p.id ? "bg-amber-50 border-l-2 border-l-amber-600" : ""}`}>
              <p className="text-xs font-semibold text-slate-800 truncate">{p.nombre}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Stock: {p.stock ?? "—"} {p.unidad || ""}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 flex-wrap">
          <Package size={13} className="text-amber-400"/>
          <span className="text-white text-xs font-semibold">
            {producto ? producto.nombre : "Seleccioná un producto"}
          </span>
          {producto && (
            <>
              <div className="w-px h-5 bg-slate-500 mx-1"/>
              <label className="text-slate-300 text-xs">Desde:</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
              <label className="text-slate-300 text-xs">Hasta:</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
              <div className="flex-1"/>
              <button onClick={exportar}
                className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
                <FileSpreadsheet size={13}/> Excel
              </button>
            </>
          )}
          {!producto && <div className="flex-1"/>}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold">
            <Plus size={13}/> Movimiento
          </button>
        </div>

        {!producto ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Package size={40} className="mx-auto mb-3 text-slate-200"/>
              <p className="text-sm font-medium">Seleccioná un producto del panel izquierdo</p>
              <p className="text-xs text-slate-300 mt-1">o usá "+ Movimiento" para registrar una entrada, salida o ajuste</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border-b border-slate-200">
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Entradas</p>
                <p className="text-xl font-bold text-amber-700">+{totalEntradas}</p>
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
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Tipo</th><th>Origen</th>
                      <th>Referencia</th><th>Detalle</th>
                      <th className="text-right">Cantidad</th>
                      <th className="text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-10">
                        Sin movimientos en el período seleccionado
                      </td></tr>
                    )}
                    {movimientos.map((m, i) => (
                      <tr key={i}>
                        <td>{fmtDate(m.fecha)}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                            ${m.tipo === "Entrada" ? "bg-amber-100 text-amber-700"
                              : m.tipo === "Salida" ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="text-slate-500 text-xs">{m.origen}</td>
                        <td className="font-mono text-xs">{m.ref}</td>
                        <td className="text-slate-600 max-w-[160px] truncate text-xs">{m.detalle}</td>
                        <td className={`text-right font-bold
                          ${m.tipo === "Entrada" ? "text-amber-700"
                            : m.tipo === "Salida" ? "text-rose-600"
                            : "text-amber-700"}`}>
                          {m.tipo === "Entrada" ? `+${m.cant}`
                            : m.tipo === "Salida" ? `-${m.cant}`
                            : `=${m.saldo}`}
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

      {/* Modal */}
      {showModal && (
        <ModalMovimiento
          productos={productos}
          onClose={() => setShowModal(false)}
          onGuardar={() => { setShowModal(false); cargar(); }}
        />
      )}
    </div>
  );
}
