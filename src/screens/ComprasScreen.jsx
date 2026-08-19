/**
 * ComprasScreen — Facturas de proveedor / compras
 * Registra gastos con crédito fiscal de IVA.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, X, Check, ShoppingCart } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { crearCXP, aumentarInventario } from "../utils/clienteUtils";

const CATEGORIAS = ["Mercadería","Materia prima","Servicios","Equipo","Suministros","Alquiler","Publicidad","Transporte","Otro"];
const MEDIOS = ["Efectivo","Transferencia","SINPE Móvil","Tarjeta","Cheque","Crédito proveedor"];

const ESTADOS = {
  pendiente:  { label:"Pendiente",   cls:"bg-amber-100 text-amber-700" },
  pagada:     { label:"Pagada",      cls:"bg-green-100 text-emerald-700" },
  vencida:    { label:"Vencida",     cls:"bg-red-100 text-red-600" },
};

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${e.cls}`}>{e.label}</span>;
}

function FormCompra({ compra, contactos, productos, proyectos, onGuardar, onCancelar }) {
  const [proveedor,  setProveedor]  = useState(compra?.proveedor || "");
  const [numFactura, setNumFactura] = useState(compra?.numFactura || "");
  const [fecha,      setFecha]      = useState(compra?.fecha || hoy());
  const [fechaVence, setFechaVence] = useState(compra?.fechaVence || "");
  const [categoria,  setCategoria]  = useState(compra?.categoria || "Mercadería");
  const [medio,      setMedio]      = useState(compra?.medio || "Transferencia");
  const [estado,     setEstado]     = useState(compra?.estado || "pendiente");
  const [montoBase,  setMontoBase]  = useState(compra?.montoBase || "");
  const [pctIVA,     setPctIVA]     = useState(compra?.pctIVA ?? 13);
  const [notas,      setNotas]      = useState(compra?.notas || "");
  const [proyectoId, setProyectoId] = useState(compra?.proyectoId || "");
  const [busq,       setBusq]       = useState(compra?.proveedor || "");
  const [showProv,   setShowProv]   = useState(false);
  const [diasProvee, setDiasProvee] = useState(0);
  // Líneas de productos recibidos (solo Mercadería/Materia prima)
  const [lineas,     setLineas]     = useState(compra?.lineas || []);
  const [busqProd,   setBusqProd]   = useState("");
  const [showProds,  setShowProds]  = useState(false);

  const INVENTARIABLE = ["Mercadería", "Materia prima"];
  const prodsFiltrados = (productos||[]).filter(p =>
    p.nombre?.toLowerCase().includes(busqProd.toLowerCase())
  ).slice(0, 6);

  const base      = parseFloat(montoBase) || 0;
  const montoIVA  = (base * pctIVA) / 100;
  const total     = base + montoIVA;

  const filtrados = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
    c.cedula?.includes(busq) ||
    c.codigoCliente?.toUpperCase().includes(busq.toUpperCase())
  ).slice(0,6);

  // Auto-calcular fechaVence cuando cambia el medio a crédito
  const seleccionarProveedor = (c) => {
    setProveedor(c.nombre);
    setBusq(c.nombre);
    setShowProv(false);
    const dias = c.dias_credito || 0;
    setDiasProvee(dias);
    // Si tiene días de crédito, cambiar medio y calcular vencimiento
    if (dias > 0) {
      setMedio("Crédito proveedor");
      const vence = new Date();
      vence.setDate(vence.getDate() + dias);
      setFechaVence(vence.toISOString().slice(0, 10));
    }
  };

  const agregarLinea = (p) => {
    const ya = lineas.find(l => l.productoId === p.id);
    if (ya) {
      setLineas(lineas.map(l => l.productoId === p.id ? { ...l, cantidad: (parseFloat(l.cantidad)||0) + 1 } : l));
    } else {
      setLineas([...lineas, { productoId: p.id, descripcion: p.nombre, cantidad: 1 }]);
    }
    setBusqProd(""); setShowProds(false);
  };

  const guardar = () => {
    onGuardar({
      id: compra?.id || genId(),
      proveedor, numFactura, fecha, fechaVence, categoria, medio, estado,
      montoBase: base, pctIVA, montoIVA, total, notas,
      proyectoId: proyectoId || null,
      lineas: INVENTARIABLE.includes(categoria) ? lineas : [],
      creadoEn: compra?.creadoEn || new Date().toISOString(),
    });
  };

  const INP = "w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400";
  const LBL = "block text-[10px] font-bold text-slate-500 uppercase mb-1";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar oscuro */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 shrink-0">
        <button onClick={onCancelar} className="flex items-center gap-1.5 border border-slate-500 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold">
          <X size={13}/> Cancelar
        </button>
        <span className="text-slate-300 text-xs font-bold flex-1">{compra ? "Editar compra" : "Nueva compra / factura de proveedor"}</span>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>Base: {fmtMoney(base,"CRC")}</span>
          <span className="text-slate-500">·</span>
          <span className="text-white font-black">{fmtMoney(total,"CRC")}</span>
        </div>
        <button onClick={guardar} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-semibold">
          <Check size={13}/> Guardar
        </button>
      </div>

      {/* Body — 2 paneles */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel izquierdo: campos */}
        <div className="flex-1 overflow-y-auto bg-slate-50 border-r border-slate-200 px-4 py-4 space-y-3">

          {/* Proveedor */}
          <div>
            <label className={LBL}>Proveedor</label>
            <div className="relative">
              <input value={busq} autoComplete="off"
                onChange={e=>{setBusq(e.target.value);setProveedor(e.target.value);setShowProv(true);}}
                onFocus={()=>setShowProv(true)} onBlur={()=>setTimeout(()=>setShowProv(false),150)}
                placeholder="Nombre del proveedor…" className={INP}/>
              {showProv && filtrados.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded shadow-lg z-20 max-h-40 overflow-auto">
                  {filtrados.map(c=>(
                    <button key={c.id} onMouseDown={()=>seleccionarProveedor(c)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 rounded mr-1">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-1.5">{c.cedula}</span>
                      {c.dias_credito > 0 && <span className="ml-1.5 text-[10px] text-red-600 font-semibold">{c.dias_credito}d pago</span>}
                    </button>
                  ))}
                </div>
              )}
              {diasProvee > 0 && (
                <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
                  ⏱ Plazo de pago: {diasProvee} días — vencimiento calculado automáticamente
                </p>
              )}
            </div>
          </div>

          {/* N° factura + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>N.° Factura proveedor</label>
              <input value={numFactura} onChange={e=>setNumFactura(e.target.value)} placeholder="FAC-0012345" className={INP}/>
            </div>
            <div>
              <label className={LBL}>Categoría</label>
              <select value={categoria} onChange={e=>setCategoria(e.target.value)} className={INP}>
                {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Fechas + Estado */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LBL}>Fecha factura</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} className={INP}/>
            </div>
            <div>
              <label className={LBL}>Fecha vencimiento</label>
              <input type="date" value={fechaVence} onChange={e=>setFechaVence(e.target.value)} className={INP}/>
            </div>
            <div>
              <label className={LBL}>Estado</label>
              <select value={estado} onChange={e=>setEstado(e.target.value)} className={INP}>
                {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Monto base + % IVA + Medio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LBL}>Monto base (sin IVA)</label>
              <input type="number" value={montoBase} onChange={e=>setMontoBase(e.target.value)} min="0" step="any" placeholder="0"
                className={`${INP} text-right`}/>
            </div>
            <div>
              <label className={LBL}>% IVA (crédito fiscal)</label>
              <select value={pctIVA} onChange={e=>setPctIVA(Number(e.target.value))} className={INP}>
                <option value={0}>0% — Exento</option>
                <option value={1}>1%</option>
                <option value={2}>2%</option>
                <option value={4}>4%</option>
                <option value={8}>8%</option>
                <option value={13}>13%</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Medio de pago</label>
              <select value={medio} onChange={e=>setMedio(e.target.value)} className={INP}>
                {MEDIOS.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Productos recibidos */}
          {INVENTARIABLE.includes(categoria) && (
            <div className="border-t border-slate-200 pt-3">
              <label className={LBL}>📦 Productos recibidos (aumenta inventario)</label>
              <div className="relative mt-1">
                <input value={busqProd} autoComplete="off"
                  onChange={e=>{setBusqProd(e.target.value);setShowProds(true);}}
                  onFocus={()=>setShowProds(true)} onBlur={()=>setTimeout(()=>setShowProds(false),150)}
                  placeholder="Buscar producto del catálogo…" className={INP}/>
                {showProds && prodsFiltrados.length>0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded shadow-lg z-20 max-h-36 overflow-auto">
                    {prodsFiltrados.map(p=>(
                      <button key={p.id} onMouseDown={()=>agregarLinea(p)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 border-b last:border-0 flex justify-between">
                        <span className="font-semibold">{p.nombre}</span>
                        <span className="text-slate-400">Stock: {p.stock ?? "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {lineas.length > 0 && (
                <div className="mt-2 space-y-1">
                  {lineas.map((l,i)=>(
                    <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-1.5">
                      <span className="flex-1 text-xs text-slate-700">{l.descripcion}</span>
                      <input type="number" min="0.01" step="any" value={l.cantidad}
                        onChange={e=>setLineas(lineas.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                        className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-right focus:outline-none"/>
                      <span className="text-[10px] text-slate-400">unds.</span>
                      <button onClick={()=>setLineas(lineas.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                  <p className="text-[10px] text-emerald-600">✓ Al guardar se aumentará el stock de estos productos</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel derecho: resumen */}
        <div className="w-56 shrink-0 bg-white overflow-y-auto px-4 py-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Resumen</p>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Base imponible</span><span>{fmtMoney(base,"CRC")}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>IVA ({pctIVA}%) fiscal</span><span>{fmtMoney(montoIVA,"CRC")}</span>
          </div>
          <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2 mt-1">
            <span>TOTAL</span><span className="text-emerald-700">{fmtMoney(total,"CRC")}</span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className={LBL}>Observaciones</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={4}
              placeholder="Notas, referencia interna…"
              className="w-full border border-slate-200 rounded px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
          </div>

          {(proyectos||[]).length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <label className={LBL}>Proyecto</label>
              <select value={proyectoId} onChange={e=>setProyectoId(e.target.value)}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">— Sin proyecto —</option>
                {(proyectos||[]).filter(p=>p.estado==="Activo").map(p=>(
                  <option key={p.id} value={p.id}>{p.nombre}{p.codigo?` (${p.codigo})`:""}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function ComprasScreen() {
  const [compras,   setCompras]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [vista,     setVista]     = useState("lista");
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const [authToken, setAuthToken] = useState(null);
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [c, ct, pr, py] = await Promise.all([db.getCompras(), db.getContactos(), db.getProductos(), db.getProyectos()]);
    setCompras(c || []);
    setContactos(ct || []);
    setProductos(pr || []);
    setProyectos(py || []);
    import("../utils/auth").then(m => m.getToken()).then(setAuthToken);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (c) => {
    const all = await db.getCompras();
    const idx = all.findIndex(x=>x.id===c.id);
    const esNueva = idx < 0;
    await db.setCompras(esNueva ? [...all, c] : all.map((x,i)=>i===idx?c:x));

    // Si es nueva compra a crédito de proveedor → crear CXP + evento calendario
    if (esNueva && c.medio === "Crédito proveedor") {
      await crearCXP({
        proveedor:  c.proveedor,
        total:      c.total,
        moneda:     "CRC",
        fechaVence: c.fechaVence || null,
        facturaRef: c.numFactura || "",
        token:      authToken,
      });
    }

    // Si tiene líneas de productos inventariables → aumentar stock
    if (esNueva && c.lineas?.length) {
      await aumentarInventario(c.lineas);
    }

    // Asiento contable automático por compra
    if (esNueva) {
      try {
        const asientos = await db.getAsientos();
        const numAJ = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
        const base  = parseFloat(c.montoBase || 0);
        const iva   = parseFloat(c.montoIVA  || 0);
        const tot   = parseFloat(c.total     || 0);
        if (tot > 0) {
          const lineas = [];
          if (base > 0) lineas.push({ cuentaCodigo: "5201", cuentaNombre: "Gastos / Compras", debe: base, haber: 0 });
          if (iva  > 0) lineas.push({ cuentaCodigo: "1106", cuentaNombre: "IVA crédito fiscal", debe: iva, haber: 0 });
          if (c.medio === "Crédito proveedor") {
            lineas.push({ cuentaCodigo: "2101", cuentaNombre: "Cuentas por pagar", debe: 0, haber: tot });
          } else {
            lineas.push({ cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",   debe: 0, haber: tot });
          }
          const totalDebe  = lineas.reduce((s, l) => s + l.debe,  0);
          const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
          if (Math.abs(totalDebe - totalHaber) <= 0.02) {
            await db.setAsientos([...asientos, {
              id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
              descripcion: `Compra ${c.numFactura || ""} — ${c.proveedor || "Proveedor"}`,
              fecha: c.fecha, totalDebe, totalHaber, lineas,
              creadoEn: new Date().toISOString(),
            }]);
          }
        }
      } catch (e) { console.warn("[Compras] asiento:", e.message); }
    }

    cargar(); setVista("lista"); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta compra?")) return;
    const all = await db.getCompras();
    await db.setCompras(all.filter(x=>x.id!==id));
    cargar();
  };

  const marcarPagada = async (id) => {
    const all = await db.getCompras();
    await db.setCompras(all.map(x=>x.id===id?{...x,estado:"pagada"}:x));
    cargar();
  };

  if (vista==="form") {
    return <FormCompra compra={editando} contactos={contactos} productos={productos} proyectos={proyectos}
      onGuardar={guardar} onCancelar={()=>{setVista("lista");setEditando(null);}} />;
  }

  const filtradas = compras.filter(c =>
    (filtroEst==="todos" || c.estado===filtroEst) &&
    (c.proveedor?.toLowerCase().includes(busq.toLowerCase()) || c.numFactura?.includes(busq))
  );
  const sel = filtradas.find(c => c.id === selected);

  const totPendiente = compras.filter(x=>x.estado==="pendiente").reduce((s,c)=>s+c.total,0);
  const totMes = compras.filter(x=>x.fecha?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,c)=>s+c.total,0);
  const totIVA  = compras.filter(x=>x.estado!=="vencida").reduce((s,c)=>s+(c.montoIVA||0),0);

  return (
    <div className="flex flex-col h-full">
      {/* KPIs strip */}
      <div className="flex gap-6 px-5 py-2 bg-white border-b border-slate-200 shrink-0">
        {[
          { label:"Por pagar", val:fmtMoney(totPendiente,"CRC"), color:"text-amber-600" },
          { label:"Compras del mes", val:fmtMoney(totMes,"CRC"), color:"text-slate-800" },
          { label:"IVA crédito fiscal", val:fmtMoney(totIVA,"CRC"), color:"text-emerald-600" },
        ].map(k=>(
          <div key={k.label}>
            <div className="text-[10px] font-bold text-slate-400 uppercase">{k.label}</div>
            <div className={`text-base font-black ${k.color}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 shrink-0">
        <button onClick={()=>{setEditando(null);setVista("form");}}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
          <Plus size={13}/> Nueva compra
        </button>
        <button disabled={!sel} onClick={()=>sel&&(setEditando(sel),setVista("form"))}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          Editar
        </button>
        <button disabled={!sel} onClick={()=>sel&&eliminar(sel.id)}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          <Trash2 size={13}/> Eliminar
        </button>
        {sel?.estado==="pendiente" && (
          <button onClick={()=>marcarPagada(sel.id)}
            className="flex items-center gap-1.5 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded">
            ✓ Marcar pagada
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
            <Search size={12} className="text-slate-300"/>
            <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar…"
              className="bg-transparent text-white text-xs outline-none w-32 placeholder-slate-400"/>
          </div>
          <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}
            className="text-xs border border-slate-500 bg-slate-600 text-white rounded px-2 py-1.5 focus:outline-none">
            <option value="todos">Todos</option>
            {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sub-barra */}
      {sel ? (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs shrink-0">
          <span className="text-blue-700 font-semibold">Seleccionado:</span>
          <span className="font-bold">{sel.proveedor}</span>
          {sel.numFactura && <span className="text-slate-400">#{sel.numFactura}</span>}
          <Badge estado={sel.estado}/>
          <button onClick={()=>setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
        </div>
      ) : (
        <div className="px-4 py-1.5 bg-slate-50 border-b text-[10px] text-slate-400 shrink-0">
          {filtradas.length} compras — clic en fila para seleccionar
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <ShoppingCart size={40} className="text-slate-200"/>
            <p className="text-sm">Sin compras registradas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Proveedor</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">N.° Factura</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Categoría</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Vence</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Total</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">IVA</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map(c=>(
                <tr key={c.id} onClick={()=>setSelected(selected===c.id?null:c.id)}
                  className={`cursor-pointer transition-colors ${selected===c.id?"bg-blue-50 border-l-4 border-blue-500":"hover:bg-slate-50"}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{c.proveedor || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{c.numFactura || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{c.categoria}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(c.fecha)}</td>
                  <td className={`px-3 py-2.5 text-xs ${c.estado==="vencida"?"text-red-500 font-semibold":"text-slate-500"}`}>
                    {c.fechaVence ? fmtDate(c.fechaVence) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">{fmtMoney(c.total,"CRC")}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-emerald-600">{fmtMoney(c.montoIVA||0,"CRC")}</td>
                  <td className="px-3 py-2.5"><Badge estado={c.estado}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
