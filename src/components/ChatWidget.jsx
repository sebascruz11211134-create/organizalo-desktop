/**
 * ChatWidget — Burbuja de chat flotante arrastrable.
 * - Drag para reposicionarla donde no estorbe.
 * - Posición persiste en localStorage.
 * - Click (sin arrastrar) abre/cierra el panel.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, ChevronDown, Hash, GripVertical } from "lucide-react";
import { useLocation } from "react-router-dom";
import api from "../utils/api";

const CANALES = [
  { id: "general",      emoji: "💬", nombre: "General" },
  { id: "facturación",  emoji: "🧾", nombre: "Facturación" },
  { id: "contabilidad", emoji: "📊", nombre: "Contabilidad" },
  { id: "inventario",   emoji: "📦", nombre: "Inventario" },
  { id: "soporte",      emoji: "🛟", nombre: "Soporte" },
];

const POS_KEY = "@finanzia/chatWidgetPos";
const DEFAULT_POS = { x: window.innerWidth - 80, y: window.innerHeight - 80 };

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_POS;
}

export default function ChatWidget() {
  const [abierto,      setAbierto]      = useState(false);
  const [canalActivo,  setCanalActivo]  = useState("general");
  const [mensajes,     setMensajes]     = useState([]);
  const [texto,        setTexto]        = useState("");
  const [enviando,     setEnviando]     = useState(false);
  const [authToken,    setAuthToken]    = useState("");
  const [user,         setUser]         = useState({});
  const [noLeidos,     setNoLeidos]     = useState(0);
  const [showCanales,  setShowCanales]  = useState(false);
  const [prevLen,      setPrevLen]      = useState(0);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [pos,       setPos]       = useState(loadPos);
  const dragging    = useRef(false);
  const dragStart   = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const moved       = useRef(false);   // detectar si fue drag real vs click

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fallosRef = useRef(0);
  const cortadoRef = useRef(false);

  // ── Auth desde localStorage ───────────────────────────────────────────────
  useEffect(() => {
    try {
      const rawToken = localStorage.getItem("@finanzia/authToken");
      const rawUser  = localStorage.getItem("@finanzia/authUser");
      if (rawToken) setAuthToken(JSON.parse(rawToken));
      if (rawUser)  setUser(JSON.parse(rawUser));
    } catch {}
  }, []);

  // ── Polling mensajes ──────────────────────────────────────────────────────
  const cargarMensajes = useCallback(async (canal) => {
    if (!authToken || cortadoRef.current) return;
    try {
      const res = await api.get(`/api/chat/mensajes/${canal}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      fallosRef.current = 0;
      const nuevos = res.data.mensajes || [];
      setMensajes(nuevos);
      setPrevLen(prev => {
        const diff = nuevos.length - prev;
        if (!abierto && diff > 0) setNoLeidos(n => n + diff);
        return nuevos.length;
      });
    } catch {
      fallosRef.current += 1;
      if (fallosRef.current >= 3) cortadoRef.current = true;
    }
  }, [authToken, abierto]);

  useEffect(() => {
    cargarMensajes(canalActivo);
    const iv = setInterval(() => cargarMensajes(canalActivo), 5000);
    return () => clearInterval(iv);
  }, [canalActivo, cargarMensajes]);

  useEffect(() => {
    if (abierto) {
      setNoLeidos(0);
      fallosRef.current = 0;
      cortadoRef.current = false;
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 80);
    }
  }, [abierto]);

  useEffect(() => {
    if (abierto) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    // Solo botón izquierdo, no en el panel
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    moved.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      const BUBBLE = 52;
      const nx = Math.max(BUBBLE / 2, Math.min(window.innerWidth  - BUBBLE / 2, dragStart.current.ox + dx));
      const ny = Math.max(BUBBLE / 2, Math.min(window.innerHeight - BUBBLE / 2, dragStart.current.oy + dy));
      setPos({ x: nx, y: ny });
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // Guardar posición final
      setPos(p => {
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
      // Si no se movió → toggle panel
      if (!moved.current) setAbierto(a => !a);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!texto.trim() || enviando || !authToken) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto("");
    try {
      const res = await api.post(
        `/api/chat/mensajes/${canalActivo}`,
        { texto: textoEnviar },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.mensaje) setMensajes(prev => [...prev, res.data.mensaje]);
    } catch { setTexto(textoEnviar); }
    finally { setEnviando(false); inputRef.current?.focus(); }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const cambiarCanal = (id) => {
    setCanalActivo(id);
    setShowCanales(false);
    setMensajes([]);
    setPrevLen(0);
  };

  const location = useLocation();
  if (!authToken) return null;
  if (location.pathname === "/chat") return null;

  // El panel se abre hacia arriba/izquierda según la posición de la burbuja
  const panelRight = pos.x < window.innerWidth / 2 ? "auto" : 0;
  const panelLeft  = pos.x < window.innerWidth / 2 ? 0 : "auto";

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x - 26,
        top: pos.y - 26,
        zIndex: 9999,
        userSelect: "none",
      }}
    >
      {/* ── Panel de chat ────────────────────────────────────────────────── */}
      {abierto && (
        <div
          className="absolute"
          style={{
            bottom: 60,
            right: panelRight,
            left: panelLeft,
            width: 320,
            height: 420,
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setShowCanales(s => !s)}
              className="flex items-center gap-1.5 text-white hover:text-slate-300 transition-colors"
            >
              <Hash size={12} className="text-slate-400" />
              <span className="text-sm font-semibold">
                {CANALES.find(c => c.id === canalActivo)?.nombre || "General"}
              </span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCanales ? "rotate-180" : ""}`} />
            </button>
            <button onClick={() => setAbierto(false)} className="text-slate-400 hover:text-white transition-colors p-0.5">
              <X size={14} />
            </button>
          </div>

          {/* Canales */}
          {showCanales && (
            <div className="bg-slate-800 flex-shrink-0 border-b border-slate-700">
              {CANALES.map(c => (
                <button key={c.id} onClick={() => cambiarCanal(c.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
                    canalActivo === c.id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}>
                  <span>{c.emoji}</span><span>{c.nombre}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50" style={{ minHeight: 0 }}>
            {mensajes.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-xs text-center leading-relaxed">
                  Sin mensajes en #{canalActivo}.<br />Sé el primero en escribir.
                </p>
              </div>
            ) : (
              mensajes.map(msg => {
                const esPropio = msg.userId === user.id || msg.user_id === user.id;
                const hora = (() => {
                  try { return new Date(msg.creadoEn || msg.creado_en).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }); }
                  catch { return ""; }
                })();
                return (
                  <div key={msg.id} className={`flex flex-col mb-2 ${esPropio ? "items-end" : "items-start"}`}>
                    {!esPropio && (
                      <span className="text-[9px] text-slate-500 mb-0.5 ml-1">{msg.userNombre || msg.user_nombre}</span>
                    )}
                    <div className={`max-w-[88%] px-2.5 py-1.5 rounded-2xl text-xs leading-snug ${
                      esPropio ? "bg-emerald-500 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.texto}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 mx-1">{hora}</span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <textarea
                ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Mensaje en #${canalActivo}…`}
                rows={1}
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 resize-none focus:outline-none"
                style={{ lineHeight: "1.5", maxHeight: 56 }}
              />
              <button onClick={enviar} disabled={!texto.trim() || enviando}
                className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Send size={10} />
              </button>
            </div>
            <p className="text-[9px] text-slate-300 mt-1 text-center">Enter para enviar</p>
          </div>
        </div>
      )}

      {/* ── Burbuja arrastrable ───────────────────────────────────────────── */}
      <button
        onMouseDown={onMouseDown}
        className="relative flex items-center justify-center rounded-full text-white select-none"
        style={{
          width: 52,
          height: 52,
          cursor: dragging.current ? "grabbing" : "grab",
          background: abierto
            ? "#334155"
            : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
          boxShadow: "0 4px 20px rgba(16,185,129,0.4), 0 2px 6px rgba(0,0,0,0.15)",
          transition: "background 0.2s",
        }}
        title="Chat interno — arrastra para mover"
      >
        {abierto ? <X size={20} /> : <MessageSquare size={20} />}

        {/* Badge no leídos */}
        {!abierto && noLeidos > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        )}
      </button>
    </div>
  );
}
