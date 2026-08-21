/**
 * TiendaScreen — Configuración de tienda en línea / catálogo WhatsApp
 * Genera un link de catálogo de productos con los artículos activos.
 * En la próxima versión: deploy en Railway con frontend público.
 */
import React, { useState, useEffect, useCallback } from "react";
import { ShoppingBag, Save, ExternalLink, Copy, CheckCircle, Globe, Phone, Package } from "lucide-react";
import db from "../utils/db";
import { fmtMoney } from "../utils/fmt";

import { BACKEND } from "../utils/config.js";

export default function TiendaScreen() {
  const [config,    setConfig]    = useState({ activa: false, nombre:"", descripcion:"", sinpe:"", whatsapp:"", colorPrincipal:"#0f172a", moneda:"CRC", mostrarStock:true });
  const [productos, setProductos] = useState([]);
  const [guardado,  setGuardado]  = useState(false);
  const [copiado,   setCopiado]   = useState(false);
  const [settings,  setSettings]  = useState({});

  const cargar = useCallback(async () => {
    const [c, p, s] = await Promise.all([db.getTiendaConfig(), db.getProductos(), db.getSettings()]);
    if (c && Object.keys(c).length>1) setConfig(c);
    else setConfig(prev => ({ ...prev, nombre: s?.nombreNegocio||"", sinpe: "8302-6613", whatsapp: s?.telefono||"" }));
    setProductos(p||[]);
    setSettings(s||{});
  }, []);
  useEffect(()=>{ cargar(); },[cargar]);

  const u = (k,v) => setConfig(p=>({...p,[k]:v}));

  const guardar = async () => {
    await db.setTiendaConfig(config);
    setGuardado(true);
    setTimeout(()=>setGuardado(false), 2500);
  };

  const tiendaUrl = config.activa && config.nombre
    ? `${BACKEND}/tienda/${encodeURIComponent(config.nombre.toLowerCase().replace(/\s+/g,"-"))}`
    : null;

  const copiar = () => {
    if (tiendaUrl) {
      navigator.clipboard.writeText(tiendaUrl);
      setCopiado(true);
      setTimeout(()=>setCopiado(false), 2000);
    }
  };

  const whatsappLink = () => {
    const num = (config.whatsapp||"").replace(/\D/g,"");
    const msg = encodeURIComponent(`Hola! Aquí podés ver nuestro catálogo: ${tiendaUrl}`);
    if (num) window.open(`https://wa.me/506${num}?text=${msg}`,"_blank");
  };

  const productosActivos = productos.filter(p=>p.activo!==false && (p.precio||0)>0);

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Tienda en línea</h1>
            <p className="text-sm text-slate-500">Publicá tu catálogo de productos en una página pública.</p>
          </div>
          <button onClick={guardar} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${guardado?"bg-yellow-600 text-white":"bg-yellow-600 text-white hover:bg-yellow-700"}`}>
            {guardado?<><CheckCircle size={14}/> Guardado</>:<><Save size={14}/> Guardar</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 grid grid-cols-[1fr_320px] gap-6">
        {/* Config */}
        <div className="space-y-6">
          {/* Activar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Tienda activa</p>
                <p className="text-sm text-slate-500 mt-0.5">Cuando está activa, la página es pública y los clientes pueden verla.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={config.activa} onChange={e=>u("activa",e.target.checked)} className="sr-only peer"/>
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-yellow-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"/>
              </label>
            </div>

            {tiendaUrl && (
              <div className="mt-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Globe size={14} className="text-slate-400 shrink-0"/>
                <span className="text-xs text-slate-600 flex-1 truncate font-mono">{tiendaUrl}</span>
                <button onClick={copiar} className="p-1 hover:bg-gray-200 rounded" title="Copiar enlace">
                  {copiado?<CheckCircle size={13} className="text-yellow-600"/>:<Copy size={13} className="text-slate-400"/>}
                </button>
                <a href={tiendaUrl} target="_blank" rel="noreferrer" className="p-1 hover:bg-gray-200 rounded">
                  <ExternalLink size={13} className="text-slate-400"/>
                </a>
              </div>
            )}
          </div>

          {/* Info del negocio */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Información de la tienda</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Nombre del negocio","nombre","text","col-span-2"],
                ["Teléfono / WhatsApp","whatsapp","text",""],
                ["SINPE Móvil","sinpe","text",""],
                ["Color principal","colorPrincipal","color",""],
              ].map(([lbl,key,type,cls])=>(
                <label key={key} className={`block ${cls}`}>
                  <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
                  <input type={type} value={config[key]||""} onChange={e=>u(key,e.target.value)}
                    className={`mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 ${type==="color"?"h-10 cursor-pointer":""}`}/>
                </label>
              ))}
              <label className="block col-span-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Descripción / Eslogan</span>
                <textarea value={config.descripcion||""} onChange={e=>u("descripcion",e.target.value)} rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none"
                  placeholder="Describí tu negocio en una línea..."/>
              </label>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.mostrarStock} onChange={e=>u("mostrarStock",e.target.checked)} className="accent-yellow-600"/>
                <span className="text-sm text-slate-600">Mostrar stock disponible en la tienda</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input type="checkbox" checked={config.moneda==="USD"} onChange={e=>u("moneda",e.target.checked?"USD":"CRC")} className="accent-yellow-600"/>
                <span className="text-sm text-slate-600">Mostrar precios en USD</span>
              </label>
            </div>
          </div>

          {/* Acciones rápidas */}
          {config.activa && tiendaUrl && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Compartir</h3>
              <div className="flex gap-3">
                <button onClick={whatsappLink}
                  className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-yellow-700">
                  <Phone size={14}/> Compartir por WhatsApp
                </button>
                <button onClick={copiar}
                  className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">
                  {copiado?<CheckCircle size={14} className="text-yellow-600"/>:<Copy size={14}/>}
                  {copiado?"¡Copiado!":"Copiar enlace"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview de productos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 self-start sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Productos en catálogo</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{productosActivos.length}</span>
          </div>
          {productosActivos.length===0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package size={28} className="mx-auto text-slate-300 mb-2"/>
              <p className="text-sm">Sin productos con precio</p>
              <p className="text-xs mt-1">Andá a Inventario → Catálogo y configurá tus productos.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {productosActivos.map(p=>(
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-b-0">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={14} className="text-slate-400"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.nombre}</p>
                    {config.mostrarStock && p.cantidadEnInventario!==undefined && (
                      <p className="text-[11px] text-slate-400">Stock: {p.cantidadEnInventario||0}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-700 shrink-0">{fmtMoney(p.precio||p.precioVenta, config.moneda||"CRC")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
