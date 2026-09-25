import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AlarmClock, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import BarraInferior from "./components/NavegacionMovil";
import { navegacionVisible } from "./navegacion";
import LoginScreen from "./screens/LoginScreen";
import { useIdioma } from "./utils/idioma";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { syncAll, startAutoSync, connectSocket, disconnectSocket, processQueue, onSyncUpdate, cambiosSinSubir } from "./utils/sync";
import { useConfirmar } from "./components/ui";
import { datosSinDueno, adoptarDatosSinDueno } from "./utils/almacen";
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
const ControlBancarioScreen = lazy(() => import("./screens/ControlBancarioScreen"));
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
const RockyConfiguracionScreen   = lazy(() => import("./screens/RockyConfiguracionScreen"));
const WhatsAppScreen             = lazy(() => import("./screens/WhatsAppScreen"));
const CalendarioScreen           = lazy(() => import("./screens/CalendarioScreen"));
const CRMClientesScreen          = lazy(() => import("./screens/CRMClientesScreen"));
const ChatScreen            = lazy(() => import("./screens/ChatScreen"));
const ConfiguracionScreen   = lazy(() => import("./screens/ConfiguracionScreen"));
const MasScreen             = lazy(() => import("./screens/MasScreen"));
const AdminScreen           = lazy(() => import("./screens/AdminScreen"));
// ChatWidget eliminado — el chat está en el menú lateral
const LibrosLegalesScreen            = lazy(() => import("./screens/LibrosLegalesScreen"));
const KardexScreen                   = lazy(() => import("./screens/KardexScreen"));
const AsistenciaScreen               = lazy(() => import("./screens/AsistenciaScreen"));
const OrdenesCompraScreen            = lazy(() => import("./screens/OrdenesCompraScreen"));
const ReporteHistorialPagosScreen    = lazy(() => import("./screens/ReporteHistorialPagosScreen"));
const ReporteCobrosClienteScreen     = lazy(() => import("./screens/ReporteCobrosClienteScreen"));
const NotaDebitoComercialScreen      = lazy(() => import("./screens/NotaDebitoComercialScreen"));

// SUPERADMIN_EMAIL se exporta desde AdminScreen — lo duplicamos aquí para no
// necesitar un import síncrono de ese módulo pesado.
const SUPERADMIN_EMAIL = "sebascruz11211134@gmail.com";

const ONBOARDING_KEY = "@finanzia/onboarding_completado";

