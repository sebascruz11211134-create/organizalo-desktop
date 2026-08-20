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

const TIPOS = [
  {
    id: "restaurante",
    label: "Restaurante",
    icon: UtensilsCrossed,
    desc: "Toma pedidos, informa del menú y crea órdenes automáticamente.",
    color: "text-orange-500",
    activeBg: "bg-orange-50 border-orange-400",
  },
  {
    id: "servicios",
    label: "Servicios / Citas",
    icon: CalendarCheck,
    desc: "Agenda citas y envía confirmaciones automáticas.",
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
  tipoNegocio: "general",
  instrucciones: "",
  nombreEmpresa: "",
  horarioInicio: "",
  horarioFin: "",
  mensajeFueraHorario: "",
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
        setMensaje({ tipo: "ok", texto: "Configuración guardada. Rocky ya está activo en WhatsApp." });
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
            <h1 className="text-xl font-bold text-slate-800">Rocky IA — WhatsApp</h1>
            <p className="text-sm text-slate-500">Configura el asistente automático de mensajes</p>
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
          <p>Cuando alguien te escribe por WhatsApp, Rocky responde automáticamente usando IA. Solo funciona si WhatsApp está conectado en la sección <strong>Rocky IA → WhatsApp</strong>.</p>
        </div>
      </div>

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

      {/* Horario de atención */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={16} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Horario de atención</span>
          <span className="text-xs text-slate-400">(opcional)</span>
        </div>
        <p className="text-xs text-slate-500">
          Si definís un horario, Rocky solo responderá dentro de ese rango. Fuera del horario enviará el mensaje automático de abajo.
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Hora inicio</label>
            <input
              type="time"
              value={config.horarioInicio || ""}
              onChange={e => setConfig(c => ({ ...c, horarioInicio: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Hora fin</label>
            <input
              type="time"
              value={config.horarioFin || ""}
              onChange={e => setConfig(c => ({ ...c, horarioFin: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Mensaje fuera de horario</label>
          <textarea
            rows={2}
            value={config.mensajeFueraHorario || ""}
            onChange={e => setConfig(c => ({ ...c, mensajeFueraHorario: e.target.value }))}
            placeholder="Ej: Gracias por escribirnos 🙏 Nuestro horario es de 8am a 6pm. Te contactamos pronto."
            className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-yellow-400 resize-none"
          />
        </div>
      </div>

      {/* Tip */}
      <div className="flex gap-2 text-xs text-slate-400">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>Rocky recuerda los últimos mensajes de cada conversación y responde con contexto. Máximo 3 oraciones por mensaje.</p>
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
