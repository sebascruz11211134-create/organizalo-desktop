/**
 * TiendaScreen — Configuración de tienda en línea / catálogo WhatsApp
 * Genera un link de catálogo de productos con los artículos activos.
 * En la próxima versión: deploy en Railway con frontend público.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Save, ExternalLink, Copy, CheckCircle, Globe, Phone, Package } from "lucide-react";
import { Modulo, Boton, Tarjeta, Vacio, Campo, Entrada, AreaTexto, Interruptor } from "../components/ui";
import db from "../utils/db";
import { fmtMoney } from "../utils/fmt";

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
    <Modulo
      seccion="Ventas"
      titulo="Tienda en línea"
      descripcion="Publicá tu catálogo en una página pública y compartilo por WhatsApp."
      acciones={<Boton icono={guardado ? CheckCircle : Save} onClick={guardar}>{guardado ? "Guardado" : "Guardar"}</Boton>}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-3">
          <div className="space-y-3">
            <div className={`animate-entrar rounded-[18px] border-2 p-5 transition-all duration-300 ease-monki ${config.activa ? "bg-monki-y border-monki-k shadow-[5px_5px_0_#111]" : "bg-white border-black/10"}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[17px] font-black text-monki-k">{config.activa ? "Tu tienda está publicada" : "Tienda apagada"}</p>
                  <p className="text-sm text-monki-k/60 mt-0.5">Cuando está activa, la página es pública y tus clientes la pueden ver.</p>
                </div>
                <Interruptor activo={config.activa} onCambio={v=>u("activa",v)} etiqueta={config.activa ? "Activa" : "Inactiva"}/>
              </div>
              {tiendaUrl && <EnlacePublico url={tiendaUrl} copiado={copiado} onCopiar={copiar}/>}
            </div>

            <Tarjeta titulo="Información de la tienda" cuerpo="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Nombre del negocio" className="col-span-2"><Entrada value={config.nombre||""} onChange={e=>u("nombre",e.target.value)}/></Campo>
                <Campo etiqueta="Teléfono / WhatsApp"><Entrada value={config.whatsapp||""} onChange={e=>u("whatsapp",e.target.value)}/></Campo>
                <Campo etiqueta="SINPE Móvil"><Entrada value={config.sinpe||""} onChange={e=>u("sinpe",e.target.value)}/></Campo>
                <Campo etiqueta="Color principal"><Entrada type="color" value={config.colorPrincipal||""} onChange={e=>u("colorPrincipal",e.target.value)} className="h-11 cursor-pointer !p-1.5"/></Campo>
                <Campo etiqueta="Descripción o eslogan" className="col-span-2"><AreaTexto value={config.descripcion||""} onChange={e=>u("descripcion",e.target.value)} rows={2} placeholder="Describí tu negocio en una línea…"/></Campo>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
                <Interruptor activo={config.mostrarStock} onCambio={v=>u("mostrarStock",v)} etiqueta="Mostrar stock disponible"/>
                <Interruptor activo={config.moneda==="USD"} onCambio={v=>u("moneda",v?"USD":"CRC")} etiqueta="Precios en dólares"/>
              </div>
            </Tarjeta>

            {config.activa && tiendaUrl && (
              <Tarjeta titulo="Compartir" cuerpo="px-4 pb-4 flex flex-wrap gap-2">
                <Boton icono={Phone} onClick={whatsappLink}>Compartir por WhatsApp</Boton>
                <Boton variante="secundario" icono={copiado ? CheckCircle : Copy} onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar enlace"}</Boton>
              </Tarjeta>
            )}
          </div>

          <Tarjeta titulo="Productos en el catálogo" acciones={<span className="font-mono text-xs bg-monki-k text-monki-y px-2 py-0.5 rounded-full">{productosActivos.length}</span>} className="self-start xl:sticky xl:top-0" cuerpo="px-2 pb-2">
            {productosActivos.length===0 ? (
              <Vacio icono={Package} titulo="Sin productos con precio" texto="Andá a Inventario → Catálogo y configurá tus productos."/>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {productosActivos.map(p=>(
                  <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-monki-cream/60 transition-colors">
                    <span className="w-8 h-8 bg-monki-y rounded-full flex items-center justify-center shrink-0 text-[12px] font-black">{(p.nombre||"?").charAt(0).toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-monki-k truncate">{p.nombre}</p>
                      {config.mostrarStock && p.cantidadEnInventario!==undefined && <p className="font-mono text-[10px] text-monki-k/45">Stock {p.cantidadEnInventario||0}</p>}
                    </div>
                    <b className="text-sm shrink-0">{fmtMoney(p.precio||p.precioVenta, config.moneda||"CRC")}</b>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        </div>
      </div>
    </Modulo>
  );
}
