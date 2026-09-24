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
  CalendarDays, UserSearch, Bot, Phone, MessageCircle,
} from "lucide-react";
import { SUPERADMIN_EMAIL } from "../screens/AdminScreen";
import { useIdioma } from "../utils/idioma";
import { navegacionVisible } from "../navegacion";

// ── Ítem de primer nivel (single) ─────────────────────────────────────────────
function SingleItem({ item, collapsed, badge = 0, onNavigate }) {
  const { tr } = useIdioma();
  return (
    <NavLink
      to={item.path}
      title={collapsed ? tr(item.label) : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 ease-monki
         ${isActive
           ? "bg-monki-y text-monki-k shadow-[4px_4px_0_rgba(255,214,0,0.25)]"
           : "text-slate-300 hover:bg-white/[0.08] hover:text-white hover:translate-x-1"}`
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative shrink-0">
            <item.icon
              size={16}
              className={`transition-all duration-300 ${isActive ? "text-monki-k" : "text-slate-400 group-hover:text-monki-y group-hover:scale-110"}`}
            />
            {/* Badge de mensajes no leídos */}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          {!collapsed && <span className="flex-1 truncate">{tr(item.label)}</span>}
          {!collapsed && badge > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
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
  const { tr } = useIdioma();

  return (
    <div>
      {/* Botón del grupo */}
      <button
        onClick={() => !collapsed && setOpen(o => !o)}
        title={collapsed ? tr(item.label) : undefined}
        className={`group w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 ease-monki
          ${hasActive
            ? "text-monki-y bg-monki-y/10"
            : "text-slate-300 hover:bg-white/[0.08] hover:text-white hover:translate-x-1"}`}
      >
        <item.icon
          size={16}
          className={`shrink-0 transition-all duration-300 ${hasActive ? "text-monki-y" : "text-slate-400 group-hover:text-monki-y group-hover:scale-110"}`}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{tr(item.label)}</span>
            <span className={`transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}>
              <ChevronDown size={12} className={hasActive ? "text-monki-y" : "text-slate-600"} />
            </span>
          </>
        )}
        {/* Collapsed: dot indicator si tiene activo */}
        {collapsed && hasActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-monki-y shrink-0" />
        )}
      </button>

      {/* Subitems */}
      {!collapsed && open && (
        <div className="mt-0.5 ml-3 pl-4 border-l border-white/10 space-y-px animate-desplegar">
          {item.children.map(child => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 ease-monki
                 ${isActive
                   ? "text-monki-k bg-monki-y font-semibold"
                   : "text-slate-300 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5"}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-1 h-1 rounded-full shrink-0 transition-colors ${isActive ? "bg-monki-k" : "bg-slate-500"}`} />
                  <span className="truncate">{tr(child.label)}</span>
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
export default function Sidebar({ collapsed, onToggle, userEmail, modulosHabilitados, mobileOpen, onMobileClose, unreadChat = 0, onChatOpen, syncStatus = "idle" }) {
  const esSuperAdmin = userEmail === SUPERADMIN_EMAIL;
  const { moneda, setMoneda, tipoCambio, cargando } = useCurrency();
  const { tr } = useIdioma();
  const location = useLocation();

  // Cerrar sidebar móvil al navegar
  useEffect(() => { onMobileClose && onMobileClose(); }, [location.pathname]);

  const navVisible = navegacionVisible(modulosHabilitados);

  return (
    <aside
      className={`
        hidden md:flex flex-col shrink-0 transition-all duration-200 overflow-hidden
        ${collapsed ? "w-14" : "w-56"}
      `}
      style={{
        background: "#111111",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Glow decorativo top */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(255,214,0,0.14) 0%, transparent 70%)" }}
      />

      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div className="drag-region relative flex items-center gap-2.5 pt-4 pb-4" style={{ paddingLeft: collapsed ? 14 : 76, paddingRight: 14 }}>
        <img src="/MK_Logo2.png" alt="Monki" className="shrink-0 transition-transform duration-500 ease-monki hover:rotate-[-8deg] hover:scale-110" style={{ width: 32, height: 32, objectFit: "contain" }} />
        {!collapsed && (
          <div className="min-w-0 flex items-baseline">
            <p className="text-[19px] font-black text-white leading-none tracking-[-0.04em] whitespace-nowrap">MONKI<span className="text-monki-y">.</span></p>
            <span className="ml-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-monki-y/80">ERP</span>
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

        {/* ── Chat interno (ítem independiente con badge) ── */}
        <div className="mx-1 my-1" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <SingleItem
          item={{ id: "chat", label: "Chat interno", path: "/chat", icon: MessageSquare }}
          collapsed={collapsed}
          badge={unreadChat}
          onNavigate={onChatOpen}
        />

        {/* Panel admin — solo superadmin */}
        {esSuperAdmin && (
          <>
            <div className="mx-1 my-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
            <NavLink
              to="/admin"
              title={collapsed ? "Admin" : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all
                 ${isActive ? "bg-monki-y text-monki-k" : "text-monki-y/70 hover:bg-monki-y/10 hover:text-monki-y"}`
              }
            >
              <Shield size={16} className="shrink-0" />
              {!collapsed && <span>{tr("Panel Admin")}</span>}
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
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black bg-monki-y text-monki-k"
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
          <button onClick={() => setMoneda("CRC")} title={tr("Colones")}
            className={`w-7 h-6 rounded text-[11px] font-bold transition-all ${moneda==="CRC" ? "bg-monki-y text-monki-k" : "text-slate-500 hover:text-slate-200"}`}>₡</button>
          <button onClick={() => setMoneda("USD")} title={tr("Dólares")}
            className={`w-7 h-6 rounded text-[11px] font-bold transition-all ${moneda==="USD" ? "bg-monki-y text-monki-k" : "text-slate-500 hover:text-slate-200"}`}>$</button>
        </div>
      ) : (
        /* Expandido: tarjeta con tipo de cambio + toggle */
        <div className="mx-3 my-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
          {tipoCambio ? (
            <div className="mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                {tr(tipoCambio.fallback ? "Tipo de cambio BCCR (aprox.)" : "Tipo de cambio BCCR")}
              </p>
              <div className="flex justify-between">
                <div>
                  <p className="text-[9px] text-slate-400">{tr("Compra")}</p>
                  <p className="text-[12px] font-semibold text-monki-y">₡{tipoCambio.compra?.toLocaleString("es-CR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400">{tr("Venta")}</p>
                  <p className="text-[12px] font-semibold text-white">₡{tipoCambio.venta?.toLocaleString("es-CR")}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 mb-2">{tr(cargando ? "Cargando tipo de cambio…" : "Tipo de cambio no disponible")}</p>
          )}
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-slate-400 flex-1">{tr("Mostrar en:")}</p>
            <div className="flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5">
              <button onClick={() => setMoneda("CRC")} title={tr("Colones")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${moneda==="CRC" ? "bg-monki-y text-monki-k shadow-sm" : "text-slate-400 hover:text-white"}`}>
                ₡ CRC
              </button>
              <button onClick={() => setMoneda("USD")} title={tr("Dólares")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${moneda==="USD" ? "bg-monki-y text-monki-k shadow-sm" : "text-slate-400 hover:text-white"}`}>
                $ USD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync dot — solo visible cuando hay algo que el usuario deba saber ── */}
      {(syncStatus === "queued" || syncStatus === "offline" || syncStatus === "error") && (
        <div className={`flex items-center justify-center py-1.5 gap-1.5 ${collapsed ? "" : "px-3"}`}>
          <span
            title={
              syncStatus === "queued"  ? "Guardando localmente…"
              : syncStatus === "offline" ? "Sin conexión"
              : "Sin conexión al servidor"
            }
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              syncStatus === "queued"  ? "bg-yellow-300 animate-pulse"
              : syncStatus === "offline" ? "bg-slate-400"
              : "bg-slate-400"
            }`}
          />
          {!collapsed && (
            <span className="text-[10px] text-slate-400">
              {tr(syncStatus === "queued" ? "Guardando…" : "Sin conexión")}
            </span>
          )}
        </div>
      )}

      {/* ── Toggle ──────────────────────────────────────────────────────────── */}
      <div className="mx-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
      <button
        onClick={onToggle}
        className="no-drag flex items-center justify-center h-9 text-slate-500 hover:text-slate-200 transition-colors"
        title={tr(collapsed ? "Expandir menú" : "Colapsar menú")}
      >
        {collapsed
          ? <PanelLeftOpen size={14} />
          : <PanelLeftClose size={14} />}
      </button>
    </aside>
  );
}
