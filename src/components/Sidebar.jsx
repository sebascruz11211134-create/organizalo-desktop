import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  LayoutDashboard, Receipt, FileText, ShoppingCart, Package,
  DollarSign, CreditCard, Landmark, Users, UserCheck,
  BarChart2, TrendingUp, Settings, ChevronDown, ChevronRight,
  Sparkles, Layers, PanelLeftClose, PanelLeftOpen, DatabaseZap,
  BookOpen, Calculator, Building2, Shield, FileCheck,
  Wallet, Wrench, Target, Globe, Bell, PieChart, MessageSquare, Inbox,
  CalendarDays, UserSearch, Bot, Phone,
} from "lucide-react";
import { SUPERADMIN_EMAIL } from "../screens/AdminScreen";

const NAV = [
  // ── Inicio ──────────────────────────────────────────────────────────────────
  { id: "inicio", label: "Inicio", icon: LayoutDashboard, path: "/", single: true },

  // ── Ventas ──────────────────────────────────────────────────────────────────
  {
    id: "facturacion",
    label: "Facturación",
    icon: Receipt,
    children: [
      { label: "Electrónica",    path: "/facturacion",        icon: Receipt },
      { label: "Cotizaciones",   path: "/cotizaciones",       icon: FileText },
      { label: "Punto de Venta", path: "/pos",                icon: Layers },
      { label: "Pedidos",        path: "/pedidos",            icon: ShoppingCart },
      { label: "Historial",      path: "/facturas-historial", icon: FileText },
    ],
  },

  // ── Compras ──────────────────────────────────────────────────────────────
  {
    id: "compras",
    label: "Compras",
    icon: ShoppingCart,
    children: [
      { label: "Facturas proveedor", path: "/compras",        icon: ShoppingCart },
      { label: "Órdenes de compra",  path: "/ordenes-compra", icon: FileText },
      { label: "Recepción",          path: "/recepcion",      icon: Inbox },
      { label: "Taller",             path: "/ordenes",        icon: Settings },
    ],
  },

  // ── Inventario ────────────────────────────────────────────────────────────
  {
    id: "inventario",
    label: "Inventario",
    icon: Package,
    children: [
      { label: "Inventario", path: "/inventario", icon: Package },
      { label: "Catálogo",   path: "/catalogo",   icon: FileText },
      { label: "Kardex",     path: "/kardex",     icon: BarChart2 },
    ],
  },

  // ── Clientes (contactos + CRM) ───────────────────────────────────────────
  {
    id: "maestros",
    label: "Clientes",
    icon: Users,
    children: [
      { label: "Contactos", path: "/contactos",    icon: Users },
      { label: "CRM",       path: "/crm-clientes", icon: UserSearch },
    ],
  },

  // ── Calendario ────────────────────────────────────────────────────────────
  { id: "calendario", label: "Calendario", icon: CalendarDays, path: "/calendario", single: true },

  // ── RRHH ─────────────────────────────────────────────────────────────────
  {
    id: "rrhh",
    label: "RRHH",
    icon: UserCheck,
    children: [
      { label: "Planillas",     path: "/planillas",  icon: Calculator },
      { label: "Empleados",     path: "/empleados",  icon: UserCheck },
      { label: "Asistencia",    path: "/asistencia", icon: UserCheck },
      { label: "Flujo de Caja", path: "/flujo-caja", icon: TrendingUp },
    ],
  },

  // ── Contabilidad + Tesorería ──────────────────────────────────────────────
  {
    id: "contabilidad",
    label: "Contabilidad",
    icon: BookOpen,
    children: [
      { label: "Asientos",         path: "/asientos",         icon: BookOpen },
      { label: "Mayor / Balances", path: "/balances",         icon: BarChart2 },
      { label: "Catálogo cuentas", path: "/catalogo-cuentas", icon: FileText },
      { label: "D-104 (IVA)",      path: "/d104",             icon: FileCheck },
      { label: "Libros legales",   path: "/libros-legales",   icon: BookOpen },
      { label: "Presupuesto",      path: "/presupuesto",      icon: PieChart },
      { label: "Proyectos",        path: "/proyectos",        icon: Target },
      { label: "CXC — Cobrar",     path: "/cxc",              icon: DollarSign },
      { label: "Recibos",          path: "/recibos",          icon: Receipt },
      { label: "CXP — Pagar",      path: "/cxp",              icon: CreditCard },
      { label: "Conciliación",     path: "/conciliacion",     icon: Landmark },
      { label: "Importar CSV",     path: "/importar-csv",     icon: FileText },
    ],
  },

  // ── Reportes ─────────────────────────────────────────────────────────────
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart2,
    children: [
      { label: "Estado de cuenta", path: "/estado-cuenta",    icon: FileText },
      { label: "Notas de crédito", path: "/notas-credito",    icon: FileText },
      { label: "CXC",              path: "/reporte-cxc",      icon: BarChart2 },
      { label: "Recibos",          path: "/reporte-recibos",  icon: Receipt },
      { label: "Vencidos",         path: "/reporte-vencidos", icon: TrendingUp },
      { label: "Análisis ventas",  path: "/analytics",        icon: TrendingUp },
    ],
  },

  // ── Operaciones (caja + activos + digital) ────────────────────────────────
  {
    id: "operaciones",
    label: "Operaciones",
    icon: Wallet,
    children: [
      { label: "Control de caja",  path: "/caja",           icon: Wallet },
      { label: "Activos fijos",    path: "/activos-fijos",  icon: Wrench },
      { label: "Recordatorios",    path: "/recordatorios",  icon: Bell },
      { label: "Tienda en línea",  path: "/tienda",         icon: Globe },
      { label: "Portal clientes",  path: "/portal-cliente", icon: Users },
    ],
  },

  // ── Administración ────────────────────────────────────────────────────────
  {
    id: "administracion",
    label: "Administración",
    icon: Building2,
    children: [
      { label: "Empresas",      path: "/empresas",  icon: Building2 },
      { label: "Usuarios",      path: "/usuarios",  icon: Shield },
      { label: "Importar datos",path: "/migracion", icon: DatabaseZap },
      { label: "Chat interno",  path: "/chat",      icon: MessageSquare },
    ],
  },

  // ── Rocky IA ──────────────────────────────────────────────────────────────
  {
    id: "rocky",
    label: "Rocky IA",
    icon: Sparkles,
    children: [
      { label: "Asistente",      path: "/rocky-asistente",     icon: Bot },
      { label: "Recepcionista",  path: "/rocky-recepcionista", icon: Phone },
      { label: "Configuración",  path: "/rocky-config",        icon: Settings },
    ],
  },

  // ── Configuración ─────────────────────────────────────────────────────────
  { id: "config", label: "Configuración", icon: Settings, path: "/configuracion", single: true },
];

