import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, X, Check, Users } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, genId } from "../utils/fmt";

const PUESTOS = ["Gerente","Administrador","Vendedor","Técnico","Operario","Contador","Recepcionista","Repartidor","Otro"];
const TIPOS_JORNADA = ["Tiempo completo","Tiempo parcial","Por hora","Por proyecto"];

function FormEmpleado({ emp, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre:     emp?.nombre || "",
    cedula:     emp?.cedula || "",
    puesto:     emp?.puesto || "Vendedor",
    jornada:    emp?.jornada || "Tiempo completo",
    salario:    emp?.salario || "",
    email:      emp?.email || "",
    telefono:   emp?.telefono || "",
    fechaIngreso:emp?.fechaIngreso || "",
    ccss:       emp?.ccss || "",
    activo:     emp?.activo ?? true,
    notas:      emp?.notas || "",
  });
  const u = k => e => setF(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));

  // Cálculos CCSS
  const salario  = parseFloat(f.salario)||0;
  const ccssObrero  = salario * 0.1067;
  const ccssPatrono = salario * 0.2625;
  const salarioNeto = salario - ccssObrero;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-800">{emp ? "Editar empleado" : "Nuevo empleado"}</h2>
          <button onClick={onCancelar}><X size={18} className="text-slate-400"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Nombre completo *</label>
              <input value={f.nombre} onChange={u("nombre")} placeholder="Nombre del empleado"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Cédula</label>
              <input value={f.cedula} onChange={u("cedula")} placeholder="X-XXXX-XXXX"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Puesto</label>
              <select value={f.puesto} onChange={u("puesto")}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
                {PUESTOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Jornada</label>
              <select value={f.jornada} onChange={u("jornada")}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
                {TIPOS_JORNADA.map(j=><option key={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Salario bruto (₡/mes)</label>
              <input type="number" value={f.salario} onChange={u("salario")} min="0" placeholder="0"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 text-right"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">N.º asegurado CCSS</label>
              <input value={f.ccss} onChange={u("ccss")} placeholder="Número asegurado"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
          </div>
          {salario>0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Carga obrera (10.67%)</span><span className="text-red-600">-{fmtMoney(ccssObrero,"CRC")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Carga patronal (26.25%)</span><span className="text-yellow-600">{fmtMoney(ccssPatrono,"CRC")}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>Salario neto a pagar</span><span className="text-yellow-700">{fmtMoney(salarioNeto,"CRC")}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Correo</label>
              <input value={f.email} onChange={u("email")} placeholder="correo@empresa.com"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Teléfono</label>
              <input value={f.telefono} onChange={u("telefono")} placeholder="8888-8888"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha de ingreso</label>
              <input type="date" value={f.fechaIngreso} onChange={u("fechaIngreso")}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={f.activo} onChange={u("activo")} className="rounded"/>
                <span className="text-slate-600 font-medium">Empleado activo</span>
              </label>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onCancelar} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={()=>onGuardar({ id:emp?.id||genId(), ...f, salario:parseFloat(f.salario)||0, creadoEn:emp?.creadoEn||new Date().toISOString() })}
            className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700">
            <Check size={14}/> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmpleadosScreen() {
  const [empleados, setEmpleados] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  const cargar = useCallback(async () => {
    setEmpleados(await db.getEmpleados() || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    const all = await db.getEmpleados();
    const idx = all.findIndex(x=>x.id===e.id);
    await db.setEmpleados(idx>=0?all.map((x,i)=>i===idx?e:x):[...all,e]);
    cargar(); setForm(false); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar empleado?")) return;
    const all = await db.getEmpleados();
    await db.setEmpleados(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = empleados.filter(e =>
    (!soloActivos || e.activo) &&
    (e.nombre?.toLowerCase().includes(busq.toLowerCase()) || e.puesto?.toLowerCase().includes(busq.toLowerCase()))
  );

  const totalPlanilla = filtrados.filter(e=>e.activo).reduce((s,e)=>s+(e.salario||0),0);

  return (
    <div className="flex flex-col h-full">
      {form && <FormEmpleado emp={editando} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}}/>}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar empleado…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={e=>setSoloActivos(e.target.checked)} className="rounded"/>
          Solo activos
        </label>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase">Total planilla</p>
            <p className="font-black text-sm text-slate-800">{fmtMoney(totalPlanilla,"CRC")}/mes</p>
          </div>
          <button onClick={()=>{setEditando(null);setForm(true);}}
            className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-yellow-700">
            <Plus size={14}/> Agregar empleado
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {filtrados.length===0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Users size={40} className="text-slate-200"/><p className="text-sm">Sin empleados registrados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(e=>(
              <div key={e.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-yellow-300 group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-sm"
                  style={{background: e.activo?"#059669":"#94a3b8"}}>
                  {(e.nombre||"?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm">{e.nombre}</span>
                    {!e.activo && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">Inactivo</span>}
                  </div>
                  <p className="text-xs text-slate-500">{e.puesto} · {e.jornada}</p>
                  {e.cedula && <p className="text-[10px] text-slate-400">Cédula: {e.cedula}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-slate-800">{fmtMoney(e.salario||0,"CRC")}</p>
                  <p className="text-[10px] text-slate-400">Salario bruto/mes</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={()=>{setEditando(e);setForm(true);}} className="text-xs px-2 py-1 rounded hover:bg-slate-100 text-slate-500">Editar</button>
                  <button onClick={()=>eliminar(e.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
