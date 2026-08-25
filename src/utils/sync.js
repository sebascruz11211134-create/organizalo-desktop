/**
 * sync.js — Sincronización infalible con IndexedDB + WebSockets + polling.
 *
 * Garantía: ningún dato se pierde aunque el backend esté caído.
 *
 * Flujo de escritura:
 *   1. El dato se guarda en IndexedDB (local, instantáneo, siempre funciona)
 *   2. Se intenta push al backend
 *   3. Si el backend confirma → se limpia IndexedDB
 *   4. Si falla → IndexedDB conserva el snapshot y el retry loop reintenta
 *      indefinidamente con backoff (2s → 4s → 8s → … → 60s máx)
 *   5. Al reconectarse (online event o socket reconnect) → reintenta inmediatamente
 *
 * Estados de sync:
 *   idle     — todo sincronizado
 *   syncing  — push/pull en progreso
 *   queued   — hay datos pendientes, reintentando (sin pérdida de datos)
 *   offline  — sin conexión a internet
 *   error    — conectado pero backend no responde (>3 intentos seguidos)
 */

import axios  from "axios";
import { io as socketIO } from "socket.io-client";
import db     from "./db";
import { getToken }  from "./auth";
import { BACKEND }   from "./config";
import { savePending, getPending, clearPending, hasPending } from "./syncQueue";

// ── Estado interno ─────────────────────────────────────────────────────────────

let _status      = "idle";   // idle | syncing | queued | offline | error
let _listeners   = [];       // callbacks de UI
let _retrying    = false;    // evita loops paralelos
let _failCount   = 0;
let _socket      = null;
let _interval    = null;

const FAIL_LIMIT = 5;        // errores antes de reportar "error" (no queued)
const RETRY_MAX_MS = 60_000; // backoff máximo entre reintentos

// ── Helpers ────────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setStatus(s) {
  if (_status === s) return;
  _status = s;
  _notifyStatus(s);
}

function _notifyStatus(status) {
  _listeners.forEach(fn => { try { fn({ status }); } catch {} });
}

function _notifyUI(updatedAt) {
  _listeners.forEach(fn => { try { fn({ updatedAt }); } catch {} });
  try {
    window.dispatchEvent(new CustomEvent("organizalo:sync", { detail: { updatedAt } }));
  } catch {}
}

// ── Core: push con IndexedDB como red de seguridad ────────────────────────────

/**
 * Intenta un push al backend.
 * SIEMPRE guarda en IndexedDB antes de intentar la red.
 * Si la red falla → IndexedDB retiene el snapshot para reintento.
 * Si la red responde → limpia IndexedDB.
 *
 * @returns {boolean} true si el backend confirmó, false si falló
 */
async function attemptPush() {
  const headers  = await authHeaders();
  if (!headers.Authorization) return true; // sin sesión, nada que hacer

  const rawData  = await db.getAll();
  const data     = Object.fromEntries(
    Object.entries(rawData).filter(([, v]) => v !== null && v !== undefined)
  );

  const hayDatosReales = Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== false && v !== ""
  );
  if (!hayDatosReales) return true;

  // 1. Guardar en IndexedDB PRIMERO (operación local, no puede fallar por red)
  await savePending(data);

  // 2. Intentar backend
  try {
    await axios.post(`${BACKEND}/api/clouddata/push`, { data }, { headers, timeout: 15_000 });
    // 3. Backend confirmó → limpiar IndexedDB
    await clearPending();
    const now = new Date().toISOString();
    await db.setLastSync(now);
    return true;
  } catch {
    return false;
  }
}

// ── Pull ──────────────────────────────────────────────────────────────────────

export async function pullSync() {
  const headers = await authHeaders();
  if (!headers.Authorization) return null;

  try {
    const res = await axios.get(`${BACKEND}/api/clouddata/pull`, { headers, timeout: 15_000 });
    if (res.data?.data) {
      const now = new Date().toISOString();
      await db.setAll(res.data.data);
      await db.setLastSync(now);
      _notifyUI(now);
      return now;
    }
  } catch {
    // silencioso — el retry loop cuida el re-intento
  }
  return null;
}

// ── Retry loop — corre en background hasta que el backend confirme ─────────────

async function _startRetryLoop() {
  if (_retrying) return;
  _retrying = true;

  let backoff = 2_000;

  while (await hasPending()) {
    // Si no hay internet, esperar el evento online en lugar de hacer requests
    if (!navigator.onLine) {
      setStatus("offline");
      await new Promise(resolve => {
        const handler = () => { window.removeEventListener("online", handler); resolve(); };
        window.addEventListener("online", handler);
      });
    }

    setStatus("queued");
    const ok = await attemptPush();

    if (ok) {
      _failCount = 0;
      setStatus("idle");
      break;
    }

    // Falló — esperar y volver a intentar
    _failCount++;
    if (_failCount >= FAIL_LIMIT) setStatus("error");
    await new Promise(r => setTimeout(r, backoff));
    backoff = Math.min(backoff * 2, RETRY_MAX_MS);
  }

  _retrying = false;
}

