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
import { fmtMoney, fechaLocal } from "../utils/fmt";
import { getToken } from "../utils/auth";

import { BACKEND } from "../utils/config";
import { Modulo, Boton, BotonIcono, Buscador, Tarjeta, Vacio, Estado, Pestanas, Entrada } from "../components/ui";
import AccionesTelefono from "../components/AccionesTelefono";

// Paleta Monki: del gris (frío) al negro (cliente), rojo para inactivo
const ETAPAS = [
  { id: "prospecto",  label: "Prospecto",  color: "#A3A3A3" },
  { id: "contactado", label: "Contactado", color: "#E0A800" },
  { id: "propuesta",  label: "Propuesta",  color: "#FFD600" },
  { id: "negociacion",label: "Negociación",color: "#6B6B6B" },
  { id: "cliente",    label: "Cliente",    color: "#111111" },
  { id: "inactivo",   label: "Inactivo",   color: "#DC2626" },
];

const ETAPA_DEFAULT = "cliente";

function etapaInfo(id) {
  return ETAPAS.find(e => e.id === id) || ETAPAS[0];
}

// ── Nota de seguimiento ───────────────────────────────────────────────────────
function NotaItem({ nota }) {
  return (
    <div className="animate-desplegar flex gap-3 py-3 border-b border-black/5 last:border-0">
      <div className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0 mt-0.5">
        <MessageSquare size={13} className="text-monki-k" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-monki-k/80">{nota.texto}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="font-mono text-[10px] text-monki-k/45">{nota.fecha}</p>
          {nota.seguimiento && (
            <span className="text-[10px] bg-monki-k text-monki-y px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Calendar size={9} /> Seguimiento: {nota.seguimiento}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel de detalle del cliente ──────────────────────────────────────────────
function ClienteDetalle({ cliente, onClose, onActualizar }) {
  const [tab,             setTab]             = useState("resumen");
  const [nuevaNota,       setNuevaNota]       = useState("");
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [notas,           setNotas]           = useState(cliente.notas || []);
  const [etapa,           setEtapa]           = useState(cliente.etapaCRM || ETAPA_DEFAULT);
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

  const agregarNota = async () => {
    if (!nuevaNota.trim()) return;
    const nota = {
      texto: nuevaNota.trim(),
      fecha: new Date().toLocaleDateString("es-CR", { dateStyle: "medium" }),
      ...(fechaSeguimiento ? { seguimiento: fechaSeguimiento } : {}),
    };
    const nuevasNotas = [nota, ...notas];
    setNotas(nuevasNotas);
    setNuevaNota("");
    setFechaSeguimiento("");
    onActualizar(cliente.id, { notas: nuevasNotas });

    // Si hay fecha de seguimiento futura, crear evento en el calendario
    if (fechaSeguimiento && token) {
      const hoy = fechaLocal(new Date());
      if (fechaSeguimiento >= hoy) {
        try {
          await fetch(`${BACKEND}/api/eventos`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              titulo:       `📋 Seguimiento: ${cliente.nombre}`,
              descripcion:  nota.texto,
              fecha:        fechaSeguimiento,
              hora:         "09:00",
              tipo:         "recordatorio",
              todo_el_dia:  false,
              color:        "#6366f1",
            }),
          });
        } catch (e) {
          console.warn("[CRM] No se pudo crear evento de seguimiento:", e.message);
        }
      }
    }
  };

  const cambiarEtapa = (nueva) => {
    setEtapa(nueva);
    onActualizar(cliente.id, { etapaCRM: nueva });
  };

  const ei = etapaInfo(etapa);
  const totalFacturado = facturas.reduce((s, f) => s + (f.total || 0), 0);
  const cxcPend = cxc.reduce((s, c) => s + Math.max(0, (c.total || 0) - (c.pagado || 0)), 0);

  const Lista = ({ vacio, children }) => children.length === 0 ? <p className="text-sm text-monki-k/40 text-center py-8">{vacio}</p> : <div className="space-y-1.5">{children}</div>;
  const Fila = ({ icono: Icono, titulo, sub, derecha, alerta }) => (
    <div className="animate-desplegar flex items-center gap-3 p-3 rounded-2xl border-2 border-black/5 hover:border-black/15 transition-colors">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${alerta ? "bg-red-100 text-red-600" : "bg-monki-cream"}`}><Icono size={14}/></span>
      <div className="flex-1 min-w-0"><p className="text-sm font-bold text-monki-k truncate">{titulo}</p><p className="font-mono text-[10px] text-monki-k/45">{sub}</p></div>
      {derecha}
    </div>
  );
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-monki-k/40 backdrop-blur-sm animate-[entrar_.2s_ease]" onClick={onClose} />
      <div className="animate-entrar w-full max-w-[540px] bg-white border-l-2 border-monki-k shadow-[-8px_0_0_#111] flex flex-col overflow-hidden">
        <div className="flex items-start gap-4 px-6 pt-5 pb-4">
          <span className="w-14 h-14 rounded-full bg-monki-y flex items-center justify-center text-monki-k font-black text-xl shrink-0 shadow-[3px_3px_0_#111]">{(cliente.nombre || "?")[0].toUpperCase()}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-monki-k truncate">{cliente.nombre}</h2>
            {cliente.empresa && <p className="text-sm text-monki-k/55 truncate">{cliente.empresa}</p>}
            <div className="flex items-center gap-2 mt-2">
              <select value={etapa} onChange={e => cambiarEtapa(e.target.value)}
                className="text-xs pl-3 pr-7 py-1.5 rounded-full border-2 border-monki-k font-bold cursor-pointer bg-white">
                {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ei.color }}/>
              {cliente.codigoCliente && <span className="font-mono text-[11px] text-monki-k/45">{cliente.codigoCliente}</span>}
            </div>
          </div>
          <BotonIcono icono={X} titulo="Cerrar" onClick={onClose}/>
        </div>

        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {cliente.email    && <span className="flex items-center gap-1.5 text-xs bg-monki-cream rounded-full px-3 py-1"><Mail size={12} />{cliente.email}</span>}
          {cliente.telefono && <span className="flex items-center gap-1.5 text-xs bg-monki-cream rounded-full pl-3 pr-1 py-1"><Phone size={12} />{cliente.telefono}<AccionesTelefono tel={cliente.telefono}/></span>}
          {cliente.cedula   && <span className="flex items-center gap-1.5 text-xs bg-monki-cream rounded-full px-3 py-1 font-mono"><Tag size={12} />{cliente.cedula}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2 px-6 pb-4">
          {[
            { label: "Facturado", value: fmtMoney(totalFacturado), oscuro: true },
            { label: "CXC pendiente", value: fmtMoney(cxcPend), alerta: cxcPend > 0 },
            { label: "Facturas", value: facturas.length },
          ].map(k => (
            <div key={k.label} className={`rounded-2xl p-3 border-2 ${k.oscuro ? "bg-monki-k border-monki-k" : k.alerta ? "border-red-300 bg-white" : "border-black/10 bg-white"}`}>
              <p className={`monki-tag text-[10px] ${k.oscuro ? "text-monki-y/70" : "text-monki-k/50"}`}>{k.label}</p>
              <p className={`text-[15px] font-black mt-0.5 ${k.oscuro ? "text-monki-y" : k.alerta ? "text-red-600" : "text-monki-k"}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="px-6">
          <Pestanas activa={tab} onCambiar={setTab} items={[
            { key: "resumen", label: "Notas" }, { key: "facturas", label: "Facturas", cuenta: facturas.length },
            { key: "cxc", label: "CXC" }, { key: "pedidos", label: "Pedidos" },
          ]}/>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {tab === "resumen" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Entrada value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !fechaSeguimiento && agregarNota()} placeholder="Agregar nota de seguimiento…"/>
                <Boton icono={Plus} onClick={agregarNota} disabled={!nuevaNota.trim()}>Nota</Boton>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-monki-k/40 shrink-0" />
                <Entrada type="date" value={fechaSeguimiento} onChange={e => setFechaSeguimiento(e.target.value)} className="!w-auto !py-1.5"/>
                <span className="text-[11px] text-monki-k/45">{fechaSeguimiento ? "Crea un evento en el calendario" : "Fecha de seguimiento (opcional)"}</span>
              </div>
              {notas.length === 0
                ? <p className="text-sm text-monki-k/40 text-center py-6">Sin notas de seguimiento todavía.</p>
                : notas.map((n, i) => <NotaItem key={i} nota={n} />)}
            </div>
          )}
          {tab === "facturas" && (
            <Lista vacio="Sin facturas registradas.">
              {facturas.map((f, i) => <Fila key={i} icono={Receipt} titulo={f.consecutivo || f.numero || `#${i+1}`} sub={f.fecha} derecha={<b className="text-sm">{fmtMoney(f.total || 0)}</b>}/>)}
            </Lista>
          )}
          {tab === "cxc" && (
            <Lista vacio="Sin cuentas por cobrar.">
              {cxc.map((c, i) => {
                const pend = Math.max(0, (c.total || 0) - (c.pagado || 0));
                const vencida = c.fechaVencimiento && c.fechaVencimiento < fechaLocal(new Date());
                return <Fila key={i} icono={DollarSign} alerta={vencida} titulo={c.descripcion || "CXC"} sub={`Vence ${c.fechaVencimiento || "N/D"}`}
                  derecha={<div className="text-right"><b className={`text-sm ${vencida ? "text-red-600" : ""}`}>{fmtMoney(pend)}</b>{vencida && <div><Estado tono="peligro">Vencida</Estado></div>}</div>}/>;
              })}
            </Lista>
          )}
          {tab === "pedidos" && (
            <Lista vacio="Sin pedidos registrados.">
              {pedidos.map((p, i) => <Fila key={i} icono={ShoppingCart} titulo={p.numero || `Pedido ${i+1}`} sub={p.fecha}
                derecha={<Estado tono={p.estado === "entregado" ? "exito" : p.estado === "cancelado" ? "peligro" : "alerta"}>{p.estado || "pendiente"}</Estado>}/>)}
            </Lista>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Score de cliente ──────────────────────────────────────────────────────────
function calcScore(cliente, facturas, debts) {
  const nombre = (cliente.nombre || "").toLowerCase();
  const match  = x => (x.cliente?.nombre || x.clienteNombre || x.nombre || "").toLowerCase().includes(nombre);
  const fCli   = facturas.filter(match);
  const dCli   = debts.filter(d => d.tipo === "cobrar" && match(d));

  // Volumen: total acumulado (normalizado más adelante en el padre)
  const volumen = fCli.reduce((s, f) => s + (f.total || 0), 0);

  // Frecuencia: facturas en últimos 6 meses
  const hace6m = new Date(); hace6m.setMonth(hace6m.getMonth() - 6);
  const freq = fCli.filter(f => new Date(f.fecha || f.creadoEn || 0) >= hace6m).length;

  // Puntualidad: CXC saldadas a tiempo (pagado >= total antes de vencimiento, approx)
  const saldadas = dCli.filter(d => (d.pagado || 0) >= (d.total || 1));
  const vencidas  = dCli.filter(d => d.fechaVencimiento < fechaLocal(new Date()) && (d.pagado||0) < (d.total||1));
  const puntPct = dCli.length === 0 ? 100 : Math.max(0, 100 - (vencidas.length / Math.max(dCli.length, 1)) * 100);

  return { volumen, freq, puntPct };
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return null;
  const sc = Math.round(score);
  const label = sc >= 80 ? "A" : sc >= 50 ? "B" : "C";
  const cls = sc >= 80 ? "bg-monki-k text-monki-y" : sc >= 50 ? "bg-monki-y text-monki-k" : "bg-red-100 text-red-700";
  return <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${cls}`} title={`Puntaje: ${sc}/100`}>{label} {sc}</span>;
}

function ClienteCard({ cliente, onClick, score }) {
  const ei = etapaInfo(cliente.etapaCRM || ETAPA_DEFAULT);
  return (
    <button type="button" onClick={onClick}
      className="ui-boton animate-desplegar w-full flex items-center gap-3 p-2.5 rounded-2xl border-2 border-transparent hover:border-monki-k hover:bg-white text-left transition-all duration-200">
      <span className="w-9 h-9 rounded-full bg-monki-y flex items-center justify-center text-monki-k font-black text-sm shrink-0">{(cliente.nombre || "?")[0].toUpperCase()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-monki-k truncate">{cliente.nombre}</p>
        <p className="text-[11px] text-monki-k/45 truncate">{cliente.email || cliente.telefono || "Sin contacto"}</p>
      </div>
      <ScoreBadge score={score} />
      <span className="w-2.5 h-2.5 rounded-full shrink-0" title={ei.label} style={{ background: ei.color }}/>
      <ChevronRight size={14} className="text-monki-k/30 shrink-0" />
    </button>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function CRMClientesScreen() {
  const [clientes,  setClientes]  = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [debts,     setDebts]     = useState([]);
  const [busqueda,  setBusqueda]  = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("todos");
  const [seleccionado, setSeleccionado] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [scores,    setScores]    = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.getContactos?.() || Promise.resolve([]),
      db.getFacturas?.()  || Promise.resolve([]),
      db.getDebts?.()     || Promise.resolve([]),
    ]).then(([c, f, d]) => {
      const contactos = c || [];
      const facts     = f || [];
      const ds        = d || [];
      setClientes(contactos);
      setFacturas(facts);
      setDebts(ds);

      // Calcular scores: normalizar volumen contra el máximo
      const raw = contactos.map(cli => ({ id: cli.id, ...calcScore(cli, facts, ds) }));
      const maxVol  = Math.max(...raw.map(r => r.volumen), 1);
      const maxFreq = Math.max(...raw.map(r => r.freq), 1);
      const scoreMap = {};
      raw.forEach(r => {
        const sVol  = (r.volumen / maxVol)  * 40;
        const sFreq = Math.min(r.freq / Math.max(maxFreq, 1), 1) * 30;
        const sPunt = (r.puntPct / 100) * 30;
        scoreMap[r.id] = sVol + sFreq + sPunt;
      });
      setScores(scoreMap);
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
    <Modulo
      seccion="Clientes"
      titulo="CRM"
      descripcion="Seguimiento de clientes por etapa, con su historial de facturas, cobros y notas."
    >
      <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
        <Tarjeta className="w-full lg:w-80 shrink-0 flex flex-col min-h-[320px] lg:min-h-0">
          <div className="p-3 space-y-2 border-b-2 border-black/5">
            <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar cliente…" className="!min-w-0 !max-w-none"/>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setEtapaFiltro("todos")}
                className={`ui-boton px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${etapaFiltro === "todos" ? "bg-monki-k text-monki-y" : "bg-black/5 text-monki-k/60 hover:text-monki-k"}`}>
                Todos <span className="font-mono opacity-70">{clientes.length}</span>
              </button>
              {ETAPAS.map(e => (
                <button key={e.id} type="button" onClick={() => setEtapaFiltro(e.id)}
                  className={`ui-boton inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${etapaFiltro === e.id ? "bg-monki-k text-monki-y" : "bg-black/5 text-monki-k/60 hover:text-monki-k"}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: e.color }}/>{e.label} <span className="font-mono opacity-70">{conteo[e.id] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {loading && <p className="text-xs text-monki-k/40 text-center py-4">Cargando…</p>}
            {!loading && clientesFiltrados.length === 0 && <p className="text-xs text-monki-k/40 text-center py-8">Sin resultados.</p>}
            {clientesFiltrados.map(c => <ClienteCard key={c.id} cliente={c} score={scores[c.id]} onClick={() => setSeleccionado(c)}/>)}
          </div>
        </Tarjeta>

        <Tarjeta className="flex-1 min-h-[320px] flex flex-col items-center justify-center p-6">
          <Vacio icono={User} titulo="Elegí un cliente" texto="Vas a ver su historial de facturas, cuentas por cobrar, pedidos y notas de seguimiento."/>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
            {ETAPAS.map((e, i) => (
              <button key={e.id} type="button" onClick={() => setEtapaFiltro(e.id)} style={{ animationDelay: `${i*40}ms` }}
                className="ui-boton animate-entrar p-3 rounded-2xl border-2 border-black/10 hover:border-monki-k hover:-translate-y-0.5 transition-all duration-300 ease-monki text-left bg-white">
                <span className="flex items-center gap-1.5 monki-tag text-[10px] text-monki-k/55"><span className="w-2 h-2 rounded-full" style={{ background: e.color }}/>{e.label}</span>
                <p className="text-[22px] font-black text-monki-k mt-1">{conteo[e.id] || 0}</p>
              </button>
            ))}
          </div>
        </Tarjeta>
      </div>

      {seleccionado && (
        <ClienteDetalle cliente={seleccionado} onClose={() => setSeleccionado(null)} onActualizar={actualizarCliente}/>
      )}
    </Modulo>
  );
}
