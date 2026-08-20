import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AlarmClock, X, LayoutDashboard, Receipt, Package, DollarSign, Settings, MoreHorizontal } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LoginScreen from "./screens/LoginScreen";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { syncAll, startAutoSync, connectSocket, disconnectSocket } from "./utils/sync";
import { isAuthenticated, verifySession, logout, getUser, getPlanStatus, getModulosHabilitados } from "./utils/auth";

// ── Lazy imports — solo cargan al navegar a cada pantalla ─────────────────────
const DashboardScreen       = lazy(() => import("./screens/DashboardScreen"));
const FacturacionScreen     = lazy(() => import("./screens/FacturacionScreen"));
const CotizacionesScreen    = lazy(() => import("./screens/CotizacionesScreen"));
const POSScreen             = lazy(() => import("./screens/POSScreen"));
const PedidosScreen         = lazy(() => import("./screens/PedidosScreen"));
const FacturasHistScreen    = lazy(() => import("./screens/FacturasHistorialScreen"));
const ComprasScreen         = lazy(() => import("./screens/ComprasScreen"));
const RecepcionScreen       = lazy(() => import("./screens/RecepcionScreen"));
const InventarioScreen      = lazy(() => import("./screens/InventarioScreen"));
const CatalogoScreen        = lazy(() => import("./screens/CatalogoScreen"));
const OrdenesScreen         = lazy(() => import("./screens/OrdenesTrabajoScreen"));
const CXCScreen             = lazy(() => import("./screens/CXCScreen"));
const CXPScreen             = lazy(() => import("./screens/CXPScreen"));
const RecibosScreen         = lazy(() => import("./screens/RecibosScreen"));
const ConciliacionScreen    = lazy(() => import("./screens/ConciliacionScreen"));
const ImportarCSVScreen     = lazy(() => import("./screens/ImportarCSVScreen"));
const ContactosScreen       = lazy(() => import("./screens/ContactosScreen"));
const EmpleadosScreen       = lazy(() => import("./screens/EmpleadosScreen"));
const EstadoCuentaScreen    = lazy(() => import("./screens/EstadoCuentaScreen"));
const NotasCreditoScreen    = lazy(() => import("./screens/NotasCreditoScreen"));
const ReporteCXCScreen      = lazy(() => import("./screens/ReporteCXCScreen"));
const ReporteRecibosScreen  = lazy(() => import("./screens/ReporteRecibosScreen"));
const ReporteVencidosScreen = lazy(() => import("./screens/ReporteVencidosScreen"));
const AnalyticsScreen       = lazy(() => import("./screens/AnalyticsScreen"));
const OnboardingScreen      = lazy(() => import("./screens/OnboardingScreen"));
const MigracionScreen       = lazy(() => import("./screens/MigracionScreen"));
const PlanillasScreen       = lazy(() => import("./screens/PlanillasScreen"));
const FlujoCajaScreen       = lazy(() => import("./screens/FlujoCajaScreen"));
const D104Screen            = lazy(() => import("./screens/D104Screen"));
const CatalogoCuentasScreen = lazy(() => import("./screens/CatalogoCuentasScreen"));
const AsientosScreen        = lazy(() => import("./screens/AsientosScreen"));
const BalancesScreen        = lazy(() => import("./screens/BalancesScreen"));
const UsuariosScreen        = lazy(() => import("./screens/UsuariosScreen"));
const EmpresasScreen        = lazy(() => import("./screens/EmpresasScreen"));
const CajaScreen            = lazy(() => import("./screens/CajaScreen"));
const ActivosFijosScreen    = lazy(() => import("./screens/ActivosFijosScreen"));
const PresupuestoScreen     = lazy(() => import("./screens/PresupuestoScreen"));
const ProyectosScreen       = lazy(() => import("./screens/ProyectosScreen"));
const TiendaScreen          = lazy(() => import("./screens/TiendaScreen"));
const PortalClienteScreen   = lazy(() => import("./screens/PortalClienteScreen"));
const RecordatoriosScreen   = lazy(() => import("./screens/RecordatoriosScreen"));
const AsistenteScreen            = lazy(() => import("./screens/AsistenteScreen"));
const RockyRecepcionistaScreen   = lazy(() => import("./screens/RockyRecepcionistaScreen"));
const WhatsAppScreen             = lazy(() => import("./screens/WhatsAppScreen"));
const CalendarioScreen           = lazy(() => import("./screens/CalendarioScreen"));
const CRMClientesScreen          = lazy(() => import("./screens/CRMClientesScreen"));
const ChatScreen            = lazy(() => import("./screens/ChatScreen"));
const ConfiguracionScreen   = lazy(() => import("./screens/ConfiguracionScreen"));
const AdminScreen           = lazy(() => import("./screens/AdminScreen"));
const ChatWidget            = lazy(() => import("./components/ChatWidget"));
const LibrosLegalesScreen            = lazy(() => import("./screens/LibrosLegalesScreen"));
const KardexScreen                   = lazy(() => import("./screens/KardexScreen"));
const AsistenciaScreen               = lazy(() => import("./screens/AsistenciaScreen"));
const OrdenesCompraScreen            = lazy(() => import("./screens/OrdenesCompraScreen"));
const ReporteHistorialPagosScreen    = lazy(() => import("./screens/ReporteHistorialPagosScreen"));
const ReporteCobrosClienteScreen     = lazy(() => import("./screens/ReporteCobrosClienteScreen"));

