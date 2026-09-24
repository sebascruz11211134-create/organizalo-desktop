import { getAutorSync } from "../utils/auth";
/**
 * ComprasScreen — Facturas de proveedor / compras
 * Registra gastos con crédito fiscal de IVA.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Check, ShoppingCart, Edit2, CreditCard, Receipt } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Tarjeta, Vacio, Estado, Indicadores, Indicador, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { useAccionInicial } from "../hooks/useAccionInicial";
import { fmtMoney, hoy, genId, fmtDate, fechaLocal, mesLocal } from "../utils/fmt";
import { crearCXP, aumentarInventario } from "../utils/clienteUtils";

const CATEGORIAS = ["Mercadería","Materia prima","Servicios","Equipo","Suministros","Alquiler","Publicidad","Transporte","Otro"];
const MEDIOS = ["Efectivo","Transferencia","SINPE Móvil","Tarjeta","Cheque","Crédito proveedor"];

const ESTADOS = {
  pendiente:  { label:"Pendiente",   tono:"alerta" },
  pagada:     { label:"Pagada",      tono:"exito" },
  vencida:    { label:"Vencida",     tono:"peligro" },
};

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return <Estado tono={e.tono}>{e.label}</Estado>;
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
      setFechaVence(fechaLocal(vence));
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
      creadoPor: compra?.creadoPor || getAutorSync(),
    });
  };

  const Desplegable = ({ children }) => (
    <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-44 overflow-auto">{children}</div>
  );
  return (
    <Modulo
      seccion="Compras"
      titulo={compra ? "Editar compra" : "Nueva compra"}
      descripcion="Factura de proveedor: suma crédito fiscal de IVA y, si es mercadería, aumenta el inventario."
      acciones={<>
        <Boton variante="fantasma" icono={X} onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={guardar}>Guardar</Boton>
      </>}
    >
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_17rem] gap-3">
        <Tarjeta className="overflow-y-auto" cuerpo="p-4 space-y-4">
          <div className="relative">
            <Campo etiqueta="Proveedor" ayuda={diasProvee > 0 ? `Plazo de pago: ${diasProvee} días — el vencimiento se calcula solo` : undefined}>
              <Entrada value={busq} autoComplete="off"
                onChange={e=>{setBusq(e.target.value);setProveedor(e.target.value);setShowProv(true);}}
                onFocus={()=>setShowProv(true)} onBlur={()=>setTimeout(()=>setShowProv(false),150)}
                placeholder="Nombre del proveedor…"/>
            </Campo>
            {showProv && filtrados.length>0 && (
              <Desplegable>
                {filtrados.map(c=>(
                  <button key={c.id} type="button" onMouseDown={()=>seleccionarProveedor(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                    {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                    <span className="font-semibold">{c.nombre}</span>
                    <span className="text-monki-k/40 ml-1.5 font-mono text-xs">{c.cedula}</span>
                    {c.dias_credito > 0 && <span className="ml-1.5 text-[10px] font-bold">{c.dias_credito}d de pago</span>}
                  </button>
                ))}
              </Desplegable>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="N.° de factura del proveedor"><Entrada value={numFactura} onChange={e=>setNumFactura(e.target.value)} placeholder="FAC-0012345" className="font-mono"/></Campo>
            <Campo etiqueta="Categoría"><Seleccion value={categoria} onChange={e=>setCategoria(e.target.value)} opciones={CATEGORIAS}/></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Fecha de la factura"><Entrada type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Campo>
            <Campo etiqueta="Vencimiento"><Entrada type="date" value={fechaVence} onChange={e=>setFechaVence(e.target.value)}/></Campo>
            <Campo etiqueta="Estado"><Seleccion value={estado} onChange={e=>setEstado(e.target.value)} opciones={Object.entries(ESTADOS).map(([k,v])=>({value:k,label:v.label}))}/></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Monto base (sin IVA)"><Entrada type="number" value={montoBase} onChange={e=>setMontoBase(e.target.value)} min="0" step="any" placeholder="0" className="text-right"/></Campo>
            <Campo etiqueta="IVA (crédito fiscal)">
              <Seleccion value={pctIVA} onChange={e=>setPctIVA(Number(e.target.value))}
                opciones={[{value:0,label:"0% — Exento"},{value:1,label:"1%"},{value:2,label:"2%"},{value:4,label:"4%"},{value:8,label:"8%"},{value:13,label:"13%"}]}/>
            </Campo>
            <Campo etiqueta="Medio de pago"><Seleccion value={medio} onChange={e=>setMedio(e.target.value)} opciones={MEDIOS}/></Campo>
          </div>
          {INVENTARIABLE.includes(categoria) && (
            <div className="border-t-2 border-black/5 pt-4">
              <div className="relative">
                <Campo etiqueta="Productos recibidos" ayuda="Al guardar se suma el stock de estos productos.">
                  <Entrada value={busqProd} autoComplete="off"
                    onChange={e=>{setBusqProd(e.target.value);setShowProds(true);}}
                    onFocus={()=>setShowProds(true)} onBlur={()=>setTimeout(()=>setShowProds(false),150)}
                    placeholder="Buscar producto del catálogo…"/>
                </Campo>
                {showProds && prodsFiltrados.length>0 && (
                  <div className="animate-desplegar absolute top-[72px] left-0 w-full bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-40 overflow-auto">
                    {prodsFiltrados.map(p=>(
                      <button key={p.id} type="button" onMouseDown={()=>agregarLinea(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0 flex justify-between">
                        <span className="font-semibold">{p.nombre}</span><span className="font-mono text-[11px] text-monki-k/50">Stock {p.stock ?? "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {lineas.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {lineas.map((l,i)=>(
                    <div key={i} className="animate-desplegar flex items-center gap-2 bg-monki-cream rounded-xl pl-3 pr-1 py-1">
                      <span className="flex-1 text-sm font-semibold">{l.descripcion}</span>
                      <input type="number" min="0.01" step="any" value={l.cantidad}
                        onChange={e=>setLineas(lineas.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                        className="w-20 bg-white border-2 border-black/10 rounded-lg px-2 py-1 text-sm text-right"/>
                      <span className="text-[10px] text-monki-k/45">unds.</span>
                      <BotonIcono icono={X} titulo="Quitar" tono="peligro" onClick={()=>setLineas(lineas.filter((_,j)=>j!==i))}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Tarjeta>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="animate-entrar bg-monki-k text-white rounded-[18px] p-5">
            <p className="monki-tag text-monki-y mb-3">Resumen</p>
            <div className="flex justify-between text-sm text-white/70 py-1"><span>Base imponible</span><span>{fmtMoney(base,"CRC")}</span></div>
            <div className="flex justify-between text-sm text-white/70 py-1"><span>IVA ({pctIVA}%) fiscal</span><span>{fmtMoney(montoIVA,"CRC")}</span></div>
            <div className="border-t border-white/15 mt-2 pt-3">
              <p className="monki-tag text-white/50">Total</p>
              <p className="text-[26px] font-black tracking-[-0.03em] text-monki-y leading-tight">{fmtMoney(total,"CRC")}</p>
            </div>
          </div>
          <Tarjeta cuerpo="p-4 space-y-3">
            <Campo etiqueta="Observaciones"><AreaTexto value={notas} onChange={e=>setNotas(e.target.value)} rows={4} placeholder="Notas, referencia interna…"/></Campo>
            {(proyectos||[]).length > 0 && (
              <Campo etiqueta="Proyecto">
                <Seleccion value={proyectoId} onChange={e=>setProyectoId(e.target.value)}
                  opciones={[{value:"",label:"— Sin proyecto —"}, ...(proyectos||[]).filter(p=>p.estado==="Activo").map(p=>({value:p.id,label:`${p.nombre}${p.codigo?` (${p.codigo})`:""}`}))]}/>
              </Campo>
            )}
          </Tarjeta>
        </div>
      </div>
    </Modulo>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function ComprasScreen() {
  const { confirmar, dialogo } = useConfirmar();
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
              creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
            }]);
          }
        }
      } catch (e) { console.warn("[Compras] asiento:", e.message); }
    }

    cargar(); setVista("lista"); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar compra", "¿Eliminar esta compra? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
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
  const totMes = compras.filter(x=>x.fecha?.startsWith(mesLocal(new Date()))).reduce((s,c)=>s+c.total,0);
  const totIVA  = compras.filter(x=>x.estado!=="vencida").reduce((s,c)=>s+(c.montoIVA||0),0);

  const nueva = () => { setEditando(null); setVista("form"); };
  useAccionInicial({ accion: v => v === "nuevo" && nueva() });
  const editar = c => { setEditando(c); setVista("form"); };
  const columnas = [
    { key: "prov", titulo: "Proveedor", render: c => <div><b className="text-monki-k">{c.proveedor || "—"}</b>{c.creadoPor && <div className="text-[10px] text-monki-k/45">Por {c.creadoPor}</div>}</div> },
    { key: "num", titulo: "N.° factura", render: c => <span className="font-mono text-xs text-monki-k/55">{c.numFactura || "—"}</span> },
    { key: "cat", titulo: "Categoría", render: c => <span className="text-monki-k/60 text-xs">{c.categoria}</span> },
    { key: "fecha", titulo: "Fecha", render: c => fmtDate(c.fecha) },
    { key: "vence", titulo: "Vence", render: c => <span className={c.estado==="vencida"?"text-red-600 font-bold":"text-monki-k/55"}>{c.fechaVence ? fmtDate(c.fechaVence) : "—"}</span> },
    { key: "total", titulo: "Total", alinear: "right", render: c => <b>{fmtMoney(c.total,"CRC")}</b> },
    { key: "iva", titulo: "IVA", alinear: "right", render: c => <span className="text-monki-k/55 text-xs">{fmtMoney(c.montoIVA||0,"CRC")}</span> },
    { key: "estado", titulo: "Estado", render: c => <Badge estado={c.estado}/> },
    { key: "acc", titulo: "", alinear: "right", render: c => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        {c.estado==="pendiente" && <BotonIcono icono={Check} titulo="Marcar pagada" onClick={()=>marcarPagada(c.id)}/>}
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>editar(c)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(c.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="Compras"
      titulo="Facturas de proveedor"
      descripcion="Lo que comprás: gastos, mercadería y el IVA que podés rebajar como crédito fiscal."
      acciones={<Boton icono={Plus} onClick={nueva}>Nueva compra</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Por pagar" valor={fmtMoney(totPendiente,"CRC")} icono={CreditCard} destacado delay={40} onClick={()=>setFiltroEst("pendiente")}/>
          <Indicador etiqueta="Compras del mes" valor={fmtMoney(totMes,"CRC")} icono={ShoppingCart} delay={90}/>
          <Indicador etiqueta="IVA crédito fiscal" valor={fmtMoney(totIVA,"CRC")} icono={Receipt} delay={140}/>
          <Indicador etiqueta="Vencidas" valor={compras.filter(c=>c.estado==="vencida").length} alerta={compras.some(c=>c.estado==="vencida")} delay={190} onClick={()=>setFiltroEst("vencida")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtroEst, onCambiar: setFiltroEst, items: [{ key: "todos", label: "Todas", cuenta: compras.length }, ...Object.entries(ESTADOS).map(([key,v]) => ({ key, label: v.label }))] }}
    >
      <BarraFiltros resumen={`${filtradas.length} compras`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por proveedor o número…"/>
      </BarraFiltros>
      <Tabla columnas={columnas} filas={filtradas} seleccionada={selected} onFila={c=>setSelected(selected===c.id?null:c.id)}
        vacio={<Vacio icono={ShoppingCart} titulo={compras.length ? "Sin resultados" : "Sin compras registradas"} texto={compras.length ? "Probá con otra búsqueda o estado." : "Registrá las facturas de tus proveedores para llevar el crédito fiscal."}
          accion={!compras.length && <Boton icono={Plus} onClick={nueva}>Nueva compra</Boton>}/>}/>
      {dialogo}
    </Modulo>
  );
}
