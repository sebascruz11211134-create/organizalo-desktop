/**
 * AsistenteScreen — Asistente IA por empresa, con filtrado de datos por rol.
 *
 * El backend recibe el JWT, extrae el rol, carga cloud_data filtrado
 * y construye el contexto. Aquí solo enviamos mensajes + token.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Sparkles, RotateCcw, Bot, Shield } from "lucide-react";
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

const ROL_SUGERENCIAS = {
  admin: [
    "¿Cuánto hemos facturado este mes?",
    "¿Cuáles clientes tienen CXC vencida?",
    "¿Cómo está el inventario bajo mínimo?",
    "Dame un resumen del negocio hoy.",
    "¿Cuánto debemos a proveedores?",
    "¿Cuántos empleados activos tenemos?",
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
    "Redacta un recordatorio de cobro para un cliente.",
  ],
  contabilidad: [
    "¿Cuánto es el CXC pendiente total?",
    "¿Cuánto debemos a proveedores?",
    "¿Cuántas facturas hay este mes?",
    "Dame un resumen de asientos del mes.",
    "¿Cuánto se pagó en compras este mes?",
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
    "¿Cuánto fue la nómina este mes?",
    "Dame un resumen del flujo de caja.",
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
  "¿Cómo está el flujo de caja?",
];

export default function AsistenteScreen() {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [token,     setToken]     = useState(null);
  const [user,      setUser]      = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Cargar token y usuario al montar
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
        throw new Error(json.error || `Error ${res.status}`);
      }

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: json.reply, id: Date.now() + 1 },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}`,
          id: Date.now() + 1,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, input, loading, token]);

  const limpiar = () => setMessages([]);

  const rolLabel = ROL_LABEL[user?.rol] || user?.rol || "";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <Sparkles size={18} className="text-emerald-600" />
        <span className="font-bold text-gray-800">Asistente IA</span>
        <span className="text-xs text-slate-400 ml-1">· Powered by Claude</span>

        {rolLabel && (
          <span className="ml-2 flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Shield size={10} />
            {rolLabel}
          </span>
        )}

        <span className="flex-1" />

        {messages.length > 0 && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
          >
            <RotateCcw size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Mensajes ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <Bot size={32} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                ¿En qué te puedo ayudar{user?.nombre ? `, ${user.nombre.split(" ")[0]}` : ""}?
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Tengo acceso en tiempo real a los datos de tu empresa.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-left text-xs px-3 py-2 border border-slate-200 rounded-md
                             hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800
                             transition-colors text-slate-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-emerald-700 text-white rounded-br-sm"
                  : m.error
                    ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-slate-500 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────────────────── */}
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
            className="p-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800
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
