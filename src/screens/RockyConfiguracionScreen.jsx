/**
 * RockyConfiguracionScreen — Configuración de Rocky para WhatsApp
 * Activa/desactiva el auto-reply, define tipo de negocio e instrucciones.
 * Usa la misma clave rocky_config del backend.
 */
import React, { useState, useEffect } from "react";
import {
  Sparkles, Save, UtensilsCrossed, CalendarCheck, Building2,
  CheckCircle2, AlertCircle, MessageCircle, Info, Clock,
} from "lucide-react";
import { getToken } from "../utils/auth";
import { BACKEND } from "../utils/config";

import RockyChannels from "../components/RockyChannels";
import { Modulo, Boton, Tarjeta, Campo, Entrada, Seleccion, AreaTexto, Interruptor } from "../components/ui";

const TIPOS = [
  {
    id: "restaurante",
    label: "Restaurante",
    icon: UtensilsCrossed,
    desc: "Responde consultas sobre el menú y detecta solicitudes de pedidos.",
    color: "text-orange-500",
    activeBg: "bg-orange-50 border-orange-400",
  },
  {
    id: "servicios",
    label: "Servicios / Citas",
    icon: CalendarCheck,
    desc: "Responde consultas de servicios y detecta solicitudes de citas.",
    color: "text-blue-500",
    activeBg: "bg-blue-50 border-blue-400",
  },
  {
    id: "general",
    label: "General",
    icon: Building2,
    desc: "Responde preguntas frecuentes y registra consultas.",
    color: "text-yellow-500",
    activeBg: "bg-yellow-50 border-yellow-400",
  },
];

const DEFAULT_CONFIG = {
  activo: false,
  correoActivo: false,
  zonaHoraria: "America/Costa_Rica",
  modoRespuestas: "borrador",
  tipoNegocio: "general",
  instrucciones: "",
  nombreEmpresa: "",
  horarioInicio: "",
  horarioFin: "",
  mensajeFueraHorario: "",
  mensajeBienvenida: "",
};