// SUPERADMIN_EMAIL se exporta desde AdminScreen — lo duplicamos aquí para no
// necesitar un import síncrono de ese módulo pesado.
const SUPERADMIN_EMAIL = "sebascruz11211134@gmail.com";

const ONBOARDING_KEY = "@finanzia/onboarding_completado";

// ── Spinner de pantalla durante lazy-load ─────────────────────────────────────
function ScreenFallback() {
  return (
    <div className="flex h-full items-center justify-center text-slate-400 text-sm">
      Cargando…
    </div>
  );
}

// ── Títulos por ruta ──────────────────────────────────────────────────────────
const TITULOS = {
  "/":                  "Inicio",
  "/facturacion":       "Facturación electrónica",
  "/cotizaciones":      "Cotizaciones",
  "/pos":               "Punto de Venta",
  "/pedidos":           "Pedidos",
  "/facturas-historial":"Historial de facturas",
  "/compras":           "Facturas de proveedor",
  "/recepcion":         "Recepción de facturas",
  "/inventario":        "Inventario",
  "/catalogo":          "Catálogo de productos",
  "/ordenes":           "Taller — Órdenes de trabajo",
  "/cxc":               "Cuentas por Cobrar (CXC)",
  "/cxp":               "Cuentas por Pagar (CXP)",
  "/recibos":           "Recibos de caja",
  "/conciliacion":      "Conciliación bancaria",
  "/importar-csv":      "Importar estado de cuenta",
  "/contactos":         "Clientes y proveedores",
  "/empleados":         "Empleados",
  "/estado-cuenta":     "Estado de cuenta por cliente",
  "/notas-credito":     "Notas de crédito",
  "/reporte-cxc":       "Reporte CXC",
  "/reporte-recibos":   "Reporte de recibos",
  "/reporte-vencidos":         "Cobros vencidos",
  "/reporte-historial-pagos": "Historial de pagos por cliente",
  "/reporte-cobros-cliente":  "Estado de cobros por cliente",
  "/analytics":               "Análisis de ventas",
  "/migracion":         "Importar datos",
  "/planillas":         "Planillas — Nómina",
  "/flujo-caja":        "Flujo de caja",
  "/d104":              "Declaración D-104 (IVA)",
  "/catalogo-cuentas":  "Catálogo de cuentas",
  "/asientos":          "Asientos contables",
  "/balances":          "Libros contables",
  "/usuarios":          "Usuarios y roles",
  "/empresas":          "Empresas",
  "/caja":              "Control de caja",
  "/activos-fijos":     "Activos fijos",
  "/presupuesto":       "Presupuesto vs Real",
  "/proyectos":         "Proyectos / Centros de costo",
  "/tienda":            "Tienda en línea",
  "/portal-cliente":    "Portal de clientes",
  "/recordatorios":     "Recordatorios de cobro",
  "/asistente":         "Asistente IA",
  "/configuracion":     "Configuración",
  "/calendario":        "Calendario",
  "/crm-clientes":      "CRM — Seguimiento de clientes",
  "/libros-legales":    "Libros legales",
  "/kardex":            "Kardex de inventario",
  "/asistencia":        "Control de asistencia",
  "/ordenes-compra":    "Órdenes de compra",
};

