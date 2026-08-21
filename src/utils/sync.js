/**
 * sync.js — Sincronización bidireccional + tiempo real con WebSockets.
 *
 * Estrategia:
 *   1. Al iniciar sesión → conectar socket.io (auth por token de sesión)
 *   2. Servidor emite "data:changed" cuando CUALQUIER dispositivo hace push
 *   3. Este cliente escucha ese evento y hace pullSync() automáticamente
 *   4. Fallback: polling cada 30s como red de seguridad
 *   5. Reintentos automáticos con backoff exponencial en errores transitorios
 *   6. Solo reporta "error" real tras 3 fallos consecutivos
 */

import axios    from "axios";
import { io as socketIO } from "socket.io-client";
import db       from "./db";
import { getToken } from "./auth";
import { BACKEND } from "./config";

// ── Header auth ───────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ── Retry con backoff exponencial ─────────────────────────────────────────────
// Reintenta fn hasta maxRetries veces. Espera baseMs * 2^intento entre reintentos.

async function withRetry(fn, { maxRetries = 3, baseMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxRetries) {
        const wait = baseMs * Math.pow(2, i);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ── Push ──────────────────────────────────────────────────────────────────────

export async function pushSync() {
  const headers  = await authHeaders();
  const rawData  = await db.getAll();
  const updatedAt = new Date().toISOString();

  const data = Object.fromEntries(
    Object.entries(rawData).filter(([, v]) => v !== null && v !== undefined)
  );

  const hayDatosReales = Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== false && v !== ""
  );
  if (!hayDatosReales) return updatedAt;

  await withRetry(() =>
    axios.post(`${BACKEND}/api/clouddata/push`, { data }, { headers, timeout: 15000 })
  );

  await db.setLastSync(updatedAt);
  return updatedAt;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

export async function pullSync() {
  const headers = await authHeaders();

  const res = await withRetry(() =>
    axios.get(`${BACKEND}/api/clouddata/pull`, { headers, timeout: 15000 })
  );

  if (res.data?.data) {
    const now = new Date().toISOString();
    await db.setAll(res.data.data);
    await db.setLastSync(now);
    _notifyUI(now);
    return now;
  }
  return null;
}

// ── Sync completo ─────────────────────────────────────────────────────────────

export async function syncAll({ freshLogin = false } = {}) {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return { ok: true, skipped: true };

    if (!freshLogin) {
      await pushSync().catch(() => {}); // push no bloquea pull si falla
    }

    const res = await withRetry(() =>
      axios.get(`${BACKEND}/api/clouddata/pull`, { headers, timeout: 15000 })
    );

    const serverData = res.data?.data;
    if (serverData && Object.keys(serverData).length > 0) {
      const now = new Date().toISOString();
      await db.setAll(serverData);
      await db.setLastSync(now);
      _notifyUI(now);
      return { ok: true, synced: true };
    }

    return { ok: true };
  } catch (err) {
    console.warn("[Sync] Error tras reintentos:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── WebSocket en tiempo real ──────────────────────────────────────────────────

let _socket    = null;
let _listeners = [];

if (typeof window !== "undefined") {
  window.__orgPush = schedulePush;
}

export async function connectSocket() {
  const token = await getToken();
  if (!token) return;

  if (_socket?.connected) return;
  if (_socket) { _socket.disconnect(); _socket = null; }

  _socket = socketIO(BACKEND, {
    auth:               { token },
    transports:         ["websocket", "polling"],
    reconnection:       true,
    reconnectionDelay:  2000,
    reconnectionAttempts: Infinity,
  });

  _socket.on("connect", () => {
    console.log("[WS] Conectado — sync en tiempo real activo");
    syncAll().catch(() => {});
  });

  _socket.on("data:changed", async ({ origen } = {}) => {
    try {
      await pullSync();
    } catch (err) {
      console.warn("[WS] Pull tras data:changed falló:", err.message);
    }
  });

  _socket.on("connect_error", (err) => {
    console.warn("[WS] Error de conexión:", err.message);
  });

  _socket.on("disconnect", (reason) => {
    console.log("[WS] Desconectado:", reason);
  });
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null; }
  _listeners = [];
}

export function onSyncUpdate(callback) {
  _listeners.push(callback);
  return () => { _listeners = _listeners.filter(fn => fn !== callback); };
}

function _notifyUI(updatedAt) {
  _listeners.forEach(fn => { try { fn({ updatedAt }); } catch {} });
  try {
    window.dispatchEvent(new CustomEvent("organizalo:sync", { detail: { updatedAt } }));
  } catch {}
}

// ── Auto-push debounced ───────────────────────────────────────────────────────

let _pushTimer = null;

export function schedulePush() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) return;
      await pushSync();
      if (_socket?.connected) _socket.emit("data:push", {});
    } catch (err) {
      console.warn("[Sync] Auto-push falló (se reintentará en el próximo ciclo):", err.message);
    }
  }, 1200);
}

// ── Auto-sync polling — corre siempre cada 30s como red de seguridad ──────────

let _interval    = null;
let _failCount   = 0;   // fallos consecutivos
const FAIL_LIMIT = 3;   // reportar error solo tras N fallos seguidos

export function startAutoSync(onSync) {
  if (_interval) return;

  // Primer sync inmediato
  syncAll()
    .then(r => {
      if (r.ok) _failCount = 0;
      onSync?.(r);
    })
    .catch(() => {});

  _interval = setInterval(async () => {
    const result = await syncAll();

    if (result.ok) {
      _failCount = 0;
      onSync?.({ ok: true });
    } else {
      _failCount++;
      // Solo reportar error al exterior tras FAIL_LIMIT fallos seguidos
      // (evita que un hipo de red muestre "Error de sync" al usuario)
      if (_failCount >= FAIL_LIMIT) {
        onSync?.({ ok: false, error: result.error });
      }
    }
  }, 30 * 1000); // 30 segundos
}

export function stopAutoSync() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

export function isSocketConnected() {
  return _socket?.connected ?? false;
}
