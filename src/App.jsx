import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AlarmClock, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LoginScreen from "./screens/LoginScreen";
import { syncAll, startAutoSync, connectSocket, disconnectSocket } from "./utils/sync";
import { isAuthenticated, verifySession, logout, getUser, getPlanStatus, getModulosHabilitados } from "./utils/auth";

// ── Screens ───────────────────────────────────────────────────────────────────
import DashboardScreen      from "./screens/DashboardScreen";
import FacturacionScreen    from "./screens/FacturacionScreen";
import CotizacionesScreen   from "./screens/CotizacionesScreen";
import POSScreen            from "./screens/POSScreen";
import PedidosScreen        from "./screens/PedidosScreen";
import FacturasHistScreen   from "./screens/FacturasHistorialScreen";
import ComprasScreen        from "./screens/ComprasScreen";
import InventarioScreen     from "./screens/InventarioScreen";
import CatalogoScreen       from "./screens/CatalogoScreen";
import OrdenesScreen        from "./screens/OrdenesTrabajoScreen";
import CXCScreen            from "./screens/CXCScreen";
import CXPScreen            from "./screens/CXPScreen";
import RecibosScreen        from "./screens/RecibosScreen";
import ConciliacionScreen   from "./screens/ConciliacionScreen";
import ImportarCSVScreen    from "./screens/ImportarCSVScreen";
import ContactosScreen      from "./screens/ContactosScreen";
import EmpleadosScreen      from "./screens/EmpleadosScreen";
import EstadoCuentaScreen   from "./screens/EstadoCuentaScreen";
import NotasCreditoScreen   from "./screens/NotasCreditoScreen";
import ReporteCXCScreen     from "./screens/ReporteCXCScreen";
import ReporteRecibosScreen from "./screens/ReporteRecibosScreen";
import ReporteVencidosScreen from "./screens/ReporteVencidosScreen";
import AnalyticsScreen      from "./screens/AnalyticsScreen";
import MigracionScreen      from "./screens/MigracionScreen";
import PlanillasScreen      from "./screens/PlanillasScreen";
import D104Screen           from "./screens/D104Screen";
import CatalogoCuentasScreen from "./screens/CatalogoCuentasScreen";
import AsientosScreen       from "./screens/AsientosScreen";
import BalancesScreen       from "./screens/BalancesScreen";
import UsuariosScreen       from "./screens/UsuariosScreen";
import EmpresasScreen       from "./screens/EmpresasScreen";
import CajaScreen           from "./screens/CajaScreen";
import ActivosFijosScreen   from "./screens/ActivosFijosScreen";
import PresupuestoScreen    from "./screens/PresupuestoScreen";
import ProyectosScreen      from "./screens/ProyectosScreen";
import TiendaScreen         from "./screens/TiendaScreen";
import PortalClienteScreen  from "./screens/PortalClienteScreen";
import RecordatoriosScreen  from "./screens/RecordatoriosScreen";
import AsistenteScreen           from "./screens/AsistenteScreen";
import RockyRecepcionistaScreen  from "./screens/RockyRecepcionistaScreen";
import CalendarioScreen          from "./screens/CalendarioScreen";
import CRMClientesScreen         from "./screens/CRMClientesScreen";
import ChatScreen           from "./screens/ChatScreen";
import ConfiguracionScreen  from "./screens/ConfiguracionScreen";
import AdminScreen, { SUPERADMIN_EMAIL } from "./screens/AdminScreen";
import ChatWidget           from "./components/ChatWidget";
import FlujoCajaScreen      from "./screens/FlujoCajaScreen";
import RecepcionScreen      from "./screens/RecepcionScreen";

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
  "/reporte-vencidos":  "Cobros vencidos",
  "/analytics":         "Análisis de ventas",
  "/migracion":         "Importar datos",
  "/planillas":         "Planillas — Nómina",
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
};

// ── TrialBanner ───────────────────────────────────────────────────────────────

