/**
 * PortalClienteScreen — Portal de auto-consulta para clientes
 * Cada cliente puede acceder con su cédula/correo y ver:
 *   - Estado de cuenta / CXC
 *   - Facturas emitidas
 * Config se guarda en db.setPortalConfig()
 */
import React, { useState, useEffect, useCallback } from "react";
import { Globe, Save, CheckCircle, Users, Copy, ExternalLink, Eye, Wallet } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio, Indicadores, Indicador, Campo, Entrada, AreaTexto, Interruptor } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

import { BACKEND } from "../utils/config.js";

function EnlacePublico({ url, copiado, onCopiar }) {
  return (
    <div className="animate-desplegar mt-4 flex items-center gap-2 bg-monki-k text-white rounded-full pl-4 pr-1.5 py-1.5">
      <Globe size={14} className="text-monki-y shrink-0"/>
      <span className="font-mono text-xs flex-1 truncate">{url}</span>
      <button type="button" onClick={onCopiar} title="Copiar enlace" className="ui-boton w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15">
        {copiado ? <CheckCircle size={14} className="text-monki-y"/> : <Copy size={14}/>}
      </button>
      <a href={url} target="_blank" rel="noreferrer" title="Abrir" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15"><ExternalLink size={14}/></a>
    </div>
  );
}

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
    <Modulo
      seccion="Clientes"
      titulo="Portal de clientes"
      descripcion="Tus clientes consultan su estado de cuenta en línea, con su cédula o correo."
      acciones={<Boton icono={guardado ? CheckCircle : Save} onClick={guardar}>{guardado ? "Guardado" : "Guardar"}</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Clientes" valor={totalClientes} icono={Users} delay={40}/>
          <Indicador etiqueta="Con saldo" valor={clientesConDeuda} delay={90}/>
          <Indicador etiqueta="CXC pendiente" valor={fmtMoney(totalCXCPendiente,"CRC")} icono={Wallet} destacado delay={140}/>
          <Indicador etiqueta="Portal" valor={config.activo ? "Activo" : "Apagado"} icono={Globe} delay={190}/>
        </Indicadores>
      }
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-3">
          <div className="space-y-3">
            <div className={`animate-entrar rounded-[18px] border-2 p-5 transition-all duration-300 ease-monki ${config.activo ? "bg-monki-y border-monki-k shadow-[5px_5px_0_#111]" : "bg-white border-black/10"}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[17px] font-black text-monki-k">{config.activo ? "El portal está abierto" : "Portal apagado"}</p>
                  <p className="text-sm text-monki-k/60 mt-0.5">Cuando está activo, los clientes entran con su cédula o correo.</p>
                </div>
                <Interruptor activo={config.activo} onCambio={v=>u("activo",v)} etiqueta={config.activo ? "Activo" : "Inactivo"}/>
              </div>
              {portalUrl && <EnlacePublico url={portalUrl} copiado={copiado} onCopiar={copiar}/>}
            </div>

            <Tarjeta titulo="Apariencia y contenido" cuerpo="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Título del portal" className="col-span-2"><Entrada value={config.titulo||""} onChange={e=>u("titulo",e.target.value)}/></Campo>
                <Campo etiqueta="Mensaje de bienvenida" className="col-span-2"><AreaTexto value={config.mensaje||""} onChange={e=>u("mensaje",e.target.value)} rows={2}/></Campo>
                <Campo etiqueta="Color principal"><Entrada type="color" value={config.colorPrincipal||"#0f172a"} onChange={e=>u("colorPrincipal",e.target.value)} className="h-11 cursor-pointer !p-1.5"/></Campo>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
                <Interruptor activo={config.mostrarSaldo} onCambio={v=>u("mostrarSaldo",v)} etiqueta="Mostrar saldo pendiente"/>
                <Interruptor activo={config.permitirDescarga} onCambio={v=>u("permitirDescarga",v)} etiqueta="Permitir descargar facturas"/>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Clientes registrados" acciones={<span className="font-mono text-[11px] text-monki-k/45">{totalClientes} en total</span>} cuerpo="max-h-72 overflow-y-auto px-2 pb-2">
              {contactos.filter(c=>c.tipo!=="proveedor").slice(0,20).map(c=>{
                const d = debts.filter(x=>x.contactoId===c.id && x.tipo==="cobrar");
                const saldo = d.reduce((s,x)=>s+(x.saldo||0),0);
                const activo = preview===c.id;
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-colors ${activo ? "bg-[#FFF4B8]" : "hover:bg-monki-cream/60"}`}>
                    <span className="w-8 h-8 bg-monki-y rounded-full flex items-center justify-center text-[12px] font-black shrink-0">{(c.nombre||"?").charAt(0).toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-monki-k truncate">{c.nombre}</p>
                      <p className="font-mono text-[10px] text-monki-k/45">{c.cedula||c.correo||"Sin datos de acceso"}</p>
                    </div>
                    {saldo>0 && <b className="text-xs text-red-600">{fmtMoney(saldo,"CRC")}</b>}
                    <BotonIcono icono={Eye} titulo="Ver como el cliente" onClick={()=>setPreview(activo?null:c.id)}/>
                  </div>
                );
              })}
            </Tarjeta>
          </div>

          <div className="self-start xl:sticky xl:top-0 animate-entrar bg-white rounded-[22px] border-2 border-monki-k shadow-[6px_6px_0_#111] p-5" style={{ animationDelay: "80ms" }}>
            <p className="monki-tag text-monki-k/50 mb-3">Vista previa del cliente</p>
            {!preview ? (
              <Vacio icono={Eye} titulo="Elegí un cliente" texto="Tocá el ojo de un cliente para ver lo que él vería en el portal."/>
            ) : (
              <div className="animate-desplegar">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-11 h-11 bg-monki-k rounded-full flex items-center justify-center text-monki-y font-black">{(clientePreview?.nombre||"?").charAt(0).toUpperCase()}</span>
                  <div>
                    <p className="font-extrabold text-monki-k">{clientePreview?.nombre}</p>
                    <p className="font-mono text-[11px] text-monki-k/45">{clientePreview?.correo||clientePreview?.cedula}</p>
                  </div>
                </div>
                {config.mostrarSaldo && (
                  <div className={`text-center py-3 rounded-2xl mb-3 ${saldoPreview>0?"bg-red-600 text-white":"bg-monki-y text-monki-k"}`}>
                    <p className="monki-tag opacity-70">Saldo pendiente</p>
                    <p className="text-[24px] font-black mt-0.5">{fmtMoney(saldoPreview,"CRC")}</p>
                  </div>
                )}
                <p className="monki-tag text-monki-k/50 mb-2">Facturas ({debtPreview.length})</p>
                <div className="space-y-1.5">
                  {debtPreview.slice(0,5).map(d=>(
                    <div key={d.id} className="flex items-center justify-between bg-monki-cream rounded-xl px-3 py-2">
                      <div>
                        <p className="font-bold text-monki-k text-xs">{d.descripcion||"Factura"}</p>
                        <p className="font-mono text-[10px] text-monki-k/45">{fmtDate(d.fecha)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black">{fmtMoney(d.monto,"CRC")}</p>
                        {d.saldo>0 && <p className="text-[10px] text-red-600 font-bold">Debe {fmtMoney(d.saldo,"CRC")}</p>}
                      </div>
                    </div>
                  ))}
                  {debtPreview.length===0 && <p className="text-xs text-monki-k/40 text-center py-2">Sin facturas</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modulo>
  );
}
