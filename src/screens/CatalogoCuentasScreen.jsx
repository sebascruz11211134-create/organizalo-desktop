/**
 * CatalogoCuentasScreen — Plan de cuentas contables (NIIF PYMES Costa Rica)
 * Permite ver, agregar y editar cuentas. Viene pre-cargado con el plan estándar CR.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, X, ChevronRight } from "lucide-react";
import db from "../utils/db";
import { PLAN_DEFAULT, TIPOS_CUENTA } from "../utils/planCuentas";
import { genId } from "../utils/fmt";

const TIPO_BADGE = {
  activo:     "bg-blue-50 text-blue-700",
  pasivo:     "bg-red-50 text-red-700",
  patrimonio: "bg-purple-50 text-purple-700",
  ingreso:    "bg-green-50 text-green-700",
  costo:      "bg-amber-50 text-amber-700",
  gasto:      "bg-slate-100 text-slate-600",
};

function CuentaModal({ cuenta, cuentas, onClose, onSave }) {
  const esNueva = !cuenta?.id;
  const [form, setForm] = useState(cuenta || { codigo:"", nombre:"", tipo:"activo", nivel:3, esGrupo:false, descripcion:"" });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.codigo || !form.nombre) return alert("Código y nombre requeridos.");
    const todas = await db.getCuentasContables() || PLAN_DEFAULT;
    const item  = { ...form, nivel: parseInt(form.nivel)||3 };
    if (esNueva) {
      item.id = genId();
      await db.setCuentasContables([...todas, item].sort((a,b)=>a.codigo.localeCompare(b.codigo)));
    } else {
      await db.setCuentasContables(todas.map(x=>x.id===item.id||x.codigo===item.codigo?item:x).sort((a,b)=>a.codigo.localeCompare(b.codigo)));
    }
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNueva?"Nueva cuenta":"Editar cuenta"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["Código *","codigo","text",""],["Nombre *","nombre","text","col-span-2"]].map(([lbl,key,type,cls])=>(
            <label key={key} className={`block ${cls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
              <input type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Tipo</span>
            <select value={form.tipo} onChange={e=>u("tipo",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              {TIPOS_CUENTA.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Nivel</span>
            <select value={form.nivel} onChange={e=>u("nivel",parseInt(e.target.value))}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              <option value={1}>1 — Grupo mayor</option>
              <option value={2}>2 — Sub-grupo</option>
              <option value={3}>3 — Cuenta detalle</option>
            </select>
          </label>
          <label className="flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={form.esGrupo} onChange={e=>u("esGrupo",e.target.checked)} className="rounded"/>
            <span className="text-sm text-slate-700">Es cuenta de grupo (no recibe asientos directamente)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoCuentasScreen() {
  const [cuentas, setCuentas] = useState([]);
  const [busq,    setBusq]    = useState("");
  const [tipo,    setTipo]    = useState("Todos");
  const [modal,   setModal]   = useState(null);

  const cargar = useCallback(async () => {
    const saved = await db.getCuentasContables();
    if (!saved) {
      // Primera vez: cargar plan por defecto
      const plan = PLAN_DEFAULT.map(c=>({...c, id: c.codigo}));
      await db.setCuentasContables(plan);
      setCuentas(plan);
    } else {
      setCuentas(saved);
    }
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = cuentas.filter(c => {
    if (tipo !== "Todos" && c.tipo !== tipo) return false;
    if (busqL && !c.codigo?.toLowerCase().includes(busqL) && !c.nombre?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const resetPlan = async () => {
    if (!confirm("¿Restaurar el plan de cuentas estándar? Esto borra las cuentas personalizadas.")) return;
    const plan = PLAN_DEFAULT.map(c=>({...c,id:c.codigo}));
    await db.setCuentasContables(plan);
    setCuentas(plan);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)}
            placeholder="Buscar por código o nombre…" className="bg-transparent text-sm flex-1 outline-none"/>
        </div>
        <select value={tipo} onChange={e=>setTipo(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
          <option value="Todos">Todos los tipos</option>
          {TIPOS_CUENTA.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
        <button onClick={resetPlan} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-2 rounded-lg">
          Restaurar plan CR
        </button>
        <button onClick={()=>setModal({})}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
          <Plus size={14}/> Nueva cuenta
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
        <span>{cuentas.filter(c=>!c.esGrupo).length} cuentas de detalle</span>
        <span>{cuentas.filter(c=>c.esGrupo).length} grupos</span>
        <span>{visibles.length} mostrando</span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Nivel</th>
              <th>Grupo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(c => (
              <tr key={c.id||c.codigo}
                className={c.nivel===1 ? "bg-slate-50 font-bold" : c.nivel===2 ? "bg-white font-semibold" : ""}>
                <td className={`font-mono text-xs ${c.nivel===1?"text-slate-900":"c.nivel===2"?"text-slate-700":"text-slate-500"}`}>
                  {"  ".repeat(c.nivel-1)}{c.codigo}
                </td>
                <td className={c.nivel===1?"text-slate-900 font-black":c.nivel===2?"text-slate-800 font-bold":"text-slate-700"}>
                  {c.nivel > 1 && <ChevronRight size={10} className="inline text-slate-300 mr-1"/>}
                  {c.nombre}
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIPO_BADGE[c.tipo]||"bg-slate-100 text-slate-500"}`}>
                    {c.tipo}
                  </span>
                </td>
                <td className="text-slate-400 text-xs">{c.nivel}</td>
                <td className="text-slate-400 text-xs">{c.esGrupo?"Sí":"—"}</td>
                <td>
                  {!c.esGrupo && (
                    <button onClick={()=>setModal(c)} className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-700">
                      <Edit2 size={12}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <CuentaModal cuenta={Object.keys(modal).length>0?modal:null} cuentas={cuentas} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
    </div>
  );
}
