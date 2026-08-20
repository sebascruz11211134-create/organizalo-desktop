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
  buscar_facturas:    { label: "Facturas",     icon: FileText,    color: "text-blue-600   bg-blue-50   border-blue-200" },
  buscar_cxc:         { label: "Cuentas ×Cob", icon: TrendingUp,  color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  buscar_cxp:         { label: "Cuentas ×Pag", icon: AlertCircle, color: "text-orange-600 bg-orange-50 border-orange-200" },
  buscar_inventario:  { label: "Inventario",   icon: Package,     color: "text-violet-600 bg-violet-50 border-violet-200" },
  buscar_contactos:   { label: "Contactos",    icon: Users,       color: "text-sky-600    bg-sky-50    border-sky-200" },
  buscar_pedidos:     { label: "Pedidos",      icon: ShoppingCart,color: "text-yellow-600  bg-yellow-50  border-yellow-200" },
  buscar_cotizaciones:{ label: "Cotizaciones", icon: ClipboardList,color:"text-pink-600   bg-pink-50   border-pink-200" },
  buscar_compras:     { label: "Compras",      icon: ShoppingCart,color: "text-red-600    bg-red-50    border-red-200" },
  resumen_financiero: { label: "Resumen",      icon: BarChart2,   color: "text-teal-600   bg-teal-50   border-teal-200" },
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
  const meta = TOOL_META[toolName] || { label: toolName, icon: Database, color: "text-slate-600 bg-slate-50 border-slate-200" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
      <Icon size={9} />
      {meta.label}
    </span>
  );
}

function CuotaBar({ cuota }) {
  if (!cuota) return null;
  const pct = Math.min(100, (cuota.usados / cuota.limite) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-yellow-500";
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500">
      <span>{cuota.usados}/{cuota.limite} consultas hoy</span>
      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-400">{cuota.restantes} restantes</span>
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
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <Sparkles size={18} className="text-yellow-600" />
        <span className="font-bold text-gray-800">Asistente IA</span>
        <span className="text-xs text-slate-400 ml-1">· Claude + datos reales</span>

        {rolLabel && (
          <span className="flex items-center gap-1 text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
            <Shield size={10} />
            {rolLabel}
          </span>
        )}

        <span className="flex-1" />

        <CuotaBar cuota={cuota} />

        {messages.length > 0 && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 ml-3"
          >
            <RotateCcw size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Mensajes ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <Bot size={32} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                ¿En qué te puedo ayudar{user?.nombre ? `, ${user.nombre.split(" ")[0]}` : ""}?
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Consulto los datos reales de tu empresa en tiempo real.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-left text-xs px-3 py-2 border border-slate-200 rounded-md
                             hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-800
                             transition-colors text-slate-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-yellow-700 text-white rounded-br-sm"
                  : m.esLimite
                    ? "bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-bl-sm"
                    : m.error
                      ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}
            >
              {m.content}
            </div>

            {/* Tools usados — chips debajo del mensaje del asistente */}
            {m.role === "assistant" && m.toolsUsados?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                <span className="text-[10px] text-slate-400 self-center mr-0.5">Consultó:</span>
                {m.toolsUsados.map(t => <ToolChip key={t} toolName={t} />)}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start gap-1.5">
            <div className="bg-gray-100 text-slate-500 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
            <span className="text-[10px] text-slate-400 ml-1">Consultando datos…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex items-end gap-3 bg-gray-100 rounded-2xl px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escribe tu pregunta… (Enter para enviar)"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 py-1"
          />
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || loading || !token}
            className="p-2 bg-yellow-700 text-white rounded-xl hover:bg-yellow-800
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">
          El asistente ve solo los datos permitidos para tu rol
        </p>
      </div>
    </div>
  );
}
