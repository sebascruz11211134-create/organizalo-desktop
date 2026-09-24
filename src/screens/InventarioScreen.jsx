/**
 * InventarioScreen — Gestión completa de inventario
 * Pestañas: Productos | Movimientos | Kardex
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Package, Trash2, FileSpreadsheet, SlidersHorizontal, AlertTriangle, Coins, ArrowLeftRight } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Selector, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, Interruptor, Tarjeta, useConfirmar } from "../components/ui";
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

  const campos = [["Nombre *","nombre","text","col-span-2"],["Código interno","codigoInterno","text",""],["Código CABYS","codigoCabys","text",""],["Precio de venta","precio","number",""],["Costo","costo","number",""],["Stock actual","stock","number",""],["Stock mínimo","stockMin","number",""]];
  return (
    <Modal titulo={esNuevo ? "Nuevo producto" : "Editar producto"} subtitulo={esNuevo ? "Agregalo a tu inventario" : form.nombre} onCerrar={onClose}
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar producto</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        {campos.map(([label,key,type,cls]) => (
          <Campo key={key} etiqueta={label} className={cls}>
            <Entrada type={type} value={form[key]??""} onChange={e=>u(key,e.target.value)} step={type==="number"?"any":undefined} min={type==="number"?"0":undefined}/>
          </Campo>
        ))}
        <Campo etiqueta="Categoría"><Seleccion value={form.categoria} onChange={e=>u("categoria",e.target.value)} opciones={CATEGORIAS}/></Campo>
        <Campo etiqueta="Unidad"><Seleccion value={form.unidad} onChange={e=>u("unidad",e.target.value)} opciones={UNIDADES}/></Campo>
        <Campo etiqueta="Descripción" className="col-span-2"><AreaTexto value={form.descripcion} onChange={e=>u("descripcion",e.target.value)} rows={2}/></Campo>
        <div className="col-span-2"><Interruptor activo={form.activo !== false} onCambio={v=>u("activo",v)} etiqueta="Producto activo"/></div>
      </div>
    </Modal>
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

  return (
    <Modal titulo="Nuevo movimiento" subtitulo="Entrada, salida o ajuste de inventario" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={handleGuardar} cargando={guardando}>Guardar movimiento</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Tipo" ayuda={tipo==="Entrada"?"Sube el stock del producto":tipo==="Salida"?"Baja el stock del producto":"Establece el stock exacto (ideal para conteo físico)"}>
          <div className="grid grid-cols-3 gap-2">
            {["Entrada","Salida","Ajuste"].map(t=>(
              <button key={t} type="button" onClick={()=>handleTipo(t)}
                className={`ui-boton py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${tipo===t ? "bg-monki-k text-monki-y" : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>
                {t}
              </button>
            ))}
          </div>
        </Campo>
        <div className="relative">
          <Campo etiqueta="Producto">
            <Entrada value={busqProd} onChange={e=>{setBusqProd(e.target.value);setShowDrop(true);setProdSel(null);}}
              onFocus={()=>setShowDrop(true)} onBlur={()=>setTimeout(()=>setShowDrop(false),150)} placeholder="Buscar producto…"/>
          </Campo>
          {showDrop && filtrados.length>0 && (
            <div className="animate-desplegar absolute top-full left-0 right-0 mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-44 overflow-auto">
              {filtrados.map(p=>(
                <button key={p.id} type="button" onMouseDown={()=>seleccionar(p)}
                  className="w-full flex justify-between text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="font-mono text-[11px] text-monki-k/50">Stock {p.stock??"—"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {tipo==="Ajuste" ? (
          <Campo etiqueta="Stock final correcto" ayuda={prodSel ? `Stock actual: ${prodSel.stock??"—"}` : undefined}>
            <Entrada type="number" min="0" step="any" value={stockFinal} onChange={e=>setStockFinal(e.target.value)} placeholder="Ej: 50"/>
          </Campo>
        ) : (
          <Campo etiqueta="Cantidad">
            <Entrada type="number" min="0.01" step="any" value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder="Ej: 10"/>
          </Campo>
        )}
        <Campo etiqueta="Motivo"><Seleccion value={motivo} onChange={e=>setMotivo(e.target.value)} opciones={MOTIVOS[tipo]}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Campo>
          <Campo etiqueta="Nota (opcional)"><Entrada value={nota} onChange={e=>setNota(e.target.value)} placeholder="Referencia…"/></Campo>
        </div>
      </div>
    </Modal>
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

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (p) => {
    if (!(await confirmar("Eliminar producto", `¿Eliminar "${p.nombre}" del inventario? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
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

  const moneda = settings.moneda || "CRC";
  const bajoMinimo = productos.filter(p=>(p.stock||0)<=(p.stockMin||0)&&p.activo!==false);
  const valorInventario = productos.reduce((t,p)=>t+(parseFloat(p.stock)||0)*(parseFloat(p.costo)||0),0);
  const signo = m => m.tipo==="Entrada"?`+${m.cant ?? m.cantidad}`:m.tipo==="Salida"?`-${m.cant ?? m.cantidad}`:`=${m.saldo ?? m.stockFinal}`;
  const tonoMov = t => t==="Entrada" ? "exito" : t==="Salida" ? "peligro" : "alerta";

  const columnasProductos = [
    { key: "codigo", titulo: "Código", render: p => <span className="font-mono text-xs text-monki-k/50">{p.codigoInterno||"—"}</span> },
    { key: "nombre", titulo: "Producto", render: p => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0"><Package size={14} className="text-monki-k"/></span>
        <div className="min-w-0"><p className="font-bold text-monki-k truncate">{p.nombre}</p><p className="text-[11px] text-monki-k/45">{p.categoria||"—"}</p></div>
      </div>) },
    { key: "cabys", titulo: "CABYS", render: p => <span className="font-mono text-xs text-monki-k/50">{p.codigoCabys||"—"}</span> },
    { key: "precio", titulo: "Precio", alinear: "right", render: p => <span className="font-bold">{fmtMoney(p.precio,moneda)}</span> },
    { key: "costo", titulo: "Costo", alinear: "right", render: p => p.costo ? fmtMoney(p.costo,moneda) : "—" },
    { key: "stock", titulo: "Stock", alinear: "right", render: p => {
      const bajo = (p.stock||0)<=(p.stockMin||0)&&p.activo!==false;
      return <span className="inline-flex items-center gap-1.5 justify-end">{bajo && <Estado tono="peligro" punto={false}>Bajo</Estado>}<b className={bajo?"text-red-600":""}>{p.stock??"—"}</b><span className="text-[11px] text-monki-k/40">{p.unidad||"Unid"}</span></span>;
    } },
    { key: "min", titulo: "Mín.", alinear: "right", render: p => <span className="text-monki-k/45">{p.stockMin??0}</span> },
    { key: "estado", titulo: "Estado", render: p => p.activo===false ? <Estado>Inactivo</Estado> : <Estado tono="exito">Activo</Estado> },
    { key: "acciones", titulo: "", alinear: "right", render: p => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal(p)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(p)}/>
      </div>) },
  ];

  const columnasMovs = [
    { key: "fecha", titulo: "Fecha", render: m => fmtDate(m.fecha) },
    { key: "producto", titulo: "Producto", render: m => <b>{m.productoNombre}</b> },
    { key: "tipo", titulo: "Tipo", render: m => <Estado tono={tonoMov(m.tipo)}>{m.tipo}</Estado> },
    { key: "motivo", titulo: "Motivo", render: m => <span className="text-monki-k/60">{m.motivo}</span> },
    { key: "cantidad", titulo: "Cantidad", alinear: "right", render: m => <b className={m.tipo==="Salida"?"text-red-600":""}>{signo(m)}</b> },
    { key: "nota", titulo: "Nota", render: m => <span className="text-monki-k/45">{m.nota||"—"}</span> },
  ];

  const columnasKardex = [
    { key: "fecha", titulo: "Fecha", render: m => fmtDate(m.fecha) },
    { key: "tipo", titulo: "Tipo", render: m => <Estado tono={tonoMov(m.tipo)}>{m.tipo}</Estado> },
    { key: "origen", titulo: "Origen", render: m => <span className="text-monki-k/60">{m.origen}</span> },
    { key: "ref", titulo: "Referencia", render: m => <span className="font-mono text-xs">{m.ref}</span> },
    { key: "detalle", titulo: "Detalle", render: m => <span className="text-monki-k/60 truncate block max-w-[200px]">{m.detalle}</span> },
    { key: "cantidad", titulo: "Cantidad", alinear: "right", render: m => <b className={m.tipo==="Salida"?"text-red-600":""}>{signo(m)}</b> },
    { key: "saldo", titulo: "Saldo", alinear: "right", render: m => <b>{m.saldo}</b> },
  ];

  const acciones = tab === "productos"
    ? <Boton icono={Plus} onClick={()=>setModal({})}>Nuevo producto</Boton>
    : tab === "movimientos"
      ? <Boton icono={Plus} onClick={()=>setShowModalMov(true)}>Nuevo movimiento</Boton>
      : prodKardex && <Boton variante="secundario" icono={FileSpreadsheet} onClick={exportarKardex}>Exportar Excel</Boton>;

  return (
    <Modulo
      seccion="Inventario"
      titulo="Inventario"
      descripcion="Productos, existencias y cada movimiento que las cambia."
      acciones={acciones}
      indicadores={tab !== "kardex" && (
        <Indicadores>
          <Indicador etiqueta="Productos" valor={productos.length} detalle={`${productos.filter(p=>p.activo!==false).length} activos`} icono={Package} delay={40}/>
          <Indicador etiqueta="Bajo mínimo" valor={bajoMinimo.length} detalle={bajoMinimo.length ? "Revisá y reponé" : "Todo en orden"} icono={AlertTriangle} alerta={bajoMinimo.length>0} delay={90}
            onClick={bajoMinimo.length ? ()=>{setTab("productos");setCat("Todos");setBusq("");} : undefined}/>
          <Indicador etiqueta="Valor al costo" valor={fmtMoney(valorInventario,moneda)} detalle="Stock × costo" icono={Coins} destacado delay={140}/>
          <Indicador etiqueta="Movimientos" valor={manuales.length} detalle="Registrados a mano" icono={ArrowLeftRight} delay={190} onClick={()=>setTab("movimientos")}/>
        </Indicadores>
      )}
      pestanas={{ activa: tab, onCambiar: setTab, items: [
        { key: "productos", label: "Productos", cuenta: productos.length },
        { key: "movimientos", label: "Movimientos", cuenta: manuales.length },
        { key: "kardex", label: "Kardex" },
      ] }}
    >
      {tab === "productos" && (<>
        <BarraFiltros resumen={`${visibles.length} de ${productos.length}`}>
          <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por nombre o código…"/>
          <Selector valor={cat} onCambio={setCat} opciones={categorias}/>
        </BarraFiltros>
        <Tabla columnas={columnasProductos} filas={visibles} onFila={p=>setModal(p)}
          vacio={<Vacio icono={Package} titulo={productos.length===0 ? "Todavía no hay productos" : "Sin resultados"}
            texto={productos.length===0 ? "Creá tu primer producto para empezar a controlar el inventario." : "Probá con otra búsqueda o categoría."}
            accion={productos.length===0 && <Boton icono={Plus} onClick={()=>setModal({})}>Nuevo producto</Boton>}/>}/>
      </>)}

      {tab === "movimientos" && (
        <Tabla columnas={columnasMovs} filas={[...manuales].reverse()}
          vacio={<Vacio icono={SlidersHorizontal} titulo="Sin movimientos todavía"
            texto="Registrá entradas, salidas o ajustes de conteo físico."
            accion={<Boton icono={Plus} onClick={()=>setShowModalMov(true)}>Nuevo movimiento</Boton>}/>}/>
      )}

      {tab === "kardex" && (
        <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
          <Tarjeta className="w-full lg:w-60 shrink-0 flex flex-col max-h-60 lg:max-h-none min-h-0">
            <div className="p-3"><Buscador valor={busqK} onCambio={setBusqK} className="!min-w-0 !max-w-none"/></div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
              {prodsFiltK.length===0 && <p className="text-center text-monki-k/40 text-xs py-8">Sin productos</p>}
              {prodsFiltK.map(p=>(
                <button key={p.id} type="button" onClick={()=>setSelected(p.id)}
                  className={`ui-boton w-full text-left px-3 py-2 rounded-xl transition-all duration-200 ${selected===p.id?"bg-monki-k text-monki-y":"hover:bg-monki-cream"}`}>
                  <p className="text-[13px] font-bold truncate">{p.nombre}</p>
                  <p className={`font-mono text-[10px] mt-0.5 ${selected===p.id?"text-monki-y/70":"text-monki-k/45"}`}>Stock {p.stock??"—"} {p.unidad||""}</p>
                </button>
              ))}
            </div>
          </Tarjeta>
          <div className="flex-1 min-w-0 flex flex-col min-h-[320px] lg:min-h-0">
            {!prodKardex ? (
              <Tarjeta className="flex-1 flex items-center justify-center">
                <Vacio icono={Package} titulo="Elegí un producto" texto="Seleccioná un producto de la lista para ver todos sus movimientos."/>
              </Tarjeta>
            ) : (<>
              <BarraFiltros>
                <span className="text-[18px] font-black tracking-[-0.03em] text-monki-k mr-2">{prodKardex.nombre}</span>
                <label className="flex items-center gap-2 monki-tag text-monki-k/55">Desde <Entrada type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="!w-auto !py-1.5"/></label>
                <label className="flex items-center gap-2 monki-tag text-monki-k/55">Hasta <Entrada type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="!w-auto !py-1.5"/></label>
              </BarraFiltros>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Indicador etiqueta="Entradas" valor={`+${totalEntradas}`}/>
                <Indicador etiqueta="Salidas" valor={`-${totalSalidas}`}/>
                <Indicador etiqueta="Stock actual" valor={prodKardex.stock??"—"} destacado/>
              </div>
              <Tabla columnas={columnasKardex} filas={movimientos} claveFila={m=>`${m.fecha}-${m.ref}-${m.tipo}-${m.detalle}`}
                vacio={<Vacio titulo="Sin movimientos en el período" texto="Cambiá las fechas para ver más."/>}/>
            </>)}
          </div>
        </div>
      )}

      {modal !== null && (
        <ProductoModal prod={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {showModalMov && (
        <ModalMovimiento productos={productos} onClose={()=>setShowModalMov(false)} onGuardar={()=>{setShowModalMov(false);cargar();}}/>
      )}
      {dialogo}
    </Modulo>
  );
}