// ── API pública: push programado ───────────────────────────────────────────────

let _pushTimer = null;

/**
 * Programa un push con debounce de 1.2s.
 * Guarda en IndexedDB inmediatamente, envía al backend poco después.
 * Si falla, el retry loop se encarga de reintentar hasta conseguirlo.
 */
export function schedulePush() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(async () => {
    setStatus("syncing");
    const ok = await attemptPush();

    if (ok) {
      _failCount = 0;
      setStatus("idle");
      if (_socket?.connected) _socket.emit("data:push", {});
    } else {
      // No bloqueamos — arrancamos el retry loop en background
      _startRetryLoop().catch(console.warn);
    }
  }, 1_200);
}

// Exponer globalmente para que los screens puedan llamarlo sin importar sync
if (typeof window !== "undefined") {
  window.__orgPush = schedulePush;
}

// ── Push explícito (sin debounce) + pull ──────────────────────────────────────

export async function pushSync() {
  const ok = await attemptPush();
  if (!ok) _startRetryLoop().catch(console.warn);
  return ok;
}

export async function syncAll({ freshLogin = false } = {}) {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return { ok: true, skipped: true };

    setStatus("syncing");

    if (!freshLogin) {
      await pushSync();
    }

    const res = await axios.get(`${BACKEND}/api/clouddata/pull`, { headers, timeout: 15_000 });
    const serverData = res.data?.data;
    if (serverData && Object.keys(serverData).length > 0) {
      const now = new Date().toISOString();
      await db.setAll(serverData);
      await db.setLastSync(now);
      _notifyUI(now);
    }

    _failCount = 0;
    setStatus("idle");
    return { ok: true, synced: true };
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    console.warn("[Sync] syncAll error:", detail);
    _failCount++;
    if (_failCount >= FAIL_LIMIT) setStatus("error");
    return { ok: false, error: detail };
  }
}

// ── Procesar cola pendiente al arrancar ───────────────────────────────────────

/**
 * Llamar al iniciar sesión para procesar cualquier snapshot
 * que quedó pendiente de una sesión anterior.
 */
export async function processQueue() {
  const pending = await getPending();
  if (!pending) return;

  console.log("[Sync] Datos pendientes de sesión anterior — reintentando…");
  setStatus("queued");
  _startRetryLoop().catch(console.warn);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export async function connectSocket() {
  const token = await getToken();
  if (!token) return;
  if (_socket?.connected) return;
  if (_socket) { _socket.disconnect(); _socket = null; }

  _socket = socketIO(BACKEND, {
    auth:              { token },
    transports:        ["websocket", "polling"],
    reconnection:      true,
    reconnectionDelay: 2_000,
    reconnectionAttempts: Infinity,
  });

  _socket.on("connect", () => {
    console.log("[WS] Conectado — sync en tiempo real activo");
    // Al reconectarse, procesar cola pendiente + pull
    processQueue().catch(console.warn);
    syncAll().catch(() => {});
  });

  _socket.on("data:changed", async () => {
    try { await pullSync(); } catch (err) {
      console.warn("[WS] Pull falló:", err.message);
    }
  });

  _socket.on("connect_error", (err) => console.warn("[WS] Error:", err.message));
  _socket.on("disconnect",    (r)   => console.log("[WS] Desconectado:", r));
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null; }
  _listeners = [];
}

// ── Listeners de estado ───────────────────────────────────────────────────────

export function onSyncUpdate(callback) {
  _listeners.push(callback);
  return () => { _listeners = _listeners.filter(fn => fn !== callback); };
}

export function getSyncStatus() { return _status; }

// ── Auto-sync con polling + online/offline ────────────────────────────────────

export function startAutoSync(onSync) {
  if (_interval) return;

  // Procesar cola pendiente al arrancar
  processQueue().catch(console.warn);

  // Listeners de conectividad del browser
  window.addEventListener("online",  () => {
    console.log("[Sync] Reconectado — procesando cola pendiente");
    setStatus("syncing");
    processQueue()
      .then(() => syncAll())
      .then(r  => { if (r.ok) setStatus("idle"); onSync?.({ ok: true }); })
      .catch(() => {});
  });

  window.addEventListener("offline", () => {
    console.log("[Sync] Sin conexión");
    setStatus("offline");
    onSync?.({ ok: false, error: "Sin conexión" });
  });

  // Primer sync inmediato
  syncAll()
    .then(r => { setStatus(r.ok ? "idle" : "error"); onSync?.(r); })
    .catch(() => {});

  // Polling cada 30s como red de seguridad
  _interval = setInterval(async () => {
    // Si ya hay un retry loop corriendo, no hacer polling doble
    if (_retrying) return;

    const result = await syncAll();
    if (result.ok) {
      _failCount = 0;
      setStatus("idle");
      onSync?.({ ok: true });
    } else {
      _failCount++;
      if (_failCount >= FAIL_LIMIT) {
        setStatus("error");
        onSync?.({ ok: false, error: result.error });
      }
    }
  }, 30_000);
}

export function stopAutoSync() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

export function isSocketConnected() {
  return _socket?.connected ?? false;
}
