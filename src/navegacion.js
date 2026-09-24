/**
 * Navegación de Monki: la misma lista de módulos alimenta el menú lateral
 * (computadora) y la pantalla "Más" + barra inferior (celular), para que
 * ambas versiones tengan siempre las mismas herramientas.
 */
import {
  LayoutDashboard, Receipt, FileText, ShoppingCart, Package,
  DollarSign, CreditCard, Landmark, Users, UserCheck,
  BarChart2, TrendingUp, Settings, ChevronDown, ChevronRight,
  Sparkles, Layers, PanelLeftClose, PanelLeftOpen, DatabaseZap,
  BookOpen, Calculator, Building2, Shield, FileCheck,
  Wallet, Wrench, Target, Globe, Bell, PieChart, MessageSquare, Inbox,
  CalendarDays, UserSearch, Bot, Phone, MessageCircle,
} from "lucide-react";

export const NAV = [
  // ── Inicio ──────────────────────────────────────────────────────────────────
  { id: "inicio", label: "Inicio", icon: LayoutDashboard, path: "/", single: true },

  // ── Ventas ──────────────────────────────────────────────────────────────────
  {
    id: "facturacion",
    label: "Facturación",
    icon: Receipt,
    children: [
      { label: "Electrónica",    path: "/facturacion",             icon: Receipt },
      { label: "Nota Débito (ND-01)", path: "/notas-debito-comercial", icon: FileText },
      { label: "Cotizaciones",   path: "/cotizaciones",             icon: FileText },
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
      { label: "Control Bancario",  path: "/control-bancario", icon: Landmark },
      { label: "Conciliación",     path: "/conciliacion",     icon: Landmark },
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
      { label: "Vencidos",           path: "/reporte-vencidos",        icon: TrendingUp },
      { label: "Historial pagos",   path: "/reporte-historial-pagos", icon: Receipt    },
      { label: "Cobros cliente",    path: "/reporte-cobros-cliente",  icon: BarChart2  },
      { label: "Análisis ventas",   path: "/analytics",               icon: TrendingUp },
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
      { label: "WhatsApp",       path: "/whatsapp",            icon: MessageCircle },
      { label: "Configuración",  path: "/rocky-config",        icon: Settings },
    ],
  },

  // ── Configuración ─────────────────────────────────────────────────────────
  { id: "config", label: "Configuración", icon: Settings, path: "/configuracion", single: true },
];

// ── Módulos que siempre se muestran ──────────────────────────────────────────
export const SIEMPRE_VISIBLES = new Set(["inicio", "administracion", "config"]);

// Módulos que el plan de la empresa tiene habilitados (null = todos)
export function navegacionVisible(modulosHabilitados) {
  return modulosHabilitados == null
    ? NAV
    : NAV.filter(item => SIEMPRE_VISIBLES.has(item.id) || modulosHabilitados.includes(item.id));
}

// Lista plana { path, label, icon, grupo } — para buscar y para la barra inferior
export function herramientas(nav = NAV) {
  return nav.flatMap(item => item.single
    ? [{ path: item.path, label: item.label, icon: item.icon, grupo: item.label }]
    : item.children.map(c => ({ ...c, grupo: item.label, iconoGrupo: item.icon })));
}
