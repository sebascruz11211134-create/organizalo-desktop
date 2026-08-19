/**
 * EmpresasScreen — Multiempresa
 * Permite manejar múltiples RUCs/empresas desde una sola instalación.
 * Al cambiar de empresa, los datos están aislados por empresaId.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, X, Building2, Check, Trash2 } from "lucide-react";
import db from "../utils/db";
import { genId } from "../utils/fmt";

const TIPOS_CEDULA = ["Jurídica (3-xxx-xxxxxx)","Física (x-xxxx-xxxx)","DIMEX","NITE"];
const REGIMENES    = ["Régimen Tradicional","Régimen Simplificado"];

function EmpresaModal({ empresa, onClose, onSave }) {
  const esNueva = !empresa?.id;
  const [form, setForm] = useState(empresa || {
    nombre:"", nombreComercial:"", cedula:"", tipoCedula:"Jurídica (3-xxx-xxxxxx)",
    correo:"", telefono:"", direccion:"", regimen:"Régimen Tradicional",
    logoUrl:"", actividadEconomica:"", moneda:"CRC",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre || !form.cedula) return alert("Nombre legal y cédula requeridos.");
    const todas = await db.getEmpresas();
    const item  = { ...form };
    if (esNueva) {
      item.id       = genId();
      item.creadoEn = new Date().toISOString();
      await db.setEmpresas([...todas, item]);
    } else {
      await db.setEmpresas(todas.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  const campos = [
    ["Nombre legal / Razón social *","nombre","text","col-span-2"],
    ["Nombre comercial","nombreComercial","text","col-span-2"],
    ["Cédula jurídica / física *","cedula","text",""],
    ["Tipo de cédula","tipoCedula","select",""],
    ["Correo","correo","email",""],
    ["Teléfono","telefono","text",""],
    ["Actividad económica (CIIU)","actividadEconomica","text",""],
    ["Régimen tributario","regimen","select",""],
    ["Moneda principal","moneda","select",""],
    ["Dirección","direccion","text","col-span-2"],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNueva?"Nueva empresa":"Editar empresa"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {campos.map(([lbl,key,type,cls])=>(
            <label key={key} className={`block ${cls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
              {type==="select" ? (
                <select value={form[key]||""} onChange={e=>u(key,e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  {key==="tipoCedula" && TIPOS_CEDULA.map(t=><option key={t} value={t}>{t}</option>)}
                  {key==="regimen"    && REGIMENES.map(t=><option key={t} value={t}>{t}</option>)}
                  {key==="moneda"     && ["CRC","USD"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function EmpresasScreen() {
  const [empresas,   setEmpresas]   = useState([]);
  const [empresaId,  setEmpresaId]  = useState(null);
  const [modal,      setModal]      = useState(null);

  const cargar = useCallback(async () => {
    const [e, id] = await Promise.all([db.getEmpresas(), db.getEmpresaId()]);
    setEmpresas(e);
    setEmpresaId(id);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const seleccionar = async (empresa) => {
    await db.setEmpresaId(empresa.id);
    setEmpresaId(empresa.id);
    // También actualiza el settings con los datos de la empresa seleccionada
    const s = await db.getSettings();
    await db.setSettings({
      ...s,
      nombreNegocio:    empresa.nombre,
      nombreComercial:  empresa.nombreComercial || empresa.nombre,
      cedula:           empresa.cedula,
      correo:           empresa.correo,
      telefono:         empresa.telefono,
      direccion:        empresa.direccion,
      moneda:           empresa.moneda || "CRC",
    });
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta empresa? Sus datos locales se mantendrán pero no podrá ser seleccionada.")) return;
    const todas = await db.getEmpresas();
    await db.setEmpresas(todas.filter(x=>x.id!==id));
    cargar();
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Empresas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manejá múltiples empresas o RUCs desde una misma instalación.
              {empresaId && <span className="ml-2 text-blue-600 font-medium">Empresa activa seleccionada.</span>}
            </p>
          </div>
          <button onClick={()=>setModal({})}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Plus size={14}/> Nueva empresa
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Building2 size={40} className="text-slate-300"/>
            <p className="text-lg font-semibold">Sin empresas registradas</p>
            <p className="text-sm">Agregá tu primera empresa para empezar.</p>
            <button onClick={()=>setModal({})} className="btn-primary mt-2">+ Agregar empresa</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-3xl">
            {empresas.map(e=>{
              const esActiva = empresaId === e.id;
              return (
                <div key={e.id}
                  className={`bg-white border-2 rounded-xl p-6 flex items-center gap-5 transition-all
                    ${esActiva?"border-slate-800 shadow-sm":"border-slate-200 hover:border-slate-300"}`}>
                  {/* Logo / inicial */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                    ${esActiva?"bg-slate-900 text-white":"bg-slate-100 text-slate-500"}`}>
                    <span className="text-lg font-black">{e.nombre?.charAt(0)||"E"}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 truncate">{e.nombre}</p>
                      {esActiva && (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <Check size={10}/> Activa
                        </span>
                      )}
                    </div>
                    {e.nombreComercial && e.nombreComercial !== e.nombre && (
                      <p className="text-sm text-slate-500">{e.nombreComercial}</p>
                    )}
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      {e.cedula && <span>Cédula: {e.cedula}</span>}
                      {e.correo && <span>{e.correo}</span>}
                      {e.regimen && <span>{e.regimen}</span>}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!esActiva && (
                      <button onClick={()=>seleccionar(e)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:border-slate-800 hover:text-slate-900 text-slate-600 transition-colors">
                        Activar
                      </button>
                    )}
                    <button onClick={()=>setModal(e)} className="p-2 rounded-lg hover:bg-gray-100 text-slate-400 hover:text-slate-700">
                      <Edit2 size={14}/>
                    </button>
                    {!esActiva && (
                      <button onClick={()=>eliminar(e.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal!==null && (
        <EmpresaModal empresa={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
    </div>
  );
}
