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
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Sparkles size={20} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Rocky IA — Atención continua</h1>
            <p className="text-sm text-slate-500">WhatsApp, correo y seguimiento de conversaciones</p>
          </div>
        </div>

        {/* Toggle activo */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">
            {config.activo ? "Activo" : "Inactivo"}
          </span>
          <button
            onClick={() => setConfig(c => ({ ...c, activo: !c.activo }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.activo ? "bg-yellow-400" : "bg-slate-200"
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
              config.activo ? "left-7" : "left-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Mensaje de estado */}
      {mensaje && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
          mensaje.tipo === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {mensaje.tipo === "ok"
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {mensaje.texto}
        </div>
      )}

      {/* Cómo funciona */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <MessageCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">¿Cómo funciona?</p>
          <p>Rocky recibe mensajes en los canales conectados. Elegí si prepara borradores o responde automáticamente, y guardá la configuración para aplicar los cambios.</p>
        </div>
      </div>

      <RockyChannels />
      <section className="rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="block text-sm font-semibold">Modo de atención
          <select className="block mt-2 border rounded p-2 w-full" value={config.modoRespuestas} onChange={e=>setConfig(c=>({...c,modoRespuestas:e.target.value}))}>
            <option value="borrador">Preparar borradores para revisar</option><option value="automatico">Responder automáticamente</option>
          </select>
        </label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={config.correoActivo===true} onChange={e=>setConfig(c=>({...c,correoActivo:e.target.checked}))}/>Atender también el Gmail conectado</label>
        <p className="text-xs text-slate-500">La conexión oficial de WhatsApp y Gmail responden consultas con información comercial aprobada. Las solicitudes que requieren cambios en el ERP o adjuntos quedan para revisión.</p>
        <button className="text-sm underline" onClick={()=>setConfig(c=>({...c,horarioInicio:'',horarioFin:'',zonaHoraria:'America/Costa_Rica'}))}>Atender las 24 horas, todos los días</button>
        <p className="text-xs text-slate-500">Zona horaria: {config.zonaHoraria}. También se admiten turnos nocturnos que cruzan medianoche.</p>
      </section>
      {/* Tipo de negocio */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de negocio</label>
        <div className="grid grid-cols-3 gap-3">
          {TIPOS.map(tipo => {
            const Icono   = tipo.icon;
            const activo  = config.tipoNegocio === tipo.id;
            return (
              <button
                key={tipo.id}
                onClick={() => setConfig(c => ({ ...c, tipoNegocio: tipo.id }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activo ? tipo.activeBg + " border-current" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icono size={20} className={`mb-2 ${tipo.color}`} />
                <p className="text-sm font-semibold text-slate-800">{tipo.label}</p>
                <p className="text-xs text-slate-500 mt-1">{tipo.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Instrucciones especiales */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Instrucciones especiales
          <span className="ml-2 text-xs font-normal text-slate-400">(opcional)</span>
        </label>
        <p className="text-xs text-slate-400 mb-2">
          Indicale a Rocky qué decir, qué no decir, horarios, precios, etc.
        </p>
        <textarea
          rows={4}
          value={config.instrucciones || ""}
          onChange={e => setConfig(c => ({ ...c, instrucciones: e.target.value }))}
          placeholder={
            "Ej: Atendemos de lunes a viernes de 8am a 6pm.\n" +
            "No hacemos entregas a domicilio.\n" +
            "Si preguntan por precios, deciles que los envíes por catálogo."
          }
          className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:border-yellow-400 resize-none"
        />
      </div>

      {/* Nombre de empresa (fallback) */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Nombre del negocio para Rocky
          <span className="ml-2 text-xs font-normal text-slate-400">(si no está configurado en Ajustes)</span>
        </label>
        <input
          type="text"
          value={config.nombreEmpresa || ""}
          onChange={e => setConfig(c => ({ ...c, nombreEmpresa: e.target.value }))}
          placeholder="Ej: Pizzería Don Mario"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
        />
      </div>

      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Horario de atención</h2>
        <p className="text-xs text-slate-500">Dejá ambos campos vacíos para atender las 24 horas. Fuera del horario los mensajes quedan pendientes hasta el próximo turno.</p>
        <div className="flex gap-3">
          <label className="flex-1 text-sm">Hora inicio<input type="time" value={config.horarioInicio || ''} onChange={e=>setConfig(c=>({...c,horarioInicio:e.target.value}))} className="block w-full border rounded p-2" /></label>
          <label className="flex-1 text-sm">Hora fin<input type="time" value={config.horarioFin || ''} onChange={e=>setConfig(c=>({...c,horarioFin:e.target.value}))} className="block w-full border rounded p-2" /></label>
        </div>
      </section>

      {/* Tip */}
      <div className="flex gap-2 text-xs text-slate-400">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>La bandeja conserva el estado de cada mensaje. Si atendés una conversación, podés pausar a Rocky para evitar respuestas simultáneas.</p>
      </div>

      {/* Guardar */}
      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
      >
        {guardando
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Save size={16} />}
        {guardando ? "Guardando…" : "Guardar configuración"}
      </button>

    </div>
  );
}
