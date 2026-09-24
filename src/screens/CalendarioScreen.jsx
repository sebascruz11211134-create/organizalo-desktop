/**
 * CalendarioScreen — Vista mensual de eventos y citas.
 * Carga eventos desde /api/eventos (backend).
 */
import React, { useState, useEffect, useCallback } from "react";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, Tag,
  User, Calendar, CheckCircle2, Circle, Trash2, Edit3,
} from "lucide-react";
import { getToken } from "../utils/auth";
import { fetchWithTimeout } from "../utils/fetchTimeout";

import { BACKEND } from "../utils/config";
import { fechaLocal } from "../utils/fmt";
import { Modulo, Boton, BotonIcono, Modal, Campo, Entrada, AreaTexto, Interruptor, Tarjeta } from "../components/ui";

// Paleta Monki (los eventos ya guardados conservan su color)
const TIPOS = [
  { id: "evento",      label: "Evento",      color: "#111111" },
  { id: "cita",        label: "Cita",        color: "#FFD600" },
  { id: "recordatorio",label: "Recordatorio",color: "#E0A800" },
  { id: "tarea",       label: "Tarea",       color: "#6B6B6B" },
  { id: "reunion",     label: "Reunión",     color: "#DC2626" },
];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function hoy() { return fechaLocal(new Date()); }
function padTwo(n) { return String(n).padStart(2,"0"); }
function fechaStr(y,m,d) { return `${y}-${padTwo(m+1)}-${padTwo(d)}`; }

