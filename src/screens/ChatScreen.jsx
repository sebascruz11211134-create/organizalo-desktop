/**
 * ChatScreen — Chat interno tipo Discord (tema claro, igual al resto de la app).
 * Canales por área + DMs privados arrastrando miembros del equipo.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Bot } from "lucide-react";
import { getToken, getUser } from "../utils/auth";
import { BACKEND } from "../utils/config";

const CANALES = [
  { id: "general",      nombre: "general",      emoji: "💬" },
  { id: "facturación",  nombre: "facturación",  emoji: "🧾" },
  { id: "contabilidad", nombre: "contabilidad", emoji: "📊" },
  { id: "inventario",   nombre: "inventario",   emoji: "📦" },
  { id: "soporte",      nombre: "soporte",      emoji: "🛟", ia: true },
];

function dmCanalId(uid1, uid2) {
  return `dm:${[uid1, uid2].sort().join(":")}`;
}

function iniciales(nombre = "") {
  return nombre.trim().split(/\s+/).map(p => p[0]?.toUpperCase() || "").join("").slice(0, 2) || "?";
}

const COLORES = ["#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316"];
function colorAvatar(id = "") {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORES[n % COLORES.length];
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ nombre, userId, size = 8 }) {
  return (
    <div
      style={{ backgroundColor: colorAvatar(userId), width: size * 4, height: size * 4, minWidth: size * 4 }}
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      title={nombre}>
      <span style={{ fontSize: size * 1.5 }}>{iniciales(nombre)}</span>
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
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-gray-200"/>
      <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-200"/>
    </div>
  );
}

// ── Grupo de mensajes (estilo Discord) ────────────────────────────────────────
function GrupoMensajes({ msgs, meId }) {
  const primero  = msgs[0];
  const esPropio = (primero.user_id || primero.userId) === meId;
  const esBot    = (primero.user_id || primero.userId) === "bot-soporte";
  const nombre   = primero.user_nombre || primero.userNombre || "Usuario";
  const uid      = primero.user_id    || primero.userId;
  const hora     = (m) => new Date(m.creado_en || m.creadoEn).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex gap-3 px-4 py-1.5 hover:bg-gray-50 group rounded-lg mx-2">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {esBot
          ? <div className="w-9 h-9 rounded-full bg-yellow-500 flex items-center justify-center text-white text-base">🤖</div>
          : <Avatar nombre={nombre} userId={uid} size={9}/>}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-semibold ${esBot ? "text-yellow-700" : esPropio ? "text-slate-900" : "text-slate-800"}`}>
            {esBot ? "Asistente Monki" : nombre}
          </span>
          {esBot && (
            <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold border border-yellow-200">IA</span>
          )}
          <span className="text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
            {hora(primero)}
          </span>
        </div>
        {msgs.map((m, i) => (
          <p key={m.id} className={`text-sm leading-relaxed whitespace-pre-wrap ${
            esBot ? "text-slate-700" : "text-slate-700"
          } ${i > 0 ? "mt-0.5" : ""}`}>
            {m.texto}
          </p>
        ))}
      </div>
    </div>
  );
}

function agrupar(mensajes) {
  const grupos = [];
  for (const m of mensajes) {
    const uid = m.user_id || m.userId;
    const t   = new Date(m.creado_en || m.creadoEn).getTime();
    const ultimo = grupos[grupos.length - 1];
    const mismo  = ultimo && (ultimo[0].user_id || ultimo[0].userId) === uid;
    const cerca  = ultimo && t - new Date(ultimo[ultimo.length-1].creado_en || ultimo[ultimo.length-1].creadoEn).getTime() < 5 * 60000;
    if (mismo && cerca) ultimo.push(m);
    else grupos.push([m]);
  }
  return grupos;
}

// ── Indicador de escritura ────────────────────────────────────────────────────
function Escribiendo({ nombres }) {
  if (!nombres?.length) return null;
  const txt = nombres.length === 1 ? `${nombres[0]} está escribiendo…` : `${nombres.join(", ")} están escribiendo…`;
  return (
    <div className="flex items-center gap-2 px-6 py-1">
      <div className="flex gap-0.5">
        {[0,150,300].map(d => (
          <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
        ))}
      </div>
      <span className="text-xs text-slate-400 italic">{txt}</span>
    </div>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const [token,         setToken]         = useState(null);
  const [me,            setMe]            = useState(null);
  const [canalActivo,   setCanalActivo]   = useState("general");
  const [mensajes,      setMensajes]      = useState([]);
  const [texto,         setTexto]         = useState("");
  const [enviando,      setEnviando]      = useState(false);
  const [equipo,        setEquipo]        = useState([]);
  const [dmsAbiertos,   setDmsAbiertos]   = useState([]);
  const [noLeidos,      setNoLeidos]      = useState({});
  const [escribiendo,   setEscribiendo]   = useState([]);
  const [iaEsc,         setIaEsc]         = useState(false);
  const [dmsCerrado,    setDmsCerrado]    = useState(false);
  const [dragOver,      setDragOver]      = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const typingRef  = useRef(null);

  // Auth
  useEffect(() => {
    (async () => {
      const t = await getToken();
      const u = await getUser();
      setToken(t);
      setMe(u);
    })();
  }, []);

  // Equipo — intentar /api/auth/team; si vacío (superadmin sin empresaId) intentar /api/admin/clientes-usuarios
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/auth/team`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.members?.length) {
          setEquipo(d.members);
        }
        // Si está vacío (superadmin), intentar endpoint alternativo
        else {
          return fetch(`${BACKEND}/api/admin/usuarios`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { usuarios: [] })
            .then(d2 => setEquipo(d2.usuarios || []))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [token]);

  // Mensajes
  const cargar = useCallback(async (canal) => {
    if (!token) return;
    try {
      const res  = await fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(canal)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMensajes(data.mensajes || []);
    } catch {}
  }, [token]);

  useEffect(() => { cargar(canalActivo); }, [canalActivo, cargar]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  // Polling mensajes cada 4s
  useEffect(() => {
    const id = setInterval(() => cargar(canalActivo), 4000);
    return () => clearInterval(id);
  }, [canalActivo, cargar]);

  // IA respuesta
  useEffect(() => {
    const u = mensajes[mensajes.length - 1];
    if (u?.userId === "bot-soporte" || u?.user_id === "bot-soporte") setIaEsc(false);
  }, [mensajes]);

  // Polling "escribiendo" cada 2.5s
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/chat/typing/${encodeURIComponent(canalActivo)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        setEscribiendo(d.writers || []);
      } catch {}
    }, 2500);
    return () => clearInterval(id);
  }, [canalActivo, token]);

  // Notificar "escribiendo"
  const notificarEscribiendo = useCallback(() => {
    if (!token || !texto.trim()) return;
    clearTimeout(typingRef.current);
    fetch(`${BACKEND}/api/chat/typing/${encodeURIComponent(canalActivo)}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    typingRef.current = setTimeout(() => setEscribiendo([]), 5000);
  }, [token, canalActivo, texto]);

  // Enviar
  const enviar = async () => {
    if (!texto.trim() || enviando || !token) return;
    setEnviando(true);
    const t = texto.trim();
    setTexto("");
    try {
      const res  = await fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(canalActivo)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t }),
      });
      const data = await res.json();
      if (data.mensaje) setMensajes(p => [...p, data.mensaje]);
      if (canalActivo === "soporte") { setIaEsc(true); setTimeout(() => setIaEsc(false), 20000); }
    } catch { setTexto(t); }
    finally { setEnviando(false); inputRef.current?.focus(); }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
    else notificarEscribiendo();
  };

  // Cambiar canal
  const cambiarCanal = (id) => {
    setCanalActivo(id);
    setMensajes([]);
    setNoLeidos(p => ({ ...p, [id]: 0 }));
    setEscribiendo([]);
    setIaEsc(false);
    if (token) fetch(`${BACKEND}/api/chat/mensajes/${encodeURIComponent(id)}/leer`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  // Drag
  const onDragStart = (e, m) => {
    e.dataTransfer.setData("userId",   m.id);
    e.dataTransfer.setData("userName", m.nombre);
  };
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const uid    = e.dataTransfer.getData("userId");
    const nombre = e.dataTransfer.getData("userName");
    if (!uid || !nombre || uid === me?.id) return;
    setDmsAbiertos(p => p.find(d => d.id === uid) ? p : [...p, { id: uid, nombre }]);
    cambiarCanal(dmCanalId(me.id, uid));
  };
  const abrirDM = (m) => {
    if (!me?.id || m.id === me.id) return;
    setDmsAbiertos(p => p.find(d => d.id === m.id) ? p : [...p, { id: m.id, nombre: m.nombre }]);
    cambiarCanal(dmCanalId(me.id, m.id));
  };

  // Info del canal activo
  const canalInfo = (() => {
    if (canalActivo.startsWith("dm:")) {
      const otherId = canalActivo.replace("dm:", "").split(":").find(x => x !== me?.id) || "";
      const dm = dmsAbiertos.find(d => d.id === otherId);
      return { nombre: dm?.nombre || "DM", isDM: true };
    }
    const c = CANALES.find(c => c.id === canalActivo);
    return { nombre: c?.nombre || canalActivo, emoji: c?.emoji, isDM: false, ia: c?.ia };
  })();

  const grupos = agrupar(mensajes);
  const meId   = me?.id;
  const otrosEquipo = equipo.filter(m => m.id !== meId);

  return (
    <div className="flex h-full bg-white overflow-hidden">

      {/* ── Sidebar claro ────────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 bg-slate-50 border-r border-gray-200 flex flex-col select-none">

        {/* Cabecera */}
        <div className="px-4 py-3.5 border-b border-gray-200">
          <p className="font-bold text-slate-900 text-sm truncate">{me?.empresaNombre || me?.empresa_nombre || "Mi empresa"}</p>
          <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
            {otrosEquipo.length + 1} miembro{otrosEquipo.length !== 0 ? "s" : ""}
          </p>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">

          {/* Canales */}
          <button onClick={() => {}} className="w-full flex items-center gap-1 px-3 py-1 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <ChevronDown size={11}/>
            Canales
          </button>

          {CANALES.map(c => {
            const activo = canalActivo === c.id;
            const n = noLeidos[c.id] || 0;
            return (
              <button key={c.id} onClick={() => cambiarCanal(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg mx-1 w-[calc(100%-8px)] transition-colors ${
                  activo
                    ? "bg-yellow-50 text-yellow-800 font-semibold"
                    : "text-slate-600 hover:bg-gray-100 hover:text-slate-900"
                }`}>
                <Hash size={13} className={activo ? "text-yellow-600" : "text-slate-400"}/>
                <span className="flex-1 text-left truncate">{c.nombre}</span>
                {c.ia && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded font-bold border border-yellow-200">IA</span>}
                {n > 0 && !activo && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{n}</span>
                )}
              </button>
            );
          })}

          {/* Mensajes Directos */}
          <div className="mt-3">
            <button onClick={() => setDmsCerrado(p => !p)}
              className="w-full flex items-center gap-1 px-3 py-1 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              {dmsCerrado ? <ChevronRight size={11}/> : <ChevronDown size={11}/>}
              Mensajes directos
            </button>

            {!dmsCerrado && (
              <div className="mt-1">
                {/* DMs abiertos */}
                {dmsAbiertos.map(dm => {
                  const cDM   = dmCanalId(me?.id || "", dm.id);
                  const activo = canalActivo === cDM;
                  const n = noLeidos[cDM] || 0;
                  return (
                    <button key={dm.id} onClick={() => cambiarCanal(cDM)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg mx-1 w-[calc(100%-8px)] transition-colors ${
                        activo ? "bg-yellow-50 text-yellow-800 font-semibold" : "text-slate-600 hover:bg-gray-100"
                      }`}>
                      <Avatar nombre={dm.nombre} userId={dm.id} size={5}/>
                      <span className="flex-1 text-left truncate">{dm.nombre}</span>
                      <Lock size={10} className="text-slate-300"/>
                      {n > 0 && !activo && (
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{n}</span>
                      )}
                    </button>
                  );
                })}

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`mx-2 my-1 rounded-lg border-2 border-dashed text-xs text-center py-2 transition-colors cursor-pointer ${
                    dragOver
                      ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                      : "border-gray-200 text-slate-400 hover:border-yellow-300 hover:text-slate-500"
                  }`}>
                  {dragOver ? "Soltar para abrir DM ✓" : "Arrastrá un miembro aquí"}
                </div>
              </div>
            )}
          </div>

          {/* Equipo (draggable) */}
          {otrosEquipo.length > 0 && (
            <div className="mt-3">
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Equipo <span className="font-normal normal-case text-slate-400">· arrastrá para DM</span>
              </p>
              {otrosEquipo.map(m => (
                <div key={m.id}
                  draggable
                  onDragStart={e => onDragStart(e, m)}
                  onClick={() => abrirDM(m)}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-slate-600 hover:bg-gray-100 hover:text-slate-900 cursor-grab active:cursor-grabbing transition-colors text-sm"
                  title="Arrastrá para DM o hacé click">
                  <Avatar nombre={m.nombre} userId={m.id} size={5}/>
                  <span className="flex-1 truncate">{m.nombre}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.activo ? "bg-green-500" : "bg-gray-300"}`}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usuario actual */}
        <div className="px-3 py-3 border-t border-gray-200 flex items-center gap-2 bg-white">
          {me && (
            <>
              <Avatar nombre={me.nombre || me.email || "Yo"} userId={me.id || ""} size={8}/>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 text-xs font-semibold truncate">{me.nombre || me.email}</p>
                <p className="text-slate-400 text-[10px]">{me.rol}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
            </>
          )}
        </div>
      </div>

      {/* ── Área de mensajes ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-2.5 bg-white shadow-sm">
          {canalInfo.isDM ? (
            <>
              <MessageSquare size={16} className="text-slate-400"/>
              <span className="font-semibold text-slate-900">{canalInfo.nombre}</span>
              <Lock size={12} className="text-slate-400"/>
              <span className="text-xs text-slate-400">· Mensaje privado</span>
            </>
          ) : (
            <>
              <Hash size={16} className="text-slate-400"/>
              <span className="font-semibold text-slate-900">{canalInfo.nombre}</span>
              {canalInfo.ia && (
                <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-semibold">
                  🤖 IA 24/7
                </span>
              )}
            </>
          )}
        </div>

        {/* Banner soporte */}
        {canalActivo === "soporte" && (
          <div className="mx-4 mt-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-sm font-semibold text-yellow-800">Asistente Monki — Soporte técnico con IA</p>
              <p className="text-xs text-yellow-600">Escribí tu duda y te respondo al instante. Disponible 24/7.</p>
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto py-4">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="text-5xl mb-4">{canalInfo.isDM ? "💬" : (CANALES.find(c => c.id === canalActivo)?.emoji || "#")}</div>
              <p className="text-slate-800 font-bold text-lg mb-1">
                {canalInfo.isDM ? `DM con ${canalInfo.nombre}` : `# ${canalInfo.nombre}`}
              </p>
              <p className="text-slate-400 text-sm">
                {canalInfo.isDM ? "Inicio de la conversación privada." : "Sé el primero en escribir algo."}
              </p>
            </div>
          ) : (
            <>
              {(() => {
                const items = []; let lastDate = null;
                for (const g of grupos) {
                  const ds = new Date(g[0].creado_en || g[0].creadoEn).toDateString();
                  if (ds !== lastDate) { items.push(<SepFecha key={`sep-${ds}`} fecha={g[0].creado_en || g[0].creadoEn}/>); lastDate = ds; }
                  items.push(<GrupoMensajes key={g[0].id} msgs={g} meId={meId}/>);
                }
                return items;
              })()}
            </>
          )}

          {/* IA escribiendo */}
          {iaEsc && canalActivo === "soporte" && (
            <div className="flex items-center gap-3 px-4 py-2 mx-2">
              <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-lg">🤖</div>
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-1.5 items-center">
                {[0,150,300].map(d => (
                  <span key={d} className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
                ))}
              </div>
            </div>
          )}

          <Escribiendo nombres={escribiendo.filter(n => n !== (me?.nombre || ""))}/>
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-yellow-300 focus-within:bg-white transition-colors">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={canalInfo.isDM ? `Mensaje a ${canalInfo.nombre}…` : `Mensaje en #${canalInfo.nombre}…`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none max-h-40"
              style={{ lineHeight: "1.6" }}
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <Send size={14}/>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>
    </div>
  );
}