function TrialBanner({ plan }) {
  const [visible, setVisible] = useState(true);
  if (!visible || plan?.plan !== "trial" || plan.daysLeft > 5) return null;

  const urgent = plan.daysLeft <= 1;
  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold
      ${urgent ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900"}`}>
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
  const [syncStatus,         setSyncStatus]         = useState("idle");
  const [authState,          setAuthState]          = useState("loading"); // "loading" | "authenticated" | "unauthenticated"
  const [user,               setUser]               = useState(null);
  const [plan,               setPlan]               = useState(null);
  const [modulosHabilitados, setModulosHabilitados] = useState(null); // null = todos
  const location = useLocation();

  const titulo = TITULOS[location.pathname] || "Organízalo.AI";

  // ── Verificar sesión al arrancar ───────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const authed = await isAuthenticated();
      if (!authed) { setAuthState("unauthenticated"); return; }

      // Verificar contra el servidor (puede fallar si no hay internet → ok igual)
      const serverOk = await verifySession(); // también guarda modulosHabilitados
      const storedUser = await getUser();
      const planStatus = await getPlanStatus();
      const modulos    = await getModulosHabilitados();

      if (!serverOk && !storedUser) {
        setAuthState("unauthenticated");
        return;
      }

      // Expandir ventana ANTES de mostrar la app (auto-login con token guardado)
      window.electronAPI?.window?.loginSuccess?.();

      setUser(storedUser);
      setPlan(planStatus);
      setModulosHabilitados(modulos);
      setAuthState("authenticated");
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
    setAuthState("authenticated");
    if (token) {
      handleSync();
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
            <span className="text-white font-bold tracking-tight" style={{ fontSize: 22 }}>Organízalo</span>
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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
      <TrialBanner plan={plan} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} userEmail={user?.email} modulosHabilitados={modulosHabilitados} />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar
            title={titulo}
            syncStatus={syncStatus}
            onSync={handleSync}
            user={user}
            onLogout={handleLogout}
          />

          <main className="flex-1 overflow-auto">
            <Routes>
            <Route path="/"                 element={<DashboardScreen />} />
            <Route path="/facturacion"      element={<FacturacionScreen />} />
            <Route path="/cotizaciones"     element={<CotizacionesScreen />} />
            <Route path="/pos"              element={<POSScreen />} />
            <Route path="/pedidos"          element={<PedidosScreen />} />
            <Route path="/facturas-historial" element={<FacturasHistScreen />} />
            <Route path="/compras"          element={<ComprasScreen />} />
            <Route path="/recepcion"        element={<RecepcionScreen />} />
            <Route path="/inventario"       element={<InventarioScreen />} />
            <Route path="/catalogo"         element={<CatalogoScreen />} />
            <Route path="/ordenes"          element={<OrdenesScreen />} />
            <Route path="/cxc"              element={<CXCScreen />} />
            <Route path="/cxp"              element={<CXPScreen />} />
            <Route path="/recibos"          element={<RecibosScreen />} />
            <Route path="/conciliacion"     element={<ConciliacionScreen />} />
            <Route path="/importar-csv"     element={<ImportarCSVScreen />} />
            <Route path="/contactos"        element={<ContactosScreen />} />
            <Route path="/empleados"        element={<EmpleadosScreen />} />
            <Route path="/estado-cuenta"    element={<EstadoCuentaScreen />} />
            <Route path="/notas-credito"    element={<NotasCreditoScreen />} />
            <Route path="/reporte-cxc"      element={<ReporteCXCScreen />} />
            <Route path="/reporte-recibos"  element={<ReporteRecibosScreen />} />
            <Route path="/reporte-vencidos" element={<ReporteVencidosScreen />} />
            <Route path="/analytics"        element={<AnalyticsScreen />} />
            <Route path="/migracion"        element={<MigracionScreen />} />
            <Route path="/planillas"        element={<PlanillasScreen />} />
            <Route path="/flujo-caja"       element={<FlujoCajaScreen />} />
            <Route path="/d104"             element={<D104Screen />} />
            <Route path="/catalogo-cuentas" element={<CatalogoCuentasScreen />} />
            <Route path="/asientos"         element={<AsientosScreen />} />
            <Route path="/balances"         element={<BalancesScreen />} />
            <Route path="/usuarios"         element={<UsuariosScreen />} />
            <Route path="/empresas"         element={<EmpresasScreen />} />
            <Route path="/caja"             element={<CajaScreen />} />
            <Route path="/activos-fijos"    element={<ActivosFijosScreen />} />
            <Route path="/presupuesto"      element={<PresupuestoScreen />} />
            <Route path="/proyectos"        element={<ProyectosScreen />} />
            <Route path="/tienda"           element={<TiendaScreen />} />
            <Route path="/portal-cliente"   element={<PortalClienteScreen />} />
            <Route path="/recordatorios"    element={<RecordatoriosScreen />} />
            <Route path="/asistente"             element={<AsistenteScreen />} />
            <Route path="/rocky-asistente"       element={<AsistenteScreen />} />
            <Route path="/rocky-recepcionista"   element={<RockyRecepcionistaScreen />} />
            <Route path="/rocky-config"          element={<RockyRecepcionistaScreen />} />
            <Route path="/chat"             element={<ChatScreen />} />
            <Route path="/configuracion"    element={<ConfiguracionScreen />} />
            <Route path="/calendario"       element={<CalendarioScreen />} />
            <Route path="/crm-clientes"     element={<CRMClientesScreen />} />
            {user?.email === SUPERADMIN_EMAIL && (
              <Route path="/admin"          element={<AdminScreen />} />
            )}
          </Routes>
          </main>
        </div>
      </div>

      {/* Chat flotante — visible en cualquier pantalla */}
      <ChatWidget />
    </div>
  );
}
