/**
 * CalendarioScreen — Vista mensual de eventos y citas.
 * Carga eventos desde /api/eventos (backend).
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, Tag,
  User, Calendar, CheckCircle2, Circle, Trash2, Edit3,
} from "lucide-react";
import { getToken } from "../utils/auth";
import { fetchWithTimeout } from "../utils/fetchTimeout";

const BACKEND = "http://31.97.141.124";

const TIPOS = [
  { id: "evento",      label: "Evento",      color: "#10b981" },
  { id: "cita",        label: "Cita",        color: "#6366f1" },
  { id: "recordatorio",label: "Recordatorio",color: "#f59e0b" },
  { id: "tarea",       label: "Tarea",       color: "#3b82f6" },
  { id: "reunion",     label: "Reunión",     color: "#ec4899" },
];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function hoy() { return new Date().toISOString().slice(0,10); }
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
    color:       evento?.color       || "#10b981",
  });

  const tipo = TIPOS.find(t => t.id === form.tipo);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-3 h-3 rounded-full" style={{ background: form.color }} />
          <h2 className="font-semibold text-slate-800 flex-1">
            {esNuevo ? "Nuevo evento" : "Editar evento"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="flex gap-2 flex-wrap">
            {TIPOS.map(t => (
              <button
                key={t.id}
                onClick={() => { set("tipo", t.id); set("color", t.color); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                  ${form.tipo === t.id ? "text-white border-transparent" : "text-slate-500 border-slate-200 hover:border-slate-300"}`}
                style={form.tipo === t.id ? { background: t.color, borderColor: t.color } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Título */}
          <input
            autoFocus
            value={form.titulo}
            onChange={e => set("titulo", e.target.value)}
            placeholder="Título del evento"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"
          />

          {/* Fecha + Hora */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => set("fecha", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              />
            </div>
            {!form.todo_el_dia && (
              <div className="w-32">
                <label className="text-xs text-slate-500 mb-1 block">Hora</label>
                <input
                  type="time"
                  value={form.hora}
                  onChange={e => set("hora", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
            )}
          </div>

          {/* Todo el día */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.todo_el_dia}
              onChange={e => set("todo_el_dia", e.target.checked)}
              className="accent-emerald-500"
            />
            <span className="text-sm text-slate-600">Todo el día</span>
          </label>

          {/* Cliente */}
          <input
            value={form.cliente_nombre}
            onChange={e => set("cliente_nombre", e.target.value)}
            placeholder="Cliente (opcional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          />

          {/* Descripción */}
          <textarea
            value={form.descripcion}
            onChange={e => set("descripcion", e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pb-5">
          {!esNuevo && (
            <button
              onClick={() => onDelete(evento.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
          <span className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.titulo.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {esNuevo ? "Crear" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
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
        setEventos(json.eventos || []);
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <h1 className="text-base font-bold text-slate-800 w-44 text-center">
            {MESES[mes]} {año}
          </h1>
          <button onClick={() => navMes(1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>

        <button
          onClick={() => { setMes(now.getMonth()); setAño(now.getFullYear()); }}
          className="text-xs text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-50 transition-colors"
        >
          Hoy
        </button>

        <span className="flex-1" />

        {/* Leyenda tipos */}
        <div className="hidden lg:flex items-center gap-3">
          {TIPOS.map(t => (
            <span key={t.id} className="flex items-center gap-1 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
        </div>

        <button
          onClick={() => setModal({ fecha: hoy() })}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus size={15} /> Nuevo evento
        </button>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {/* Encabezado días semana */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7 flex-1">
          {celdas.map((d, i) => {
            const fecha = d ? fechaStr(año, mes, d) : null;
            const esHoy = fecha === todayStr;
            const evs   = eventosDelDia(d);
            return (
              <div
                key={i}
                onClick={() => d && setModal({ fecha })}
                className={`min-h-[100px] border-b border-r border-slate-100 p-2 cursor-pointer transition-colors
                  ${d ? "hover:bg-emerald-50/40" : "bg-slate-50/50"}
                  ${esHoy ? "bg-emerald-50" : ""}`}
              >
                {d && (
                  <>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1
                      ${esHoy ? "bg-emerald-500 text-white" : "text-slate-600"}`}>
                      {d}
                    </span>
                    <div className="space-y-0.5">
                      {evs.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setModal({ evento: e }); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer hover:opacity-80"
                          style={{ background: (e.color || "#10b981") + "22", color: e.color || "#10b981" }}
                        >
                          {!e.todo_el_dia && e.hora && (
                            <span className="shrink-0 opacity-70">{e.hora.slice(0,5)}</span>
                          )}
                          <span className="truncate">{e.titulo}</span>
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <span className="text-[10px] text-slate-400 pl-1">+{evs.length - 3} más</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {modal && (
        <EventoModal
          evento={modal.evento || { fecha: modal.fecha }}
          onClose={() => setModal(null)}
          onSave={guardarEvento}
          onDelete={eliminarEvento}
        />
      )}
    </div>
  );
}
