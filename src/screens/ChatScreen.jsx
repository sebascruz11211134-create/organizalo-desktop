/**
 * ChatScreen — Chat interno tipo Discord (tema claro, igual al resto de la app).
 * Canales por área + DMs privados arrastrando miembros del equipo.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Bot } from "lucide-react";
import { getToken, getUser } from "../utils/auth";
import { BACKEND } from "../utils/config";
import { Modulo } from "../components/ui";

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

const COLORES = ["#111111","#2a2a2a","#3a3a3a","#111111","#2a2a2a","#3a3a3a","#111111","#2a2a2a"];
function colorAvatar(id = "") {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORES[n % COLORES.length];
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ nombre, userId, size = 8 }) {
  return (
    <div
      style={{ backgroundColor: colorAvatar(userId), width: size * 4, height: size * 4, minWidth: size * 4 }}
      className="rounded-full flex items-center justify-center text-monki-y font-black flex-shrink-0"
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
      <div className="flex-1 h-px bg-black/10"/>
      <span className="monki-tag text-[10px] text-monki-k/50 bg-monki-cream rounded-full px-3 py-1 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-black/10"/>
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
    <div className="animate-desplegar flex gap-3 px-4 py-2 hover:bg-monki-cream/60 group rounded-2xl mx-2 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {esBot
          ? <div className="w-9 h-9 rounded-full bg-monki-y flex items-center justify-center text-monki-k"><Bot size={17}/></div>
          : <Avatar nombre={nombre} userId={uid} size={9}/>}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-extrabold text-monki-k">
            {esBot ? "Asistente Monki" : nombre}
          </span>
          {esBot && (
            <span className="text-[9px] bg-monki-k text-monki-y px-1.5 py-0.5 rounded-full font-bold">IA</span>
          )}
          <span className="font-mono text-[10px] text-monki-k/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {hora(primero)}
          </span>
        </div>
        {msgs.map((m, i) => (
          <p key={m.id} className={`text-sm leading-relaxed whitespace-pre-wrap text-monki-k/80 ${i > 0 ? "mt-0.5" : ""}`}>
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
          <span key={d} className="w-1.5 h-1.5 bg-monki-k rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
        ))}
      </div>
      <span className="text-xs text-monki-k/50 italic">{txt}</span>
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

  const itemCanal = activo => `ui-boton w-[calc(100%-8px)] mx-1 flex items-center gap-2 px-3 py-2 text-sm rounded-full transition-all duration-200 ${
    activo ? "bg-monki-k text-monki-y font-bold" : "text-monki-k/65 hover:bg-black/5 hover:text-monki-k"}`;
  const Contador = ({ n }) => <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{n}</span>;
  const Grupo = ({ children, onClick, abierto = true }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-1 px-4 py-1 monki-tag text-[10px] text-monki-k/45">
      {abierto ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}{children}
    </button>
  );

  return (
    <Modulo seccion="Equipo" titulo="Chat interno" descripcion="Canales por área, mensajes directos y soporte con IA las 24 horas.">
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
        <aside className="ui-tarjeta w-full md:w-60 shrink-0 bg-white rounded-[18px] border-2 border-black/10 flex flex-col select-none overflow-hidden max-h-64 md:max-h-none">
          <div className="px-4 py-3.5 border-b-2 border-black/10">
            <p className="font-extrabold text-monki-k text-sm truncate">{me?.empresaNombre || me?.empresa_nombre || "Mi empresa"}</p>
            <p className="text-monki-k/50 text-xs mt-0.5 flex items-center gap-1.5">
              <span className="monki-pulse"/>{otrosEquipo.length + 1} miembro{otrosEquipo.length !== 0 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
            <Grupo>Canales</Grupo>
            {CANALES.map(c => {
              const activo = canalActivo === c.id;
              const n = noLeidos[c.id] || 0;
              return (
                <button key={c.id} type="button" onClick={() => cambiarCanal(c.id)} className={itemCanal(activo)}>
                  <Hash size={13} className={activo ? "text-monki-y" : "text-monki-k/35"}/>
                  <span className="flex-1 text-left truncate">{c.nombre}</span>
                  {c.ia && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activo ? "bg-monki-y text-monki-k" : "bg-monki-k text-monki-y"}`}>IA</span>}
                  {n > 0 && !activo && <Contador n={n}/>}
                </button>
              );
            })}

            <div className="pt-3">
              <Grupo onClick={() => setDmsCerrado(p => !p)} abierto={!dmsCerrado}>Mensajes directos</Grupo>
              {!dmsCerrado && (
                <div className="mt-1 space-y-0.5">
                  {dmsAbiertos.map(dm => {
                    const cDM = dmCanalId(me?.id || "", dm.id);
                    const activo = canalActivo === cDM;
                    const n = noLeidos[cDM] || 0;
                    return (
                      <button key={dm.id} type="button" onClick={() => cambiarCanal(cDM)} className={itemCanal(activo)}>
                        <Avatar nombre={dm.nombre} userId={dm.id} size={5}/>
                        <span className="flex-1 text-left truncate">{dm.nombre}</span>
                        <Lock size={10} className="opacity-40"/>
                        {n > 0 && !activo && <Contador n={n}/>}
                      </button>
                    );
                  })}
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                    className={`mx-2 my-1 rounded-2xl border-2 border-dashed text-xs font-semibold text-center py-2.5 transition-all duration-200 ${
                      dragOver ? "border-monki-k bg-monki-y text-monki-k" : "border-black/15 text-monki-k/40"}`}>
                    {dragOver ? "Soltá para abrir el mensaje ✓" : "Arrastrá un miembro aquí"}
                  </div>
                </div>
              )}
            </div>

            {otrosEquipo.length > 0 && (
              <div className="pt-3">
                <p className="px-4 py-1 monki-tag text-[10px] text-monki-k/45">Equipo · arrastrá o tocá</p>
                {otrosEquipo.map(m => (
                  <div key={m.id} draggable onDragStart={e => onDragStart(e, m)} onClick={() => abrirDM(m)} title="Arrastrá o tocá para escribirle"
                    className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-full text-monki-k/70 hover:bg-black/5 hover:text-monki-k cursor-grab active:cursor-grabbing transition-colors text-sm">
                    <Avatar nombre={m.nombre} userId={m.id} size={5}/>
                    <span className="flex-1 truncate">{m.nombre}</span>
                    <span className={`w-2 h-2 rounded-full ${m.activo ? "bg-[#35e06b]" : "bg-black/15"}`}/>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-3 py-3 border-t-2 border-black/10 flex items-center gap-2 bg-monki-cream/50">
            {me && (
              <>
                <Avatar nombre={me.nombre || me.email || "Yo"} userId={me.id || ""} size={8}/>
                <div className="flex-1 min-w-0">
                  <p className="text-monki-k text-xs font-bold truncate">{me.nombre || me.email}</p>
                  <p className="font-mono text-monki-k/45 text-[10px]">{me.rol}</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#35e06b] flex-shrink-0"/>
              </>
            )}
          </div>
        </aside>

        <section className="ui-tarjeta flex-1 min-h-[360px] md:min-h-0 min-w-0 bg-white rounded-[18px] border-2 border-black/10 flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b-2 border-black/10 flex items-center gap-2.5">
            {canalInfo.isDM ? (
              <>
                <span className="w-8 h-8 rounded-full bg-monki-cream flex items-center justify-center"><MessageSquare size={15}/></span>
                <span className="font-extrabold text-monki-k">{canalInfo.nombre}</span>
                <span className="monki-tag text-[10px] text-monki-k/45 flex items-center gap-1"><Lock size={10}/> Privado</span>
              </>
            ) : (
              <>
                <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center"><Hash size={15}/></span>
                <span className="font-extrabold text-monki-k">{canalInfo.nombre}</span>
                {canalInfo.ia && <span className="text-[10px] bg-monki-k text-monki-y px-2 py-0.5 rounded-full font-bold">IA 24/7</span>}
              </>
            )}
          </div>

          {canalActivo === "soporte" && (
            <div className="animate-desplegar mx-4 mt-3 px-4 py-3 bg-monki-k text-white rounded-2xl flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-monki-y text-monki-k flex items-center justify-center shrink-0"><Bot size={18}/></span>
              <div>
                <p className="text-sm font-extrabold text-monki-y">Asistente Monki — soporte con IA</p>
                <p className="text-xs text-white/60">Escribí tu duda y te respondo al instante, a cualquier hora.</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-4">
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
                <div className="w-16 h-16 rounded-full bg-monki-y flex items-center justify-center shadow-[4px_4px_0_#111] animate-flotar text-2xl">
                  {canalInfo.isDM ? <MessageSquare size={26}/> : (CANALES.find(c => c.id === canalActivo)?.emoji || "#")}
                </div>
                <p className="text-monki-k font-black text-lg">{canalInfo.isDM ? `Mensaje con ${canalInfo.nombre}` : `# ${canalInfo.nombre}`}</p>
                <p className="text-monki-k/50 text-sm">{canalInfo.isDM ? "Inicio de la conversación privada." : "Sé el primero en escribir algo."}</p>
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
            {iaEsc && canalActivo === "soporte" && (
              <div className="flex items-center gap-3 px-4 py-2 mx-2">
                <div className="w-9 h-9 rounded-full bg-monki-y flex items-center justify-center"><Bot size={17}/></div>
                <div className="px-3.5 py-2.5 bg-monki-cream rounded-2xl flex gap-1.5 items-center">
                  {[0,150,300].map(d => <span key={d} className="w-2 h-2 bg-monki-k rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>)}
                </div>
              </div>
            )}
            <Escribiendo nombres={escribiendo.filter(n => n !== (me?.nombre || ""))}/>
            <div ref={bottomRef}/>
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3 border-t-2 border-black/10 bg-monki-cream/40">
            <div className="flex items-end gap-2 bg-white border-2 border-black/10 rounded-[20px] pl-4 pr-1.5 py-1.5 focus-within:border-monki-k transition-colors">
              <textarea ref={inputRef} value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={onKeyDown}
                placeholder={canalInfo.isDM ? `Mensaje a ${canalInfo.nombre}…` : `Mensaje en #${canalInfo.nombre}…`}
                rows={1} className="ui-sin-foco flex-1 bg-transparent border-0 text-sm text-monki-k placeholder:text-monki-k/35 resize-none outline-none max-h-40 py-2" style={{ lineHeight: "1.6" }}/>
              <button type="button" onClick={enviar} disabled={!texto.trim() || enviando} title="Enviar"
                className="ui-boton w-10 h-10 flex items-center justify-center rounded-full bg-monki-k text-monki-y transition-all duration-300 ease-monki hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 flex-shrink-0">
                <Send size={15}/>
              </button>
            </div>
            <p className="font-mono text-[10px] text-monki-k/40 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </section>
      </div>
    </Modulo>
  );
}
