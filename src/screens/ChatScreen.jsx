/**
 * ChatScreen — Chat interno por empresa dividido por canal.
 * Canales: General, Facturación, Contabilidad, Inventario, Soporte.
 * Tiempo real vía Socket.io (reconexión automática).
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, Users, Plus, Link, Copy, Check } from "lucide-react";
import api from "../utils/api";

import { BACKEND } from "../utils/config";
const CANALES = [
  { id: "general",       emoji: "💬", nombre: "General" },
  { id: "facturación",   emoji: "🧾", nombre: "Facturación" },
  { id: "contabilidad",  emoji: "📊", nombre: "Contabilidad" },
  { id: "inventario",    emoji: "📦", nombre: "Inventario" },
  { id: "soporte",       emoji: "🛟", nombre: "Soporte" },
];

// store.get es async IPC — no se puede llamar sincrónicamente
async function getAuthHeader() {
  const token = await window.electronAPI?.store?.get("@finanzia/authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getUserAsync() {
  return (await window.electronAPI?.store?.get("@finanzia/authUser")) || {};
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────

function Burbuja({ msg, esPropio }) {
  const hora  = new Date(msg.creadoEn || msg.creado_en).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
  const esBot = msg.esBot || msg.user_id === "bot-soporte" || msg.userId === "bot-soporte";

  if (esBot) {
    return (
      <div className="flex flex-col mb-4 items-start">
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <span className="text-base">🤖</span>
          <span className="text-xs font-semibold text-amber-700">Asistente Monki</span>
          <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">IA</span>
        </div>
        <div className="max-w-sm lg:max-w-lg px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-amber-50 border border-amber-200 text-slate-800 whitespace-pre-wrap">
          {msg.texto}
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 ml-1">{hora}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-3 ${esPropio ? "items-end" : "items-start"}`}>
      {!esPropio && (
        <span className="text-xs text-slate-500 mb-0.5 ml-1">{msg.userNombre || msg.user_nombre}</span>
      )}
      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${
        esPropio ? "bg-amber-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
      }`}>
        {msg.texto}
      </div>
      <span className="text-[10px] text-slate-400 mt-0.5 mx-1">{hora}</span>
    </div>
  );
}

// ── Modal de invitar colaborador ──────────────────────────────────────────────

function InviteModal({ onClose, authToken }) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("colaborador");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const invitar = async () => {
    if (!email.includes("@")) return setError("Correo inválido");
    setLoading(true); setError("");
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const res = await api.post(`/api/auth/invite`, { email, rol }, { headers });
      setLink(res.data.inviteLink);
    } catch (e) {
      setError(e.response?.data?.error || "Error al generar invitación");
    } finally { setLoading(false); }
  };

  const copiar = () => {
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Invitar colaborador</h2>
        {!link ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Rol</label>
              <select value={rol} onChange={e => setRol(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="colaborador">Colaborador</option>
                <option value="contador">Contador</option>
                <option value="vendedor">Vendedor</option>
                <option value="solo_lectura">Solo lectura</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={invitar} disabled={loading}
                className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-60">
                {loading ? "Generando…" : "Generar invitación"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-amber-300 rounded-xl p-4">
              <p className="text-sm text-green-800 font-semibold mb-2">✅ Invitación generada</p>
              <p className="text-xs text-amber-700 mb-3">Comparte este link con {email}. Expira en 7 días.</p>
              <div className="bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-600 break-all">{link}</div>
            </div>
            <button onClick={copiar}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700">
              {copiado ? <><Check size={14}/> ¡Copiado!</> : <><Copy size={14}/> Copiar link</>}
            </button>
            <button onClick={onClose} className="w-full text-sm text-slate-400 hover:text-slate-600">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [canalActivo, setCanalActivo] = useState("general");
  const [mensajes,    setMensajes]    = useState([]);
  const [texto,       setTexto]       = useState("");
  const [enviando,    setEnviando]    = useState(false);
  const [showInvite,  setShowInvite]  = useState(false);
  const [noLeidos,    setNoLeidos]    = useState({});
  const [authToken,   setAuthToken]   = useState("");
  const [user,        setUser]        = useState({});
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Cargar token y usuario de forma async al montar
  useEffect(() => {
    (async () => {
      const token = await window.electronAPI?.store?.get("@finanzia/authToken");
      const usr   = await window.electronAPI?.store?.get("@finanzia/authUser");
      if (token) setAuthToken(token);
      if (usr)   setUser(usr);
    })();
  }, []);

  const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const cargarMensajes = useCallback(async (canal) => {
    if (!authToken) return;               // esperar token
    try {
      const res = await api.get(`/api/chat/mensajes/${canal}`, { headers: { Authorization: `Bearer ${authToken}` } });
      setMensajes(res.data.mensajes || []);
    } catch (e) { console.error(e); }
  }, [authToken]);

  useEffect(() => {
    cargarMensajes(canalActivo);
    inputRef.current?.focus();
  }, [canalActivo, cargarMensajes]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Polling cada 5s para nuevos mensajes (sin socket.io en dev)
  useEffect(() => {
    const interval = setInterval(() => {
      cargarMensajes(canalActivo);
    }, 5000);
    return () => clearInterval(interval);
  }, [canalActivo, cargarMensajes]);

  // Apagar "IA escribiendo" cuando llega un mensaje del bot
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo?.userId === "bot-soporte" || ultimo?.user_id === "bot-soporte") {
      setIaEscribiendo(false);
    }
  }, [mensajes]);

  const [iaEscribiendo, setIaEscribiendo] = useState(false);

  const enviar = async () => {
    if (!texto.trim() || enviando || !authToken) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto("");
    try {
      const res = await api.post(
        `/api/chat/mensajes/${canalActivo}`,
        { texto: textoEnviar },
        { headers: authHeaders }
      );
      setMensajes(prev => [...prev, res.data.mensaje]);
      // Mostrar "Asistente escribiendo..." si estamos en soporte
      if (canalActivo === "soporte") {
        setIaEscribiendo(true);
        // El polling a los 5s traerá la respuesta; lo apagamos al recibirla
        setTimeout(() => setIaEscribiendo(false), 15000);
      }
    } catch (e) { setTexto(textoEnviar); }
    finally { setEnviando(false); inputRef.current?.focus(); }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const cambiarCanal = (id) => {
    setCanalActivo(id);
    setNoLeidos(prev => ({ ...prev, [id]: 0 }));
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar de canales */}
      <div className="w-56 flex-shrink-0 bg-slate-900 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-white font-bold text-sm truncate">{user.empresaNombre || "Mi empresa"}</p>
          <p className="text-slate-400 text-xs mt-0.5">Chat interno</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-4 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Canales</p>
          {CANALES.map(c => (
            <button key={c.id} onClick={() => cambiarCanal(c.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                canalActivo === c.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}>
              <span>{c.emoji}</span>
              <span className="flex-1 text-left">{c.nombre}</span>
              {noLeidos[c.id] > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {noLeidos[c.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Botón invitar */}
        <div className="p-3 border-t border-slate-700">
          <button onClick={() => setShowInvite(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors">
            <Users size={14}/> Invitar colaborador
          </button>
        </div>

        {/* Usuario actual */}
        <div className="px-4 py-3 border-t border-slate-700 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
            {(user.nombre || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user.nombre || "Usuario"}</p>
            <p className="text-slate-500 text-[10px]">{user.rol || "admin"}</p>
          </div>
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Hash size={16} className="text-slate-400"/>
          <h2 className="font-semibold text-slate-900">
            {CANALES.find(c => c.id === canalActivo)?.nombre}
          </h2>
        </div>

        {/* Banner soporte IA */}
        {canalActivo === "soporte" && (
          <div className="mx-6 mt-3 mb-1 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <p className="text-xs font-semibold text-amber-800">Asistente Monki — IA 24/7</p>
              <p className="text-xs text-amber-600">Escribí tu duda o problema y te respondo al instante.</p>
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-3">
                {CANALES.find(c => c.id === canalActivo)?.emoji}
              </div>
              <p className="text-slate-400 text-sm">No hay mensajes en #{canalActivo} todavía.</p>
              <p className="text-slate-300 text-xs mt-1">Sé el primero en escribir algo.</p>
            </div>
          ) : (
            mensajes.map(msg => (
              <Burbuja
                key={msg.id}
                msg={msg}
                esPropio={msg.userId === user.id || msg.user_id === user.id}
              />
            ))
          )}
          {/* Indicador "IA escribiendo" */}
          {iaEscribiendo && canalActivo === "soporte" && (
            <div className="flex items-center gap-2 mb-3 ml-1">
              <span className="text-base">🤖</span>
              <div className="flex items-center gap-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Mensaje en #${canalActivo}…`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none max-h-32"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={14}/>
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-1 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} authToken={authToken}/>}
    </div>
  );
}