export default function RockyConfiguracionScreen() {
  const [config,    setConfig]    = useState(DEFAULT_CONFIG);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje,   setMensaje]   = useState(null); // { tipo: "ok"|"error", texto }

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${BACKEND}/api/rocky/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.config) setConfig(prev => ({ ...DEFAULT_CONFIG, ...data.config }));
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo cargar la configuración." });
    }
    setLoading(false);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const token = await getToken();
      const res   = await fetch(`${BACKEND}/api/rocky/config`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        setMensaje({ tipo: "ok", texto: "Configuración guardada. La atención depende de los canales conectados y del modo seleccionado." });
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (e) {
      setMensaje({ tipo: "error", texto: `No se pudo guardar. ${e.message}` });
    }
    setGuardando(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-monki-y border-t-monki-k rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Modulo
      seccion="Rocky IA"
      titulo="Configuración de Rocky"
      descripcion="Atención continua por WhatsApp y correo, con el tono y las reglas de tu negocio."
      acciones={<>
        <div className="bg-white rounded-full border-2 border-black/10 px-3 py-1.5">
          <Interruptor activo={config.activo} onCambio={v => setConfig(c => ({ ...c, activo: v }))} etiqueta={config.activo ? "Activo" : "Inactivo"}/>
        </div>
        <Boton icono={Save} onClick={guardar} cargando={guardando} disabled={guardando}>{guardando ? "Guardando…" : "Guardar configuración"}</Boton>
      </>}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        <div className="max-w-3xl space-y-3">
          {mensaje && (
            <div className={`animate-desplegar flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold ${mensaje.tipo === "ok" ? "bg-[#dcfce7] text-[#166534]" : "bg-red-100 text-red-700"}`}>
              {mensaje.tipo === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {mensaje.texto}
            </div>
          )}

          <div className="animate-entrar bg-monki-k text-white rounded-[18px] p-5 flex gap-3">
            <span className="w-9 h-9 rounded-full bg-monki-y text-monki-k flex items-center justify-center shrink-0"><MessageCircle size={17} /></span>
            <div className="text-sm">
              <p className="font-extrabold text-monki-y mb-1">¿Cómo funciona?</p>
              <p className="text-white/70">Rocky recibe mensajes en los canales conectados. Elegí si prepara borradores o responde solo, y guardá para aplicar los cambios.</p>
            </div>
          </div>

          <RockyChannels />

          <Tarjeta titulo="Modo de atención" cuerpo="px-4 pb-4 space-y-3">
            <Seleccion value={config.modoRespuestas} onChange={e=>setConfig(c=>({...c,modoRespuestas:e.target.value}))}
              opciones={[{value:"borrador",label:"Preparar borradores para revisar"},{value:"automatico",label:"Responder automáticamente"}]}/>
            <Interruptor activo={config.correoActivo===true} onCambio={v=>setConfig(c=>({...c,correoActivo:v}))} etiqueta="Atender también el Gmail conectado"/>
            <p className="text-xs text-monki-k/50">WhatsApp y Gmail responden con la información comercial aprobada. Lo que requiera cambios en el ERP o adjuntos queda para revisión.</p>
          </Tarjeta>

          <Tarjeta titulo="Tipo de negocio" cuerpo="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TIPOS.map(tipo => {
                const Icono = tipo.icon;
                const activo = config.tipoNegocio === tipo.id;
                return (
                  <button key={tipo.id} type="button" onClick={() => setConfig(c => ({ ...c, tipoNegocio: tipo.id }))}
                    className={`ui-boton p-4 rounded-2xl border-2 text-left transition-all duration-300 ease-monki ${activo ? "bg-monki-y border-monki-k shadow-[4px_4px_0_#111] -translate-x-0.5 -translate-y-0.5" : "border-black/10 hover:border-black/30 bg-white"}`}>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${activo ? "bg-monki-k text-monki-y" : "bg-monki-cream"}`}><Icono size={17} /></span>
                    <p className="text-sm font-extrabold text-monki-k">{tipo.label}</p>
                    <p className="text-[11px] text-monki-k/55 mt-1">{tipo.desc}</p>
                  </button>
                );
              })}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Lo que Rocky tiene que saber" cuerpo="px-4 pb-4 space-y-3">
            <Campo etiqueta="Instrucciones especiales (opcional)" ayuda="Qué decir, qué no decir, horarios, precios…">
              <AreaTexto rows={4} value={config.instrucciones || ""} onChange={e => setConfig(c => ({ ...c, instrucciones: e.target.value }))}
                placeholder={"Ej: Atendemos de lunes a viernes de 8am a 6pm.\nNo hacemos entregas a domicilio."}/>
            </Campo>
            <Campo etiqueta="Nombre del negocio para Rocky" ayuda="Si no está configurado en Ajustes.">
              <Entrada value={config.nombreEmpresa || ""} onChange={e => setConfig(c => ({ ...c, nombreEmpresa: e.target.value }))} placeholder="Ej: Pizzería Don Mario"/>
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Horario de atención" acciones={<Boton variante="fantasma" tamano="sm" icono={Clock} onClick={()=>setConfig(c=>({...c,horarioInicio:'',horarioFin:'',zonaHoraria:'America/Costa_Rica'}))}>24 horas</Boton>} cuerpo="px-4 pb-4 space-y-3">
            <p className="text-xs text-monki-k/50">Dejá ambos vacíos para atender las 24 horas. Fuera del horario, los mensajes quedan pendientes hasta el próximo turno. Zona horaria: {config.zonaHoraria}; se admiten turnos que cruzan medianoche.</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Hora de inicio"><Entrada type="time" value={config.horarioInicio || ''} onChange={e=>setConfig(c=>({...c,horarioInicio:e.target.value}))}/></Campo>
              <Campo etiqueta="Hora de fin"><Entrada type="time" value={config.horarioFin || ''} onChange={e=>setConfig(c=>({...c,horarioFin:e.target.value}))}/></Campo>
            </div>
          </Tarjeta>

          <p className="flex gap-2 text-xs text-monki-k/45"><Info size={14} className="shrink-0 mt-0.5" /> La bandeja guarda el estado de cada mensaje. Si atendés vos una conversación, pausá a Rocky para evitar respuestas dobles.</p>
        </div>
      </div>
    </Modulo>
  );
}
