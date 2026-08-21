/**
 * ChatScreen — Chat interno tipo Discord.
 *
 * Canales fijos por área + DMs privados arrastrando miembros del equipo.
 * Auth: usa getToken()/getUser() de auth.js (PWA, no Electron).
 * DMs: canal = "dm:userId1:userId2" (sorted) — reutiliza todas las rutas existentes.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { getToken, getUser } from "../utils/auth";
import { BACKEND } from "../utils/config";

// ── Canales fijos ─────────────────────────────────────────────────────────────
const CANALES = [
  { id: "general",      nombre: "general",      emoji: "💬" },
  { id: "facturación",  nombre: "facturación",  emoji: "🧾" },
  { id: "contabilidad", nombre: "contabilidad", emoji: "📊" },
  { id: "inventario",   nombre: "inventario",   emoji: "📦" },
  { id: "soporte",      nombre: "soporte",      emoji: "🛟" },
];

// Canal de DM determinístico (mismo resultado sin importar el orden)
function dmCanalId(uid1, uid2) {
  return `dm:${[uid1, uid2].sort().join(":")}`;
}

// Iniciales de un nombre
function iniciales(nombre = "") {
  return nombre.trim().split(/\s+/).map(p => p[0]?.toUpperCase() || "").join("").slice(0, 2) || "?";
}

// Color de avatar por usuario (determinístico)
const COLORES = ["#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316"];
function colorAvatar(id = "") {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORES[n % COLORES.length];
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ nombre, userId, size = 8 }) {
  const bg = colorAvatar(userId);
  return (
    <div
      style={{ backgroundColor: bg, width: `${size * 4}px`, height: `${size * 4}px` }}
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      title={nombre}
    >
      <span style={{ fontSize: `${size * 1.6}px` }}>{iniciales(nombre)}</span>
    </div>
  );
}

// ── Separador de fecha ────────────────────────────────────────────────────────
function SepFecha({ fecha }) {
  const d = new Date(fecha);
  const hoy  = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  let label;
  if (d.toDateString() === hoy.toDateString())  label = "Hoy";
  else if (d.toDateString() === ayer.toDateString()) label = "Ayer";
  else label = d.toLocaleDateString("es-CR", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-slate-700"/>
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <div className="flex-1 h-px bg-slate-700"/>
    </div>
  );
}

// ── Burbuja de mensaje (agrupado tipo Discord) ────────────────────────────────
function GrupoMensajes({ msgs, meId }) {
  const primero = msgs[0];
  const esPropio = primero.user_id === meId || primero.userId === meId;
  const esBot = primero.user_id === "bot-soporte" || primero.userId === "bot-soporte";
  const nombre = primero.user_nombre || primero.userNombre || "Usuario";
  const hora = (m) => new Date(m.creado_en || m.creadoEn).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });

  const avatarColor = esBot ? "#f59e0b" : colorAvatar(primero.user_id || primero.userId);

  return (
    <div className="flex gap-3 px-4 py-1 hover:bg-slate-800/30 group">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {esBot ? (
          <div className="w-9 h-9 rounded-full bg-yellow-600 flex items-center justify-center text-white text-lg">🤖</div>
        ) : (
          <Avatar nombre={nombre} userId={primero.user_id || primero.userId} size={9} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-semibold ${esBot ? "text-yellow-400" : esPropio ? "text-white" : "text-slate-200"}`}>
            {esBot ? "Asistente Monki" : nombre}
          </span>
          {esBot && <span className="text-[10px] bg-yellow-600 text-white px-1.5 py-0.5 rounded font-bold">IA</span>}
          <span className="text-[11px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{hora(primero)}</span>
        </div>
        {msgs.map((m, i) => (
          <p key={m.id} className={`text-sm leading-relaxed ${esBot ? "text-slate-200 whitespace-pre-wrap" : "text-slate-300"} ${i > 0 ? "mt-0.5" : ""}`}>
            {m.texto}
          </p>
        ))}
      </div>
    </div>
  );
}

// Agrupa mensajes consecutivos del mismo usuario (≤5 min de diferencia)
function agrupar(mensajes) {
  const grupos = [];
  for (const m of mensajes) {
    const uid = m.user_id || m.userId;
    const t   = new Date(m.creado_en || m.creadoEn).getTime();
    const ultimo = grupos[grupos.length - 1];
    const mismoUser = ultimo && (ultimo[0].user_id || ultimo[0].userId) === uid;
    const cercano   = ultimo && t - new Date(ultimo[ultimo.length-1].creado_en || ultimo[ultimo.length-1].creadoEn).getTime() < 5 * 60000;
    if (mismoUser && cercano) {
      ultimo.push(m);
    } else {
      grupos.push([m]);
    }
  }
  return grupos;
}

// ── Indicador "escribiendo" ───────────────────────────────────────────────────
function Escribiendo({ nombres }) {
  if (!nombres?.length) return null;
  const texto = nombres.length === 1
    ? `${nombres[0]} está escribiendo…`
    : `${nombres.join(", ")} están escribiendo…`;
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-0.5">
        {[0,150,300].map(d => (
          <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
        ))}
      </div>
      <span className="text-xs text-slate-400 italic">{texto}</span>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ChatScreen() {
  const [token,          setToken]          = useState(null);
  const [me,             setMe]             = useState(null);          // usuario actual
  const [canalActivo,    setCanalActivo]    = useState("general");     // id de canal o "dm:x:y"
  const [mensajes,       setMensajes]       = useState([]);
  const [texto,          setTexto]          = useState("");
  const [enviando,       setEnviando]       = useState(false);
  const [equipo,         setEquipo]         = useState([]);            // miembros del equipo
  const [dmsAbiertos,    setDmsAbiertos]    = useState([]);            // [{id,nombre}] DMs activos
  const [noLeidos,       setNoLeidos]       = useState({});            // canal → int
  const [escribiendo,    setEscribiendo]    = useState([]);            // nombres escribiendo
  const [iaEscribiendo,  setIaEscribiendo]  = useState(false);
  const [canalesCerrado, setCanalesCerrado] = useState(false);
  const [dmsCerrado,     setDmsCerrado]     = useState(false);
  const [dragOver,       setDragOver]       = useState(false);         // DM drop zone
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const typingTimer = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const t = await getToken();
      const u = await getUser();
      setToken(t);
      setMe(u);
    })();
  }, []);

  // ── Equipo ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/auth/team`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setEquipo(d.members || []))
      .catch(() => {});
  }, [token]);

  // ── Cargar mensajes ───────────────────────────────────────────────────────
  const cargar = useCallback(async (canal) => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(canal)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMensajes(data.mensajes || []);
    } catch {}
  }, [token]);

  useEffect(() => { cargar(canalActivo); }, [canalActivo, cargar]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Polling cada 4s
  useEffect(() => {
    const id = setInterval(() => cargar(canalActivo), 4000);
    return () => clearInterval(id);
  }, [canalActivo, cargar]);

  // Apagar "IA escribiendo" al recibir respuesta
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo?.userId === "bot-soporte" || ultimo?.user_id === "bot-soporte") {
      setIaEscribiendo(false);
    }
  }, [mensajes]);

  // ── Polling de "escribiendo" ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/chat/typing/${encodeURIComponent(canalActivo)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setEscribiendo(d.writers || []);
      } catch {}
    }, 2500);
    return () => clearInterval(id);
  }, [canalActivo, token]);

  // ── Notificar "estoy escribiendo" ─────────────────────────────────────────
  const notificarEscribiendo = useCallback(() => {
    if (!token || !texto.trim()) return;
    clearTimeout(typingTimer.current);
    fetch(`${BACKEND}/api/chat/typing/${encodeURIComponent(canalActivo)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    typingTimer.current = setTimeout(() => setEscribiendo([]), 5000);
  }, [token, canalActivo, texto]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!texto.trim() || enviando || !token) return;
    setEnviando(true);
    const t = texto.trim();
    setTexto("");
    try {
      const res = await fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(canalActivo)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t }),
      });
      const data = await res.json();
      if (data.mensaje) setMensajes(prev => [...prev, data.mensaje]);
      if (canalActivo === "soporte") {
        setIaEscribiendo(true);
        setTimeout(() => setIaEscribiendo(false), 20000);
      }
    } catch { setTexto(t); }
    finally { setEnviando(false); inputRef.current?.focus(); }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
    else notificarEscribiendo();
  };

  // ── Cambiar canal ─────────────────────────────────────────────────────────
  const cambiarCanal = (id) => {
    setCanalActivo(id);
    setMensajes([]);
    setNoLeidos(prev => ({ ...prev, [id]: 0 }));
    setEscribiendo([]);
    setIaEscribiendo(false);
    // Marcar como leído
    if (token) {
      fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(id)}/leer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  // ── Drag & Drop: abrir DM ─────────────────────────────────────────────────
  const onDragStart = (e, miembro) => {
    e.dataTransfer.setData("userId", miembro.id);
    e.dataTransfer.setData("userName", miembro.nombre);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const uid  = e.dataTransfer.getData("userId");
    const nombre = e.dataTransfer.getData("userName");
    if (!uid || !nombre || uid === me?.id) return;
    // Agregar a DMs si no existe
    setDmsAbiertos(prev => {
      if (prev.find(d => d.id === uid)) return prev;
      return [...prev, { id: uid, nombre }];
    });
    // Abrir esa conversación
    cambiarCanal(dmCanalId(me.id, uid));
  };

  // Abrir DM al hacer click en un miembro (alternativa al drag)
  const abrirDM = (miembro) => {
    if (!me?.id || miembro.id === me.id) return;
    setDmsAbiertos(prev => {
      if (prev.find(d => d.id === miembro.id)) return prev;
      return [...prev, { id: miembro.id, nombre: miembro.nombre }];
    });
    cambiarCanal(dmCanalId(me.id, miembro.id));
  };

  // ── Título del canal activo ───────────────────────────────────────────────
  const canalInfo = (() => {
    if (canalActivo.startsWith("dm:")) {
      const otherId = canalActivo.replace("dm:", "").replace(me?.id || "", "").replace(":", "");
      const dm = dmsAbiertos.find(d => d.id === otherId);
      return { nombre: dm?.nombre || "DM", isDM: true };
    }
    const c = CANALES.find(c => c.id === canalActivo);
    return { nombre: c?.nombre || canalActivo, emoji: c?.emoji, isDM: false };
  })();

  const grupos = agrupar(mensajes);
  const meId   = me?.id;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-slate-800 flex flex-col select-none">

        {/* Nombre de empresa */}
        <div className="px-4 py-4 border-b border-slate-700/60 shadow-sm">
          <p className="font-bold text-white text-sm truncate">{me?.empresaNombre || me?.empresa_nombre || "Mi empresa"}</p>
          <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
            {equipo.length + 1} miembro{equipo.length !== 0 ? "s" : ""}
          </p>
        </div>

        {/* Canales */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Sección CANALES */}
          <button
            onClick={() => setCanalesCerrado(p => !p)}
            className="w-full flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1">
            {canalesCerrado ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
            Canales
          </button>
          {!canalesCerrado && CANALES.map(c => {
            const activo = canalActivo === c.id;
            const n = noLeidos[c.id] || 0;
            return (
              <button key={c.id} onClick={() => cambiarCanal(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${
                  activo ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}>
                <Hash size={13} className="flex-shrink-0"/>
                <span className="flex-1 text-left truncate">{c.nombre}</span>
                {n > 0 && !activo && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{n}</span>
                )}
                {c.id === "soporte" && <span className="text-[10px] bg-yellow-600 rounded px-1 text-yellow-100">IA</span>}
              </button>
            );
          })}

          {/* Sección MENSAJES DIRECTOS */}
          <div className="mt-3">
            <button
              onClick={() => setDmsCerrado(p => !p)}
              className="w-full flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1">
              {dmsCerrado ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
              Mensajes directos
            </button>

            {!dmsCerrado && (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`mx-2 mb-2 rounded-lg border-2 border-dashed text-xs text-center py-2 transition-colors ${
                    dragOver ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-slate-600 text-slate-500"
                  }`}>
                  {dragOver ? "Soltar para abrir DM" : "Arrastrá un miembro aquí"}
                </div>

                {/* DMs abiertos */}
                {dmsAbiertos.map(dm => {
                  const canalDM = dmCanalId(me?.id || "", dm.id);
                  const activo  = canalActivo === canalDM;
                  const n = noLeidos[canalDM] || 0;
                  return (
                    <button key={dm.id} onClick={() => cambiarCanal(canalDM)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${
                        activo ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      }`}>
                      <Avatar nombre={dm.nombre} userId={dm.id} size={5}/>
                      <span className="flex-1 text-left truncate">{dm.nombre}</span>
                      <Lock size={10} className="text-slate-500 flex-shrink-0"/>
                      {n > 0 && !activo && (
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{n}</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Sección EQUIPO (draggable) */}
          {equipo.length > 0 && (
            <div className="mt-3">
              <p className="px-2 py-1 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                Equipo
                <span className="text-[10px] text-slate-600 normal-case font-normal">· arrastrá para DM</span>
              </p>
              {equipo.filter(m => m.id !== meId).map(m => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, m)}
                  onClick={() => abrirDM(m)}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 cursor-grab active:cursor-grabbing transition-colors text-sm"
                  title="Arrastrá para abrir DM · Click para abrir directo">
                  <Avatar nombre={m.nombre} userId={m.id} size={5}/>
                  <span className="flex-1 truncate">{m.nombre}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.activo ? "bg-green-400" : "bg-slate-600"}`}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usuario actual */}
        <div className="px-3 py-3 border-t border-slate-700/60 flex items-center gap-2 bg-slate-900/40">
          {me ? (
            <>
              <Avatar nombre={me.nombre || me.email || "Yo"} userId={me.id || ""} size={8}/>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{me.nombre || me.email}</p>
                <p className="text-slate-500 text-[10px]">{me.rol}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="En línea"/>
            </>
          ) : (
            <p className="text-slate-500 text-xs">Cargando…</p>
          )}
        </div>
      </div>

      {/* ── Área de chat ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center gap-2.5 shadow-sm">
          {canalInfo.isDM ? (
            <>
              <MessageSquare size={16} className="text-slate-400"/>
              <span className="font-semibold text-white">{canalInfo.nombre}</span>
              <Lock size={12} className="text-slate-500 ml-0.5"/>
              <span className="text-xs text-slate-500 ml-1">Conversación privada</span>
            </>
          ) : (
            <>
              <Hash size={16} className="text-slate-400"/>
              <span className="font-semibold text-white">{canalInfo.nombre}</span>
              {canalInfo.nombre === "soporte" && (
                <span className="ml-2 text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full font-medium">IA 24/7</span>
              )}
            </>
          )}
        </div>

        {/* Banner soporte */}
        {canalActivo === "soporte" && (
          <div className="mx-4 mt-3 px-4 py-2.5 bg-yellow-900/30 border border-yellow-600/30 rounded-xl flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Asistente Monki — IA de soporte técnico</p>
              <p className="text-xs text-yellow-500">Escribí tu duda. Te respondo en segundos, disponible 24/7.</p>
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto py-4">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="text-5xl mb-4">{canalInfo.isDM ? "💬" : (CANALES.find(c => c.id === canalActivo)?.emoji || "#")}</div>
              <p className="text-white font-bold text-lg mb-1">
                {canalInfo.isDM ? `Conversación con ${canalInfo.nombre}` : `Bienvenido a #${canalInfo.nombre}`}
              </p>
              <p className="text-slate-400 text-sm">
                {canalInfo.isDM
                  ? "Este es el inicio de tu conversación privada."
                  : "Este es el inicio del canal. Sé el primero en escribir algo."}
              </p>
            </div>
          ) : (
            <>
              {(() => {
                const items = [];
                let lastDate = null;
                for (const grupo of grupos) {
                  const d = new Date(grupo[0].creado_en || grupo[0].creadoEn);
                  const dateStr = d.toDateString();
                  if (dateStr !== lastDate) {
                    items.push(<SepFecha key={`sep-${dateStr}`} fecha={d}/>);
                    lastDate = dateStr;
                  }
                  items.push(
                    <GrupoMensajes key={grupo[0].id} msgs={grupo} meId={meId}/>
                  );
                }
                return items;
              })()}
            </>
          )}

          {/* Indicadores de escritura */}
          {iaEscribiendo && canalActivo === "soporte" && (
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-9 h-9 rounded-full bg-yellow-600 flex items-center justify-center text-lg">🤖</div>
              <div className="px-3 py-2 bg-slate-800 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                {[0,150,300].map(d => (
                  <span key={d} className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
                ))}
              </div>
            </div>
          )}
          <Escribiendo nombres={escribiendo.filter(n => n !== (me?.nombre || ""))} />
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-2 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 focus-within:border-slate-500 transition-colors">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={canalInfo.isDM ? `Mensaje a ${canalInfo.nombre}…` : `Mensaje en #${canalInfo.nombre}…`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-40"
              style={{ lineHeight: "1.6" }}
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <Send size={14}/>
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
