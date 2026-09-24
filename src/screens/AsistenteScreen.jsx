/**
 * AsistenteScreen — Asistente IA con tool-calling por empresa.
 *
 * Muestra cuota restante, tools consultadas y respuestas con datos reales.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Sparkles, RotateCcw, Bot, Shield,
  Database, BarChart2, FileText, Package,
  Users, ShoppingCart, ClipboardList, TrendingUp,
  AlertCircle,
} from "lucide-react";
import { getToken, getUser } from "../utils/auth";
import { Modulo, Boton } from "../components/ui";

import { BACKEND } from "../utils/config";

const ROL_LABEL = {
  admin:        "Administrador",
  gerencia:     "Gerencia",
  ventas:       "Ventas",
  contabilidad: "Contabilidad",
  bodega:       "Bodega",
  rrhh:         "RRHH",
  colaborador:  "Colaborador",
};

// Íconos y etiquetas para cada herramienta del agente
const TOOL_META = {
  buscar_facturas:    { label: "Facturas",     icon: FileText,    color: "" },
  buscar_cxc:         { label: "Cuentas ×Cob", icon: TrendingUp,  color: "" },
  buscar_cxp:         { label: "Cuentas ×Pag", icon: AlertCircle, color: "" },
  buscar_inventario:  { label: "Inventario",   icon: Package,     color: "" },
  buscar_contactos:   { label: "Contactos",    icon: Users,       color: "" },
  buscar_pedidos:     { label: "Pedidos",      icon: ShoppingCart,color: "" },
  buscar_cotizaciones:{ label: "Cotizaciones", icon: ClipboardList,color: "" },
  buscar_compras:     { label: "Compras",      icon: ShoppingCart,color: "" },
  resumen_financiero: { label: "Resumen",      icon: BarChart2,   color: "" },
};

const ROL_SUGERENCIAS = {
  admin: [
    "¿Cuánto hemos facturado este mes?",
    "¿Cuáles clientes tienen CXC vencida?",
    "¿Qué productos están bajo el mínimo?",
    "Dame un resumen financiero del mes.",
    "¿Cuánto debemos a proveedores?",
    "Top 5 clientes por ventas este trimestre.",
  ],
  gerencia: [
    "¿Cuánto hemos facturado este mes?",
    "¿Cuáles clientes tienen CXC vencida?",
    "Dame un resumen ejecutivo del negocio.",
    "¿Cómo está el flujo de caja?",
    "Top 5 clientes por ventas.",
  ],
  ventas: [
    "¿Cuáles clientes tienen facturas vencidas?",
    "¿Cuántas cotizaciones están abiertas?",
    "¿Cuánto hemos facturado este mes?",
    "¿Cuántos pedidos están pendientes?",
    "Redacta un recordatorio de cobro.",
  ],
  contabilidad: [
    "¿Cuánto es el CXC pendiente total?",
    "¿Cuánto debemos a proveedores?",
    "¿Cuántas facturas hay este mes?",
    "¿Cuánto se pagó en compras este mes?",
    "Dame un resumen financiero del trimestre.",
  ],
  bodega: [
    "¿Qué productos están bajo el mínimo?",
    "¿Cuántos productos están sin stock?",
    "¿Cuántos pedidos están pendientes?",
    "¿Cuántas órdenes de taller hay abiertas?",
    "¿Qué se compró este mes?",
  ],
  rrhh: [
    "¿Cuántos empleados activos tenemos?",
    "Dame un resumen financiero del mes.",
    "¿Cuánto se facturó este mes?",
  ],
  colaborador: [
    "¿Cuántas facturas hay este mes?",
    "¿Cuántas cotizaciones están abiertas?",
    "¿Cuántos pedidos hay pendientes?",
  ],
};

const SUGERENCIAS_DEFAULT = [
  "¿Cuánto hemos facturado este mes?",
  "¿Cuáles clientes tienen CXC vencida?",
  "¿Qué productos están bajo el mínimo?",
  "Dame un resumen del negocio.",
  "¿Cuánto debemos a proveedores?",
  "Top 5 clientes por ventas.",
];

function ToolChip({ toolName }) {
  const meta = TOOL_META[toolName] || { label: toolName, icon: Database, color: "" };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-monki-k text-monki-y">
      <Icon size={9} />
      {meta.label}
    </span>
  );
}

function CuotaBar({ cuota }) {
  if (!cuota) return null;
  const pct = Math.min(100, (cuota.usados / cuota.limite) * 100);
  const color = pct >= 90 ? "bg-red-500" : "bg-monki-k";
  return (
    <div className="flex items-center gap-2 bg-white rounded-full border-2 border-black/10 px-3 py-1.5 font-mono text-[11px] text-monki-k/60">
      <span>{cuota.usados}/{cuota.limite} hoy</span>
      <div className="w-20 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{cuota.restantes} restantes</span>
    </div>
  );
}

export default function AsistenteScreen() {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [token,     setToken]     = useState(null);
  const [user,      setUser]      = useState(null);
  const [cuota,     setCuota]     = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    Promise.all([getToken(), getUser()]).then(([t, u]) => {
      setToken(t);
      setUser(u);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sugerencias = ROL_SUGERENCIAS[user?.rol] || SUGERENCIAS_DEFAULT;

  const enviar = useCallback(async (texto) => {
    const msg = texto || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { role: "user", content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const historial = [...messages, userMsg].map(m => ({
        role: m.role, content: m.content,
      }));

      const res = await fetch(`${BACKEND}/api/asistente/chat`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: historial }),
      });

      const json = await res.json();

      if (!res.ok) {
        // Cuota agotada — mostrar aviso especial
        if (res.status === 429) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: json.error || "Límite diario de consultas alcanzado. Se renueva mañana.",
            id: Date.now() + 1,
            error: true,
            esLimite: true,
          }]);
          return;
        }
        throw new Error(json.error || `Error ${res.status}`);
      }

      if (json.cuota) setCuota(json.cuota);

      setMessages(prev => [...prev, {
        role:        "assistant",
        content:     json.reply,
        id:          Date.now() + 1,
        toolsUsados: json.toolsUsados || [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role:    "assistant",
        content: `Error: ${err.message}`,
        id:      Date.now() + 1,
        error:   true,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, input, loading, token]);

  const limpiar = () => setMessages([]);
  const rolLabel = ROL_LABEL[user?.rol] || user?.rol || "";

  return (
    <Modulo
      seccion="Rocky IA"
      titulo="Asistente IA"
      descripcion={`Preguntale lo que quieras: consulta los datos reales de tu empresa${rolLabel ? ` · rol ${rolLabel}` : ""}.`}
      acciones={<>
        <CuotaBar cuota={cuota} />
        {messages.length > 0 && <Boton variante="secundario" icono={RotateCcw} onClick={limpiar}>Nueva conversación</Boton>}
      </>}
    >
      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[22px] border-2 border-black/10 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto px-4 md:px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-20 h-20 bg-monki-y rounded-full flex items-center justify-center shadow-[5px_5px_0_#111] animate-flotar">
                <Bot size={36} className="text-monki-k" />
              </div>
              <div>
                <h2 className="text-[24px] font-black tracking-[-0.03em] text-monki-k">
                  ¿En qué te ayudo{user?.nombre ? `, ${user.nombre.split(" ")[0]}` : ""}?
                </h2>
                <p className="text-sm text-monki-k/55 mt-1 flex items-center justify-center gap-1.5">
                  <Sparkles size={14}/> Consulto los datos reales de tu empresa al momento.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {sugerencias.map((s, i) => (
                  <button key={s} type="button" onClick={() => enviar(s)} style={{ animationDelay: `${i*50}ms` }}
                    className="ui-boton animate-entrar text-left text-sm px-4 py-3 bg-white border-2 border-black/10 rounded-2xl font-semibold text-monki-k/75
                               transition-all duration-300 ease-monki hover:border-monki-k hover:text-monki-k hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111]">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`animate-desplegar flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-[20px] text-sm leading-relaxed whitespace-pre-wrap
                  ${m.role === "user"
                    ? "bg-monki-k text-white rounded-br-md"
                    : m.esLimite
                      ? "bg-monki-y text-monki-k rounded-bl-md"
                      : m.error
                        ? "bg-red-100 text-red-700 rounded-bl-md"
                        : "bg-monki-cream text-monki-k rounded-bl-md"}`}>
                {m.content}
              </div>
              {m.role === "assistant" && m.toolsUsados?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-1 items-center">
                  <span className="monki-tag text-[10px] text-monki-k/40 mr-0.5">Consultó</span>
                  {m.toolsUsados.map(t => <ToolChip key={t} toolName={t} />)}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start gap-1.5">
              <div className="bg-monki-cream px-4 py-3.5 rounded-[20px] rounded-bl-md">
                <span className="inline-flex gap-1 items-center">
                  {[0,150,300].map(d => <span key={d} className="w-2 h-2 bg-monki-k rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
              <span className="monki-tag text-[10px] text-monki-k/40 ml-1">Consultando datos…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 px-4 md:px-6 py-4 border-t-2 border-black/10 bg-monki-cream/40">
          <div className="flex items-end gap-2 bg-white border-2 border-black/10 focus-within:border-monki-k rounded-[20px] pl-4 pr-1.5 py-1.5 transition-colors">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escribí tu pregunta… (Enter para enviar)" rows={1}
              className="ui-sin-foco flex-1 bg-transparent text-sm resize-none outline-none border-0 max-h-32 py-2" />
            <button type="button" onClick={() => enviar()} disabled={!input.trim() || loading || !token} title="Enviar"
              className="ui-boton w-10 h-10 shrink-0 rounded-full bg-monki-k text-monki-y flex items-center justify-center transition-all duration-300 ease-monki hover:scale-105 disabled:opacity-30 disabled:hover:scale-100">
              <Send size={16} />
            </button>
          </div>
          <p className="text-[11px] text-monki-k/40 mt-2 text-center flex items-center justify-center gap-1"><Shield size={11}/> El asistente solo ve los datos permitidos para tu rol</p>
        </div>
      </div>
    </Modulo>
  );
}
