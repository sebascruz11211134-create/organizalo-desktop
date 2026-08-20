/**
 * PortalClienteScreen — Portal de auto-consulta para clientes
 * Cada cliente puede acceder con su cédula/correo y ver:
 *   - Estado de cuenta / CXC
 *   - Facturas emitidas
 * Config se guarda en db.setPortalConfig()
 */
import React, { useState, useEffect, useCallback } from "react";
import { Globe, Save, CheckCircle, Users, FileText, Copy, ExternalLink, Eye } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

const BACKEND = "https://organizalo-backend-production.up.railway.app";

export default function PortalClienteScreen() {
  const [config,   setConfig]   = useState({ activo: false, titulo:"", mensaje:"", permitirDescarga:true, mostrarSaldo:true, colorPrincipal:"#0f172a" });
  const [contactos,setContactos]= useState([]);
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [guardado, setGuardado] = useState(false);
  const [copiado,  setCopiado]  = useState(false);
  const [preview,  setPreview]  = useState(null);

  const cargar = useCallback(async ()=>{
    const [c,co,d,s] = await Promise.all([db.getPortalConfig(), db.getContactos(), db.getDebts(), db.getSettings()]);
    if (c && Object.keys(c).length>1) setConfig(c);
    else setConfig(prev=>({...prev, titulo: `Portal de ${s?.nombreNegocio||"mi negocio"}`, mensaje:"Consultá tu estado de cuenta de forma fácil y segura."}));
    setContactos(co||[]); setDebts(d||[]); setSettings(s||{});
  },[]);
  useEffect(()=>{ cargar(); },[cargar]);

  const u = (k,v) => setConfig(p=>({...p,[k]:v}));

  const guardar = async () => {
    await db.setPortalConfig(config);
    setGuardado(true);
    setTimeout(()=>setGuardado(false), 2500);
  };

  const portalUrl = config.activo && settings.nombreNegocio
    ? `${BACKEND}/portal/${encodeURIComponent(settings.nombreNegocio.toLowerCase().replace(/\s+/g,"-"))}`
    : null;

  const copiar = () => {
    if (portalUrl) { navigator.clipboard.writeText(portalUrl); setCopiado(true); setTimeout(()=>setCopiado(false),2000); }
  };

  // Estadísticas rápidas
  const totalClientes    = contactos.filter(c=>c.tipo!=="proveedor").length;
  const totalCXCPendiente= debts.filter(d=>d.tipo==="cobrar"&&d.saldo>0).reduce((s,d)=>s+(d.saldo||0),0);
  const clientesConDeuda = [...new Set(debts.filter(d=>d.tipo==="cobrar"&&d.saldo>0).map(d=>d.contactoId))].length;

  // Preview de cliente
  const clientePreview = contactos.find(c=>c.id===preview);
  const debtPreview    = debts.filter(d=>d.contactoId===preview && d.tipo==="cobrar");
  const saldoPreview   = debtPreview.reduce((s,d)=>s+(d.saldo||0),0);

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Portal de clientes</h1>
            <p className="text-sm text-slate-500">Tus clientes pueden consultar su estado de cuenta en línea.</p>
          </div>
          <button onClick={guardar} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${guardado?"bg-yellow-600 text-white":"bg-yellow-600 text-white hover:bg-yellow-700"}`}>
            {guardado?<><CheckCircle size={14}/> Guardado</>:<><Save size={14}/> Guardar</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 grid grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Clientes activos", totalClientes, "text-slate-700"],
              ["Clientes con saldo", clientesConDeuda, "text-orange-700"],
              ["CXC total pendiente", fmtMoney(totalCXCPendiente,"CRC"), "text-red-600 font-bold"],
            ].map(([lbl,val,cls])=>(
              <div key={lbl} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">{lbl}</p>
                <p className={`text-lg mt-0.5 ${cls}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Activar portal */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-slate-900">Portal activo</p>
                <p className="text-sm text-slate-500 mt-0.5">Cuando está activo, los clientes pueden acceder con su cédula o correo.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={config.activo} onChange={e=>u("activo",e.target.checked)} className="sr-only peer"/>
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-yellow-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"/>
              </label>
            </div>

            {portalUrl && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Globe size={14} className="text-slate-400 shrink-0"/>
                <span className="text-xs text-slate-600 flex-1 truncate font-mono">{portalUrl}</span>
                <button onClick={copiar} className="p-1 hover:bg-gray-200 rounded">
                  {copiado?<CheckCircle size={13} className="text-yellow-600"/>:<Copy size={13} className="text-slate-400"/>}
                </button>
                <a href={portalUrl} target="_blank" rel="noreferrer" className="p-1 hover:bg-gray-200 rounded">
                  <ExternalLink size={13} className="text-slate-400"/>
                </a>
              </div>
            )}
          </div>

          {/* Configuración apariencia */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Apariencia y contenido</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Título del portal</span>
                <input value={config.titulo||""} onChange={e=>u("titulo",e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
              </label>
              <label className="block col-span-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Mensaje de bienvenida</span>
                <textarea value={config.mensaje||""} onChange={e=>u("mensaje",e.target.value)} rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none"/>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Color principal</span>
                <input type="color" value={config.colorPrincipal||"#0f172a"} onChange={e=>u("colorPrincipal",e.target.value)}
                  className="mt-1 w-full h-10 border border-slate-200 rounded-md cursor-pointer"/>
              </label>
            </div>
            <div className="flex gap-6 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.mostrarSaldo} onChange={e=>u("mostrarSaldo",e.target.checked)} className="accent-yellow-600"/>
                <span className="text-sm text-slate-600">Mostrar saldo pendiente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.permitirDescarga} onChange={e=>u("permitirDescarga",e.target.checked)} className="accent-yellow-600"/>
                <span className="text-sm text-slate-600">Permitir descargar facturas</span>
              </label>
            </div>
          </div>

          {/* Lista de clientes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Clientes registrados</h3>
              <span className="text-xs text-slate-400">{totalClientes} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {contactos.filter(c=>c.tipo!=="proveedor").slice(0,20).map(c=>{
                const d = debts.filter(x=>x.contactoId===c.id && x.tipo==="cobrar");
                const saldo = d.reduce((s,x)=>s+(x.saldo||0),0);
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 hover:bg-slate-50">
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">{(c.nombre||"?").charAt(0)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                      <p className="text-[11px] text-slate-400">{c.cedula||c.correo||"Sin datos de acceso"}</p>
                    </div>
                    {saldo>0 && <span className="text-xs font-bold text-red-600">{fmtMoney(saldo,"CRC")}</span>}
                    <button onClick={()=>setPreview(preview===c.id?null:c.id)} title="Ver vista previa del cliente"
                      className="p-1 rounded hover:bg-gray-100">
                      <Eye size={13} className={preview===c.id?"text-slate-800":"text-slate-300"}/>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel derecho: preview cliente */}
        <div className="self-start sticky top-6 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Vista previa del cliente</h3>
          {!preview ? (
            <div className="text-center py-10 text-slate-400">
              <Eye size={28} className="mx-auto text-slate-300 mb-2"/>
              <p className="text-sm">Hacé click en el ojo de un cliente para ver lo que él vería en el portal.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold">
                  {(clientePreview?.nombre||"?").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{clientePreview?.nombre}</p>
                  <p className="text-xs text-slate-500">{clientePreview?.correo||clientePreview?.cedula}</p>
                </div>
              </div>

              {config.mostrarSaldo && (
                <div className={`text-center py-3 rounded-lg mb-3 ${saldoPreview>0?"bg-red-50":"bg-yellow-50"}`}>
                  <p className="text-[11px] font-semibold uppercase text-slate-500">Saldo pendiente</p>
                  <p className={`text-xl font-black mt-0.5 ${saldoPreview>0?"text-red-700":"text-yellow-700"}`}>
                    {fmtMoney(saldoPreview,"CRC")}
                  </p>
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Facturas ({debtPreview.length})</p>
              <div className="space-y-2">
                {debtPreview.slice(0,5).map(d=>(
                  <div key={d.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">{d.descripcion||"Factura"}</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(d.fecha)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{fmtMoney(d.monto,"CRC")}</p>
                      {d.saldo>0 && <p className="text-[11px] text-red-500">Pendiente: {fmtMoney(d.saldo,"CRC")}</p>}
                    </div>
                  </div>
                ))}
                {debtPreview.length===0 && <p className="text-xs text-slate-400 text-center py-2">Sin facturas</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
