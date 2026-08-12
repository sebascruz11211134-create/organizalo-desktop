import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, X, Check, Wrench } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";

const ESTADOS = {
  recibido:   { label:"Recibido",    cls:"bg-slate-100 text-slate-600" },
  diagnostico:{ label:"Diagnóstico", cls:"bg-blue-100 text-blue-700" },
  reparacion: { label:"Reparación",  cls:"bg-amber-100 text-amber-700" },
  listo:      { label:"Listo",       cls:"bg-green-100 text-green-700" },
  entregado:  { label:"Entregado",   cls:"bg-slate-100 text-slate-500" },
};

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.recibido;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${e.cls}`}>{e.label}</span>;
}

function FormOrden({ orden, contactos, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    cliente:      orden?.cliente || "",
    telefono:     orden?.telefono || "",
    equipo:       orden?.equipo || "",
    problema:     orden?.problema || "",
    diagnostico:  orden?.diagnostico || "",
    tecnico:      orden?.tecnico || "",
    estado:       orden?.estado || "recibido",
    fecha:        orden?.fecha || hoy(),
    fechaEntrega: orden?.fechaEntrega || "",
    manoObra:     orden?.manoObra || "",
    repuestos:    orden?.repuestos || "",
    total:        orden?.total || "",
    notas:        orden?.notas || "",
    busq:         orden?.cliente || "",
  });
  const u = k => e => setF(p=>({...p,[k]:e.target.value}));
  const [showC, setShowC] = useState(false);
  const filtrados = contactos.filter(c=>
    c.nombre?.toLowerCase().includes(f.busq.toLowerCase()) ||
    c.cedula?.includes(f.busq) ||
    c.codigoCliente?.toUpperCase().includes(f.busq.toUpperCase())
  ).slice(0,5);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-800">{orden ? `OT-${orden.numero}` : "Nueva orden de trabajo"}</h2>
          <button onClick={onCancelar}><X size={18} className="text-slate-400"/></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Cliente</label>
              <input value={f.busq} onChange={e=>{setF(p=>({...p,busq:e.target.value,cliente:e.target.value}));setShowC(true);}}
                onFocus={()=>setShowC(true)} onBlur={()=>setTimeout(()=>setShowC(false),150)}
                placeholder="Nombre o CLI-XXXX…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
              {showC && filtrados.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-28 overflow-auto">
                  {filtrados.map(c=>(
                    <button key={c.id} onMouseDown={()=>setF(p=>({...p,cliente:c.nombre,busq:c.nombre,telefono:c.telefono||""}))}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-1">{c.telefono}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Teléfono</label>
              <input value={f.telefono} onChange={u("telefono")} placeholder="8888-8888"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Equipo / vehículo / artículo</label>
            <input value={f.equipo} onChange={u("equipo")} placeholder="Marca, modelo, serie…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Problema reportado</label>
            <textarea value={f.problema} onChange={u("problema")} rows={2} placeholder="Qué falla el cliente reporta…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Diagnóstico técnico</label>
            <textarea value={f.diagnostico} onChange={u("diagnostico")} rows={2} placeholder="Diagnóstico y trabajo a realizar…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Técnico</label>
              <input value={f.tecnico} onChange={u("tecnico")} placeholder="Nombre…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Estado</label>
              <select value={f.estado} onChange={u("estado")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Entrega estimada</label>
              <input type="date" value={f.fechaEntrega} onChange={u("fechaEntrega")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Mano de obra (₡)</label>
              <input type="number" value={f.manoObra} onChange={u("manoObra")} min="0" placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 text-right"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Repuestos (₡)</label>
              <input type="number" value={f.repuestos} onChange={u("repuestos")} min="0" placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 text-right"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Total (₡)</label>
              <input type="number" value={f.total||((parseFloat(f.manoObra)||0)+(parseFloat(f.repuestos)||0))} onChange={u("total")} min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 text-right font-bold"/>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onCancelar} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={()=>onGuardar({ id:orden?.id||genId(), numero:orden?.numero||Date.now().toString().slice(-5), ...f, manoObra:parseFloat(f.manoObra)||0, repuestos:parseFloat(f.repuestos)||0, total:parseFloat(f.total)||(parseFloat(f.manoObra)||0)+(parseFloat(f.repuestos)||0), creadoEn:orden?.creadoEn||new Date().toISOString() })}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600">
            <Check size={14}/> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdenesTrabajoScreen() {
  const [ordenes,   setOrdenes]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");

  const cargar = useCallback(async () => {
    const [o,c] = await Promise.all([db.getOrdenes(), db.getContactos()]);
    setOrdenes(o||[]); setContactos(c||[]);
  },[]);
  useEffect(()=>{cargar();},[cargar]);

  const guardar = async (o) => {
    const all = await db.getOrdenes();
    const idx = all.findIndex(x=>x.id===o.id);
    await db.setOrdenes(idx>=0?all.map((x,i)=>i===idx?o:x):[...all,o]);
    cargar(); setForm(false); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar orden?")) return;
    const all = await db.getOrdenes();
    await db.setOrdenes(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtradas = ordenes.filter(o =>
    (filtroEst==="todos"||o.estado===filtroEst) &&
    (o.cliente?.toLowerCase().includes(busq.toLowerCase())||o.equipo?.toLowerCase().includes(busq.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full">
      {form && <FormOrden orden={editando} contactos={contactos} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}}/>}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Cliente o equipo…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"/>
        </div>
        <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">{filtradas.length} órdenes</span>
          <button onClick={()=>{setEditando(null);setForm(true);}}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
            <Plus size={14}/> Nueva OT
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {filtradas.length===0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Wrench size={40} className="text-slate-200"/><p className="text-sm">No hay órdenes de trabajo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(o=>(
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-brand-300 group">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Wrench size={16} className="text-slate-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm">OT-{o.numero}</span>
                    <Badge estado={o.estado}/>
                    <span className="text-xs text-slate-400">{o.cliente}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{o.equipo} · {o.problema}</p>
                  {o.tecnico && <p className="text-[10px] text-slate-400">Técnico: {o.tecnico}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmtMoney(o.total||0,"CRC")}</p>
                  <p className="text-[10px] text-slate-400">{fmtDate(o.fecha)}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={()=>{setEditando(o);setForm(true);}} className="text-xs px-2 py-1 rounded hover:bg-slate-100 text-slate-500">Editar</button>
                  <button onClick={()=>eliminar(o.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
