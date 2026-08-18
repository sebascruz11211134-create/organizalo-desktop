import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, X, Check, Package } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { reducirInventario } from "../utils/clienteUtils";

const COLS = [
  { key:"pendiente",  label:"Pendiente",   color:"bg-amber-50  border-amber-200",  dot:"bg-amber-400" },
  { key:"proceso",    label:"En proceso",  color:"bg-blue-50   border-blue-200",   dot:"bg-blue-500" },
  { key:"listo",      label:"Listo",       color:"bg-green-50  border-green-200",  dot:"bg-green-500" },
  { key:"entregado",  label:"Entregado",   color:"bg-slate-50  border-slate-200",  dot:"bg-slate-400" },
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">{pedido ? "Editar pedido" : "Nuevo pedido"}</h2>
          <button onClick={onCancelar} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16}/></button>
        </div>

        <div className="space-y-3">
          {/* Cliente */}
          <div className="relative">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Cliente</label>
            <input value={busq} onChange={e=>{setBusq(e.target.value);setCliente(e.target.value);setShowC(true);}}
              onFocus={()=>setShowC(true)} onBlur={()=>setTimeout(()=>setShowC(false),150)}
              placeholder="Nombre o código CLI-XXXX…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            {showC && filtrados.length>0 && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-36 overflow-auto">
                {filtrados.map(c=>(
                  <button key={c.id} onMouseDown={()=>{setCliente(c.nombre);setBusq(c.nombre);setShowC(false);}}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
                    {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                    <span className="font-semibold">{c.nombre}</span>
                    <span className="text-slate-400 ml-2">{c.cedula}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descripción del pedido</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
              placeholder="Qué incluye el pedido…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Monto (₡)</label>
              <input type="number" value={monto} onChange={e=>setMonto(e.target.value)} min="0"
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Estado</label>
              <select value={estado} onChange={e=>setEstado(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                {COLS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha pedido</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha entrega</label>
              <input type="date" value={entrega} onChange={e=>setEntrega(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Notas</label>
            <input value={notas} onChange={e=>setNotas(e.target.value)}
              placeholder="Notas adicionales…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </div>

          {/* Productos del pedido (opcional — reduce inventario al entregar) */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">📦 Productos (reduce inventario al entregar)</label>
            <div className="relative">
              <input value={busqProd} onChange={e=>{setBusqProd(e.target.value);setShowProd(true);}}
                onFocus={()=>setShowProd(true)} onBlur={()=>setTimeout(()=>setShowProd(false),150)}
                placeholder="Buscar producto…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              {showProd && prodsFilt.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-32 overflow-auto">
                  {prodsFilt.map(p=>(
                    <button key={p.id} onMouseDown={()=>agregarProd(p)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-50 border-b last:border-0 flex justify-between">
                      <span>{p.nombre}</span><span className="text-slate-400">Stock: {p.stock ?? "—"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {lineas.length>0 && (
              <div className="mt-2 space-y-1">
                {lineas.map((l,i)=>(
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1">
                    <span className="flex-1 text-xs">{l.descripcion}</span>
                    <input type="number" min="0.01" value={l.cantidad}
                      onChange={e=>setLineas(lineas.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                      className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right" />
                    <button onClick={()=>setLineas(lineas.filter((_,j)=>j!==i))} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancelar} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={()=>onGuardar({ id:pedido?.id||genId(), cliente, descripcion:desc, monto:parseFloat(monto)||0, fecha, fechaEntrega:entrega, estado, notas, lineas, creadoEn:pedido?.creadoEn||new Date().toISOString() })}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600">
            <Check size={14}/> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PedidosScreen() {
  const [pedidos,   setPedidos]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");

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

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar pedido?")) return;
    const all = await db.getPedidos();
    await db.setPedidos(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = pedidos.filter(p =>
    p.cliente?.toLowerCase().includes(busq.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(busq.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {form && <FormPedido pedido={editando} contactos={contactos} productos={productos}
        onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}} />}

      {/* Barra */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar pedido…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{pedidos.length} pedidos</span>
          <button onClick={()=>{setEditando(null);setForm(true);}}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
            <Plus size={14}/> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {COLS.map(col => {
            const items = filtrados.filter(p => p.estado === col.key);
            return (
              <div key={col.key} className={`w-72 flex flex-col rounded-2xl border ${col.color} overflow-hidden`}>
                {/* Header columna */}
                <div className="px-4 py-2.5 flex items-center gap-2 border-b border-inherit">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`}/>
                  <span className="text-xs font-bold text-slate-700">{col.label}</span>
                  <span className="ml-auto text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-auto p-3 space-y-2">
                  {items.map(p=>(
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-white hover:border-brand-200 group">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-sm text-slate-800 leading-tight">{p.cliente || "Sin cliente"}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={()=>{setEditando(p);setForm(true);}} className="p-1 rounded hover:bg-slate-100 text-slate-400 text-xs">✏️</button>
                          <button onClick={()=>eliminar(p.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11}/></button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{p.descripcion}</p>
                      {p.monto>0 && <p className="text-xs font-bold text-green-700">{fmtMoney(p.monto,"CRC")}</p>}
                      {p.fechaEntrega && <p className="text-[10px] text-slate-400 mt-1">📅 Entrega: {fmtDate(p.fechaEntrega)}</p>}
                      {/* Mover a siguiente estado */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                        {COLS.filter(c=>c.key!==col.key).map(c=>(
                          <button key={c.key} onClick={()=>mover(p.id,c.key)}
                            className="flex-1 text-[10px] py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 truncate">
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {items.length===0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                      <Package size={24}/><p className="text-xs mt-1">Vacío</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
