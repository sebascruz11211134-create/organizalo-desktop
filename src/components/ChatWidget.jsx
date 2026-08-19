/**
 * ChatWidget — Burbuja de chat flotante arrastrable.
 * • Drag con PointerEvents + setPointerCapture
 * • Tres pelotitas animadas cuando alguien escribe
 * • Palomitas ✓ / ✓✓ de leído
 * • Posición persiste en localStorage
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
      if (p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight) return p;
    }
  } catch {}
  return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
}

// ── Tres pelotitas animadas ───────────────────────────────────────────────────
function TypingDots({ writers }) {
  if (!writers?.length) return null;
  const label = writers.length === 1
    ? `${writers[0]} está escribiendo`
    : `${writers.join(", ")} están escribiendo`;
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: "inline-block",
            width: 6, height: 6,
            borderRadius: "50%",
            background: "#94a3b8",
            animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <span className="text-[10px] text-slate-400 italic">{label}</span>
    </div>
  );
}

// ── Palomitas de leído ────────────────────────────────────────────────────────
function Checkmarks({ leido }) {
  return (
    <span style={{ fontSize: 10, marginLeft: 2, lineHeight: 1 }}>
      {leido
        ? <span style={{ color: "#10b981" }}>✓✓</span>   /* leído — verde */
        : <span style={{ color: "rgba(255,255,255,0.6)" }}>✓</span>  /* enviado — gris */
      }
    </span>
  );
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
  const [writers,     setWriters]     = useState([]);   // quién está escribiendo
  const [lecturas,    setLecturas]    = useState([]);   // IDs de usuarios que leyeron

  const posRef      = useRef(pos);
  const dragStart   = useRef(null);
  const movedRef    = useRef(false);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const fallosRef   = useRef(0);
  const cortadoRef  = useRef(false);
  const typingTimer = useRef(null);  // debounce para enviar "estoy escribiendo"

  useEffect(() => { posRef.current = pos; }, [pos]);

  // ── CSS de animación para las pelotitas ───────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes chatBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30%            { transform: translateY(-5px); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── Auth desde localStorage — soporta JSON y plain string ────────────────
  useEffect(() => {
    function safeParse(raw) {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }  // fallback: valor crudo
    }
    const token = safeParse(localStorage.getItem("@finanzia/authToken"));
    const usr   = safeParse(localStorage.getItem("@finanzia/authUser"));
    if (token) setAuthToken(token);
    if (usr)   setUser(typeof usr === "object" ? usr : {});
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

  // ── Polling typing ────────────────────────────────────────────────────────
  const cargarTyping = useCallback(async (canal) => {
    if (!authToken || !abierto) return;
    try {
      const res = await api.get(`/api/chat/typing/${canal}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setWriters(res.data.writers || []);
    } catch {}
  }, [authToken, abierto]);

  // ── Polling lecturas ──────────────────────────────────────────────────────
  const cargarLecturas = useCallback(async (canal) => {
    if (!authToken) return;
    try {
      const res = await api.get(`/api/chat/mensajes/${canal}/lecturas`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setLecturas(res.data.lecturas || []);
    } catch {}
  }, [authToken]);

  useEffect(() => {
    cargarMensajes(canalActivo);
    cargarLecturas(canalActivo);
    const iv1 = setInterval(() => cargarMensajes(canalActivo), 5000);
    const iv2 = setInterval(() => cargarTyping(canalActivo), 2000);
    const iv3 = setInterval(() => cargarLecturas(canalActivo), 6000);
    return () => { clearInterval(iv1); clearInterval(iv2); clearInterval(iv3); };
  }, [canalActivo, cargarMensajes, cargarTyping, cargarLecturas]);

  // Al abrir panel → marcar como leído
  useEffect(() => {
    if (abierto && authToken) {
      setNoLeidos(0);
      fallosRef.current = 0;
      cortadoRef.current = false;
      api.post(`/api/chat/mensajes/${canalActivo}/leer`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
      cargarLecturas(canalActivo);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 80);
    }
  }, [abierto, authToken, canalActivo, cargarLecturas]);

  useEffect(() => {
    if (abierto) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    movedRef.current = false;
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: posRef.current.x, oy: posRef.current.y };
  };

  const onPointerMove = (e) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    const nx = Math.max(26, Math.min(window.innerWidth  - 26, dragStart.current.ox + dx));
    const ny = Math.max(26, Math.min(window.innerHeight - 26, dragStart.current.oy + dy));
    posRef.current = { x: nx, y: ny };
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setIsDragging(false);
    try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch {}
    if (!movedRef.current) setAbierto(a => !a);
  };

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!texto.trim() || enviando || !authToken) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto("");
    clearTimeout(typingTimer.current);
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

  // ── Notificar "estoy escribiendo" con debounce ────────────────────────────
  const onTextoChange = (e) => {
    setTexto(e.target.value);
    if (!authToken) return;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      api.post(`/api/chat/typing/${canalActivo}`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }, 300);
  };

  const cambiarCanal = (id) => {
    setCanalActivo(id);
    setShowCanales(false);
    setMensajes([]);
    setPrevLen(0);
    setWriters([]);
  };

  // ── Calcular si un mensaje está leído ────────────────────────────────────
  // Un mensaje propio está "leído" si algún OTRO usuario tiene una entrada en lecturas
  // con leido_en posterior a creadoEn del mensaje
  const otrosLeyeron = lecturas.filter(l => l.user_id !== user.id && l.user_id !== "bot-soporte");

  const location = useLocation();
  if (!authToken) return null;
  if (location.pathname === "/chat") return null;

  const abrirDerecha = pos.x < window.innerWidth / 2;

  return (
    <div style={{ position: "fixed", left: pos.x - 26, top: pos.y - 26, width: 52, height: 52, zIndex: 9999 }}>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {abierto && (
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", bottom: 60,
          ...(abrirDerecha ? { left: 0 } : { right: 0 }),
          width: 320, display: "flex", flexDirection: "column",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 8px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)",
          background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
          maxHeight: "70vh",
        }}>
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <button onClick={() => setShowCanales(s => !s)}
              className="flex items-center gap-1.5 text-white hover:text-slate-300 transition-colors">
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
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50" style={{ minHeight: 0, maxHeight: 340 }}>
            {mensajes.length === 0 ? (
              <div className="h-full flex items-center justify-center" style={{ minHeight: 100 }}>
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
                // Leído si algún otro leyó DESPUÉS de que se envió el mensaje
                const msgTime = new Date(msg.creadoEn || msg.creado_en).getTime();
                const leido = esPropio && otrosLeyeron.some(l => new Date(l.leido_en).getTime() > msgTime);

                return (
                  <div key={msg.id} className={`flex flex-col mb-2 ${esPropio ? "items-end" : "items-start"}`}>
                    {!esPropio && (
                      <span className="text-[9px] text-slate-500 mb-0.5 ml-1">{msg.userNombre || msg.user_nombre}</span>
                    )}
                    <div className={`max-w-[88%] px-2.5 py-1.5 rounded-2xl text-xs leading-snug ${
                      esPropio ? "bg-emerald-500 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.texto}
                      {esPropio && <Checkmarks leido={leido} />}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 mx-1">{hora}</span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Typing indicator */}
          <TypingDots writers={writers} />

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <textarea
                ref={inputRef}
                value={texto}
                onChange={onTextoChange}
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
          width: 52, height: 52, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          background: abierto ? "#334155" : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
          boxShadow: "0 4px 20px rgba(16,185,129,0.4), 0 2px 6px rgba(0,0,0,0.15)",
          color: "#fff", userSelect: "none", touchAction: "none",
          position: "relative", transition: isDragging ? "none" : "background 0.2s",
        }}
        title="Chat interno — arrastra para mover"
      >
        {abierto ? <X size={20} /> : <MessageSquare size={20} />}

        {/* Badge no leídos */}
        {!abierto && noLeidos > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            width: 18, height: 18, background: "#ef4444", color: "#fff",
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
