/**
 * CRMClientesScreen — Seguimiento y gestión de clientes.
 * Vista de pipeline + detalle por cliente con historial completo.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, User, Phone, Mail, MapPin, TrendingUp, FileText,
  DollarSign, Calendar, MessageSquare, Plus, X, ChevronRight,
  Tag, Clock, CheckCircle2, AlertCircle, Edit3, Star,
  BarChart2, ShoppingCart, Receipt,
} from "lucide-react";
import db from "../utils/db";
import { fmtMoney } from "../utils/fmt";
import { getToken } from "../utils/auth";

import { BACKEND } from "../utils/config";

const ETAPAS = [
  { id: "prospecto",  label: "Prospecto",  color: "#94a3b8", bg: "bg-slate-100" },
  { id: "contactado", label: "Contactado", color: "#f59e0b", bg: "bg-amber-50" },
  { id: "propuesta",  label: "Propuesta",  color: "#6366f1", bg: "bg-indigo-50" },
  { id: "negociacion",label: "Negociación",color: "#3b82f6", bg: "bg-blue-50" },
  { id: "cliente",    label: "Cliente",    color: "#10b981", bg: "bg-emerald-50" },
  { id: "inactivo",   label: "Inactivo",   color: "#ef4444", bg: "bg-red-50" },
];

const ETAPA_DEFAULT = "cliente";

function etapaInfo(id) {
  return ETAPAS.find(e => e.id === id) || ETAPAS[0];
}

// ── Nota de seguimiento ───────────────────────────────────────────────────────
function NotaItem({ nota }) {
  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
        <MessageSquare size={12} className="text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{nota.texto}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{nota.fecha}</p>
      </div>
    </div>
  );
}

// ── Panel de detalle del cliente ──────────────────────────────────────────────
function ClienteDetalle({ cliente, onClose, onActualizar }) {
  const [tab,       setTab]       = useState("resumen");
  const [nuevaNota, setNuevaNota] = useState("");
  const [notas,     setNotas]     = useState(cliente.notas || []);
  const [etapa,     setEtapa]     = useState(cliente.etapaCRM || ETAPA_DEFAULT);
  const [facturas,  setFacturas]  = useState([]);
  const [cxc,       setCxc]       = useState([]);
  const [pedidos,   setPedidos]   = useState([]);
  const [eventos,   setEventos]   = useState([]);
  const [token,     setToken]     = useState(null);

  useEffect(() => {
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  useEffect(() => {
    // Cargar historial del cliente desde electron-store
    Promise.all([db.getFacturas(), db.getCXC?.() || Promise.resolve([]), db.getPedidos?.() || Promise.resolve([])]).then(([f, c, p]) => {
      const nombre = cliente.nombre?.toLowerCase();
      const codigo = cliente.codigoCliente;
      const match  = (x) => (x.clienteNombre || x.cliente || "").toLowerCase().includes(nombre) || x.clienteCodigo === codigo;
      setFacturas((f || []).filter(match).slice(0, 10));
      setCxc((c || []).filter(match).slice(0, 10));
      setPedidos((p || []).filter(match).slice(0, 10));
    }).catch(() => {});
  }, [cliente]);

  const agregarNota = () => {
    if (!nuevaNota.trim()) return;
    const nota = {
      texto: nuevaNota.trim(),
      fecha: new Date().toLocaleDateString("es-CR", { dateStyle: "medium" }),
    };
    const nuevasNotas = [nota, ...notas];
    setNotas(nuevasNotas);
    setNuevaNota("");
    onActualizar(cliente.id, { notas: nuevasNotas });
  };

  const cambiarEtapa = (nueva) => {
    setEtapa(nueva);
    onActualizar(cliente.id, { etapaCRM: nueva });
  };

  const ei = etapaInfo(etapa);
  const totalFacturado = facturas.reduce((s, f) => s + (f.total || 0), 0);
  const cxcPend = cxc.reduce((s, c) => s + Math.max(0, (c.total || 0) - (c.pagado || 0)), 0);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[520px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {(cliente.nombre || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-800 text-base truncate">{cliente.nombre}</h2>
            {cliente.empresa && <p className="text-sm text-slate-500 truncate">{cliente.empresa}</p>}
            <div className="flex items-center gap-2 mt-1.5">
              {/* Selector de etapa */}
              <select
                value={etapa}
                onChange={e => cambiarEtapa(e.target.value)}
                className="text-xs px-2 py-1 rounded-full border font-medium focus:outline-none cursor-pointer"
                style={{ color: ei.color, borderColor: ei.color + "44", background: ei.color + "11" }}
              >
                {ETAPAS.map(e => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
              {cliente.codigoCliente && (
                <span className="text-[11px] text-slate-400 font-mono">{cliente.codigoCliente}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1">
            <X size={18} />
          </button>
        </div>

        {/* Info de contacto */}
        <div className="px-6 py-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100">
          {cliente.email    && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Mail size={12} />{cliente.email}</span>}
          {cliente.telefono && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Phone size={12} />{cliente.telefono}</span>}
          {cliente.cedula   && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Tag size={12} />{cliente.cedula}</span>}
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 border-b border-slate-100">
          {[
            { label: "Facturado", value: fmtMoney(totalFacturado), icon: BarChart2, color: "text-emerald-600" },
            { label: "CXC pend.", value: fmtMoney(cxcPend),        icon: DollarSign, color: cxcPend > 0 ? "text-amber-600" : "text-slate-400" },
            { label: "Facturas",  value: facturas.length,           icon: Receipt,   color: "text-slate-600" },
          ].map(k => (
            <div key={k.label} className="flex flex-col items-center py-3 border-r last:border-0 border-slate-100">
              <k.icon size={14} className={k.color} />
              <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-slate-400">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { id: "resumen",  label: "Notas" },
            { id: "facturas", label: `Facturas (${facturas.length})` },
            { id: "cxc",      label: "CXC" },
            { id: "pedidos",  label: "Pedidos" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors
                ${tab === t.id ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido tab */}
        <div className="flex-1 overflow-auto px-6 py-4">

          {tab === "resumen" && (
            <div className="space-y-4">
              {/* Agregar nota */}
              <div className="flex gap-2">
                <input
                  value={nuevaNota}
                  onChange={e => setNuevaNota(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agregarNota()}
                  placeholder="Agregar nota de seguimiento…"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <button
                  onClick={agregarNota}
                  disabled={!nuevaNota.trim()}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  <Plus size={15} />
                </button>
              </div>

              {notas.length === 0
                ? <p className="text-sm text-slate-400 text-center py-6">Sin notas de seguimiento aún.</p>
                : notas.map((n, i) => <NotaItem key={i} nota={n} />)
              }
            </div>
          )}

          {tab === "facturas" && (
            <div className="space-y-2">
              {facturas.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">Sin facturas registradas.</p>
                : facturas.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                    <Receipt size={14} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.consecutivo || f.numero || `#${i+1}`}</p>
                      <p className="text-xs text-slate-400">{f.fecha}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{fmtMoney(f.total || 0)}</span>
                  </div>
                ))
              }
            </div>
          )}

          {tab === "cxc" && (
            <div className="space-y-2">
              {cxc.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">Sin cuentas por cobrar.</p>
                : cxc.map((c, i) => {
                  const pend = Math.max(0, (c.total || 0) - (c.pagado || 0));
                  const vencida = c.fechaVencimiento && c.fechaVencimiento < new Date().toISOString().slice(0,10);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                      <DollarSign size={14} className={vencida ? "text-red-500" : "text-amber-500"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{c.descripcion || "CXC"}</p>
                        <p className="text-xs text-slate-400">Vence: {c.fechaVencimiento || "N/D"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${vencida ? "text-red-600" : "text-amber-600"}`}>{fmtMoney(pend)}</p>
                        {vencida && <span className="text-[10px] text-red-500">Vencida</span>}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}

          {tab === "pedidos" && (
            <div className="space-y-2">
              {pedidos.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">Sin pedidos registrados.</p>
                : pedidos.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                    <ShoppingCart size={14} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{p.numero || `Pedido ${i+1}`}</p>
                      <p className="text-xs text-slate-400">{p.fecha}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${p.estado === "entregado" ? "bg-emerald-100 text-emerald-700"
                        : p.estado === "cancelado" ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"}`}>
                      {p.estado || "pendiente"}
                    </span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de cliente en la lista ────────────────────────────────────────────
function ClienteCard({ cliente, onClick }) {
  const ei = etapaInfo(cliente.etapaCRM || ETAPA_DEFAULT);
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {(cliente.nombre || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{cliente.nombre}</p>
        <p className="text-xs text-slate-400 truncate">{cliente.email || cliente.telefono || "Sin contacto"}</p>
      </div>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ color: ei.color, background: ei.color + "18" }}>
        {ei.label}
      </span>
      <ChevronRight size={14} className="text-slate-300 shrink-0" />
    </div>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function CRMClientesScreen() {
  const [clientes,  setClientes]  = useState([]);
  const [busqueda,  setBusqueda]  = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("todos");
  const [seleccionado, setSeleccionado] = useState(null);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    setLoading(true);
    db.getContactos?.().then(c => {
      setClientes(c || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const actualizarCliente = useCallback(async (id, cambios) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...cambios } : c));
    // Persistir en electron-store
    const actualizados = clientes.map(c => c.id === id ? { ...c, ...cambios } : c);
    try { await db.setContactos?.(actualizados); } catch {}
  }, [clientes]);

  const clientesFiltrados = clientes.filter(c => {
    const q = busqueda.toLowerCase();
    const matchBusqueda = !q ||
      (c.nombre || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.telefono || "").includes(q);
    const matchEtapa = etapaFiltro === "todos" || (c.etapaCRM || ETAPA_DEFAULT) === etapaFiltro;
    return matchBusqueda && matchEtapa;
  });

  // Conteo por etapa
  const conteo = ETAPAS.reduce((acc, e) => {
    acc[e.id] = clientes.filter(c => (c.etapaCRM || ETAPA_DEFAULT) === e.id).length;
    return acc;
  }, {});

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Panel izquierdo ─────────────────────────────────────────────────── */}
      <div className="w-72 border-r border-slate-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100">
          <h1 className="font-bold text-slate-800 text-sm">CRM — Clientes</h1>
          <p className="text-xs text-slate-400 mt-0.5">{clientes.length} contactos</p>
        </div>

        {/* Búsqueda */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Filtro etapas */}
        <div className="px-3 py-2 border-b border-slate-100 space-y-0.5">
          <button
            onClick={() => setEtapaFiltro("todos")}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors
              ${etapaFiltro === "todos" ? "bg-slate-200 text-slate-700 font-medium" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <span>Todos</span>
            <span className="text-slate-400">{clientes.length}</span>
          </button>
          {ETAPAS.map(e => (
            <button
              key={e.id}
              onClick={() => setEtapaFiltro(e.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors
                ${etapaFiltro === e.id ? "font-medium" : "text-slate-500 hover:bg-slate-50"}`}
              style={etapaFiltro === e.id ? { background: e.color + "18", color: e.color } : {}}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                {e.label}
              </span>
              <span style={{ color: e.color + "99" }}>{conteo[e.id] || 0}</span>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-auto px-3 py-2 space-y-1">
          {loading && <p className="text-xs text-slate-400 text-center py-4">Cargando…</p>}
          {!loading && clientesFiltrados.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Sin resultados.</p>
          )}
          {clientesFiltrados.map(c => (
            <ClienteCard
              key={c.id}
              cliente={c}
              onClick={() => setSeleccionado(c)}
            />
          ))}
        </div>
      </div>

      {/* ── Panel derecho — vacío o resumen ────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        {!seleccionado ? (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <User size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-700">Seleccioná un cliente</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Verás su historial completo de facturas, cuentas por cobrar, pedidos y notas de seguimiento.
            </p>

            {/* Resumen rápido por etapa */}
            <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-md">
              {ETAPAS.slice(0,6).map(e => (
                <div
                  key={e.id}
                  onClick={() => setEtapaFiltro(e.id)}
                  className="p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all text-center"
                  style={{ borderColor: e.color + "33", background: e.color + "0a" }}
                >
                  <p className="text-xl font-bold" style={{ color: e.color }}>{conteo[e.id] || 0}</p>
                  <p className="text-xs mt-0.5" style={{ color: e.color + "bb" }}>{e.label}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Panel de detalle */}
      {seleccionado && (
        <ClienteDetalle
          cliente={seleccionado}
          onClose={() => setSeleccionado(null)}
          onActualizar={actualizarCliente}
        />
      )}
    </div>
  );
}
