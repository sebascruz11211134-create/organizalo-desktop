/**
 * ProyectosScreen — Centro de costos / Proyectos
 * Cada proyecto puede tener ingresos y gastos asignados (desde facturas y gastos).
 * Muestra un P&L simple por proyecto.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, X, Trash2, Layers, ChevronDown, ChevronRight } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

const ESTADOS = ["Activo","Completado","Pausado","Cancelado"];

// ── Modal proyecto ────────────────────────────────────────────────────────────
function ProyectoModal({ proyecto, onClose, onSave }) {
  const esNuevo = !proyecto?.id;
  const [form, setForm] = useState(proyecto || {
    nombre:"", codigo:"", descripcion:"", responsable:"",
    fechaInicio: hoy(), fechaFin:"", presupuesto:"", estado:"Activo",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    const todos = await db.getProyectos();
    const item  = { ...form, presupuesto: parseFloat(form.presupuesto)||0 };
    if (esNuevo) {
      item.id = genId(); item.creadoEn = new Date().toISOString();
      await db.setProyectos([...todos, item]);
    } else {
      await db.setProyectos(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-900">{esNuevo?"Nuevo proyecto":"Editar proyecto"}</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>
        <div className="space-y-3">
          {[["Nombre del proyecto *","nombre","text"],["Código","codigo","text"],["Responsable","responsable","text"]].map(([lbl,key,type])=>(
            <label key={key} className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
              <input type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Fecha inicio</span>
              <input type="date" value={form.fechaInicio||""} onChange={e=>u("fechaInicio",e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Fecha fin</span>
              <input type="date" value={form.fechaFin||""} onChange={e=>u("fechaFin",e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Presupuesto (₡)</span>
              <input type="number" min="0" value={form.presupuesto||""} onChange={e=>u("presupuesto",e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Estado</span>
              <select value={form.estado||"Activo"} onChange={e=>u("estado",e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span>
            <textarea value={form.descripcion||""} onChange={e=>u("descripcion",e.target.value)} rows={2}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>
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

// ── Modal asignar transacción ─────────────────────────────────────────────────
function AsignarModal({ proyecto, facturas, gastos, onClose, onSave }) {
  const [tab,        setTab]        = useState("facturas");
  const [seleccion,  setSeleccion]  = useState([]);

  const toggle = (id) => setSeleccion(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const guardar = async () => {
    const todos = await db.getProyectos();
    const asig  = proyecto.asignaciones || {};
    const nuevas = { ...asig };
    seleccion.forEach(id=>{ nuevas[id] = tab; });
    await db.setProyectos(todos.map(x=>x.id===proyecto.id?{...x,asignaciones:nuevas}:x));
    onSave(); onClose();
  };

  const lista = tab==="facturas" ? facturas : gastos;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-slate-900">Asignar a "{proyecto.nombre}"</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>
        <div className="flex gap-2 mb-3">
          {["facturas","gastos"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab===t?"bg-brand-500 text-white":"bg-slate-100 text-slate-500"}`}>
              {t==="facturas"?"Facturas":"Gastos"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {lista.map(item=>{
            const yaAsig = (proyecto.asignaciones||{})[item.id];
            const sel    = seleccion.includes(item.id);
            return (
              <label key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                ${yaAsig?"border-blue-200 bg-blue-50":sel?"border-slate-600 bg-slate-50":"border-slate-100 hover:border-slate-300"}`}>
                <input type="checkbox" checked={sel||!!yaAsig} onChange={()=>!yaAsig&&toggle(item.id)} disabled={!!yaAsig}
                  className="accent-brand-500"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.nombreReceptor||item.descripcion||"Sin nombre"}</p>
                  <p className="text-xs text-slate-400">{fmtDate(item.fechaEmision||item.fecha)} · {fmtMoney(item.totalGeneral||item.monto,"CRC")}</p>
                </div>
                {yaAsig && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Asignado</span>}
              </label>
            );
          })}
          {lista.length===0 && <p className="text-slate-400 text-sm text-center py-8">Sin registros</p>}
        </div>
        <div className="flex gap-3 mt-4 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar}  className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Asignar seleccionados</button>
        </div>
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ProyectosScreen() {
  const [proyectos, setProyectos] = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [gastos,    setGastos]    = useState([]);
  const [modal,     setModal]     = useState(null); // null | {type:"editar"|"asignar", proy}
  const [expandido, setExpandido] = useState({});

  const cargar = useCallback(async ()=>{
    const [p,f,g,c] = await Promise.all([db.getProyectos(), db.getFacturas(), db.getGastos(), db.getCompras()]);
    setProyectos(p||[]); setFacturas(f||[]); setGastos([...(g||[]), ...(c||[])]);
  },[]);
  useEffect(()=>{ cargar(); },[cargar]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este proyecto?")) return;
    const todos = await db.getProyectos();
    await db.setProyectos(todos.filter(x=>x.id!==id));
    cargar();
  };

  const pnl = (proyecto) => {
    const asig = proyecto.asignaciones || {};
    // Facturas: manuales + auto-imputadas por proyectoId
    const ingresos = facturas
      .filter(f => asig[f.id]==="facturas" || f.proyectoId === proyecto.id)
      .reduce((s,f) => s + (f.totalGeneral || f.total || 0), 0);
    // Gastos: manuales + compras auto-imputadas por proyectoId
    const costos = gastos
      .filter(g => asig[g.id]==="gastos" || g.proyectoId === proyecto.id)
      .reduce((s,g) => s + (g.monto || g.total || g.montoBase || 0), 0);
    return { ingresos, costos, utilidad: ingresos - costos };
  };

  const toggleExp = (id) => setExpandido(p=>({...p,[id]:!p[id]}));

  const estadoColor = {
    "Activo":"text-green-700 bg-green-50", "Completado":"text-blue-700 bg-blue-50",
    "Pausado":"text-yellow-700 bg-yellow-50", "Cancelado":"text-red-600 bg-red-50",
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Proyectos / Centros de costo</h1>
          <p className="text-sm text-slate-500">Asigná facturas y gastos a proyectos y mirá el P&L.</p>
        </div>
        <button onClick={()=>setModal({type:"nuevo"})} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
          <Plus size={14}/> Nuevo proyecto
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-3">
        {proyectos.length===0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Layers size={40} className="text-slate-300"/>
            <p className="text-lg font-semibold">Sin proyectos</p>
            <button onClick={()=>setModal({type:"nuevo"})} className="btn-primary mt-2">+ Crear proyecto</button>
          </div>
        ) : proyectos.map(p=>{
          const { ingresos, costos, utilidad } = pnl(p);
          const exp = expandido[p.id];
          const asig = p.asignaciones||{};
          const nAsig = Object.keys(asig).length;
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-4 px-5 py-4">
                <button onClick={()=>toggleExp(p.id)} className="p-1 rounded hover:bg-gray-100">
                  {exp?<ChevronDown size={15} className="text-slate-400"/>:<ChevronRight size={15} className="text-slate-400"/>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{p.nombre}</p>
                    {p.codigo && <span className="text-[11px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{p.codigo}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoColor[p.estado]||"bg-slate-100 text-slate-500"}`}>{p.estado}</span>
                  </div>
                  {p.responsable && <p className="text-xs text-slate-500 mt-0.5">Resp: {p.responsable}</p>}
                </div>

                {/* P&L mini */}
                <div className="flex gap-5 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Ingresos</p>
                    <p className="text-sm font-semibold text-green-700">{fmtMoney(ingresos,"CRC")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Costos</p>
                    <p className="text-sm font-semibold text-red-600">{fmtMoney(costos,"CRC")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Utilidad</p>
                    <p className={`text-sm font-black ${utilidad>=0?"text-slate-900":"text-red-700"}`}>{fmtMoney(utilidad,"CRC")}</p>
                  </div>
                  {p.presupuesto>0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Presup.</p>
                      <p className="text-xs font-semibold text-slate-500">{((costos/p.presupuesto)*100).toFixed(0)}% ej.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={()=>setModal({type:"asignar",proy:p})} title="Asignar transacciones"
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-slate-400 transition-colors">
                    Asignar ({nAsig})
                  </button>
                  <button onClick={()=>setModal({type:"editar",proy:p})} className="p-1.5 rounded hover:bg-gray-100 text-slate-400"><Edit2 size={13}/></button>
                  <button onClick={()=>eliminar(p.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13}/></button>
                </div>
              </div>

              {exp && (
                <div className="px-12 pb-4 border-t border-slate-100 bg-slate-50">
                  {p.descripcion && <p className="text-sm text-slate-500 py-2">{p.descripcion}</p>}
                  <div className="flex gap-8 text-xs text-slate-500 mt-1">
                    {p.fechaInicio && <span>Inicio: {fmtDate(p.fechaInicio)}</span>}
                    {p.fechaFin && <span>Fin: {fmtDate(p.fechaFin)}</span>}
                    {p.presupuesto>0 && <span>Presupuesto: {fmtMoney(p.presupuesto,"CRC")}</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {/* Facturas asignadas */}
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">Facturas ({facturas.filter(f=>asig[f.id]==="facturas").length})</p>
                      {facturas.filter(f=>asig[f.id]==="facturas").slice(0,5).map(f=>(
                        <div key={f.id} className="flex justify-between text-xs text-slate-600 py-0.5">
                          <span className="truncate max-w-[140px]">{f.nombreReceptor||"Sin nombre"}</span>
                          <span className="font-semibold text-green-700">{fmtMoney(f.totalGeneral,"CRC")}</span>
                        </div>
                      ))}
                    </div>
                    {/* Gastos asignados */}
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">Gastos ({gastos.filter(g=>asig[g.id]==="gastos").length})</p>
                      {gastos.filter(g=>asig[g.id]==="gastos").slice(0,5).map(g=>(
                        <div key={g.id} className="flex justify-between text-xs text-slate-600 py-0.5">
                          <span className="truncate max-w-[140px]">{g.descripcion||"Sin desc."}</span>
                          <span className="font-semibold text-red-600">{fmtMoney(g.monto,"CRC")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal?.type==="nuevo"  && <ProyectoModal onClose={()=>setModal(null)} onSave={cargar}/>}
      {modal?.type==="editar" && <ProyectoModal proyecto={modal.proy} onClose={()=>setModal(null)} onSave={cargar}/>}
      {modal?.type==="asignar"&& <AsignarModal proyecto={modal.proy} facturas={facturas} gastos={gastos} onClose={()=>setModal(null)} onSave={cargar}/>}
    </div>
  );
}
