/**
 * db.js — Capa de acceso a datos para el desktop
 *
 * Usa electron-store (vía IPC) como almacenamiento local.
 * Las claves coinciden exactamente con las del móvil (AsyncStorage)
 * para que el sync funcione sin transformaciones.
 */

// ── Capa de almacenamiento unificada (Electron o Web) ─────────────────────────
// En Electron: usa electron-store vía IPC (window.electronAPI.store)
// En Web/PWA:  usa localStorage del navegador

const isElectron = !!window.electronAPI?.store;

async function getJSON(key, fallback = null) {
  if (isElectron) {
    const val = await window.electronAPI.store.get(key);
    return val ?? fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

async function setJSON(key, value) {
  if (isElectron) {
    await window.electronAPI.store.set(key, value);
  } else {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  // Auto-push al servidor después de cada write (debounced via sync.js)
  // window.__orgPush es inyectado por sync.js para evitar imports circulares
  if (typeof window.__orgPush === "function") window.__orgPush();
}

// getAll / setAll para web (electron-store los tiene nativos)
function webGetAll() {
  const result = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("@finanzia/")) {
      try { result[key] = JSON.parse(localStorage.getItem(key)); }
      catch { result[key] = localStorage.getItem(key); }
    }
  }
  return result;
}

function webSetAll(data) {
  Object.entries(data || {}).forEach(([key, value]) => {
    if (key?.startsWith("@finanzia/")) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch {}
    }
  });
}

// ── Claves (mismas que el móvil) ──────────────────────────────────────────────

const KEYS = {
  // Auth (manejado también por auth.js, pero útil tenerlos aquí para getAll)
  authToken:         "@finanzia/authToken",
  authUser:          "@finanzia/authUser",
  settings:          "@finanzia/settings",
  debts:             "@finanzia/debts",
  recibos:           "@finanzia/recibos",
  facturas:          "@finanzia/facturas",
  notasCredito:      "@finanzia/notasCredito",
  productos:         "@finanzia/productos",
  contactos:         "@finanzia/contactos",
  empleados:         "@finanzia/empleados",
  gastos:            "@finanzia/transactions",
  ingresos:          "@finanzia/ingresos",
  cuentas:           "@finanzia/cuentas",
  reconciliadas:     "@finanzia/reconciliadas",
  pedidos:           "@finanzia/pedidos",
  ordenesTrabajo:    "@finanzia/ordenesTrabajo",
  cotizaciones:      "@finanzia/cotizaciones",
  lastSync:          "@finanzia/lastSync",
  empresaId:         "@finanzia/empresaId",
  // Nuevos módulos
  planillas:         "@finanzia/planillas",
  asientos:          "@finanzia/asientosContables",
  cuentasContables:  "@finanzia/cuentasContables",
  empresas:          "@finanzia/empresas",
  usuarios:          "@finanzia/usuarios",
  usuarioActivo:     "@finanzia/usuarioActivo",
  compras:           "@finanzia/compras",
  caja:              "@finanzia/caja",
  activosFijos:      "@finanzia/activosFijos",
  presupuestos:      "@finanzia/presupuestos",
  proyectos:         "@finanzia/proyectos",
  tiendaConfig:      "@finanzia/tiendaConfig",
  portalConfig:      "@finanzia/portalConfig",
};

// ── API ───────────────────────────────────────────────────────────────────────

