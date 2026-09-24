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
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio, Indicadores, Indicador, Campo, Entrada, AreaTexto, Interruptor } from "../components/ui";
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
    color: "text-yellow-500",
    activeBg: "bg-yellow-50 border-yellow-300",
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
    <div className="animate-desplegar flex items-start gap-3 p-3.5 rounded-2xl border-2 border-black/10 bg-white hover:border-black/25 transition-colors">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${exitosa ? "bg-monki-y text-monki-k" : "bg-monki-cream text-monki-k/50"}`}>
        {exitosa ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-monki-k">{llamada.telefono || "Desconocido"}</span>
          <span className="font-mono text-[10px] text-monki-k/45">{fecha}</span>
        </div>
        <p className="text-xs text-monki-k/60 mt-0.5 line-clamp-2">{llamada.resumen || llamada.pregunta}</p>
        {llamada.accion && llamada.accion !== "NINGUNA" && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold bg-monki-k text-monki-y px-2 py-0.5 rounded-full">
            <ChevronRight size={10} />
            {llamada.accion === "PEDIDO" ? "Pedido creado" : llamada.accion === "CITA" ? "Cita agendada" : llamada.accion}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${exitosa ? "bg-[#dcfce7] text-[#166534]" : "bg-black/5 text-monki-k/60"}`}>
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

  const TITULO = "text-[15px] font-extrabold tracking-[-0.02em] text-monki-k";
  return (
    <Modulo
      seccion="Rocky IA"
      titulo="Rocky recepcionista"
      descripcion="Un agente de IA que contesta las llamadas de tu negocio, 24/7."
      acciones={<>
        <div className="bg-white rounded-full border-2 border-black/10 px-3 py-1.5"><Interruptor activo={config.activo} onCambio={v=>set("activo", v)} etiqueta={config.activo ? "Activo" : "Inactivo"}/></div>
        <Boton icono={guardado ? CheckCircle2 : undefined} onClick={guardar} cargando={guardando} disabled={guardando}>{guardado ? "Guardado" : guardando ? "Guardando…" : "Guardar"}</Boton>
      </>}
      pestanas={{ activa: tab, onCambiar: setTab, items: [
        { key: "config", label: "Configuración" },
        { key: "historial", label: "Llamadas", cuenta: totalLlamadas },
        { key: "ayuda", label: "Cómo activarlo" },
      ] }}
    >
      {error && (
        <div className="animate-desplegar mb-3 flex items-center gap-2 text-sm font-bold text-red-700 bg-red-100 rounded-full px-4 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        {tab === "config" && (
          <div className="max-w-3xl space-y-3">
            <Tarjeta titulo="¿Qué hace Rocky en tu negocio?" cuerpo="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TIPOS_NEGOCIO.map(t => {
                  const activo = config.tipoNegocio === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => set("tipoNegocio", t.id)}
                      className={`ui-boton flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all duration-300 ease-monki
                        ${activo ? "bg-monki-y border-monki-k shadow-[4px_4px_0_#111] -translate-x-0.5 -translate-y-0.5" : "border-black/10 hover:border-black/30 bg-white"}`}>
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${activo ? "bg-monki-k text-monki-y" : "bg-monki-cream text-monki-k/60"}`}><t.icon size={17} /></span>
                      <div>
                        <p className="text-sm font-extrabold text-monki-k">{t.label}</p>
                        <p className="text-[11px] text-monki-k/55 mt-0.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Número de teléfono (Twilio)" cuerpo="px-4 pb-4">
              <p className="text-sm text-monki-k/55 mb-2">El número que tus clientes llaman. Rocky contesta automáticamente.</p>
              <div className="flex flex-wrap gap-2">
                <Entrada value={config.numeroTwilio} onChange={e => set("numeroTwilio", e.target.value)} placeholder="+1 (555) 000-0000" className="flex-1 min-w-[200px] font-mono"/>
                <a href="https://www.twilio.com/console/phone-numbers/incoming" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold shadow-[inset_0_0_0_2px_#111] hover:bg-monki-k hover:text-monki-y transition-colors">
                  <ExternalLink size={13} /> Consola de Twilio
                </a>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Horario de atención" cuerpo="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2 max-w-md mb-3">
                {[{ id: "24h", label: "24/7, siempre activo" }, { id: "custom", label: "Personalizado" }].map(h => (
                  <button key={h.id} type="button" onClick={() => set("horario", h.id)}
                    className={`ui-boton py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${config.horario === h.id ? "bg-monki-k text-monki-y" : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>{h.label}</button>
                ))}
              </div>
              {config.horario === "custom" && (
                <div className="animate-desplegar space-y-3 bg-monki-cream rounded-2xl p-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {DIAS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDia(i)}
                        className={`ui-boton w-11 h-11 rounded-full text-xs font-bold transition-all duration-200 ${config.diasActivos.includes(i) ? "bg-monki-k text-monki-y" : "bg-white text-monki-k/55 hover:text-monki-k"}`}>{d}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Entrada type="time" value={config.horaInicio} onChange={e => set("horaInicio", e.target.value)} className="!w-auto"/>
                    <span className="monki-tag text-monki-k/50">a</span>
                    <Entrada type="time" value={config.horaFin} onChange={e => set("horaFin", e.target.value)} className="!w-auto"/>
                  </div>
                </div>
              )}
            </Tarjeta>

            <Tarjeta titulo="Mensaje de bienvenida" cuerpo="px-4 pb-4">
              <Campo ayuda="Lo primero que Rocky dice al contestar. Si lo dejás vacío usa el predeterminado.">
                <AreaTexto value={config.bienvenida} onChange={e => set("bienvenida", e.target.value)} rows={3}
                  placeholder={`Ej: "Gracias por llamar. Soy Rocky, ¿en qué te puedo ayudar?"`}/>
              </Campo>
            </Tarjeta>

            <Tarjeta titulo="Confirmaciones automáticas" cuerpo="px-4 pb-4 space-y-2">
              {[
                { key: "emailConfirmacion",   label: "Correo al negocio",   icon: Mail,          desc: "Recibís un correo por cada llamada completada" },
                { key: "whatsappConfirmacion", label: "WhatsApp al cliente", icon: MessageSquare, desc: "Confirma por WhatsApp si el cliente dejó su número" },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-3 p-3 rounded-2xl bg-monki-cream/60">
                  <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0"><opt.icon size={15} /></span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-monki-k">{opt.label}</p>
                    <p className="text-[11px] text-monki-k/50">{opt.desc}</p>
                  </div>
                  <Interruptor activo={config[opt.key]} onCambio={v => set(opt.key, v)} />
                </div>
              ))}
            </Tarjeta>
          </div>
        )}

        {tab === "historial" && (
          <div className="max-w-3xl space-y-3">
            <Indicadores>
              <Indicador etiqueta="Llamadas" valor={totalLlamadas} icono={PhoneIncoming} delay={40}/>
              <Indicador etiqueta="Completadas" valor={completadas} icono={CheckCircle2} destacado delay={90}/>
              <Indicador etiqueta="Pedidos" valor={pedidosCreados} icono={UtensilsCrossed} delay={140}/>
              <Indicador etiqueta="Citas" valor={citasCreadas} icono={CalendarCheck} delay={190}/>
            </Indicadores>
            <div className="flex items-center justify-between">
              <h2 className={TITULO}>Llamadas recientes</h2>
              <Boton variante="fantasma" tamano="sm" icono={RefreshCw} onClick={cargar} cargando={cargando}>Actualizar</Boton>
            </div>
            {historial.length === 0 ? (
              <Tarjeta><Vacio icono={PhoneIncoming} titulo="Sin llamadas todavía" texto="Las llamadas aparecen acá cuando Rocky empieza a contestar."/></Tarjeta>
            ) : (
              <div className="space-y-2">{historial.map((l, i) => <LlamadaCard key={i} llamada={l} />)}</div>
            )}
          </div>
        )}

        {tab === "ayuda" && (
          <div className="max-w-2xl space-y-3">
            <div className="animate-entrar bg-monki-k text-white rounded-[22px] p-6">
              <p className="monki-tag text-monki-y mb-4">Pasos para activar a Rocky</p>
              <ol className="space-y-4">
                {[
                  { n: "1", title: "Crear una cuenta en Twilio", body: "Entrá a twilio.com, creá una cuenta gratuita y comprá un número de teléfono (unos $1 al mes).", link: "https://www.twilio.com/try-twilio", linkLabel: "Ir a Twilio" },
                  { n: "2", title: "Poner el número acá", body: "Pegá el número de Twilio en la pestaña Configuración y guardá." },
                  { n: "3", title: "Configurar el webhook en Twilio", body: "En la consola de Twilio: tu número → Voice → Webhook, y pegá esta dirección:", webhook: webhookUrl },
                  { n: "4", title: "Activar a Rocky", body: "Encendé el interruptor de arriba y guardá." },
                  { n: "5", title: "¡Listo!", body: "Llamá al número y Rocky te atiende. Los pedidos y citas aparecen solos en el sistema." },
                ].map(s => (
                  <li key={s.n} className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-monki-y text-monki-k text-xs font-black flex items-center justify-center shrink-0">{s.n}</span>
                    <div className="flex-1">
                      <p className="text-sm font-extrabold">{s.title}</p>
                      <p className="text-sm text-white/65 mt-0.5">{s.body}</p>
                      {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-monki-y font-bold hover:underline mt-1"><ExternalLink size={12} /> {s.linkLabel}</a>}
                      {s.webhook && (
                        <div className="flex items-center gap-2 mt-2 bg-white/10 rounded-full pl-4 pr-1 py-1">
                          <code className="flex-1 text-xs text-monki-y font-mono truncate">{s.webhook}</code>
                          <button type="button" onClick={copiarWebhook} title="Copiar" className="ui-boton w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15"><Copy size={13} /></button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-monki-y/40 border-2 border-monki-y rounded-2xl p-4 flex gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-extrabold text-monki-k">Correos de confirmación</p>
                <p className="text-sm text-monki-k/70 mt-0.5">
                  Para que Rocky mande correos necesitás una cuenta gratuita en{" "}
                  <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline font-bold">resend.com</a>
                  {" "}y poner la clave en el servidor (RESEND_API_KEY).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modulo>
  );
}