// ── Módulos que siempre se muestran ──────────────────────────────────────────
const SIEMPRE_VISIBLES = new Set(["inicio", "administracion", "config"]);

// ── Ítem de primer nivel (single) ─────────────────────────────────────────────
function SingleItem({ item, collapsed }) {
  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150
         ${isActive
           ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
           : "text-slate-300 hover:bg-white/[0.08] hover:text-white"}`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={16}
            className={`shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

// ── Grupo con hijos ────────────────────────────────────────────────────────────
function GroupItem({ item, collapsed }) {
  const location = useLocation();
  const hasActive = item.children?.some(c => location.pathname === c.path);
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      {/* Botón del grupo */}
      <button
        onClick={() => !collapsed && setOpen(o => !o)}
        title={collapsed ? item.label : undefined}
        className={`group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150
          ${hasActive
            ? "text-emerald-300 bg-emerald-500/12"
            : "text-slate-300 hover:bg-white/[0.08] hover:text-white"}`}
      >
        <item.icon
          size={16}
          className={`shrink-0 transition-colors ${hasActive ? "text-emerald-400" : "text-slate-400 group-hover:text-white"}`}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            <span className={`transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}>
              <ChevronDown size={12} className={hasActive ? "text-emerald-400" : "text-slate-600"} />
            </span>
          </>
        )}
        {/* Collapsed: dot indicator si tiene activo */}
        {collapsed && hasActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        )}
      </button>

      {/* Subitems */}
      {!collapsed && open && (
        <div className="mt-0.5 ml-3 pl-4 border-l border-white/10 space-y-px">
          {item.children.map(child => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-100
                 ${isActive
                   ? "text-emerald-300 bg-emerald-500/15"
                   : "text-slate-300 hover:text-white hover:bg-white/[0.06]"}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-1 h-1 rounded-full shrink-0 transition-colors ${isActive ? "bg-emerald-400" : "bg-slate-500"}`} />
                  <span className="truncate">{child.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar principal ──────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, onToggle, userEmail, modulosHabilitados, mobileOpen, onMobileClose }) {
  const esSuperAdmin = userEmail === SUPERADMIN_EMAIL;
  const { moneda, setMoneda, tipoCambio, cargando } = useCurrency();
  const location = useLocation();

  // Cerrar sidebar móvil al navegar
  useEffect(() => { onMobileClose && onMobileClose(); }, [location.pathname]);

  const navVisible = modulosHabilitados === null
    ? NAV
    : NAV.filter(item => SIEMPRE_VISIBLES.has(item.id) || modulosHabilitados.includes(item.id));

  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50
        flex flex-col shrink-0 transition-all duration-200 overflow-hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        ${collapsed ? "w-14" : "w-56"}
      `}
      style={{
        background: "linear-gradient(180deg, #0d1829 0%, #0f1f2e 50%, #0b1620 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Glow decorativo top */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(16,185,129,0.12) 0%, transparent 70%)" }}
      />

      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div className="drag-region relative flex items-center gap-2.5 pt-4 pb-4" style={{ paddingLeft: collapsed ? 14 : 76, paddingRight: 14 }}>
        {/* Cubo isométrico */}
        <svg width="28" height="26" viewBox="0 0 34 30" className="shrink-0" xmlns="http://www.w3.org/2000/svg">
          {/* Cara superior */}
          <polygon points="17,2 27,8 17,14 7,8" fill="#2aadad"/>
          {/* Cara derecha */}
          <polygon points="27,8 27,20 17,26 17,14" fill="#1a8888"/>
          {/* Cara izquierda */}
          <polygon points="7,8 17,14 17,26 7,20" fill="#116060"/>
          {/* Bordes */}
          <polyline points="17,2 17,14 17,26" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8"/>
          <polyline points="7,8 17,14 27,8"   stroke="rgba(255,255,255,0.22)" strokeWidth="0.8"/>
          <polyline points="7,20 17,26 27,20"  stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
        </svg>
        {!collapsed && (
          <div className="min-w-0 flex items-baseline gap-0.5">
            <p className="text-[14px] font-semibold text-white leading-none tracking-tight whitespace-nowrap">Organízalo</p>
            <span className="text-[10px] font-bold leading-none" style={{ color: "#84cc16" }}>.AI</span>
          </div>
        )}
      </div>

      {/* ── Divisor ─────────────────────────────────────────────────────────── */}
      <div className="mx-3 mb-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {navVisible.map(item =>
          item.single
            ? <SingleItem key={item.id} item={item} collapsed={collapsed} />
            : <GroupItem  key={item.id} item={item} collapsed={collapsed} />
        )}

        {/* Panel admin — solo superadmin */}
        {esSuperAdmin && (
          <>
            <div className="mx-1 my-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
            <NavLink
              to="/admin"
              title={collapsed ? "Admin" : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all
                 ${isActive ? "bg-amber-500/20 text-amber-300" : "text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-300"}`
              }
            >
              <Shield size={16} className="shrink-0" />
              {!collapsed && <span>Panel Admin</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* ── Usuario ─────────────────────────────────────────────────────────── */}
      {!collapsed && userEmail && (
        <>
          <div className="mx-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
          <div className="px-3 py-3 flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-emerald-100"
              style={{ background: "rgba(16,185,129,0.25)" }}
            >
              {userEmail[0].toUpperCase()}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
          </div>
        </>
      )}

      {/* ── Selector de moneda ₡ | $ ────────────────────────────────────────── */}
      <div className="mx-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
      {collapsed ? (
        /* Colapsado: solo el toggle pequeño centrado */
        <div className="flex flex-col items-center gap-0.5 py-2">
          <button onClick={() => setMoneda("CRC")} title="Colones"
            className={`w-7 h-6 rounded text-[11px] font-bold transition-all ${moneda==="CRC" ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-200"}`}>₡</button>
          <button onClick={() => setMoneda("USD")} title="Dólares"
            className={`w-7 h-6 rounded text-[11px] font-bold transition-all ${moneda==="USD" ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-200"}`}>$</button>
        </div>
      ) : (
        /* Expandido: tarjeta con tipo de cambio + toggle */
        <div className="mx-3 my-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
          {tipoCambio ? (
            <div className="mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Tipo de cambio BCCR</p>
              <div className="flex justify-between">
                <div>
                  <p className="text-[9px] text-slate-500">Compra</p>
                  <p className="text-[12px] font-semibold text-emerald-400">₡{tipoCambio.compra?.toLocaleString("es-CR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500">Venta</p>
                  <p className="text-[12px] font-semibold text-slate-200">₡{tipoCambio.venta?.toLocaleString("es-CR")}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-slate-600 mb-2">{cargando ? "Cargando tipo de cambio…" : "Tipo de cambio no disponible"}</p>
          )}
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-slate-500 flex-1">Mostrar en:</p>
            <div className="flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5">
              <button onClick={() => setMoneda("CRC")} title="Colones"
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${moneda==="CRC" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-200"}`}>
                ₡ CRC
              </button>
              <button onClick={() => setMoneda("USD")} title="Dólares"
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${moneda==="USD" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-200"}`}>
                $ USD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle ──────────────────────────────────────────────────────────── */}
      <div className="mx-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
      <button
        onClick={onToggle}
        className="no-drag flex items-center justify-center h-9 text-slate-500 hover:text-slate-200 transition-colors"
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed
          ? <PanelLeftOpen size={14} />
          : <PanelLeftClose size={14} />}
      </button>
    </aside>
    </>
  );
}