const db = {
  // Settings
  getSettings:      () => getJSON(KEYS.settings, { moneda: "CRC", nombreNegocio: "Mi negocio" }),
  setSettings:      (v) => setJSON(KEYS.settings, v),

  // Deudas (CXC / CXP)
  getDebts:         () => getJSON(KEYS.debts, []),
  setDebts:         (v) => setJSON(KEYS.debts, v),

  // Recibos de caja
  getRecibos:       () => getJSON(KEYS.recibos, []),
  setRecibos:       (v) => setJSON(KEYS.recibos, v),

  // Facturas
  getFacturas:      () => getJSON(KEYS.facturas, []),
  setFacturas:      (v) => setJSON(KEYS.facturas, v),

  // Notas de crédito
  getNotasCredito:  () => getJSON(KEYS.notasCredito, []),
  setNotasCredito:  (v) => setJSON(KEYS.notasCredito, v),

  // Productos / Inventario
  getProductos:     () => getJSON(KEYS.productos, []),
  setProductos:     (v) => setJSON(KEYS.productos, v),

  // Contactos
  getContactos:     () => getJSON(KEYS.contactos, []),
  setContactos:     (v) => setJSON(KEYS.contactos, v),

  // Empleados
  getEmpleados:     () => getJSON(KEYS.empleados, []),
  setEmpleados:     (v) => setJSON(KEYS.empleados, v),

  // Gastos
  getGastos:        () => getJSON(KEYS.gastos, []),
  setGastos:        (v) => setJSON(KEYS.gastos, v),

  // Pedidos
  getPedidos:       () => getJSON(KEYS.pedidos, []),
  setPedidos:       (v) => setJSON(KEYS.pedidos, v),

  // Cotizaciones
  getCotizaciones:  () => getJSON(KEYS.cotizaciones, []),
  setCotizaciones:  (v) => setJSON(KEYS.cotizaciones, v),

  // Órdenes de trabajo
  getOrdenes:       () => getJSON(KEYS.ordenesTrabajo, []),
  setOrdenes:       (v) => setJSON(KEYS.ordenesTrabajo, v),

  // Sync metadata
  getLastSync:      () => getJSON(KEYS.lastSync, null),
  setLastSync:      (v) => setJSON(KEYS.lastSync, v),

  getEmpresaId:     () => getJSON(KEYS.empresaId, null),
  setEmpresaId:     (v) => setJSON(KEYS.empresaId, v),

  // Planillas
  getPlanillas:     () => getJSON(KEYS.planillas, []),
  setPlanillas:     (v) => setJSON(KEYS.planillas, v),

  // Contabilidad
  getAsientos:           () => getJSON(KEYS.asientos, []),
  setAsientos:           (v) => setJSON(KEYS.asientos, v),
  getCuentasContables:   () => getJSON(KEYS.cuentasContables, null),
  setCuentasContables:   (v) => setJSON(KEYS.cuentasContables, v),

  // Multiempresa
  getEmpresas:      () => getJSON(KEYS.empresas, []),
  setEmpresas:      (v) => setJSON(KEYS.empresas, v),

  // Usuarios
  getUsuarios:      () => getJSON(KEYS.usuarios, []),
  setUsuarios:      (v) => setJSON(KEYS.usuarios, v),
  getUsuarioActivo: () => getJSON(KEYS.usuarioActivo, null),
  setUsuarioActivo: (v) => setJSON(KEYS.usuarioActivo, v),

  // Compras (facturas de proveedor con IVA crédito fiscal)
  getCompras:       () => getJSON(KEYS.compras, []),
  setCompras:       (v) => setJSON(KEYS.compras, v),

  // Caja diaria
  getCaja:          () => getJSON(KEYS.caja, []),
  setCaja:          (v) => setJSON(KEYS.caja, v),

  // Activos fijos
  getActivosFijos:  () => getJSON(KEYS.activosFijos, []),
  setActivosFijos:  (v) => setJSON(KEYS.activosFijos, v),

  // Presupuestos
  getPresupuestos:  () => getJSON(KEYS.presupuestos, {}),
  setPresupuestos:  (v) => setJSON(KEYS.presupuestos, v),

  // Proyectos / centros de costo
  getProyectos:     () => getJSON(KEYS.proyectos, []),
  setProyectos:     (v) => setJSON(KEYS.proyectos, v),

  // Configuración tienda y portal
  getTiendaConfig:  () => getJSON(KEYS.tiendaConfig, { activa: false }),
  setTiendaConfig:  (v) => setJSON(KEYS.tiendaConfig, v),
  getPortalConfig:  () => getJSON(KEYS.portalConfig, { activo: false }),
  setPortalConfig:  (v) => setJSON(KEYS.portalConfig, v),

  // Planilla mejorada — préstamos a colaboradores y horas semanales
  getPlanillaPrestamos: () => getJSON("@finanzia/planillaPrestamos", []),
  setPlanillaPrestamos: (v) => setJSON("@finanzia/planillaPrestamos", v),
  getPlanillaSemanas:   () => getJSON("@finanzia/planillaSemanas", {}),
  setPlanillaSemanas:   (v) => setJSON("@finanzia/planillaSemanas", v),

  // Flujo de caja
  getFlujoCajaSaldo:      () => getJSON("@finanzia/fcSaldo", { banco: 0, bancoUSD: 0, efectivo: 0 }),
  setFlujoCajaSaldo:      (v) => setJSON("@finanzia/fcSaldo", v),
  getFlujoCajaPagosFijos: () => getJSON("@finanzia/fcPagosFijos", []),
  setFlujoCajaPagosFijos: (v) => setJSON("@finanzia/fcPagosFijos", v),
  getFlujoCajaMovs:       () => getJSON("@finanzia/fcMovimientos", []),
  setFlujoCajaMovs:       (v) => setJSON("@finanzia/fcMovimientos", v),

  // Dump completo para sync
  getAll: () => isElectron ? window.electronAPI.store.getAll() : webGetAll(),
  setAll: (data) => isElectron ? window.electronAPI.store.setAll(data) : webSetAll(data),
};

export default db;
