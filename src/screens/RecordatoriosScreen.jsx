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
import { Bell, Send, CheckCircle, AlertTriangle, Clock, Settings, Wallet } from "lucide-react";
import { Modulo, Boton, Tarjeta, Vacio, Estado, Indicadores, Indicador, Campo, Entrada, Seleccion } from "../components/ui";
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
  if (dias < 0)  return { label:`Vencida hace ${Math.abs(dias)}d`, tono:"peligro" };
  if (dias === 0) return { label:"Vence hoy", tono:"oscuro" };
  if (dias <= 7)  return { label:`Vence en ${dias}d`, tono:"alerta" };
  return { label:`Vence en ${dias}d`, tono:"neutro" };
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
    <Modulo
      seccion="Cobros"
      titulo="Recordatorios de cobro"
      descripcion="Mandale por WhatsApp un recordatorio a cada cliente con saldo pendiente."
      acciones={<>
        <Boton variante="secundario" icono={Bell} onClick={notifOS}>Probar notificación</Boton>
        <Boton variante={configOpen ? "primario" : "secundario"} icono={Settings} onClick={()=>setConfigOpen(c=>!c)}>Configurar</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Vencidas" valor={vencidas} detalle="Ya pasó la fecha" icono={AlertTriangle} alerta={vencidas>0} delay={40} onClick={()=>setFiltro("vencidas")}/>
          <Indicador etiqueta="Próximas" valor={proximas} detalle={`En los próximos ${config.diasAviso||7} días`} icono={Clock} delay={90} onClick={()=>setFiltro("proximas")}/>
          <Indicador etiqueta="Total pendiente" valor={fmtMoney(pendientes.reduce((s,d)=>s+(d.saldo||0),0),"CRC")} icono={Wallet} destacado delay={140}/>
          <Indicador etiqueta="Enviados hoy" valor={Object.keys(enviados).length} icono={Send} delay={190}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [{key:"todos",label:"Todos"},{key:"vencidas",label:"Vencidas",cuenta:vencidas},{key:"proximas",label:"Próximas",cuenta:proximas}] }}
    >
      {configOpen && (
        <Tarjeta titulo="Configuración de recordatorios" className="animate-desplegar mb-3 !border-monki-k" cuerpo="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <Campo etiqueta="Avisar días antes"><Entrada type="number" min="0" max="90" value={config.diasAviso} onChange={e=>setConfig(p=>({...p,diasAviso:parseInt(e.target.value)||7}))}/></Campo>
            <Campo etiqueta="SINPE Móvil"><Entrada value={config.sinpe||""} onChange={e=>setConfig(p=>({...p,sinpe:e.target.value}))}/></Campo>
            <Campo etiqueta="Plantilla del mensaje"><Seleccion value={config.plantilla} onChange={e=>setConfig(p=>({...p,plantilla:e.target.value}))} opciones={PLANTILLAS.map(t=>({value:t.id,label:t.label}))}/></Campo>
            <Boton onClick={guardarConfig}>Guardar configuración</Boton>
          </div>
          <div className="mt-3 bg-monki-cream rounded-2xl px-4 py-3">
            <p className="monki-tag text-monki-k/50 mb-1">Vista previa</p>
            <p className="text-sm text-monki-k/75">{generarMensaje({ contacto:{nombre:"Juan"}, saldo:50000, fechaVencimiento: hoy() })}</p>
          </div>
        </Tarjeta>
      )}

      <div className="flex-1 overflow-auto space-y-2 -mx-1 px-1 pb-1">
        {pendientes.length===0 ? (
          <Tarjeta className="h-full flex items-center justify-center">
            <Vacio icono={CheckCircle} titulo="¡Todo al día!" texto="No hay cobros vencidos ni próximos a vencer."/>
          </Tarjeta>
        ) : pendientes.map((d,i)=>{
          const badge = badgeDias(d.dias);
          const ya    = enviados[d.id];
          return (
            <div key={d.id} style={{ animationDelay: `${Math.min(i,10)*35}ms` }}
              className={`animate-entrar bg-white border-2 rounded-[18px] px-4 py-3.5 flex flex-wrap items-center gap-4 transition-all duration-300 ease-monki hover:-translate-y-0.5
              ${d.dias<0?"border-red-300":"border-black/10 hover:border-black/25"}`}>
              <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${d.dias<0?"bg-red-100 text-red-600":"bg-monki-y text-monki-k"}`}>
                {d.dias<0?<AlertTriangle size={17}/>:<Clock size={17}/>}
              </span>
              <div className="flex-1 min-w-[160px]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-monki-k truncate">{d.contacto?.nombre||"Sin nombre"}</p>
                  <Estado tono={badge.tono}>{badge.label}</Estado>
                </div>
                <p className="text-xs text-monki-k/50 mt-0.5">{d.descripcion||"Deuda"} · vence {fmtDate(d.fechaVencimiento)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[17px] font-black text-monki-k">{fmtMoney(d.saldo,"CRC")}</p>
                {d.monto !== d.saldo && <p className="font-mono text-[10px] text-monki-k/45">Total {fmtMoney(d.monto,"CRC")}</p>}
              </div>
              {ya
                ? <Boton variante="secundario" icono={CheckCircle} onClick={()=>enviarWhatsApp(d)}>Enviado</Boton>
                : <Boton icono={Send} onClick={()=>enviarWhatsApp(d)}>WhatsApp</Boton>}
            </div>
          );
        })}
      </div>
    </Modulo>
  );
}
