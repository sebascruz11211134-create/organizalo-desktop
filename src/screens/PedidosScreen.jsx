import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Check, Package, Edit2, CalendarDays, ArrowRight } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Vacio, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { reducirInventario } from "../utils/clienteUtils";

const COLS = [
  { key:"pendiente",  label:"Pendiente",   cabecera:"bg-white text-monki-k",        punto:"bg-monki-k/30" },
  { key:"proceso",    label:"En proceso",  cabecera:"bg-monki-y text-monki-k",      punto:"bg-monki-k" },
  { key:"listo",      label:"Listo",       cabecera:"bg-monki-k text-monki-y",      punto:"bg-monki-y" },
  { key:"entregado",  label:"Entregado",   cabecera:"bg-[#dcfce7] text-[#166534]",  punto:"bg-[#166534]" },
];

function FormPedido({ pedido, contactos, productos, onGuardar, onCancelar }) {
  const [cliente,  setCliente]  = useState(pedido?.cliente || "");
  const [busq,     setBusq]     = useState(pedido?.cliente || "");
  const [showC,    setShowC]    = useState(false);
  const [desc,     setDesc]     = useState(pedido?.descripcion || "");
  const [monto,    setMonto]    = useState(pedido?.monto || "");
  const [fecha,    setFecha]    = useState(pedido?.fecha || hoy());
  const [entrega,  setEntrega]  = useState(pedido?.fechaEntrega || "");
  const [estado,   setEstado]   = useState(pedido?.estado || "pendiente");
  const [notas,    setNotas]    = useState(pedido?.notas || "");
  const [lineas,   setLineas]   = useState(pedido?.lineas || []);
  const [busqProd, setBusqProd] = useState("");
  const [showProd, setShowProd] = useState(false);

  const prodsFilt = (productos||[]).filter(p =>
    p.nombre?.toLowerCase().includes(busqProd.toLowerCase())
  ).slice(0,6);

  const agregarProd = (p) => {
    const ya = lineas.find(l => l.productoId === p.id);
    if (ya) setLineas(lineas.map(l => l.productoId === p.id ? { ...l, cantidad: (parseFloat(l.cantidad)||0) + 1 } : l));
    else setLineas([...lineas, { productoId: p.id, descripcion: p.nombre, cantidad: 1 }]);
    setBusqProd(""); setShowProd(false);
  };

  const filtrados = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
    c.cedula?.includes(busq) ||
    c.codigoCliente?.toUpperCase().includes(busq.toUpperCase())
  ).slice(0,5);

  return (
    <Modal titulo={pedido ? "Editar pedido" : "Nuevo pedido"} subtitulo="Lo que el cliente te encargó" onCerrar={onCancelar} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={()=>onGuardar({ id:pedido?.id||genId(), cliente, descripcion:desc, monto:parseFloat(monto)||0, fecha, fechaEntrega:entrega, estado, notas, lineas, creadoEn:pedido?.creadoEn||new Date().toISOString() })}>Guardar pedido</Boton></>}>
      <div className="space-y-4">
        <div className="relative">
          <Campo etiqueta="Cliente">
            <Entrada value={busq} onChange={e=>{setBusq(e.target.value);setCliente(e.target.value);setShowC(true);}}
              onFocus={()=>setShowC(true)} onBlur={()=>setTimeout(()=>setShowC(false),150)} placeholder="Nombre o código CLI-XXXX…" />
          </Campo>
          {showC && filtrados.length>0 && (
            <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-40 overflow-auto">
              {filtrados.map(c=>(
                <button key={c.id} type="button" onMouseDown={()=>{setCliente(c.nombre);setBusq(c.nombre);setShowC(false);}}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                  {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                  <span className="font-semibold">{c.nombre}</span>
                  <span className="text-monki-k/40 ml-2 font-mono text-xs">{c.cedula}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Campo etiqueta="Descripción del pedido"><AreaTexto value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Qué incluye el pedido…" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Monto (₡)"><Entrada type="number" value={monto} onChange={e=>setMonto(e.target.value)} min="0" placeholder="0" /></Campo>
          <Campo etiqueta="Estado"><Seleccion value={estado} onChange={e=>setEstado(e.target.value)} opciones={COLS.map(c=>({value:c.key,label:c.label}))} /></Campo>
          <Campo etiqueta="Fecha del pedido"><Entrada type="date" value={fecha} onChange={e=>setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Fecha de entrega"><Entrada type="date" value={entrega} onChange={e=>setEntrega(e.target.value)} /></Campo>
        </div>
        <Campo etiqueta="Notas"><Entrada value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Notas adicionales…" /></Campo>
        <div>
          <div className="relative">
            <Campo etiqueta="Productos" ayuda="Se descuentan del inventario cuando el pedido se entrega.">
              <Entrada value={busqProd} onChange={e=>{setBusqProd(e.target.value);setShowProd(true);}}
                onFocus={()=>setShowProd(true)} onBlur={()=>setTimeout(()=>setShowProd(false),150)} placeholder="Buscar producto…" />
            </Campo>
            {showProd && prodsFilt.length>0 && (
              <div className="animate-desplegar absolute top-[72px] left-0 w-full bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-36 overflow-auto">
                {prodsFilt.map(p=>(
                  <button key={p.id} type="button" onMouseDown={()=>agregarProd(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0 flex justify-between">
                    <span className="font-semibold">{p.nombre}</span><span className="font-mono text-[11px] text-monki-k/50">Stock {p.stock ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {lineas.length>0 && (
            <div className="mt-2 space-y-1.5">
              {lineas.map((l,i)=>(
                <div key={i} className="animate-desplegar flex items-center gap-2 bg-monki-cream rounded-xl pl-3 pr-1 py-1">
                  <span className="flex-1 text-sm font-semibold">{l.descripcion}</span>
                  <input type="number" min="0.01" value={l.cantidad}
                    onChange={e=>setLineas(lineas.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                    className="w-20 bg-white border-2 border-black/10 rounded-lg px-2 py-1 text-sm text-right" />
                  <BotonIcono icono={X} titulo="Quitar" tono="peligro" onClick={()=>setLineas(lineas.filter((_,j)=>j!==i))} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function PedidosScreen() {
  const [pedidos,   setPedidos]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [p,c,pr] = await Promise.all([db.getPedidos(), db.getContactos(), db.getProductos()]);
    setPedidos(p||[]); setContactos(c||[]); setProductos(pr||[]);
  },[]);

  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const guardar = async (p) => {
    const all = await db.getPedidos();
    const idx = all.findIndex(x=>x.id===p.id);
    await db.setPedidos(idx>=0 ? all.map((x,i)=>i===idx?p:x) : [...all,p]);
    cargar(); setForm(false); setEditando(null);
  };

  const mover = async (id, nuevoEstado) => {
    const all = await db.getPedidos();
    const pedido = all.find(x => x.id === id);
    await db.setPedidos(all.map(x=>x.id===id?{...x,estado:nuevoEstado}:x));

    // Al entregar → reducir inventario si tiene líneas de productos
    if (nuevoEstado === "entregado" && pedido?.lineas?.length) {
      await reducirInventario(pedido.lineas);
    }

    cargar();
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar pedido", "¿Eliminar este pedido? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
    const all = await db.getPedidos();
    await db.setPedidos(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = pedidos.filter(p =>
    p.cliente?.toLowerCase().includes(busq.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(busq.toLowerCase())
  );
  const sel = pedidos.find(p => p.id === selected);

  const enCurso = pedidos.filter(p => p.estado === "pendiente" || p.estado === "proceso");
  const hoyStr = hoy();
  const atrasados = pedidos.filter(p => p.fechaEntrega && p.fechaEntrega < hoyStr && p.estado !== "entregado");
  const nuevo = () => { setEditando(null); setForm(true); };

  return (
    <Modulo
      seccion="Ventas"
      titulo="Pedidos"
      descripcion="Tablero de pedidos: movelos de columna a medida que avanzan."
      acciones={<Boton icono={Plus} onClick={nuevo}>Nuevo pedido</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Pedidos" valor={pedidos.length} icono={Package} delay={40} />
          <Indicador etiqueta="En curso" valor={enCurso.length} detalle="Pendientes o en proceso" destacado delay={90} />
          <Indicador etiqueta="Listos" valor={pedidos.filter(p=>p.estado==="listo").length} detalle="Por entregar" icono={Check} delay={140} />
          <Indicador etiqueta="Atrasados" valor={atrasados.length} detalle={atrasados.length ? "Pasó la fecha de entrega" : "Todo a tiempo"} icono={CalendarDays} alerta={atrasados.length>0} delay={190} />
        </Indicadores>
      }
    >
      <BarraFiltros resumen={sel ? null : `${filtrados.length} pedidos`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por cliente o descripción…" />
      </BarraFiltros>
      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionado</span>
          <b>{sel.cliente || "Sin cliente"}</b><span className="text-white/60 truncate max-w-xs">{sel.descripcion}</span>
          <div className="flex-1" />
          <Boton variante="amarillo" tamano="sm" icono={Edit2} onClick={()=>{setEditando(sel);setForm(true);}}>Editar</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={()=>eliminar(sel.id)}>Eliminar</Boton>
          <BotonIcono icono={X} titulo="Quitar selección" onClick={()=>setSelected(null)} />
        </div>
      )}
      {pedidos.length === 0 ? (
        <div className="ui-tarjeta flex-1 bg-white rounded-[18px] border-2 border-black/10 flex items-center justify-center">
          <Vacio icono={Package} titulo="Todavía no hay pedidos" texto="Registrá lo que tus clientes te encargan y seguilo hasta la entrega."
            accion={<Boton icono={Plus} onClick={nuevo}>Nuevo pedido</Boton>} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto -mx-1 px-1 pb-1">
          <div className="flex gap-3 h-full min-w-max">
            {COLS.map((col, ci) => {
              const items = filtrados.filter(p => p.estado === col.key);
              return (
                <div key={col.key} style={{ animationDelay: `${ci*60}ms` }}
                  className="animate-entrar w-72 flex flex-col rounded-[18px] bg-white/60 border-2 border-black/10 overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center gap-2 ${col.cabecera}`}>
                    <span className={`w-2 h-2 rounded-full ${col.punto}`}/>
                    <span className="text-sm font-extrabold">{col.label}</span>
                    <span className="ml-auto font-mono text-[11px] bg-white/80 text-monki-k px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <div className="flex-1 overflow-auto p-2.5 space-y-2">
                    {items.map(p=>{
                      const activo = selected===p.id;
                      return (
                        <div key={p.id} onClick={()=>setSelected(activo?null:p.id)}
                          className={`animate-desplegar cursor-pointer rounded-2xl p-3 border-2 transition-all duration-300 ease-monki ${activo?"bg-[#FFF4B8] border-monki-k shadow-[4px_4px_0_#111] -translate-x-0.5 -translate-y-0.5":"bg-white border-transparent hover:border-black/15 hover:-translate-y-0.5"}`}>
                          <p className="font-extrabold text-sm text-monki-k leading-tight">{p.cliente || "Sin cliente"}</p>
                          {p.descripcion && <p className="text-xs text-monki-k/55 mt-1 line-clamp-2">{p.descripcion}</p>}
                          <div className="flex items-center justify-between mt-2">
                            {p.monto>0 ? <b className="text-sm">{fmtMoney(p.monto,"CRC")}</b> : <span/>}
                            {p.fechaEntrega && <span className={`font-mono text-[10px] ${p.fechaEntrega < hoyStr && p.estado!=="entregado" ? "text-red-600 font-bold" : "text-monki-k/45"}`}>Entrega {fmtDate(p.fechaEntrega)}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-black/5" onClick={e=>e.stopPropagation()}>
                            {COLS.filter(c=>c.key!==col.key).map(c=>(
                              <button key={c.key} type="button" onClick={()=>mover(p.id,c.key)}
                                className="ui-boton inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/5 text-monki-k/60 hover:bg-monki-k hover:text-monki-y transition-colors">
                                <ArrowRight size={10}/>{c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {items.length===0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-monki-k/25">
                        <Package size={22}/><p className="text-xs mt-1 font-semibold">Vacío</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {form && <FormPedido pedido={editando} contactos={contactos} productos={productos}
        onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}} />}
      {dialogo}
    </Modulo>
  );
}