// ── TrialBanner ───────────────────────────────────────────────────────────────
function TrialBanner({ plan }) {
  const [visible, setVisible] = useState(true);
  if (!visible || plan?.plan !== "trial" || plan.daysLeft > 5) return null;

  const urgent = plan.daysLeft <= 1;
  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold
      ${urgent ? "bg-red-500 text-white" : "bg-yellow-400 text-yellow-900"}`}>
      <div className="flex items-center gap-2">
        <AlarmClock size={14} />
        {plan.expired
          ? "Tu prueba gratuita venció. Pagá por SINPE Móvil al 8302-6613 para continuar."
          : `Te quedan ${plan.daysLeft} día${plan.daysLeft!==1?"s":""} de prueba gratuita. Pagá ₡9.900/mes por SINPE al 8302-6613.`}
      </div>
      <button onClick={() => setVisible(false)} className="p-0.5 hover:opacity-70">
        <X size={13} />
      </button>
    </div>
  );
}

// ── Bottom Tab Bar (solo móvil, < 768px) ─────────────────────────────────────
function BottomTabBar() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const tabs = [
    { path: "/",             icon: LayoutDashboard, label: "Inicio"     },
    { path: "/facturacion",  icon: Receipt,         label: "Facturar"   },
    { path: "/inventario",   icon: Package,         label: "Inventario" },
    { path: "/cxc",          icon: DollarSign,      label: "Cobrar"     },
    { path: "/configuracion",icon: Settings,        label: "Más"        },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {tabs.map(tab => {
        const active =
          tab.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors
              ${active ? "text-yellow-600" : "text-slate-400"}`}
          >
            <tab.icon size={20} className={active ? "text-yellow-600" : "text-slate-400"} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [collapsed,          setCollapsed]          = useState(false);
  const [mobileMenuOpen,     setMobileMenuOpen]     = useState(false);
  // Tablet detection (md range: 768–1023px) → sidebar always icon-only
  const [isTablet, setIsTablet] = useState(
    typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024
  );
  useEffect(() => {
    const handler = () => setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [syncStatus,         setSyncStatus]         = useState("idle");
  const [authState,          setAuthState]          = useState("loading"); // "loading" | "authenticated" | "unauthenticated"
  const [user,               setUser]               = useState(null);
  const [plan,               setPlan]               = useState(null);
  const [modulosHabilitados, setModulosHabilitados] = useState(null); // null = todos
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const location = useLocation();

  const titulo = TITULOS[location.pathname] || "Monki.AI";

  // ── Verificar sesión al arrancar ───────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const authed = await isAuthenticated();
      if (!authed) { setAuthState("unauthenticated"); return; }

      // Leer datos locales PRIMERO (instantáneo desde electron-store)
      const [storedUser, planStatus, modulos] = await Promise.all([
        getUser(),
        getPlanStatus(),
        getModulosHabilitados(),
      ]);

      if (!storedUser) { setAuthState("unauthenticated"); return; }

      // Mostrar la app INMEDIATAMENTE con datos cacheados
      window.electronAPI?.window?.loginSuccess?.();
      setUser(storedUser);
      setPlan(planStatus);
      setModulosHabilitados(modulos);
      setShowOnboarding(localStorage.getItem(ONBOARDING_KEY) !== "1");
      setAuthState("authenticated");

      // Verificar sesión en el servidor en BACKGROUND (no bloquea el splash)
      verifySession().then((ok) => {
        if (!ok) return; // si falla red, ignorar — el usuario ya está adentro
        // Refrescar datos si el servidor actualizó algo
        Promise.all([getUser(), getPlanStatus(), getModulosHabilitados()]).then(
          ([u, p, m]) => { setUser(u); setPlan(p); setModulosHabilitados(m); }
        );
      }).catch(() => {});
    }
    checkAuth();
  }, []);

  const handleLogin = useCallback(async (loggedUser, token) => {
    setUser(loggedUser);
    let planStatus;
    if (token) {
      planStatus = await getPlanStatus();
    } else {
      const trialEnds = loggedUser?.trialEnds ? new Date(loggedUser.trialEnds) : new Date(Date.now() + 7 * 86400_000);
      const daysLeft  = Math.max(0, Math.ceil((trialEnds - Date.now()) / 86400_000));
      planStatus = { plan: loggedUser?.plan || "trial", daysLeft, expired: daysLeft === 0 };
    }
    setPlan(planStatus);
    setShowOnboarding(localStorage.getItem(ONBOARDING_KEY) !== "1");
    setAuthState("authenticated");
    if (token) {
      // freshLogin: true → solo pull, no push, para no contaminar esta cuenta
      // con datos residuales de una sesión anterior en el mismo browser
      setSyncStatus("syncing");
      syncAll({ freshLogin: true })
        .then(r => setSyncStatus(r.ok ? "idle" : "error"))
        .catch(() => setSyncStatus("error"));
      // Conectar WebSocket para sync en tiempo real
      connectSocket().catch(console.warn);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    disconnectSocket();   // cerrar WebSocket
    await logout();
    setUser(null);
    setPlan(null);
    // Contraer ventana antes de mostrar login
    window.electronAPI?.window?.logout?.();
    setAuthState("unauthenticated");
  }, []);

  const handleSync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const res = await syncAll();
      setSyncStatus(res.ok ? "idle" : "error");
    } catch {
      setSyncStatus("error");
    }
    setTimeout(() => setSyncStatus("idle"), 3000);
  }, []);

  // Sync inicial + auto-sync cada 3 min (solo si autenticado)
  useEffect(() => {
    if (authState !== "authenticated") return;
    handleSync();
    startAutoSync((res) => setSyncStatus(res.ok ? "idle" : "error"));
  }, [authState]);

  // ── Splash / Loading inicial ───────────────────────────────────────────────
  if (authState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center font-sans overflow-hidden select-none"
        style={{ background: "linear-gradient(135deg, #047857 0%, #059669 40%, #10b981 75%, #34d399 100%)" }}>
        <style>{`
          @keyframes splash-load {
            0%   { transform: translateX(-100%); }
            50%  { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
          .splash-bar { animation: splash-load 1.4s ease-in-out infinite; }
        `}</style>

        <div className="flex flex-col items-center gap-4">
          <svg width="52" height="46" viewBox="0 0 34 30" xmlns="http://www.w3.org/2000/svg">
            <polygon points="17,2 27,8 17,14 7,8"    fill="rgba(255,255,255,0.9)"/>
            <polygon points="27,8 27,20 17,26 17,14"  fill="rgba(255,255,255,0.6)"/>
            <polygon points="7,8 17,14 17,26 7,20"    fill="rgba(255,255,255,0.35)"/>
            <polyline points="17,2 17,14 17,26"        stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
            <polyline points="7,8 17,14 27,8"          stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
            <polyline points="7,20 17,26 27,20"        stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
          </svg>

          <div className="flex items-baseline gap-0.5">
            <span className="text-white font-bold tracking-tight" style={{ fontSize: 22 }}>Monki</span>
            <span className="font-bold text-white/80" style={{ fontSize: 14 }}>.AI</span>
          </div>

          {/* Barra de carga */}
          <div className="mt-2 w-20 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.25)" }}>
            <div className="splash-bar h-full w-full rounded-full" style={{ background: "rgba(255,255,255,0.8)" }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Sin sesión → Login ─────────────────────────────────────────────────────
  if (authState === "unauthenticated") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ── App principal ──────────────────────────────────────────────────────────
  return (
    <CurrencyProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
      <TrialBanner plan={plan} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={collapsed || isTablet}
          onToggle={() => setCollapsed((c) => !c)}
          userEmail={user?.email}
          modulosHabilitados={modulosHabilitados}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar
            title={titulo}
            syncStatus={syncStatus}
            onSync={handleSync}
            user={user}
            onLogout={handleLogout}
            onMobileMenu={() => setMobileMenuOpen((o) => !o)}
          />

          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Suspense fallback={<ScreenFallback />}>
              <Routes>
                <Route path="/"                   element={<DashboardScreen />} />
                <Route path="/facturacion"         element={<FacturacionScreen />} />
                <Route path="/cotizaciones"        element={<CotizacionesScreen />} />
                <Route path="/pos"                 element={<POSScreen />} />
                <Route path="/pedidos"             element={<PedidosScreen />} />
                <Route path="/facturas-historial"  element={<FacturasHistScreen />} />
                <Route path="/compras"             element={<ComprasScreen />} />
                <Route path="/recepcion"           element={<RecepcionScreen />} />
                <Route path="/inventario"          element={<InventarioScreen />} />
                <Route path="/catalogo"            element={<CatalogoScreen />} />
                <Route path="/ordenes"             element={<OrdenesScreen />} />
                <Route path="/cxc"                 element={<CXCScreen />} />
                <Route path="/cxp"                 element={<CXPScreen />} />
                <Route path="/recibos"             element={<RecibosScreen />} />
                <Route path="/conciliacion"        element={<ConciliacionScreen />} />
                <Route path="/importar-csv"        element={<ImportarCSVScreen />} />
                <Route path="/contactos"           element={<ContactosScreen />} />
                <Route path="/empleados"           element={<EmpleadosScreen />} />
                <Route path="/estado-cuenta"       element={<EstadoCuentaScreen />} />
                <Route path="/notas-credito"       element={<NotasCreditoScreen />} />
                <Route path="/reporte-cxc"         element={<ReporteCXCScreen />} />
                <Route path="/reporte-recibos"     element={<ReporteRecibosScreen />} />
                <Route path="/reporte-vencidos"          element={<ReporteVencidosScreen />} />
                <Route path="/reporte-historial-pagos"   element={<ReporteHistorialPagosScreen />} />
                <Route path="/reporte-cobros-cliente"    element={<ReporteCobrosClienteScreen />} />
                <Route path="/analytics"                 element={<AnalyticsScreen />} />
                <Route path="/migracion"           element={<MigracionScreen />} />
                <Route path="/planillas"           element={<PlanillasScreen />} />
                <Route path="/flujo-caja"          element={<FlujoCajaScreen />} />
                <Route path="/d104"                element={<D104Screen />} />
                <Route path="/catalogo-cuentas"    element={<CatalogoCuentasScreen />} />
                <Route path="/asientos"            element={<AsientosScreen />} />
                <Route path="/balances"            element={<BalancesScreen />} />
                <Route path="/usuarios"            element={<UsuariosScreen />} />
                <Route path="/empresas"            element={<EmpresasScreen />} />
                <Route path="/caja"                element={<CajaScreen />} />
                <Route path="/activos-fijos"       element={<ActivosFijosScreen />} />
                <Route path="/presupuesto"         element={<PresupuestoScreen />} />
                <Route path="/proyectos"           element={<ProyectosScreen />} />
                <Route path="/tienda"              element={<TiendaScreen />} />
                <Route path="/portal-cliente"      element={<PortalClienteScreen />} />
                <Route path="/recordatorios"       element={<RecordatoriosScreen />} />
                <Route path="/asistente"           element={<AsistenteScreen />} />
                <Route path="/rocky-asistente"     element={<AsistenteScreen />} />
                <Route path="/rocky-recepcionista" element={<RockyRecepcionistaScreen />} />
                <Route path="/rocky-config"        element={<RockyRecepcionistaScreen />} />
                <Route path="/whatsapp"            element={<WhatsAppScreen />} />
                <Route path="/chat"                element={<ChatScreen />} />
                <Route path="/configuracion"       element={<ConfiguracionScreen />} />
                <Route path="/calendario"          element={<CalendarioScreen />} />
                <Route path="/crm-clientes"        element={<CRMClientesScreen />} />
                <Route path="/libros-legales"      element={<LibrosLegalesScreen />} />
                <Route path="/kardex"              element={<InventarioScreen />} />
                <Route path="/asistencia"          element={<AsistenciaScreen />} />
                <Route path="/ordenes-compra"      element={<OrdenesCompraScreen />} />
                {user?.email === SUPERADMIN_EMAIL && (
                  <Route path="/admin"             element={<AdminScreen />} />
                )}
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>

      {/* Chat flotante — visible en cualquier pantalla */}
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>

      {/* Bottom tab bar — solo móvil */}
      <BottomTabBar />

      {/* Onboarding wizard — solo la primera vez */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingScreen onDone={() => setShowOnboarding(false)} />
        </Suspense>
      )}
    </div>
    </CurrencyProvider>
  );
}
