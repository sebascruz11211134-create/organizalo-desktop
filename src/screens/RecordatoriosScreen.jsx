/**
 * RecordatoriosScreen — Recordatorios automáticos de cobro
 *
 * - Muestra deudas vencidas y próximas a vencer
 * - Permite configurar días de aviso (ej: 7 días antes, 3 días después)
 * - En startup, el main process Electron puede lanzar una notificación del OS
 *   usando electron.Notification (ver preload y main — no requiere cambios aquí)
 * - Aquí el usuario configura las reglas y puede enviar recordatorio por WhatsApp
 */
import React, { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Send, CheckCircle, AlertTriangle, Clock, Settings } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";

const PLANTILLAS = [
  { id:"amable",   label:"Amable",     texto:"Hola {nombre}, le recordamos que tiene un saldo pendiente de {monto} con fecha límite {fecha}. Puede realizar su pago por SINPE Móvil al 8302-6613. ¡Gracias!" },
  { id:"formal",   label:"Formal",     texto:"Estimado/a {nombre}: Le comunicamos que su factura por {monto} venció el {fecha}. Le solicitamos atender este saldo a la brevedad. Para consultas: {correo}." },
  { id:"urgente",  label:"Urgente",    texto:"⚠️ {nombre}: Su cuenta presenta un saldo vencido de {monto} (desde {fecha}). Por favor regularizá a la brevedad o contáctenos." },
];

function diasDiff(fecha) {
  const hoyMs = new Date(hoy()+"T12:00:00").getTime();
  const fecMs = new Date((fecha||hoy())+"T12:00:00").getTime();
  return Math.round((fecMs - hoyMs)/(1000*60*60*24));
}

function badgeDias(dias) {
  if (dias < 0)  return { label:`Vencida hace ${Math.abs(dias)}d`, cls:"bg-red-100 text-red-700" };
  if (dias === 0) return { label:"Vence hoy", cls:"bg-orange-100 text-orange-700" };
  if (dias <= 7)  return { label:`Vence en ${dias}d`, cls:"bg-yellow-100 text-yellow-700" };
  return { label:`Vence en ${dias}d`, cls:"bg-slate-100 text-slate-500" };
}

