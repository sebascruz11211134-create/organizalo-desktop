/**
 * KardexScreen — Historial de movimientos de inventario por producto
 * Entradas: compras, ajuste manual
 * Salidas:  facturas, POS, órdenes de trabajo, ajuste manual
 * Ajuste:   corrección directa de stock
 */
import React, { useState, useEffect, useCallback } from "react";
import { Package, FileSpreadsheet, Plus } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Tabla, Tarjeta, Vacio, Estado, Indicador, Modal, Campo, Entrada, Seleccion } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtDate, hoy, genId, mesLocal } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function mesActual() { return mesLocal(new Date()); }

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

  const tonoMov = t => t === "Entrada" ? "exito" : t === "Salida" ? "peligro" : "alerta";
  const columnas = [
    { key: "fecha", titulo: "Fecha", render: m => fmtDate(m.fecha) },
    { key: "tipo", titulo: "Tipo", render: m => <Estado tono={tonoMov(m.tipo)}>{m.tipo}</Estado> },
    { key: "origen", titulo: "Origen", render: m => <span className="text-monki-k/60">{m.origen}</span> },
    { key: "ref", titulo: "Referencia", render: m => <span className="font-mono text-xs">{m.ref}</span> },
    { key: "detalle", titulo: "Detalle", render: m => <span className="text-monki-k/60 truncate block max-w-[200px] text-xs">{m.detalle}</span> },
    { key: "cant", titulo: "Cantidad", alinear: "right", render: m => <b className={m.tipo==="Salida"?"text-red-600":""}>{m.tipo === "Entrada" ? `+${m.cant}` : m.tipo === "Salida" ? `-${m.cant}` : `=${m.saldo}`}</b> },
    { key: "saldo", titulo: "Saldo", alinear: "right", render: m => <b>{m.saldo}</b> },
  ];

  return (
    <Modulo
      seccion="Inventario"
      titulo="Kardex"
      descripcion="Cada entrada, salida y ajuste de un producto, con el saldo que queda."
      acciones={<>
        {producto && <Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>}
        <Boton icono={Plus} onClick={() => setShowModal(true)}>Movimiento</Boton>
      </>}
    >
      <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
        <Tarjeta className="w-full lg:w-64 shrink-0 flex flex-col max-h-60 lg:max-h-none min-h-0">
          <div className="p-3"><Buscador valor={busq} onCambio={setBusq} className="!min-w-0 !max-w-none"/></div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {filtrados.length === 0 && <p className="text-center text-monki-k/40 text-xs py-8">Sin productos</p>}
            {filtrados.map(p => (
              <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                className={`ui-boton w-full text-left px-3 py-2 rounded-xl transition-all duration-200 ${selected === p.id ? "bg-monki-k text-monki-y" : "hover:bg-monki-cream"}`}>
                <p className="text-[13px] font-bold truncate">{p.nombre}</p>
                <p className={`font-mono text-[10px] mt-0.5 ${selected === p.id ? "text-monki-y/70" : "text-monki-k/45"}`}>Stock {p.stock ?? "—"} {p.unidad || ""}</p>
              </button>
            ))}
          </div>
        </Tarjeta>
        <div className="flex-1 min-w-0 flex flex-col min-h-[320px] lg:min-h-0">
          {!producto ? (
            <Tarjeta className="flex-1 flex items-center justify-center">
              <Vacio icono={Package} titulo="Elegí un producto" texto="Seleccioná un producto de la lista, o registrá una entrada, salida o ajuste."
                accion={<Boton icono={Plus} onClick={() => setShowModal(true)}>Movimiento</Boton>}/>
            </Tarjeta>
          ) : (<>
            <BarraFiltros>
              <span className="text-[18px] font-black tracking-[-0.03em] text-monki-k mr-2">{producto.nombre}</span>
              <label className="flex items-center gap-2 monki-tag text-monki-k/55">Desde <Entrada type="date" value={desde} onChange={e => setDesde(e.target.value)} className="!w-auto !py-1.5"/></label>
              <label className="flex items-center gap-2 monki-tag text-monki-k/55">Hasta <Entrada type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="!w-auto !py-1.5"/></label>
            </BarraFiltros>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Indicador etiqueta="Entradas" valor={`+${totalEntradas}`}/>
              <Indicador etiqueta="Salidas" valor={`-${totalSalidas}`}/>
              <Indicador etiqueta="Stock actual" valor={producto.stock ?? "—"} destacado/>
            </div>
            <Tabla columnas={columnas} filas={movimientos} claveFila={m => `${m.fecha}-${m.ref}-${m.tipo}-${m.detalle}-${m.saldo}`}
              vacio={<Vacio titulo="Sin movimientos en el período" texto="Cambiá las fechas para ver más."/>}/>
          </>)}
        </div>
      </div>
      {showModal && (
        <ModalMovimiento productos={productos} onClose={() => setShowModal(false)} onGuardar={() => { setShowModal(false); cargar(); }}/>
      )}
    </Modulo>
  );
}