// ── Modal de evento ───────────────────────────────────────────────────────────
function EventoModal({ evento, onClose, onSave, onDelete }) {
  const esNuevo = !evento?.id;
  const [form, setForm] = useState({
    titulo:      evento?.titulo      || "",
    descripcion: evento?.descripcion || "",
    tipo:        evento?.tipo        || "evento",
    fecha:       evento?.fecha       || hoy(),
    hora:        evento?.hora        || "09:00",
    todo_el_dia: evento?.todo_el_dia || false,
    cliente_nombre: evento?.cliente_nombre || "",
    color:       evento?.color       || "#111111",
  });

  const tipo = TIPOS.find(t => t.id === form.tipo);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal titulo={esNuevo ? "Nuevo evento" : "Editar evento"} subtitulo={tipo?.label} onCerrar={onClose} ancho="max-w-md"
      pie={<>
        {!esNuevo && <Boton variante="peligro" icono={Trash2} onClick={() => onDelete(evento.id)} className="mr-auto">Eliminar</Boton>}
        <Boton variante="fantasma" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={() => onSave(form)} disabled={!form.titulo.trim()}>{esNuevo ? "Crear" : "Guardar"}</Boton>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-1.5 flex-wrap">
          {TIPOS.map(t => (
            <button key={t.id} type="button" onClick={() => { set("tipo", t.id); set("color", t.color); }}
              className={`ui-boton inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${form.tipo === t.id ? "bg-monki-k text-white" : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: t.color }}/>{t.label}
            </button>
          ))}
        </div>
        <Campo etiqueta="Título"><Entrada value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Título del evento"/></Campo>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Campo etiqueta="Fecha"><Entrada type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)}/></Campo>
          {!form.todo_el_dia && <Campo etiqueta="Hora"><Entrada type="time" value={form.hora} onChange={e => set("hora", e.target.value)}/></Campo>}
        </div>
        <Interruptor activo={form.todo_el_dia} onCambio={v => set("todo_el_dia", v)} etiqueta="Todo el día"/>
        <Campo etiqueta="Cliente (opcional)">
          <ClienteAutocomplete value={form.cliente_nombre} onChange={(c, str) => set("cliente_nombre", str)} tipo="todos" placeholder="Buscar cliente…" ringColor="focus:ring-monki-y" className="py-2"/>
        </Campo>
        <Campo etiqueta="Descripción"><AreaTexto value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Descripción (opcional)" rows={2}/></Campo>
      </div>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function CalendarioScreen() {
  const now = new Date();
  const [año,   setAño]   = useState(now.getFullYear());
  const [mes,   setMes]   = useState(now.getMonth());
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal,   setModal]   = useState(null); // null | { fecha?, evento? }
  const [token,   setToken]   = useState(null);

  useEffect(() => {
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  // Cargar eventos del mes
  const cargarEventos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const desde = `${año}-${padTwo(mes+1)}-01`;
      const hasta = `${año}-${padTwo(mes+1)}-31`;
      const res = await fetchWithTimeout(`${BACKEND}/api/eventos?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 5000);
      if (res.ok) {
        const json = await res.json();
        setEventos(Array.isArray(json) ? json : (json.eventos || []));
      }
    } catch { /* offline, usar eventos locales */ }
    finally { setLoading(false); }
  }, [token, año, mes]);

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  // Guardar evento (crear o editar)
  const guardarEvento = async (form) => {
    const esNuevo = !modal?.evento?.id;
    const url = esNuevo
      ? `${BACKEND}/api/eventos`
      : `${BACKEND}/api/eventos/${modal.evento.id}`;
    const method = esNuevo ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModal(null);
        cargarEventos();
      }
    } catch {
      // Fallback: agregar localmente
      const nuevo = { ...form, id: Date.now().toString() };
      setEventos(prev => esNuevo ? [...prev, nuevo] : prev.map(e => e.id === modal.evento.id ? nuevo : e));
      setModal(null);
    }
  };

  // Eliminar evento
  const eliminarEvento = async (id) => {
    try {
      await fetch(`${BACKEND}/api/eventos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setEventos(prev => prev.filter(e => e.id !== id));
    setModal(null);
  };

  // ── Construir grid del mes ──────────────────────────────────────────────────
  const primerDia = new Date(año, mes, 1).getDay();
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const eventosDelDia = (d) => {
    if (!d) return [];
    const fecha = fechaStr(año, mes, d);
    return eventos.filter(e => e.fecha === fecha);
  };

  const navMes = (delta) => {
    let m = mes + delta;
    let y = año;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMes(m); setAño(y);
  };

  const todayStr = hoy();

  const eventosMes = eventos.length;

  return (
    <Modulo
      seccion="Agenda"
      titulo="Calendario"
      descripcion="Citas, cobros y recordatorios del mes. Tocá un día para agregar algo."
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={() => navMes(-1)}/>
          <span className="text-sm font-black w-36 text-center">{MESES[mes]} {año}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={() => navMes(1)}/>
        </div>
        <Boton variante="secundario" onClick={() => { setMes(now.getMonth()); setAño(now.getFullYear()); }}>Hoy</Boton>
        <Boton icono={Plus} onClick={() => setModal({ fecha: hoy() })}>Nuevo evento</Boton>
      </>}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {TIPOS.map(t => (
          <span key={t.id} className="flex items-center gap-1.5 text-xs font-semibold text-monki-k/60">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />{t.label}
          </span>
        ))}
        <span className="ml-auto monki-tag text-monki-k/45">{loading ? "Cargando…" : `${eventosMes} eventos`}</span>
      </div>
      <Tarjeta className="flex-1 min-h-0 overflow-auto flex flex-col">
        <div className="grid grid-cols-7 border-b-2 border-black/10 sticky top-0 bg-white z-10">
          {DIAS_SEMANA.map(d => <div key={d} className="py-2.5 text-center monki-tag text-[10px] text-monki-k/50">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 flex-1">
          {celdas.map((d, i) => {
            const fecha = d ? fechaStr(año, mes, d) : null;
            const esHoy = fecha === todayStr;
            const evs   = eventosDelDia(d);
            return (
              <div key={i} onClick={() => d && setModal({ fecha })}
                className={`group min-h-[96px] border-b border-r border-black/5 p-1.5 transition-colors ${d ? "cursor-pointer hover:bg-monki-y/15" : "bg-monki-cream/40"} ${esHoy ? "bg-monki-y/25" : ""}`}>
                {d && (
                  <>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mb-1 transition-colors ${esHoy ? "bg-monki-k text-monki-y" : "text-monki-k/70 group-hover:bg-white"}`}>{d}</span>
                    <div className="space-y-0.5">
                      {evs.slice(0, 3).map(e => (
                        <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setModal({ evento: e }); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-black/10 text-[10px] font-semibold text-monki-k truncate cursor-pointer hover:border-monki-k transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color || "#111" }}/>
                          {!e.todo_el_dia && e.hora && <span className="shrink-0 font-mono text-monki-k/50">{e.hora.slice(0,5)}</span>}
                          <span className="truncate">{e.titulo}</span>
                        </div>
                      ))}
                      {evs.length > 3 && <span className="text-[10px] font-bold text-monki-k/45 pl-1">+{evs.length - 3} más</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Tarjeta>

      {modal && (
        <EventoModal evento={modal.evento || { fecha: modal.fecha }} onClose={() => setModal(null)} onSave={guardarEvento} onDelete={eliminarEvento}/>
      )}
    </Modulo>
  );
}
