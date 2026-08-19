/**
 * InventarioScreen — Gestión completa de inventario
 * Pestañas: Productos | Movimientos | Kardex
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Edit2, Package, Trash2, FileSpreadsheet, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

const CATEGORIAS = ["Producto", "Servicio", "Materia Prima", "Consumible", "Activo", "Otro"];
const UNIDADES   = ["Unid", "Kg", "g", "L", "mL", "m", "cm", "h", "Días", "Servicio", "Otro"];

const MOTIVOS = {
  Entrada: ["Compra directa", "Devolución de cliente", "Ajuste inicial de stock", "Donación / regalo", "Producción propia", "Otro"],
  Salida:  ["Merma / daño", "Muestra / regalo", "Consumo interno", "Robo / pérdida", "Vencimiento", "Otro"],
  Ajuste:  ["Corrección de inventario", "Conteo físico", "Error de sistema", "Otro"],
};

function mesActual() { return new Date().toISOString().slice(0, 7); }

// ── Helpers Kardex ────────────────────────────────────────────────────────────
function buildKardex(producto, facturas, compras, ordenes, manuales) {
  const movs = [];

  compras.forEach(c => {
    (c.lineas || []).forEach(l => {
      const n = (l.nombre || l.producto || "").toLowerCase().trim();
      const p = (producto.nombre || "").toLowerCase().trim();
      if (n && p && (n.includes(p) || p.includes(n))) {
        movs.push({ fecha: (c.fecha || c.creadoEn || "").slice(0,10), tipo: "Entrada", origen: "Compra", ref: c.numeroFactura || c.numero || "—", detalle: c.proveedor || "Proveedor", cant: parseFloat(l.cantidad || 1) });
      }
    });
  });

  facturas.forEach(f => {
    (f.lineas || f.items || []).forEach(l => {
      const n = (l.nombre || l.producto || l.descripcion || "").toLowerCase().trim();
      const p = (producto.nombre || "").toLowerCase().trim();
      if (n && p && (n.includes(p) || p.includes(n))) {
        movs.push({ fecha: (f.fecha || f.creadoEn || "").slice(0,10), tipo: "Salida", origen: "Factura", ref: f.numero || "—", detalle: f.clienteNombre || f.cliente?.nombre || "Cliente", cant: parseFloat(l.cantidad || 1) });
      }
    });
  });

  ordenes.forEach(o => {
    (o.repuestos || []).forEach(r => {
      const n = (r.nombre || r.producto || "").toLowerCase().trim();
      const p = (producto.nombre || "").toLowerCase().trim();
      if (n && p && (n.includes(p) || p.includes(n))) {
        movs.push({ fecha: (o.fecha || o.creadoEn || "").slice(0,10), tipo: "Salida", origen: "Orden Trabajo", ref: o.numero || "—", detalle: o.cliente || "—", cant: parseFloat(r.cantidad || 1) });
      }
    });
  });

  manuales.filter(m => m.productoId === producto.id).forEach(m => {
    movs.push({ fecha: m.fecha, tipo: m.tipo, origen: "Manual", ref: m.id.slice(0,8).toUpperCase(), detalle: m.motivo + (m.nota ? ` — ${m.nota}` : ""), cant: parseFloat(m.cantidad), esAjuste: m.tipo === "Ajuste", stockFinal: m.tipo === "Ajuste" ? parseFloat(m.stockFinal) : undefined });
  });

  movs.sort((a,b) => a.fecha.localeCompare(b.fecha));

  let saldo = parseFloat(producto.stockInicial || producto.stock || 0);
  return movs.map(m => {
    if (m.esAjuste) saldo = m.stockFinal;
    else if (m.tipo === "Entrada") saldo += m.cant;
    else saldo -= m.cant;
    return { ...m, saldo };
  });
}

// ── Modal producto ────────────────────────────────────────────────────────────
function ProductoModal({ prod, onClose, onSave }) {
  const esNuevo = !prod?.id;
  const [form, setForm] = useState(prod || { nombre: "", codigoInterno: "", codigoCabys: "", descripcion: "", precio: "", costo: "", stock: "", stockMin: "0", unidad: "Unid", categoria: "Producto", activo: true });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    const todos = await db.getProductos();
    const item  = { ...form, precio: parseFloat(form.precio)||0, costo: parseFloat(form.costo)||0, stock: parseFloat(form.stock)||0, stockMin: parseFloat(form.stockMin)||0 };
    if (esNuevo) { item.id = genId(); item.creadoEn = new Date().toISOString(); await db.setProductos([...todos, item]); }
    else { await db.setProductos(todos.map(x => x.id === item.id ? item : x)); }
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNuevo ? "Nuevo producto" : "Editar producto"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-700"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["Nombre *","nombre","text","col-span-2"],["Código interno","codigoInterno","text",""],["Código CABYS","codigoCabys","text",""],["Precio de venta","precio","number",""],["Costo","costo","number",""],["Stock actual","stock","number",""],["Stock mínimo","stockMin","number",""]].map(([label,key,type,cls]) => (
            <label key={key} className={`block ${cls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
              <input type={type} value={form[key]??""} onChange={e=>u(key,e.target.value)} step={type==="number"?"any":undefined} min={type==="number"?"0":undefined}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Categoría</span>
            <select value={form.categoria} onChange={e=>u("categoria",e.target.value)} className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Unidad</span>
            <select value={form.unidad} onChange={e=>u("unidad",e.target.value)} className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span>
            <textarea value={form.descripcion} onChange={e=>u("descripcion",e.target.value)} rows={2}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </label>
          <label className="flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={form.activo} onChange={e=>u("activo",e.target.checked)} className="rounded"/>
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar}  className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal movimiento ──────────────────────────────────────────────────────────
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

  const filtrados = productos.filter(p => !busqProd.trim() || (p.nombre||"").toLowerCase().includes(busqProd.toLowerCase())).slice(0,6);

  const seleccionar = (p) => { setProdSel(p); setBusqProd(p.nombre); setShowDrop(false); if (tipo==="Ajuste") setStockFinal(String(p.stock??"")); };
  const handleTipo  = (t) => { setTipo(t); setMotivo(MOTIVOS[t][0]); if (t==="Ajuste"&&prodSel) setStockFinal(String(prodSel.stock??"")); };

  const handleGuardar = async () => {
    if (!prodSel) return alert("Seleccioná un producto");
    if (tipo!=="Ajuste" && (!cantidad||parseFloat(cantidad)<=0)) return alert("Ingresá una cantidad válida");
    if (tipo==="Ajuste" && stockFinal==="") return alert("Ingresá el stock final correcto");
    setGuardando(true);
    try {
      const mov = { id: genId(), productoId: prodSel.id, productoNombre: prodSel.nombre, tipo, fecha, cantidad: tipo==="Ajuste" ? Math.abs(parseFloat(stockFinal)-parseFloat(prodSel.stock??0)) : parseFloat(cantidad), stockFinal: tipo==="Ajuste" ? parseFloat(stockFinal) : undefined, motivo, nota, creadoEn: new Date().toISOString() };
      const todos = await db.getMovimientosInv();
      await db.setMovimientosInv([...todos, mov]);
      const prods = await db.getProductos();
      const nuevoStock = tipo==="Entrada" ? (parseFloat(prodSel.stock??0)+parseFloat(cantidad)) : tipo==="Salida" ? (parseFloat(prodSel.stock??0)-parseFloat(cantidad)) : parseFloat(stockFinal);
      await db.setProductos(prods.map(p => p.id===prodSel.id ? {...p, stock: Math.max(0,nuevoStock)} : p));
      onGuardar();
    } finally { setGuardando(false); }
  };

  const tipoColor = tipo==="Entrada" ? "bg-emerald-500" : tipo==="Salida" ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`${tipoColor} rounded-t-2xl px-5 py-4 flex items-center justify-between`}>
          <h2 className="text-white font-bold text-base">Nuevo movimiento de inventario</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {["Entrada","Salida","Ajuste"].map(t=>(
                <button key={t} onClick={()=>handleTipo(t)}
                  className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${tipo===t ? t==="Entrada"?"border-emerald-500 bg-emerald-50 text-emerald-700":t==="Salida"?"border-rose-500 bg-rose-50 text-rose-700":"border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {tipo==="Entrada"?"Sube el stock del producto":tipo==="Salida"?"Baja el stock del producto":"Establece el stock exacto (ideal para conteo físico)"}
            </p>
          </div>
          {/* Producto */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-500 uppercase">Producto</label>
            <input value={busqProd} onChange={e=>{setBusqProd(e.target.value);setShowDrop(true);setProdSel(null);}}
              onFocus={()=>setShowDrop(true)} onBlur={()=>setTimeout(()=>setShowDrop(false),150)}
              placeholder="Buscar producto…"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
            {showDrop && filtrados.length>0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-auto">
                {filtrados.map(p=>(
                  <button key={p.id} onMouseDown={()=>seleccionar(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-gray-50 last:border-0">
                    <span className="font-semibold">{p.nombre}</span>
                    <span className="text-slate-400 ml-2">Stock: {p.stock??"—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Cantidad / Stock final */}
          {tipo==="Ajuste" ? (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Stock final correcto</label>
              {prodSel && <p className="text-[10px] text-slate-400">Stock actual: {prodSel.stock??"—"}</p>}
              <input type="number" min="0" step="any" value={stockFinal} onChange={e=>setStockFinal(e.target.value)} placeholder="Ej: 50"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Cantidad</label>
              <input type="number" min="0.01" step="any" value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder="Ej: 10"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
            </div>
          )}
          {/* Motivo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
            <select value={motivo} onChange={e=>setMotivo(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {MOTIVOS[tipo].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* Nota + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nota (opcional)</label>
              <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Referencia…"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${tipoColor}`}>
              {guardando?"Guardando…":"Guardar movimiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function InventarioScreen() {
  const [tab,        setTab]        = useState("productos"); // productos | movimientos | kardex
  const [productos,  setProductos]  = useState([]);
  const [settings,   setSettings]   = useState({});
  const [facturas,   setFacturas]   = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [ordenes,    setOrdenes]    = useState([]);
  const [manuales,   setManuales]   = useState([]);

  // Productos
  const [busq,  setBusq]  = useState("");
  const [cat,   setCat]   = useState("Todos");
  const [modal, setModal] = useState(null);

  // Movimientos
  const [showModalMov, setShowModalMov] = useState(false);

  // Kardex
  const [busqK,    setBusqK]    = useState("");
  const [selected, setSelected] = useState(null);
  const [desde,    setDesde]    = useState(mesActual() + "-01");
  const [hasta,    setHasta]    = useState(hoy());

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [p, s, f, c, o, m] = await Promise.all([
      db.getProductos(), db.getSettings(), db.getFacturas(),
      db.getCompras(), db.getOrdenes(), db.getMovimientosInv(),
    ]);
    setProductos(p.sort((a,b) => (a.nombre||"").localeCompare(b.nombre||"")));
    setSettings(s);
    setFacturas(f);
    setCompras(c);
    setOrdenes(o);
    setManuales(m);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    const todos = await db.getProductos();
    await db.setProductos(todos.filter(x => x.id !== p.id));
    cargar();
  };

  // ── Tab: Productos ──────────────────────────────────────────────────────────
  const busqL    = busq.trim().toLowerCase();
  const visibles = productos.filter(p => {
    if (cat !== "Todos" && p.categoria !== cat) return false;
    if (busqL && !p.nombre?.toLowerCase().includes(busqL) && !p.codigoInterno?.toLowerCase().includes(busqL)) return false;
    return true;
  });
  const categorias = ["Todos", ...new Set(productos.map(p=>p.categoria).filter(Boolean))];

  // ── Tab: Kardex ─────────────────────────────────────────────────────────────
  const prodsFiltK  = productos.filter(p => !busqK.trim() || (p.nombre||"").toLowerCase().includes(busqK.toLowerCase()));
  const prodKardex  = selected ? productos.find(p => p.id === selected) : null;
  const movimientos = prodKardex
    ? buildKardex(prodKardex, facturas, compras, ordenes, manuales).filter(m => m.fecha >= desde && m.fecha <= hasta)
    : [];
  const totalEntradas = movimientos.filter(m=>m.tipo==="Entrada").reduce((s,m)=>s+m.cant,0);
  const totalSalidas  = movimientos.filter(m=>m.tipo==="Salida").reduce((s,m)=>s+m.cant,0);

  const exportarKardex = () => {
    const rows = movimientos.map(m => ({ Fecha: fmtDate(m.fecha), Tipo: m.tipo, Origen: m.origen, Referencia: m.ref, Detalle: m.detalle, Cantidad: m.tipo==="Entrada"?`+${m.cant}`:m.tipo==="Ajuste"?`=${m.saldo}`:`-${m.cant}`, Saldo: m.saldo }));
    exportExcel(rows, `kardex-${prodKardex?.nombre?.replace(/\s/g,"-")}`);
  };

  // ── Tab Selector ────────────────────────────────────────────────────────────
  const TABS = [
    { key: "productos",    label: "Productos" },
    { key: "movimientos",  label: "Movimientos" },
    { key: "kardex",       label: "Kardex" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex shrink-0 bg-white border-b border-gray-200 px-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors mr-1
              ${tab===t.key ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            {t.label}
            {t.key==="productos" && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{productos.length}</span>}
            {t.key==="movimientos" && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{manuales.length}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB: PRODUCTOS ────────────────────────────────────────────────────── */}
      {tab === "productos" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-100 rounded-lg px-3 py-2">
              <Search size={14} className="text-slate-400 shrink-0"/>
              <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto…" className="bg-transparent text-sm flex-1 outline-none min-w-0"/>
            </div>
            <select value={cat} onChange={e=>setCat(e.target.value)} className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none">
              {categorias.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={()=>setModal({})} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
              <Plus size={15}/> Nuevo producto
            </button>
          </div>
          <div className="flex gap-4 px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-200 text-xs text-slate-500">
            <span>{productos.length} productos</span>
            <span className="text-amber-600 font-semibold">{productos.filter(p=>(p.stock||0)<=(p.stockMin||0)&&p.activo!==false).length} bajo mínimo</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="table-base">
              <thead><tr>
                <th>Código</th><th>Nombre</th><th>Categoría</th><th>CABYS</th>
                <th>Precio venta</th><th>Costo</th><th>Stock</th><th>Mín.</th><th>Unidad</th><th></th>
              </tr></thead>
              <tbody>
                {visibles.length===0 ? (
                  <tr><td colSpan={10} className="text-center py-16 text-slate-400">{productos.length===0?"Sin productos. Creá el primero →":"Sin resultados."}</td></tr>
                ) : visibles.map(p => {
                  const bajo = (p.stock||0)<=(p.stockMin||0)&&p.activo!==false;
                  return (
                    <tr key={p.id} className={p.activo===false?"opacity-40":""}>
                      <td className="text-xs font-mono text-slate-400">{p.codigoInterno||"—"}</td>
                      <td className="font-semibold text-slate-900"><div className="flex items-center gap-2"><Package size={13} className="text-green-600 shrink-0"/>{p.nombre}</div></td>
                      <td className="text-slate-500 text-xs">{p.categoria||"—"}</td>
                      <td className="text-xs font-mono text-slate-400">{p.codigoCabys||"—"}</td>
                      <td className="text-green-700 font-semibold">{fmtMoney(p.precio,settings.moneda||"CRC")}</td>
                      <td className="text-slate-500">{p.costo?fmtMoney(p.costo,settings.moneda||"CRC"):"—"}</td>
                      <td className={`font-bold ${bajo?"text-red-600":"text-slate-700"}`}>{p.stock??"—"}{bajo&&<span className="ml-1 text-xs text-red-500">⚠</span>}</td>
                      <td className="text-slate-400">{p.stockMin??0}</td>
                      <td className="text-slate-400 text-xs">{p.unidad||"Unid"}</td>
                      <td><div className="flex items-center gap-1">
                        <button onClick={()=>setModal(p)} className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-700"><Edit2 size={13}/></button>
                        <button onClick={()=>eliminar(p)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: MOVIMIENTOS ─────────────────────────────────────────────────── */}
      {tab === "movimientos" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-gray-200">
            <p className="text-sm text-slate-500">{manuales.length} movimientos manuales registrados</p>
            <button onClick={()=>setShowModalMov(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
              <Plus size={15}/> Nuevo movimiento
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="table-base">
              <thead><tr>
                <th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th>
                <th className="text-right">Cantidad</th><th>Nota</th>
              </tr></thead>
              <tbody>
                {manuales.length===0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <SlidersHorizontal size={36} className="text-slate-200"/>
                      <p>Sin movimientos aún. Usá "+ Nuevo movimiento" para registrar una entrada, salida o ajuste.</p>
                    </div>
                  </td></tr>
                ) : [...manuales].reverse().map(m => (
                  <tr key={m.id}>
                    <td>{fmtDate(m.fecha)}</td>
                    <td className="font-semibold">{m.productoNombre}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${m.tipo==="Entrada"?"bg-emerald-100 text-emerald-700":m.tipo==="Salida"?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs">{m.motivo}</td>
                    <td className={`text-right font-bold ${m.tipo==="Entrada"?"text-emerald-700":m.tipo==="Salida"?"text-rose-600":"text-amber-700"}`}>
                      {m.tipo==="Entrada"?`+${m.cantidad}`:m.tipo==="Salida"?`-${m.cantidad}`:`=${m.stockFinal}`}
                    </td>
                    <td className="text-slate-400 text-xs">{m.nota||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: KARDEX ──────────────────────────────────────────────────────── */}
      {tab === "kardex" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo */}
          <div className="w-52 md:w-64 border-r border-slate-200 flex flex-col bg-white shrink-0">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                <Search size={13} className="text-slate-400"/>
                <input value={busqK} onChange={e=>setBusqK(e.target.value)} placeholder="Buscar…"
                  className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {prodsFiltK.length===0 && <p className="text-center text-slate-400 text-xs py-8">Sin productos</p>}
              {prodsFiltK.map(p=>(
                <button key={p.id} onClick={()=>setSelected(p.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected===p.id?"bg-emerald-50 border-l-2 border-l-emerald-600":""}`}>
                  <p className="text-xs font-semibold text-slate-800 truncate">{p.nombre}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Stock: {p.stock??"—"} {p.unidad||""}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Panel derecho */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 flex-wrap">
              <Package size={13} className="text-emerald-400"/>
              <span className="text-white text-xs font-semibold">{prodKardex ? prodKardex.nombre : "Seleccioná un producto"}</span>
              {prodKardex && <>
                <div className="w-px h-5 bg-slate-500 mx-1"/>
                <label className="text-slate-300 text-xs">Desde:</label>
                <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
                <label className="text-slate-300 text-xs">Hasta:</label>
                <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1"/>
                <div className="flex-1"/>
                <button onClick={exportarKardex} className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
                  <FileSpreadsheet size={13}/> Excel
                </button>
              </>}
            </div>

            {!prodKardex ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Package size={40} className="mx-auto mb-3 text-slate-200"/>
                  <p className="text-sm font-medium">Seleccioná un producto del panel izquierdo</p>
                </div>
              </div>
            ) : (
              <>
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
                    <p className="text-xl font-bold text-slate-800">{prodKardex.stock??"—"}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <div className="overflow-x-auto">
                    <table className="table-base w-full">
                      <thead><tr>
                        <th>Fecha</th><th>Tipo</th><th>Origen</th><th>Referencia</th>
                        <th>Detalle</th><th className="text-right">Cantidad</th><th className="text-right">Saldo</th>
                      </tr></thead>
                      <tbody>
                        {movimientos.length===0 && (
                          <tr><td colSpan={7} className="text-center text-slate-400 py-10">Sin movimientos en el período</td></tr>
                        )}
                        {movimientos.map((m,i)=>(
                          <tr key={i}>
                            <td>{fmtDate(m.fecha)}</td>
                            <td><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.tipo==="Entrada"?"bg-emerald-100 text-emerald-700":m.tipo==="Salida"?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700"}`}>{m.tipo}</span></td>
                            <td className="text-slate-500 text-xs">{m.origen}</td>
                            <td className="font-mono text-xs">{m.ref}</td>
                            <td className="text-slate-600 max-w-[160px] truncate text-xs">{m.detalle}</td>
                            <td className={`text-right font-bold ${m.tipo==="Entrada"?"text-emerald-700":m.tipo==="Salida"?"text-rose-600":"text-amber-700"}`}>
                              {m.tipo==="Entrada"?`+${m.cant}`:m.tipo==="Salida"?`-${m.cant}`:`=${m.saldo}`}
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
      )}

      {/* Modales */}
      {modal !== null && (
        <ProductoModal prod={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {showModalMov && (
        <ModalMovimiento productos={productos} onClose={()=>setShowModalMov(false)} onGuardar={()=>{setShowModalMov(false);cargar();}}/>
      )}
    </div>
  );
}