export default function RecordatoriosScreen() {
  const [debts,      setDebts]      = useState([]);
  const [contactos,  setContactos]  = useState([]);
  const [settings,   setSettings]   = useState({});
  const [configOpen, setConfigOpen] = useState(false);
  const [config,     setConfig]     = useState({ diasAviso: 7, diasVencido: 3, activo: true, plantilla: "amable", sinpe:"8302-6613" });
  const [enviados,   setEnviados]   = useState({});
  const [filtro,     setFiltro]     = useState("todos"); // todos | vencidas | proximas

  const cargar = useCallback(async () => {
    const [d, c, s] = await Promise.all([db.getDebts(), db.getContactos(), db.getSettings()]);
    setDebts(d||[]); setContactos(c||[]); setSettings(s||{});
    // Cargar config guardada
    const cfg = await db.getSettings();
    if (cfg?.recordatoriosConfig) setConfig(cfg.recordatoriosConfig);
  },[]);
  useEffect(()=>{ cargar(); },[cargar]);

  const guardarConfig = async () => {
    const s = await db.getSettings();
    await db.setSettings({...s, recordatoriosConfig: config});
    setConfigOpen(false);
  };

  // Deudas CXC (por cobrar) con contacto
  const pendientes = debts
    .filter(d=>d.tipo==="cobrar" && (d.saldo||0)>0)
    .map(d=>{
      const contacto = contactos.find(c=>c.id===d.contactoId)||{};
      const dias = diasDiff(d.fechaVencimiento);
      return { ...d, contacto, dias };
    })
    .filter(d=>{
      if (filtro==="vencidas")  return d.dias < 0;
      if (filtro==="proximas")  return d.dias >= 0 && d.dias <= (config.diasAviso||7);
      return d.dias <= (config.diasAviso||7); // todos que son relevantes
    })
    .sort((a,b)=>a.dias-b.dias);

  const generarMensaje = (deuda) => {
    const plantilla = PLANTILLAS.find(p=>p.id===config.plantilla)||PLANTILLAS[0];
    return plantilla.texto
      .replace("{nombre}",  deuda.contacto?.nombre||"Cliente")
      .replace("{monto}",   fmtMoney(deuda.saldo,"CRC"))
      .replace("{fecha}",   fmtDate(deuda.fechaVencimiento))
      .replace("{correo}",  settings?.correo||"")
      .replace("{sinpe}",   config.sinpe||"");
  };

  const enviarWhatsApp = (deuda) => {
    const tel = (deuda.contacto?.telefono||"").replace(/\D/g,"");
    if (!tel) return alert("El contacto no tiene teléfono registrado.");
    const msg = encodeURIComponent(generarMensaje(deuda));
    const url = `https://wa.me/506${tel}?text=${msg}`;
    window.open(url,"_blank");
    setEnviados(p=>({...p,[deuda.id]:true}));
  };

  const notifOS = () => {
    if (window.Notification && Notification.permission !== "denied") {
      Notification.requestPermission().then(perm => {
        if (perm==="granted") {
          new Notification("Monki — Cobros pendientes", {
            body: `Tenés ${pendientes.filter(d=>d.dias<0).length} facturas vencidas por cobrar.`,
            icon: undefined,
          });
        }
      });
    }
  };

  const vencidas  = pendientes.filter(d=>d.dias<0).length;
  const proximas  = pendientes.filter(d=>d.dias>=0).length;

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Recordatorios de cobro</h1>
            <p className="text-sm text-slate-500">Enviá recordatorios por WhatsApp a clientes con saldo pendiente.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={notifOS} title="Probar notificación del sistema"
              className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Bell size={14}/> Probar notificación
            </button>
            <button onClick={()=>setConfigOpen(c=>!c)}
              className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Settings size={14}/> Configurar
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="flex gap-6 mt-4 pt-3 border-t border-slate-100">
          {[
            ["Vencidas", vencidas,  "text-red-700 font-black"],
            ["Próximas a vencer", proximas, "text-yellow-700 font-black"],
            ["Total pendiente", fmtMoney(pendientes.reduce((s,d)=>s+(d.saldo||0),0),"CRC"), "text-slate-900 font-black"],
          ].map(([lbl,val,cls])=>(
            <div key={lbl}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase">{lbl}</p>
              <p className={`text-sm mt-0.5 ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de configuración desplegable */}
      {configOpen && (
        <div className="bg-blue-50 border-b border-blue-100 px-8 py-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Configuración de recordatorios</h3>
          <div className="grid grid-cols-4 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avisar X días antes</span>
              <input type="number" min="0" max="90" value={config.diasAviso} onChange={e=>setConfig(p=>({...p,diasAviso:parseInt(e.target.value)||7}))}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">SINPE Móvil</span>
              <input value={config.sinpe||""} onChange={e=>setConfig(p=>({...p,sinpe:e.target.value}))}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Plantilla de mensaje</span>
              <select value={config.plantilla} onChange={e=>setConfig(p=>({...p,plantilla:e.target.value}))}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
                {PLANTILLAS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={guardarConfig} className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
                Guardar config
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 italic">
            Vista previa: {generarMensaje({ contacto:{nombre:"Juan"}, saldo:50000, fechaVencimiento: hoy() })}
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 px-8 py-3 bg-white border-b border-slate-100">
        {[["todos","Todos"],["vencidas","Vencidas"],["proximas","Próximas"]].map(([k,lbl])=>(
          <button key={k} onClick={()=>setFiltro(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filtro===k?"bg-amber-600 text-white":"text-slate-500 hover:bg-slate-100"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
        {pendientes.length===0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <CheckCircle size={40} className="text-green-400"/>
            <p className="text-lg font-semibold">¡Todo al día!</p>
            <p className="text-sm">No hay cobros vencidos ni próximos a vencer.</p>
          </div>
        ) : pendientes.map(d=>{
          const badge = badgeDias(d.dias);
          const ya    = enviados[d.id];
          return (
            <div key={d.id} className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4
              ${d.dias<0?"border-red-200":d.dias<=3?"border-orange-200":"border-slate-200"}`}>
              {/* Ícono estado */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                ${d.dias<0?"bg-red-50":d.dias<=3?"bg-orange-50":"bg-slate-50"}`}>
                {d.dias<0?<AlertTriangle size={16} className="text-red-600"/>:<Clock size={16} className="text-orange-500"/>}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 truncate">{d.contacto?.nombre||"Sin nombre"}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{d.descripcion||"Deuda"} · Vence: {fmtDate(d.fechaVencimiento)}</p>
              </div>

              {/* Monto */}
              <div className="text-right shrink-0">
                <p className="font-black text-slate-900">{fmtMoney(d.saldo,"CRC")}</p>
                {d.monto !== d.saldo && (
                  <p className="text-[11px] text-slate-400">Total: {fmtMoney(d.monto,"CRC")}</p>
                )}
              </div>

              {/* Botón enviar */}
              <button onClick={()=>enviarWhatsApp(d)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shrink-0 transition-all
                  ${ya?"bg-green-50 text-amber-700 border border-amber-300":"bg-amber-600 text-white hover:bg-amber-700"}`}>
                {ya?<><CheckCircle size={13}/> Enviado</>:<><Send size={13}/> WhatsApp</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
