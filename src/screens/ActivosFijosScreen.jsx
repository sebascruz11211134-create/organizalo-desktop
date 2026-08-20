/**
 * ActivosFijosScreen — Activos fijos con depreciación automática
 * Métodos: Línea recta / Saldo decreciente
 * Vida útil por años; calcula depreciación mensual y valor en libros.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, X, Trash2, Package, AlertCircle } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

const TIPOS  = ["Equipo de cómputo","Vehículo","Mobiliario y equipo","Edificio","Terreno","Intangible","Otro"];
const METODOS = ["Línea recta","Saldo decreciente"];

// ── Cálculo de depreciación ───────────────────────────────────────────────────
function calcDepreciacion(activo) {
  const { costo = 0, valorResidual = 0, vidaUtil = 5, metodo = "Línea recta", fechaCompra } = activo;
  if (!fechaCompra || !costo) return { depMensual: 0, depAnual: 0, valorLibros: costo, acumulada: 0 };

  const inicio      = new Date(fechaCompra + "T12:00:00");
  const hoyDate     = new Date();
  const mesesUsados = Math.max(0, (hoyDate.getFullYear() - inicio.getFullYear()) * 12
    + (hoyDate.getMonth() - inicio.getMonth()));

  const vidaMeses = vidaUtil * 12;
  const baseDeprec = costo - valorResidual;

  let acumulada = 0;
  let depMensual = 0;

  if (metodo === "Línea recta") {
    depMensual = baseDeprec / vidaMeses;
    acumulada  = Math.min(depMensual * mesesUsados, baseDeprec);
  } else {
    // Saldo decreciente: tasa anual = 2/vidaUtil
    const tasaAnual   = 2 / vidaUtil;
    const tasaMensual = tasaAnual / 12;
    let   saldo       = costo;
    for (let i = 0; i < Math.min(mesesUsados, vidaMeses); i++) {
      const dep = saldo * tasaMensual;
      acumulada += dep;
      depMensual = dep;
      saldo     -= dep;
      if (saldo <= valorResidual) { acumulada += (saldo - valorResidual); saldo = valorResidual; break; }
    }
  }

  const valorLibros = Math.max(valorResidual, costo - acumulada);
  return { depMensual: metodo==="Línea recta"?depMensual:depMensual, depAnual: depMensual*12, valorLibros, acumulada, pctDeprec: Math.min(100,(acumulada/baseDeprec)*100) };
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ActivoModal({ activo, onClose, onSave }) {
  const esNuevo = !activo?.id;
  const [form, setForm] = useState(activo || {
    nombre:"", tipo:"Equipo de cómputo", costo:"", valorResidual:"", vidaUtil:5,
    metodo:"Línea recta", fechaCompra: hoy(), ubicacion:"", proveedor:"", descripcion:"",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre || !form.costo) return alert("Nombre y costo son requeridos.");
    const todos = await db.getActivosFijos();
    const item  = { ...form, costo: parseFloat(form.costo)||0, valorResidual: parseFloat(form.valorResidual)||0, vidaUtil: parseInt(form.vidaUtil)||5 };
    if (esNuevo) {
      item.id = genId(); item.creadoEn = new Date().toISOString();
      await db.setActivosFijos([...todos, item]);
    } else {
      await db.setActivosFijos(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-900">{esNuevo?"Nuevo activo":"Editar activo"}</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Nombre del activo *", "nombre", "text", "col-span-2"],
            ["Tipo",                "tipo",   "select",""],
            ["Método",              "metodo", "select",""],
            ["Costo (₡) *",         "costo",  "number",""],
            ["Valor residual (₡)",  "valorResidual","number",""],
            ["Vida útil (años)",    "vidaUtil","number",""],
            ["Fecha de compra",     "fechaCompra","date",""],
            ["Ubicación",           "ubicacion","text",""],
            ["Proveedor",           "proveedor","text",""],
            ["Descripción",         "descripcion","text","col-span-2"],
          ].map(([lbl,key,type,cls])=>(
            <label key={key} className={`block ${cls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
              {type==="select"?(
                <select value={form[key]||""} onChange={e=>u(key,e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400">
                  {key==="tipo"   && TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                  {key==="metodo" && METODOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              ):(
                <input type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)} min={type==="number"?0:undefined}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"/>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar}  className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ActivosFijosScreen() {
  const [activos, setActivos] = useState([]);
  const [modal,   setModal]   = useState(null);

  const cargar = useCallback(async ()=>{ setActivos(await db.getActivosFijos()); },[]);
  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este activo?")) return;
    const todos = await db.getActivosFijos();
    await db.setActivosFijos(todos.filter(x=>x.id!==id));
    cargar();
  };

  // Totales
  const totalCosto     = activos.reduce((s,a)=>s+(a.costo||0),0);
  const totalLibros    = activos.reduce((s,a)=>s+calcDepreciacion(a).valorLibros,0);
  const totalAcumulada = activos.reduce((s,a)=>s+calcDepreciacion(a).acumulada,0);

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Activos Fijos</h1>
            <p className="text-sm text-slate-500">Depreciación automática — línea recta o saldo decreciente</p>
          </div>
          <button onClick={()=>setModal({})} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
            <Plus size={14}/> Nuevo activo
          </button>
        </div>

        {/* Resumen */}
        {activos.length>0 && (
          <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
            {[
              ["Total activos", activos.length+" registros", "text-slate-700"],
              ["Costo histórico", fmtMoney(totalCosto,"CRC"), "text-slate-900"],
              ["Dep. acumulada",  fmtMoney(totalAcumulada,"CRC"), "text-red-600"],
              ["Valor en libros", fmtMoney(totalLibros,"CRC"), "text-amber-700 font-bold"],
            ].map(([lbl,val,cls])=>(
              <div key={lbl}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{lbl}</p>
                <p className={`text-sm mt-0.5 ${cls}`}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {activos.length===0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Package size={40} className="text-slate-300"/>
            <p className="text-lg font-semibold">Sin activos registrados</p>
            <button onClick={()=>setModal({})} className="btn-primary mt-2">+ Agregar activo</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Activo","Tipo","Método","Costo","Dep. mensual","Acumulada","Valor libros","% dep.","Acciones"].map(h=>(
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activos.map(a=>{
                  const d = calcDepreciacion(a);
                  const vencido = d.pctDeprec>=100;
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">{a.nombre}</p>
                        <p className="text-[11px] text-slate-400">{fmtDate(a.fechaCompra)} · {a.vidaUtil} años</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{a.tipo}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{a.metodo==="Línea recta"?"Línea recta":"Sal. decr."}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{fmtMoney(a.costo,"CRC")}</td>
                      <td className="px-3 py-3 text-red-500 text-xs">{fmtMoney(d.depMensual,"CRC")}</td>
                      <td className="px-3 py-3 text-red-600">{fmtMoney(d.acumulada,"CRC")}</td>
                      <td className="px-3 py-3 font-bold text-slate-900">{fmtMoney(d.valorLibros,"CRC")}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${vencido?"bg-red-500":"bg-slate-600"}`} style={{width:`${Math.min(100,d.pctDeprec)}%`}}/>
                          </div>
                          <span className="text-xs text-slate-500">{d.pctDeprec.toFixed(0)}%</span>
                          {vencido && <AlertCircle size={11} className="text-red-500"/>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={()=>setModal(a)} className="p-1.5 rounded hover:bg-gray-100 text-slate-400"><Edit2 size={12}/></button>
                          <button onClick={()=>eliminar(a.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal!==null && (
        <ActivoModal activo={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
    </div>
  );
}