// ── Error boundary — atrapa crashes de cualquier pantalla ────────────────────
class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err) { console.error("[ScreenErrorBoundary]", err); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-3 p-8 text-center">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-slate-700">Esta pantalla tuvo un error al cargar</p>
          <p className="text-xs text-slate-400 max-w-xs">{this.state.error?.message || "Error desconocido"}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="mt-2 px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700">
            Recargar app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  "/control-bancario":        "Control Bancario",
  "/notas-debito-comercial":  "Notas de Débito Comercial (ND-01)",
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
  "/mas":               "Herramientas",
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
  // Si algo no se pudo guardar en el dispositivo (p. ej. sin espacio), avisar en vez de callar
  const [errorAlmacen,       setErrorAlmacen]       = useState(false);
  const { confirmar: confirmarApp, dialogo: dialogoApp } = useConfirmar();
  // Si en otra pestaña entra otra cuenta o se cierra la sesión, esta pestaña
  // se recarga: nunca sigue mostrando ni guardando datos de la sesión anterior.
  useEffect(() => {
    const alCambiar = (e) => { if (e.key === "monki:sesion" && e.oldValue !== e.newValue) window.location.reload(); };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);
  useEffect(() => {
    const avisar = (e) => setErrorAlmacen(e?.detail?.mensaje || "No se pudo guardar un cambio en este dispositivo (¿poco espacio?). Liberá espacio o sincronizá antes de seguir.");
    window.addEventListener("monki:almacen-error", avisar);
    return () => window.removeEventListener("monki:almacen-error", avisar);
  }, []);
  const [unreadChat,         setUnreadChat]         = useState(0);
  const [authState,          setAuthState]          = useState("loading"); // "loading" | "authenticated" | "unauthenticated"
  // Datos de una sesión anterior cuyo dueño no se pudo identificar: no se
  // adivina, se pregunta. Si la respuesta es "No", quedan intactos en el equipo.
  useEffect(() => {
    if (authState !== "authenticated" || !datosSinDueno()) return;
    (async () => {
      const son = await confirmarApp("Datos de una sesión anterior",
        "Este equipo tiene datos guardados de una sesión anterior que no se pudieron identificar. ¿Son de esta empresa? Si no estás seguro, elegí Cancelar: quedan guardados sin tocarse.",
        { boton: "Sí, son de esta empresa" });
      if (son) { await adoptarDatosSinDueno(); window.location.reload(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const [user,               setUser]               = useState(null);
  const [plan,               setPlan]               = useState(null);
  const [modulosHabilitados, setModulosHabilitados] = useState(null); // null = todos
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const location = useLocation();

  const { tr } = useIdioma();
  const titulo = tr(TITULOS[location.pathname] || "Monki.AI");

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
      // freshLogin: true → solo pull, no push
      setSyncStatus("syncing");
      syncAll({ freshLogin: true })
        .then(r => setSyncStatus(r.ok ? "idle" : "error"))
        .catch(() => setSyncStatus("error"));
      // Procesar cualquier dato que quedó pendiente de sesión anterior
      processQueue().catch(console.warn);
      // Conectar WebSocket para sync en tiempo real
      connectSocket().catch(console.warn);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    // Antes de salir, subir lo pendiente. Si no se puede, preguntar: y si sale
    // igual, los datos de esta empresa quedan guardados aparte en este equipo.
    let conservarDatos = false;
    try {
      await syncAll();
      if (await cambiosSinSubir()) {
        if (window.electronAPI?.store) {
          // En la app de escritorio no hay espacios por empresa: salir borraría esos cambios
          await confirmarApp("Cambios sin subir",
            "Hay cambios en este equipo que todavía no se subieron al servidor. Conectate a internet y volvé a intentar cerrar sesión para no perderlos.",
            { boton: "Entendido" });
          return;
        }
        const salir = await confirmarApp("Cambios sin subir",
          "Hay cambios en este equipo que todavía no se subieron al servidor (¿sin internet?). Si salís igual, quedan guardados aquí y se suben la próxima vez que entres con esta empresa en este equipo.",
          { boton: "Salir igual" });
        if (!salir) return;
        conservarDatos = true;
      }
    } catch {
      // No se pudo comprobar: en Electron salir borraría los datos, así que no se sale
      if (window.electronAPI?.store) {
        await confirmarApp("Cambios sin subir",
          "Hay cambios en este equipo que todavía no se subieron al servidor. Conectate a internet y volvé a intentar cerrar sesión para no perderlos.",
          { boton: "Entendido" });
        return;
      }
      conservarDatos = true;
    }
    disconnectSocket();   // cerrar WebSocket
    await logout({ conservarDatos });
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

  // Sync inicial + auto-sync cada 30s (solo si autenticado)
  useEffect(() => {
    if (authState !== "authenticated") return;
    // No llamar handleSync() aquí — startAutoSync ya hace el primer sync
    // Escuchar cambios de estado internos (queued, offline, idle, error)
    const unsub = onSyncUpdate(({ status }) => {
      if (status) setSyncStatus(status);
    });
    startAutoSync((res) => {
      if (!res.ok) setSyncStatus("error");
    });
    return () => { unsub(); };
  }, [authState]);

  // Polling mensajes no leídos cada 30s
  useEffect(() => {
    if (authState !== "authenticated") return;
    const fetchUnread = async () => {
      try {
        const { getToken } = await import("./utils/auth");
        const { BACKEND }  = await import("./utils/config");
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${BACKEND}/api/chat/no-leidos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setUnreadChat(d.total || 0);
        }
      } catch {}
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
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
    <div className="flex flex-col h-screen overflow-hidden bg-monki-app font-sans">
      <TrialBanner plan={plan} />
      {errorAlmacen && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-red-600 text-white text-xs font-semibold shrink-0">
          <span>⚠ {tr(errorAlmacen)}</span>
          <button onClick={() => setErrorAlmacen(false)} className="p-0.5 hover:opacity-70" aria-label={tr("Cerrar")}><X size={13} /></button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={collapsed || isTablet}
          onToggle={() => setCollapsed((c) => !c)}
          userEmail={user?.email}
          modulosHabilitados={modulosHabilitados}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          unreadChat={unreadChat}
          onChatOpen={() => setUnreadChat(0)}
          syncStatus={syncStatus}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar
            title={titulo}
            syncStatus={syncStatus}
            onSync={handleSync}
            user={user}
            onLogout={handleLogout}
            onMobileMenu={() => setMobileMenuOpen((o) => !o)}
            onUserUpdate={(updated) => { setUser(updated); localStorage.setItem("user", JSON.stringify(updated)); }}
          />

          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <ScreenErrorBoundary>
            <Suspense fallback={<ScreenFallback />}>
              <div key={location.pathname} className="monki-pantalla h-full">
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
                <Route path="/control-bancario"         element={<ControlBancarioScreen />} />
                <Route path="/notas-debito-comercial"   element={<NotaDebitoComercialScreen />} />
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
                <Route path="/rocky-config"        element={<RockyConfiguracionScreen />} />
                <Route path="/whatsapp"            element={<WhatsAppScreen />} />
                <Route path="/chat"                element={<ChatScreen />} />
                <Route path="/configuracion"       element={<ConfiguracionScreen />} />
                <Route path="/mas"                 element={<MasScreen modulosHabilitados={modulosHabilitados} esSuperAdmin={user?.email === SUPERADMIN_EMAIL} />} />
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
              </div>
            </Suspense>
            </ScreenErrorBoundary>
          </main>
        </div>
      </div>

      {/* Barra inferior + acciones rápidas — solo celular */}
      <BarraInferior modulos={navegacionVisible(modulosHabilitados)} />
      {dialogoApp}

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
