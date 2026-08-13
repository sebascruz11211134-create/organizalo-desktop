/**
 * AdminScreen — Panel exclusivo del superadmin.
 * Solo visible cuando user.email === SUPERADMIN_EMAIL.
 *
 * Muestra: lista de clientes, estado de plan, acciones básicas y notas de soporte.
 * No expone datos de negocio del cliente.
 */
import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { getToken } from "../utils/auth";
import {
  Users, CheckCircle, Clock, AlertCircle, XCircle,
  RefreshCw, ChevronDown, Search, Shield, TrendingUp,
  Database, Trash2, Edit3, Save, Eye, EyeOff, AlertTriangle,
  HardDrive, FileText, Package, UserCheck, DollarSign,
  CreditCard, Landmark, BarChart2, Settings, Copy,
  Key, Plus, ChevronUp,
} from "lucide-react";

import { BACKEND } from "../utils/config";
export const SUPERADMIN_EMAIL = "sebascruz11211134@gmail.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
}

function EstadoBadge({ estado }) {
  const MAP = {
    activo:     { label: "Activo",     bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
    trial:      { label: "En trial",   bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500"    },
    vencido:    { label: "Vencido",    bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"   },
    suspendido: { label: "Suspendido", bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500"     },
  };
  const s = MAP[estado] || MAP.vencido;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  );
}

// ── Mapa de claves → etiquetas legibles ───────────────────────────────────────

const CLAVE_META = {
  facturas:           { label: "Facturas",              icon: FileText,   color: "bg-blue-500"    },
  cotizaciones:       { label: "Cotizaciones",          icon: FileText,   color: "bg-sky-500"     },
  pedidos:            { label: "Pedidos",               icon: Package,    color: "bg-orange-500"  },
  contactos:          { label: "Contactos",             icon: Users,      color: "bg-violet-500"  },
  inventario:         { label: "Inventario",            icon: Package,    color: "bg-emerald-500" },
  recibos:            { label: "Recibos",               icon: FileText,   color: "bg-teal-500"    },
  cxc:                { label: "CXC por cobrar",        icon: DollarSign, color: "bg-green-500"   },
  cxp:                { label: "CXP por pagar",         icon: CreditCard, color: "bg-red-500"     },
  conciliacion:       { label: "Conciliación",          icon: Landmark,   color: "bg-slate-500"   },
  planillas:          { label: "Planillas",             icon: UserCheck,  color: "bg-indigo-500"  },
  empleados:          { label: "Empleados",             icon: UserCheck,  color: "bg-indigo-400"  },
  activos_fijos:      { label: "Activos Fijos",         icon: HardDrive,  color: "bg-amber-500"   },
  asientos:           { label: "Asientos contables",    icon: BarChart2,  color: "bg-purple-500"  },
  configuracion:      { label: "Configuración",         icon: Settings,   color: "bg-slate-600"   },
};

function claveInfo(clave) {
  const key = clave.replace(/^@finanzia\//, "");
  return CLAVE_META[key] || { label: clave, icon: Database, color: "bg-slate-400" };
}

// ── Panel de Soporte Técnico ──────────────────────────────────────────────────

function SoportePanel({ u, token }) {
  const [claves,    setClaves]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [expandida, setExpandida] = useState(null); // clave expandida
  const [detalle,   setDetalle]   = useState({});   // { clave: { valor, loading } }
  const [editando,  setEditando]  = useState(null); // clave en edición
  const [editVal,   setEditVal]   = useState("");
  const [msgOp,     setMsgOp]     = useState("");
  const [opLoading, setOpLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const cargarClaves = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await api.get(`/api/admin/usuarios/${u.id}/datos`, { headers });
      setClaves(res.data.claves || []);
    } catch (e) {
      setError(e.response?.data?.error || "Error al cargar datos.");
    } finally { setLoading(false); }
  }, [u.id, token]);

  useEffect(() => { cargarClaves(); }, [cargarClaves]);

  const verDetalle = async (clave) => {
    if (expandida === clave) { setExpandida(null); return; }
    setExpandida(clave);
    if (detalle[clave]) return;
    setDetalle(d => ({ ...d, [clave]: { loading: true } }));
    try {
      const res = await api.get(`/api/admin/usuarios/${u.id}/datos/${encodeURIComponent(clave)}`, { headers });
      setDetalle(d => ({ ...d, [clave]: { valor: JSON.stringify(res.data.valor, null, 2), loading: false } }));
    } catch (e) {
      setDetalle(d => ({ ...d, [clave]: { error: e.response?.data?.error || "Error", loading: false } }));
    }
  };

  const guardar = async (clave) => {
    setOpLoading(true); setMsgOp("");
    try {
      const parsed = JSON.parse(editVal);
      await api.put(`/api/admin/usuarios/${u.id}/datos/${encodeURIComponent(clave)}`, { valor: parsed }, { headers });
      setDetalle(d => ({ ...d, [clave]: { valor: JSON.stringify(parsed, null, 2), loading: false } }));
      setEditando(null);
      setMsgOp("✅ Guardado correctamente.");
      cargarClaves();
    } catch (e) {
      setMsgOp(e.response?.data?.error || "JSON inválido o error al guardar.");
    } finally { setOpLoading(false); }
  };

  const resetear = async (clave) => {
    if (!window.confirm(`¿Eliminar la clave "${clave}" para este cliente? Esta acción no se puede deshacer.`)) return;
    setOpLoading(true); setMsgOp("");
    try {
      await api.delete(`/api/admin/usuarios/${u.id}/datos/${encodeURIComponent(clave)}`, { headers });
      setMsgOp(`✅ Clave '${clave}' eliminada.`);
      setExpandida(null);
      setDetalle(d => { const nd = { ...d }; delete nd[clave]; return nd; });
      cargarClaves();
    } catch (e) {
      setMsgOp(e.response?.data?.error || "Error al eliminar.");
    } finally { setOpLoading(false); }
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    setMsgOp("📋 Copiado al portapapeles.");
    setTimeout(() => setMsgOp(""), 2000);
  };

  if (loading) return <p className="text-xs text-slate-400 py-4 text-center">Cargando datos del cliente…</p>;
  if (error)   return <p className="text-xs text-red-500 py-4 text-center">{error}</p>;

  if (!u.empresa_id) return (
    <div className="py-4 text-center">
      <AlertTriangle size={20} className="text-amber-400 mx-auto mb-1"/>
      <p className="text-xs text-slate-500">Este cliente no tiene empresa_id asignada aún (nunca hizo sync).</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700">
            {claves.length} módulo{claves.length !== 1 ? "s" : ""} sincronizado{claves.length !== 1 ? "s" : ""}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">{u.empresa_id}</p>
        </div>
        <button onClick={cargarClaves} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <RefreshCw size={11}/> Actualizar
        </button>
      </div>

      {msgOp && (
        <p className={`text-xs px-3 py-1.5 rounded-lg font-medium ${msgOp.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : msgOp.startsWith("📋") ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-600"}`}>
          {msgOp}
        </p>
      )}

      {claves.length === 0 && (
        <p className="text-xs text-slate-400 py-4 text-center">Sin datos sincronizados aún.</p>
      )}

      {/* Lista de claves */}
      {claves.map(k => {
        const meta = claveInfo(k.clave);
        const Icon = meta.icon;
        const abierta = expandida === k.clave;
        const det = detalle[k.clave];
        const enEdicion = editando === k.clave;

        return (
          <div key={k.clave} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Cabecera de clave */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                <Icon size={13} className="text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">{meta.label}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{k.clave}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {k.conteo !== null && (
                  <p className="text-xs font-bold text-slate-700">{k.conteo} reg.</p>
                )}
                <p className="text-[10px] text-slate-400">{(k.tamanoBytes / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => verDetalle(k.clave)}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                  title={abierta ? "Ocultar" : "Ver datos"}
                >
                  {abierta ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
                <button
                  onClick={() => resetear(k.clave)}
                  disabled={opLoading}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  title="Eliminar esta clave (reset)"
                >
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>

            {/* Detalle expandido */}
            {abierta && (
              <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
                {det?.loading && <p className="text-xs text-slate-400">Cargando…</p>}
                {det?.error   && <p className="text-xs text-red-500">{det.error}</p>}
                {det?.valor   && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      {!enEdicion ? (
                        <>
                          <button onClick={() => { setEditando(k.clave); setEditVal(det.valor); }}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 bg-slate-800 text-white rounded-md hover:bg-slate-900">
                            <Edit3 size={10}/> Editar
                          </button>
                          <button onClick={() => copiar(det.valor)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">
                            <Copy size={10}/> Copiar JSON
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => guardar(k.clave)} disabled={opLoading}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60">
                            <Save size={10}/> Guardar
                          </button>
                          <button onClick={() => setEditando(null)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">
                            Cancelar
                          </button>
                        </>
                      )}
                      <p className="text-[10px] text-slate-400 ml-auto">
                        Últ. sync: {k.actualizadoEn ? new Date(k.actualizadoEn).toLocaleString("es-CR") : "—"}
                      </p>
                    </div>

                    {enEdicion ? (
                      <textarea
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        className="w-full font-mono text-[11px] bg-white border border-slate-300 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none text-slate-800"
                        rows={12}
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="text-[10px] font-mono bg-white border border-slate-200 rounded-md p-2 overflow-auto max-h-48 text-slate-700 whitespace-pre-wrap break-all">
                        {det.valor.length > 3000 ? det.valor.slice(0, 3000) + "\n…(truncado)" : det.valor}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fila de cliente expandible ────────────────────────────────────────────────

function FilaCliente({ u, token, onRefresh }) {
  const [expandido,  setExpandido]  = useState(false);
  const [tab,        setTab]        = useState("cuenta"); // "cuenta" | "soporte"
  const [nota,       setNota]       = useState(u.nota_soporte || "");
  const [guardando,  setGuardando]  = useState(false);
  const [accion,     setAccion]     = useState(null); // "activar"|"extender"|"suspender"|"reactivar"
  const [diasExtra,  setDiasExtra]  = useState(7);
  const [msg,        setMsg]        = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const hacer = async (endpoint, body = {}) => {
    setAccion(endpoint);
    setMsg("");
    try {
      const res = await api.post(`/api/admin/usuarios/${u.id}/${endpoint}`, body, { headers });
      setMsg(res.data.mensaje || "Listo.");
      onRefresh();
    } catch (e) {
      setMsg(e.response?.data?.error || "Error.");
    } finally { setAccion(null); }
  };

  const guardarNota = async () => {
    setGuardando(true);
    try {
      await api.post(`/api/admin/usuarios/${u.id}/nota`, { nota }, { headers });
      setMsg("Nota guardada.");
    } catch { setMsg("Error al guardar."); }
    finally { setGuardando(false); }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Fila principal */}
      <button
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setExpandido(e => !e)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
          {(u.nombre || u.email)[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{u.nombre}</p>
          <p className="text-xs text-slate-500 truncate">{u.email}</p>
        </div>

        {/* Empresa */}
        <div className="hidden md:block w-40 flex-shrink-0">
          <p className="text-xs text-slate-600 truncate">{u.empresa_nombre || "—"}</p>
        </div>

        {/* Estado */}
        <div className="flex-shrink-0">
          <EstadoBadge estado={u.estado} />
        </div>

        {/* Trial / vencimiento */}
        <div className="hidden lg:block w-28 flex-shrink-0 text-right">
          {u.estado === "trial" && (
            <p className="text-xs text-blue-600 font-medium">{u.diasRestantes}d restantes</p>
          )}
          {u.estado === "vencido" && (
            <p className="text-xs text-amber-600">Venció {fmt(u.trial_ends)}</p>
          )}
          {u.estado === "activo" && (
            <p className="text-xs text-slate-400">Plan activo</p>
          )}
          {u.estado === "suspendido" && (
            <p className="text-xs text-red-500">Suspendido</p>
          )}
        </div>

        {/* Nota rápida */}
        {nota && (
          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Tiene nota" />
        )}

        <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${expandido ? "rotate-180" : ""}`} />
      </button>

      {/* Panel expandido */}
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 px-4 pt-2">
            {[
              { id: "cuenta",   label: "Cuenta & Plan" },
              { id: "modulos",  label: "🧩 Módulos" },
              { id: "soporte",  label: "🔧 Soporte Técnico" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px
                  ${tab === t.id
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-3 space-y-4">
          {tab === "soporte" ? (
            <SoportePanel u={u} token={token} />
          ) : tab === "modulos" ? (
            <ModulosPanel u={u} token={token} />
          ) : (<>
          {/* Datos de contacto */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Teléfono</p>
              <p className="text-slate-700">{u.telefono || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Registrado</p>
              <p className="text-slate-700">{fmt(u.creado_en)}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Trial termina</p>
              <p className="text-slate-700">{fmt(u.trial_ends)}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-semibold tracking-wide mb-0.5">Empresa ID</p>
              <p className="text-slate-700 font-mono text-[10px] break-all">{u.empresa_id?.slice(0,8) || "—"}…</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2">
            {u.estado !== "activo" && (
              <button
                onClick={() => hacer("activar")}
                disabled={accion === "activar"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle size={12}/> Activar plan
              </button>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => hacer("extender-trial", { dias: diasExtra })}
                disabled={!!accion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <Clock size={12}/> +{diasExtra}d trial
              </button>
              <select
                value={diasExtra}
                onChange={e => setDiasExtra(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 bg-white text-slate-600"
              >
                {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} días</option>)}
              </select>
            </div>

            {u.activo === 1 ? (
              <button
                onClick={() => hacer("suspender")}
                disabled={!!accion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <XCircle size={12}/> Suspender
              </button>
            ) : (
              <button
                onClick={() => hacer("reactivar")}
                disabled={!!accion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <RefreshCw size={12}/> Reactivar
              </button>
            )}
          </div>

          {msg && (
            <p className="text-xs text-emerald-600 font-medium">{msg}</p>
          )}

          {/* Nota de soporte */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Nota de soporte (solo vos la ves)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: Preguntó sobre facturación electrónica. Llamar el lunes."
              rows={2}
              className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none text-slate-700 placeholder-slate-300"
            />
            <button
              onClick={guardarNota}
              disabled={guardando}
              className="mt-1.5 text-xs px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
          </>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Módulos disponibles (mismo orden que Sidebar) ─────────────────────────────

const MODULOS_DISPONIBLES = [
  { id: "facturacion",   label: "Facturación",        desc: "Facturas, cotizaciones, POS, pedidos" },
  { id: "compras",       label: "Compras",             desc: "Facturas de proveedor" },
  { id: "inventario",    label: "Inventario",          desc: "Stock, catálogo, taller" },
  { id: "cxc",           label: "CXC — Por cobrar",    desc: "Gestión de cobros y recibos" },
  { id: "cxp",           label: "CXP — Por pagar",     desc: "Gestión de pagos a proveedores" },
  { id: "bancario",      label: "Control Bancario",    desc: "Conciliación, importar CSV" },
  { id: "maestros",      label: "Contactos",           desc: "Clientes y proveedores" },
  { id: "reportes",      label: "Reportes",            desc: "Estado de cuenta, CXC, recibos, ventas" },
  { id: "rrhh",          label: "RRHH",                desc: "Planillas, empleados, flujo de caja" },
  { id: "contabilidad",  label: "Contabilidad",        desc: "Asientos, balances, D104, presupuesto" },
  { id: "operaciones",   label: "Operaciones",         desc: "Caja, activos fijos, recordatorios" },
  { id: "digital",       label: "Presencia digital",   desc: "Tienda en línea, portal de clientes" },
  { id: "chat",          label: "Chat interno",        desc: "Mensajería por empresa" },
  { id: "asistente",     label: "Asistente IA",        desc: "IA para consultas y análisis" },
];

// ── Panel de Módulos por empresa ──────────────────────────────────────────────

function ModulosPanel({ u, token }) {
  const [modulos,  setModulos]  = useState(null); // null = todos, array = habilitados
  const [loading,  setLoading]  = useState(true);
  const [guardando,setGuardando]= useState(false);
  const [msg,      setMsg]      = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    api.get(`/api/admin/usuarios/${u.id}/modulos`, { headers })
      .then(r => setModulos(r.data.modulosHabilitados))
      .catch(() => setMsg("Error al cargar."))
      .finally(() => setLoading(false));
  }, [u.id]);

  // Si modulos === null, todos están habilitados
  const estaHabilitado = (id) => modulos === null || modulos.includes(id);
  const todosHabilitados = modulos === null;

  const toggle = (id) => {
    if (modulos === null) {
      // Pasar de "todos" a "todos menos este"
      setModulos(MODULOS_DISPONIBLES.map(m => m.id).filter(m => m !== id));
    } else if (modulos.includes(id)) {
      const nuevo = modulos.filter(m => m !== id);
      setModulos(nuevo.length === MODULOS_DISPONIBLES.length ? null : nuevo);
    } else {
      const nuevo = [...modulos, id];
      setModulos(nuevo.length === MODULOS_DISPONIBLES.length ? null : nuevo);
    }
  };

  const habilitarTodos = () => setModulos(null);

  const guardar = async () => {
    setGuardando(true); setMsg("");
    try {
      await api.put(`/api/admin/usuarios/${u.id}/modulos`, { modulos }, { headers });
      setMsg("✅ Módulos guardados.");
    } catch (e) {
      setMsg(e.response?.data?.error || "Error al guardar.");
    } finally { setGuardando(false); }
  };

  if (loading) return <p className="text-xs text-slate-400 py-4 text-center">Cargando…</p>;
  if (!u.empresa_id) return (
    <div className="py-4 text-center">
      <AlertTriangle size={20} className="text-amber-400 mx-auto mb-1"/>
      <p className="text-xs text-slate-500">Sin empresa asignada aún. El cliente debe iniciar sesión al menos una vez.</p>
    </div>
  );

  const habilitados = modulos === null ? MODULOS_DISPONIBLES.length : modulos.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">
          {habilitados}/{MODULOS_DISPONIBLES.length} módulos habilitados
        </p>
        <div className="flex items-center gap-2">
          {!todosHabilitados && (
            <button onClick={habilitarTodos} className="text-[11px] text-emerald-600 hover:underline">
              Habilitar todos
            </button>
          )}
        </div>
      </div>

      {/* Grid de toggles */}
      <div className="grid grid-cols-2 gap-2">
        {MODULOS_DISPONIBLES.map(m => {
          const on = estaHabilitado(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                on
                  ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 opacity-60"
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                on ? "bg-emerald-500" : "bg-slate-300"
              }`}>
                {on && <CheckCircle size={10} className="text-white"/>}
              </div>
              <div className="min-w-0">
                <p className={`text-[11px] font-semibold ${on ? "text-slate-800" : "text-slate-500"}`}>{m.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {msg && (
        <p className={`text-xs px-3 py-1.5 rounded-lg font-medium ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
      >
        <Save size={12}/> {guardando ? "Guardando…" : "Guardar cambios"}
      </button>

      <p className="text-[10px] text-slate-400 text-center">
        Los módulos deshabilitados desaparecen del sidebar del cliente al próximo login.
      </p>
    </div>
  );
}

// ── Panel de Códigos de Acceso ────────────────────────────────────────────────

function CodigosPanel({ token }) {
  const [codigos,       setCodigos]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [generando,     setGenerando]     = useState(false);
  const [msg,           setMsg]           = useState("");
  const [form,          setForm]          = useState({ nombreCliente: "", emailEsperado: "", expiraDias: "", maxUsos: "1" });

  const headers = { Authorization: `Bearer ${token}` };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/codigos`, { headers });
      setCodigos(res.data.codigos || []);
    } catch (e) {
      setMsg("Error al cargar códigos.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) cargar(); }, [cargar, token]);

  const generar = async (e) => {
    e.preventDefault();
    setGenerando(true); setMsg("");
    try {
      const body = {
        nombreCliente: form.nombreCliente.trim() || undefined,
        emailEsperado: form.emailEsperado.trim() || undefined,
        expiraDias:    form.expiraDias ? parseInt(form.expiraDias) : undefined,
        maxUsos:       parseInt(form.maxUsos) || 1,
      };
      const res = await api.post(`/api/admin/codigos`, body, { headers });
      setMsg(`✅ Código generado: ${res.data.codigo} (máx. ${res.data.maxUsos} usuario${res.data.maxUsos !== 1 ? "s" : ""})`);
      setForm({ nombreCliente: "", emailEsperado: "", expiraDias: "", maxUsos: "1" });
      cargar();
    } catch (e) {
      setMsg(e.response?.data?.error || "Error al generar.");
    } finally { setGenerando(false); }
  };

  const revocar = async (id, codigo) => {
    if (!window.confirm(`¿Revocar el código ${codigo}?`)) return;
    try {
      await api.delete(`/api/admin/codigos/${id}`, { headers });
      setMsg(`✅ Código ${codigo} revocado.`);
      cargar();
    } catch (e) {
      setMsg(e.response?.data?.error || "Error al revocar.");
    }
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    setMsg("📋 Código copiado.");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
          <Key size={14} className="text-white"/>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Códigos de Acceso</p>
          <p className="text-[11px] text-slate-400">Generá códigos únicos para que los clientes puedan registrarse.</p>
        </div>
        <button onClick={cargar} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw size={11}/> Actualizar
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Formulario de generación */}
        <form onSubmit={generar} className="bg-slate-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nuevo código</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Cliente (opcional)</label>
              <input
                type="text"
                value={form.nombreCliente}
                onChange={e => setForm(p => ({ ...p, nombreCliente: e.target.value }))}
                placeholder="Ej: Sodería La Palma"
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Email fijo (opcional)</label>
              <input
                type="email"
                value={form.emailEsperado}
                onChange={e => setForm(p => ({ ...p, emailEsperado: e.target.value }))}
                placeholder="cliente@empresa.com"
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Máx. usuarios <span className="text-emerald-600 font-semibold">*</span></label>
              <input
                type="number"
                value={form.maxUsos}
                onChange={e => setForm(p => ({ ...p, maxUsos: e.target.value }))}
                min={1}
                max={100}
                className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Vence en (días, opcional)</label>
              <input
                type="number"
                value={form.expiraDias}
                onChange={e => setForm(p => ({ ...p, expiraDias: e.target.value }))}
                placeholder="Sin vencimiento"
                min={1}
                max={365}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={generando}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            <Plus size={12}/> {generando ? "Generando…" : "Generar código"}
          </button>
        </form>

        {msg && (
          <p className={`text-xs px-3 py-2 rounded-lg font-medium ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : msg.startsWith("📋") ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-600"}`}>
            {msg}
          </p>
        )}

        {/* Lista de códigos */}
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Cargando…</p>
        ) : codigos?.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin códigos generados aún.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{codigos?.length} código{codigos?.length !== 1 ? "s" : ""}</p>
            {codigos?.map(c => {
              const lleno = c.usos_actuales >= c.max_usos;
              const pct   = Math.round((c.usos_actuales / c.max_usos) * 100);
              return (
              <div key={c.id} className={`px-3 py-2.5 rounded-lg border text-xs ${lleno ? "bg-slate-50 border-slate-100 opacity-70" : "bg-white border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  {/* Indicador */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lleno ? "bg-slate-400" : "bg-emerald-500"}`}/>
                  {/* Código */}
                  <span className="font-mono font-bold text-slate-800 tracking-widest w-24 flex-shrink-0">{c.codigo}</span>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {c.nombre_cliente && <p className="text-slate-700 font-medium truncate">{c.nombre_cliente}</p>}
                    {c.email_esperado && <p className="text-slate-400 truncate">{c.email_esperado}</p>}
                    {c.expira_en && <p className="text-slate-400">Vence {fmt(c.expira_en)}</p>}
                  </div>
                  {/* Contador de usuarios */}
                  <div className="text-right flex-shrink-0 w-20">
                    <p className={`font-bold ${lleno ? "text-slate-500" : "text-emerald-600"}`}>
                      {c.usos_actuales}/{c.max_usos}
                    </p>
                    <p className="text-[10px] text-slate-400">{lleno ? "completo" : "usuarios"}</p>
                  </div>
                  {/* Acciones */}
                  {!lleno && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copiar(c.codigo)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title="Copiar código"
                      >
                        <Copy size={12}/>
                      </button>
                      <button
                        onClick={() => revocar(c.id, c.codigo)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600"
                        title="Revocar código"
                      >
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  )}
                </div>
                {/* Barra de progreso */}
                {c.max_usos > 1 && (
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${lleno ? "bg-slate-400" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta de stat ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white"/>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function AdminScreen() {
  const [usuarios,       setUsuarios]       = useState([]);
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [token,          setToken]          = useState("");
  const [busqueda,       setBusqueda]       = useState("");
  const [filtro,         setFiltro]         = useState("todos");
  const [error,          setError]          = useState("");
  const [verCodigos,     setVerCodigos]     = useState(false);

  useEffect(() => {
    getToken().then(t => { if (t) setToken(t); });
  }, []);

  const cargar = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resU, resS] = await Promise.all([
        api.get(`/api/admin/usuarios`, { headers }),
        api.get(`/api/admin/stats`,    { headers }),
      ]);
      setUsuarios(resU.data.usuarios || []);
      setStats(resS.data);
    } catch (e) {
      setError(e.response?.data?.error || "Error al cargar datos.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusqueda = !busqueda || [u.nombre, u.email, u.empresa_nombre].some(
      v => v?.toLowerCase().includes(busqueda.toLowerCase())
    );
    const matchFiltro = filtro === "todos" || u.estado === filtro;
    return matchBusqueda && matchFiltro;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Panel de administración</h1>
            <p className="text-xs text-slate-500">Solo visible para vos · Organízalo.AI</p>
          </div>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""}/>
          Actualizar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total clientes" value={stats.total}      color="bg-slate-700"    icon={Users}       />
          <StatCard label="Activos"         value={stats.activos}    color="bg-emerald-500"  icon={CheckCircle} />
          <StatCard label="En trial"        value={stats.enTrial}    color="bg-blue-500"     icon={Clock}       />
          <StatCard label="Vencidos"        value={stats.vencidos}   color="bg-amber-500"    icon={AlertCircle} />
          <StatCard label="Suspendidos"     value={stats.suspendidos} color="bg-red-500"     icon={XCircle}     />
        </div>
      )}

      {/* Códigos de acceso — toggle */}
      <div>
        <button
          onClick={() => setVerCodigos(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          <Key size={14}/>
          Códigos de Acceso
          {verCodigos ? <ChevronUp size={13} className="text-slate-400"/> : <ChevronDown size={13} className="text-slate-400"/>}
        </button>
        {verCodigos && token && (
          <div className="mt-3">
            <CodigosPanel token={token} />
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email o empresa…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["todos","activo","trial","vencido","suspendido"].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                filtro === f
                  ? "bg-slate-800 text-white"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          <RefreshCw size={18} className="animate-spin mr-2"/> Cargando clientes…
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {busqueda || filtro !== "todos" ? "Sin resultados para ese filtro." : "Sin clientes registrados aún."}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Encabezado */}
          <div className="hidden md:grid grid-cols-[36px_1fr_160px_120px_112px_20px] gap-4 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <div/>
            <div>Cliente</div>
            <div>Empresa</div>
            <div>Estado</div>
            <div className="text-right">Trial / Plan</div>
            <div/>
          </div>
          {usuariosFiltrados.map(u => (
            <FilaCliente key={u.id} u={u} token={token} onRefresh={cargar}/>
          ))}
        </div>
      )}
    </div>
  );
}
