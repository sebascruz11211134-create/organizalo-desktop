/**
 * UsuariosScreen — Gestión de usuarios y roles
 * Roles: admin | contador | vendedor | solo_lectura
 * Cada usuario tiene un PIN de 4 dígitos para identificarse.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, X, Shield, Eye, EyeOff, Trash2 } from "lucide-react";
import db from "../utils/db";
import { genId, hoy } from "../utils/fmt";

const ROLES = [
  { id:"admin",        label:"Administrador",  desc:"Acceso completo a todas las funciones y configuraciones.",   color:"bg-red-100 text-red-800" },
  { id:"contador",     label:"Contador",        desc:"Acceso a contabilidad, reportes y declaraciones. Sin facturar.", color:"bg-purple-100 text-purple-800" },
  { id:"vendedor",     label:"Vendedor",        desc:"Puede facturar, ver CXC y recibos. Sin acceso a contabilidad.", color:"bg-blue-100 text-blue-800" },
  { id:"solo_lectura", label:"Solo lectura",    desc:"Ve reportes y datos pero no puede crear ni editar nada.",    color:"bg-slate-100 text-slate-600" },
];

const PERMISOS = {
  admin:        ["*"],
  contador:     ["contabilidad","reportes","d104","planillas","configuracion"],
  vendedor:     ["facturacion","cxc","recibos","inventario","contactos","cotizaciones","pos","pedidos"],
  solo_lectura: ["reportes","estado-cuenta","reporte-cxc","reporte-recibos","reporte-vencidos"],
};

function UsuarioModal({ usuario, onClose, onSave }) {
  const esNuevo = !usuario?.id;
  const [form, setForm] = useState(usuario || { nombre:"", correo:"", rol:"vendedor", pin:"", activo:true });
  const [showPin, setShowPin] = useState(false);
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    if (!form.pin || form.pin.length !== 4 || !/^\d+$/.test(form.pin)) return alert("PIN debe ser exactamente 4 dígitos.");
    const todos = await db.getUsuarios();
    const item  = { ...form };
    if (esNuevo) {
      item.id       = genId();
      item.creadoEn = new Date().toISOString();
      await db.setUsuarios([...todos, item]);
    } else {
      await db.setUsuarios(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  const rolInfo = ROLES.find(r=>r.id===form.rol);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNuevo?"Nuevo usuario":"Editar usuario"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Nombre completo *</span>
            <input value={form.nombre} onChange={e=>u("nombre",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Correo</span>
            <input type="email" value={form.correo} onChange={e=>u("correo",e.target.value)}
              placeholder="usuario@empresa.com"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Rol</span>
            <select value={form.rol} onChange={e=>u("rol",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
              {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            {rolInfo && <p className="text-xs text-slate-400 mt-1">{rolInfo.desc}</p>}
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">PIN (4 dígitos) *</span>
            <div className="relative mt-1">
              <input type={showPin?"text":"password"} value={form.pin} onChange={e=>u("pin",e.target.value.slice(0,4))}
                maxLength={4} placeholder="••••"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
              <button type="button" onClick={()=>setShowPin(p=>!p)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                {showPin?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.activo} onChange={e=>u("activo",e.target.checked)} className="rounded"/>
            <span className="text-sm text-slate-700">Usuario activo</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [modal,    setModal]    = useState(null);
  const [usuActivo,setUsuActivo]= useState(null);

  const cargar = useCallback(async () => {
    const [u, ua] = await Promise.all([db.getUsuarios(), db.getUsuarioActivo()]);
    setUsuarios(u);
    setUsuActivo(ua);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const todos = await db.getUsuarios();
    await db.setUsuarios(todos.filter(x=>x.id!==id));
    cargar();
  };

  const activar = async (usuario) => {
    await db.setUsuarioActivo(usuario);
    setUsuActivo(usuario);
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Usuarios y roles</h1>
            <p className="text-sm text-slate-500 mt-0.5">Controlá quién accede a cada módulo del sistema</p>
          </div>
          <button onClick={()=>setModal({})}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Plus size={14}/> Nuevo usuario
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Roles explicados */}
        <div className="grid grid-cols-4 gap-3">
          {ROLES.map(r=>(
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 ${r.color}`}>{r.label}</span>
              <p className="text-xs text-slate-500">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* Lista usuarios */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Usuarios ({usuarios.length})</h3>
            {usuActivo && (
              <span className="text-xs text-slate-400">
                Sesión activa: <strong className="text-slate-700">{usuActivo.nombre}</strong>
              </span>
            )}
          </div>

          {usuarios.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Shield size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="font-semibold">Sin usuarios configurados</p>
              <p className="text-sm mt-1">Agregá usuarios para controlar el acceso al sistema</p>
              <button onClick={()=>setModal({})} className="mt-4 btn-primary">+ Crear primer usuario</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sesión</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {usuarios.map(u=>{
                  const rolInfo = ROLES.find(r=>r.id===u.rol);
                  const esSesion = usuActivo?.id===u.id;
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold text-slate-900">{u.nombre}</td>
                      <td className="text-slate-500 text-sm">{u.correo||"—"}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${rolInfo?.color||""}`}>
                          {rolInfo?.label||u.rol}
                        </span>
                      </td>
                      <td>
                        {esSesion
                          ? <span className="text-xs text-emerald-700 font-semibold">● Activo</span>
                          : <button onClick={()=>activar(u)} className="text-xs text-blue-600 hover:underline">Cambiar a este</button>}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.activo?"bg-green-50 text-emerald-700":"bg-slate-100 text-slate-400"}`}>
                          {u.activo?"Activo":"Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={()=>setModal(u)} className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-700">
                            <Edit2 size={13}/>
                          </button>
                          <button onClick={()=>eliminar(u.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Tabla de permisos por rol */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Permisos por rol</h3>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 bg-slate-50 border border-slate-200 font-semibold text-slate-600">Módulo</th>
                  {ROLES.map(r=>(
                    <th key={r.id} className="py-2 px-3 bg-slate-50 border border-slate-200 font-semibold text-slate-600">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Facturación electrónica","facturacion"],
                  ["CXC / CXP","cxc"],
                  ["Recibos de caja","recibos"],
                  ["Inventario","inventario"],
                  ["Reportes","reportes"],
                  ["Planillas","planillas"],
                  ["Declaración D-104","d104"],
                  ["Contabilidad","contabilidad"],
                  ["Usuarios","*"],
                  ["Configuración","configuracion"],
                ].map(([label,perm])=>(
                  <tr key={perm}>
                    <td className="py-1.5 px-3 border border-slate-100 text-slate-700">{label}</td>
                    {ROLES.map(r=>{
                      const tiene = PERMISOS[r.id]?.includes("*") || PERMISOS[r.id]?.includes(perm);
                      return (
                        <td key={r.id} className="py-1.5 px-3 border border-slate-100 text-center">
                          {tiene
                            ? <span className="text-emerald-600 font-bold">✓</span>
                            : <span className="text-slate-200">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal!==null && (
        <UsuarioModal usuario={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
    </div>
  );
}
