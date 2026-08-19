/**
 * ChatWidget — Burbuja de chat flotante arrastrable.
 * Usa Pointer Events + setPointerCapture para drag confiable.
 * Click sin mover = abrir/cerrar panel.
 * Posición persiste en localStorage.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, ChevronDown, Hash } from "lucide-react";
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

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // Validar que esté dentro de pantalla
      if (p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight) return p;
    }
  } catch {}
  return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
}

export default function ChatWidget() {
  const [abierto,     setAbierto]     = useState(false);
  const [canalActivo, setCanalActivo] = useState("general");
  const [mensajes,    setMensajes]    = useState([]);
  const [texto,       setTexto]       = useState("");
  const [enviando,    setEnviando]    = useState(false);
  const [authToken,   setAuthToken]   = useState("");
  const [user,        setUser]        = useState({});
  const [noLeidos,    setNoLeidos]    = useState(0);
  const [showCanales, setShowCanales] = useState(false);
  const [prevLen,     setPrevLen]     = useState(0);
  const [pos,         setPos]         = useState(loadPos);
  const [isDragging,  setIsDragging]  = useState(false);

  const posRef     = useRef(pos);          // siempre actualizado sin stale closure
  const dragStart  = useRef(null);         // { mx, my, ox, oy }
  const movedRef   = useRef(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const fallosRef  = useRef(0);
  const cortadoRef = useRef(false);

  // Mantener posRef sincronizado
  useEffect(() => { posRef.current = pos; }, [pos]);

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

  // ── Drag con Pointer Events + setPointerCapture ───────────────────────────
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);   // ← toda la magia aquí
    movedRef.current = false;
    setIsDragging(true);
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
    };
  };

  const onPointerMove = (e) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    const BUBBLE = 26;
    const nx = Math.max(BUBBLE, Math.min(window.innerWidth  - BUBBLE, dragStart.current.ox + dx));
    const ny = Math.max(BUBBLE, Math.min(window.innerHeight - BUBBLE, dragStart.current.oy + dy));
    posRef.current = { x: nx, y: ny };
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setIsDragging(false);
    try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch {}
    if (!movedRef.current) setAbierto(a => !a);   // click sin drag → toggle
  };

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

  // El panel se abre hacia arriba y hacia el lado que tenga más espacio
  const abrirDerecha = pos.x < window.innerWidth / 2;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x - 26,
        top:  pos.y - 26,
        width: 52,
        height: 52,
        zIndex: 9999,
      }}
    >
      {/* ── Panel de mensajes ────────────────────────────────────────────── */}
      {abierto && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 60,
            ...(abrirDerecha ? { left: 0 } : { right: 0 }),
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

          {/* Selector canales */}
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
                className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                <Send size={10} />
              </button>
            </div>
            <p className="text-[9px] text-slate-300 mt-1 text-center">Enter para enviar</p>
          </div>
        </div>
      )}

      {/* ── Burbuja ───────────────────────────────────────────────────────── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          background: abierto
            ? "#334155"
            : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
          boxShadow: "0 4px 20px rgba(16,185,129,0.4), 0 2px 6px rgba(0,0,0,0.15)",
          color: "#fff",
          userSelect: "none",
          touchAction: "none",            // necesario para touch drag
          position: "relative",
          transition: isDragging ? "none" : "background 0.2s",
        }}
        title="Chat interno — arrastra para mover"
      >
        {abierto ? <X size={20} /> : <MessageSquare size={20} />}

        {/* Badge no leídos */}
        {!abierto && noLeidos > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            width: 18, height: 18,
            background: "#ef4444", color: "#fff",
            borderRadius: "50%", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}>
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        )}
      </div>
    </div>
  );
}
