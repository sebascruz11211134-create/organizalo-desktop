/**
 * RockyRecepcionistaScreen — Agente IA que atiende llamadas por la empresa.
 * Conectado al backend real: GET/POST /api/rocky/config, GET /api/rocky/historial
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Phone, Settings2, PhoneIncoming, Sparkles,
  UtensilsCrossed, CalendarCheck, Building2, CheckCircle2,
  XCircle, Mail, MessageSquare, ChevronRight,
  AlertCircle, ExternalLink, RefreshCw, Copy,
} from "lucide-react";
import { getToken } from "../utils/auth";
import { fetchWithTimeout } from "../utils/fetchTimeout";

import { BACKEND } from "../utils/config";

const TIPOS_NEGOCIO = [
  {
    id: "restaurante",
    label: "Restaurante",
    icon: UtensilsCrossed,
    desc: "Rocky toma pedidos para llevar o a domicilio y los crea en el sistema.",
    color: "text-orange-500",
    activeBg: "bg-orange-50 border-orange-300",
  },
  {
    id: "servicios",
    label: "Servicios / Citas",
    icon: CalendarCheck,
    desc: "Rocky agenda citas y envía confirmaciones automáticas por correo.",
    color: "text-blue-500",
    activeBg: "bg-blue-50 border-blue-300",
  },
  {
    id: "general",
    label: "General",
    icon: Building2,
    desc: "Rocky responde preguntas frecuentes y registra mensajes.",
    color: "text-amber-500",
    activeBg: "bg-amber-50 border-amber-300",
  },
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CONFIG_DEFAULT = {
  tipoNegocio: "restaurante",
  activo: false,
  numeroTwilio: "",
  horario: "24h",
  horaInicio: "08:00",
  horaFin: "22:00",
  diasActivos: [0, 1, 2, 3, 4],
  bienvenida: "",
  emailConfirmacion: true,
  whatsappConfirmacion: false,
};

// ── Llamada en el historial ────────────────────────────────────────────────────
function LlamadaCard({ llamada }) {
  const exitosa = llamada.resultado === "completado";
  const fecha = llamada.fecha
    ? new Date(llamada.fecha).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })
    : "";
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
        ${exitosa ? "bg-amber-100" : "bg-amber-50"}`}>
        {exitosa
          ? <CheckCircle2 size={15} className="text-amber-600" />
          : <XCircle size={15} className="text-amber-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-700">{llamada.telefono || "Desconocido"}</span>
          <span className="text-[11px] text-slate-400">{fecha}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{llamada.resumen || llamada.pregunta}</p>
        {llamada.accion && llamada.accion !== "NINGUNA" && (
          <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <ChevronRight size={10} />
            {llamada.accion === "PEDIDO" ? "Pedido creado" : llamada.accion === "CITA" ? "Cita agendada" : llamada.accion}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0
        ${exitosa ? "bg-amber-100 text-amber-700" : "bg-amber-100 text-amber-700"}`}>
        {exitosa ? "OK" : llamada.resultado || "N/D"}
      </span>
    </div>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function RockyRecepcionistaScreen() {
  const [config,    setConfig]    = useState(CONFIG_DEFAULT);
  const [historial, setHistorial] = useState([]);
  const [token,     setToken]     = useState(null);
  const [tab,       setTab]       = useState("config");
  const [guardando, setGuardando] = useState(false);
  const [guardado,  setGuardado]  = useState(false);
  const [error,     setError]     = useState("");
  const [cargando,  setCargando]  = useState(true);

  // Cargar token
  useEffect(() => {
    getToken().then(setToken);
  }, []);

  // Cargar config y historial del backend
  const cargar = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const [resConfig, resHist] = await Promise.all([
        fetchWithTimeout(`${BACKEND}/api/rocky/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 5000),
        fetchWithTimeout(`${BACKEND}/api/rocky/historial`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 5000),
      ]);
      if (resConfig.ok) {
        const json = await resConfig.json();
        if (json.config) setConfig({ ...CONFIG_DEFAULT, ...json.config });
      }
      if (resHist.ok) {
        const json = await resHist.json();
        setHistorial(json.historial || []);
      }
    } catch {
      // offline — mantenemos defaults
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  // Guardar config en backend
  const guardar = async () => {
    if (!token) return;
    setGuardando(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/rocky/config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Error del servidor");
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (err) {
      setError("No se pudo guardar. Verificá la conexión.");
    } finally {
      setGuardando(false);
    }
  };

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const toggleDia = (idx) =>
    setConfig(c => ({
      ...c,
      diasActivos: c.diasActivos.includes(idx)
        ? c.diasActivos.filter(d => d !== idx)
        : [...c.diasActivos, idx],
    }));

  const webhookUrl = `${BACKEND}/api/rocky/llamada`;
  const copiarWebhook = () => navigator.clipboard?.writeText(webhookUrl);

  const tipo = TIPOS_NEGOCIO.find(t => t.id === config.tipoNegocio);

  // Stats del historial
  const totalLlamadas = historial.length;
  const completadas   = historial.filter(l => l.resultado === "completado").length;
  const pedidosCreados = historial.filter(l => l.accion === "PEDIDO").length;
  const citasCreadas   = historial.filter(l => l.accion === "CITA").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center shrink-0">
          <Phone size={16} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-800 text-sm leading-none">Rocky Recepcionista</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Agente IA que atiende llamadas 24/7</p>
        </div>
        <span className="flex-1" />

        {/* Toggle activo */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => set("activo", !config.activo)}
            className={`relative w-10 h-6 rounded-full transition-colors ${config.activo ? "bg-amber-500" : "bg-slate-300"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.activo ? "translate-x-5" : "translate-x-1"}`} />
          </div>
          <span className={`text-xs font-medium ${config.activo ? "text-amber-700" : "text-slate-500"}`}>
            {config.activo ? "Activo" : "Inactivo"}
          </span>
        </label>

        <button
          onClick={guardar}
          disabled={guardando}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${guardado ? "bg-amber-500 text-white" : "bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60"}`}
        >
          {guardado ? <><CheckCircle2 size={14} /> Guardado</> : guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        {[
          { id: "config",    label: "Configuración",  icon: Settings2 },
          { id: "historial", label: `Llamadas (${totalLlamadas})`, icon: PhoneIncoming },
          { id: "ayuda",     label: "Cómo activar",  icon: Sparkles },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium border-b-2 transition-colors
              ${tab === t.id ? "border-violet-500 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {/* ══ TAB: Configuración ══ */}
        {tab === "config" && (
          <div className="max-w-2xl space-y-6">

            {/* Tipo de negocio */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">¿Qué hace Rocky en tu negocio?</h2>
              <div className="grid grid-cols-3 gap-3">
                {TIPOS_NEGOCIO.map(t => (
                  <button
                    key={t.id}
                    onClick={() => set("tipoNegocio", t.id)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all
                      ${config.tipoNegocio === t.id ? t.activeBg : "border-slate-200 hover:border-slate-300 bg-white"}`}
                  >
                    <t.icon size={20} className={config.tipoNegocio === t.id ? t.color : "text-slate-400"} />
                    <div>
                      <p className={`text-xs font-semibold ${config.tipoNegocio === t.id ? "text-slate-800" : "text-slate-600"}`}>
                        {t.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Número Twilio */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Número de teléfono (Twilio)</h2>
              <p className="text-xs text-slate-400 mb-2">
                El número que tus clientes llaman. Rocky contesta automáticamente.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.numeroTwilio}
                  onChange={e => set("numeroTwilio", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="flex-1 border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                />
                <a
                  href="https://www.twilio.com/console/phone-numbers/incoming"
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50"
                >
                  <ExternalLink size={12} /> Twilio Console
                </a>
              </div>
            </div>

            {/* Horario */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Horario de atención</h2>
              <div className="flex gap-4 mb-3">
                {[{ id: "24h", label: "24/7 siempre activo" }, { id: "custom", label: "Personalizado" }].map(h => (
                  <label key={h.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="horario" value={h.id}
                      checked={config.horario === h.id}
                      onChange={() => set("horario", h.id)}
                      className="accent-violet-500"
                    />
                    <span className="text-sm text-slate-600">{h.label}</span>
                  </label>
                ))}
              </div>

              {config.horario === "custom" && (
                <div className="space-y-3 pl-4 border-l-2 border-violet-200">
                  <div className="flex gap-2 flex-wrap">
                    {DIAS.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => toggleDia(i)}
                        className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors
                          ${config.diasActivos.includes(i) ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="time" value={config.horaInicio}
                      onChange={e => set("horaInicio", e.target.value)}
                      className="border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
                    <span className="text-slate-400 text-sm">a</span>
                    <input type="time" value={config.horaFin}
                      onChange={e => set("horaFin", e.target.value)}
                      className="border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
                  </div>
                </div>
              )}
            </div>

            {/* Mensaje de bienvenida */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Mensaje de bienvenida</h2>
              <p className="text-xs text-slate-400 mb-2">Lo primero que Rocky dice al contestar. Dejá vacío para usar el predeterminado.</p>
              <textarea
                value={config.bienvenida}
                onChange={e => set("bienvenida", e.target.value)}
                placeholder={`Ej: "Gracias por llamar. Soy Rocky, ¿en qué te puedo ayudar?"`}
                rows={3}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
              />
            </div>

            {/* Confirmaciones */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Confirmaciones automáticas</h2>
              <div className="space-y-2">
                {[
                  { key: "emailConfirmacion",      label: "Email al negocio",    icon: Mail,          desc: "Recibís un email por cada llamada completada" },
                  { key: "whatsappConfirmacion",    label: "WhatsApp al cliente", icon: MessageSquare, desc: "Envía confirmación por WhatsApp si el cliente dejó número" },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={config[opt.key]}
                      onChange={e => set(opt.key, e.target.checked)}
                      className="accent-violet-500 w-4 h-4 shrink-0"
                    />
                    <opt.icon size={15} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{opt.label}</p>
                      <p className="text-[11px] text-slate-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: Historial ══ */}
        {tab === "historial" && (
          <div className="max-w-2xl">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Total llamadas", value: totalLlamadas, color: "text-slate-700" },
                { label: "Completadas",    value: completadas,   color: "text-amber-600" },
                { label: "Pedidos",        value: pedidosCreados,color: "text-orange-600" },
                { label: "Citas",          value: citasCreadas,  color: "text-blue-600" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Llamadas recientes</h2>
              <button onClick={cargar} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
                <RefreshCw size={12} /> Actualizar
              </button>
            </div>

            {historial.length === 0 ? (
              <div className="text-center py-12">
                <PhoneIncoming size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Sin llamadas registradas aún.</p>
                <p className="text-xs text-slate-400 mt-1">Las llamadas aparecen aquí cuando Rocky empieza a funcionar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historial.map((l, i) => <LlamadaCard key={i} llamada={l} />)}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Cómo activar ══ */}
        {tab === "ayuda" && (
          <div className="max-w-xl space-y-4">
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-violet-800 mb-4">Pasos para activar Rocky</h2>
              <ol className="space-y-4">
                {[
                  {
                    n: "1", title: "Crear cuenta en Twilio",
                    body: "Entrá a twilio.com, creá una cuenta gratuita y comprá un número de teléfono (~$1/mes).",
                    link: "https://www.twilio.com/try-twilio", linkLabel: "Ir a Twilio →",
                  },
                  {
                    n: "2", title: "Configurar el número arriba",
                    body: "Pegá el número de Twilio en el campo de la pestaña Configuración y guardá.",
                  },
                  {
                    n: "3", title: "Apuntar el webhook en Twilio",
                    body: "En la consola de Twilio, buscá tu número → Voice → Webhook, y pegá esta URL:",
                    webhook: webhookUrl,
                  },
                  {
                    n: "4", title: "Activar Rocky",
                    body: "Usá el toggle 'Activo' en la parte superior y guardá la configuración.",
                  },
                  {
                    n: "5", title: "¡Listo!",
                    body: "Llamá al número y Rocky te atenderá. Los pedidos y citas aparecen automáticamente en el sistema.",
                  },
                ].map(s => (
                  <li key={s.n} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {s.n}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.body}</p>
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1">
                          <ExternalLink size={11} /> {s.linkLabel}
                        </a>
                      )}
                      {s.webhook && (
                        <div className="flex items-center gap-2 mt-2 bg-white border border-violet-200 rounded-lg px-3 py-2">
                          <code className="flex-1 text-xs text-violet-700 font-mono truncate">{s.webhook}</code>
                          <button onClick={copiarWebhook} className="shrink-0 text-violet-500 hover:text-violet-700">
                            <Copy size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Emails de confirmación</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Para que Rocky envíe emails necesitás una cuenta gratuita en{" "}
                  <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline">resend.com</a>
                  {" "}y agregar la API key en el servidor (RESEND_API_KEY en .env.vps).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
