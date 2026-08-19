/**
 * sync.js — Sincronización bidireccional + tiempo real con WebSockets.
 *
 * Estrategia:
 *   1. Al iniciar sesión → conectar socket.io (auth por token de sesión)
 *   2. Servidor emite "data:changed" cuando CUALQUIER dispositivo hace push
 *   3. Este cliente escucha ese evento y hace pullSync() automáticamente
 *   4. La UI recibe "sync:updated" por el canal de eventos y se refresca
 *
 * Fallback: si el socket no conecta, el auto-sync polling de 3 min sigue activo.
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

// ── Push ──────────────────────────────────────────────────────────────────────

export async function pushSync() {
  const headers  = await authHeaders();
  const rawData  = await db.getAll();
  const updatedAt = new Date().toISOString();

  // Excluir solo nulls/undefined — los arrays vacíos SÍ se suben para que
  // el servidor refleje borrados (ej: usuario eliminó todas las CXC)
  const data = Object.fromEntries(
    Object.entries(rawData).filter(([, v]) => v !== null && v !== undefined)
  );

  // No pushear si literalmente no hay ningún dato local (browser recién iniciado)
  const hayDatosReales = Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== false && v !== ""
  );
  if (!hayDatosReales) return updatedAt;

  await axios.post(
    `${BACKEND}/api/clouddata/push`,
    { data },
    { headers, timeout: 15000 }
  );

  await db.setLastSync(updatedAt);
  return updatedAt;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

export async function pullSync() {
  const headers = await authHeaders();

  const res = await axios.get(
    `${BACKEND}/api/clouddata/pull`,      // endpoint correcto del VPS
    { headers, timeout: 15000 }
  );

  if (res.data?.data) {
    const now = new Date().toISOString();
    await db.setAll(res.data.data);
    await db.setLastSync(now);

    // Notificar a la UI que hay datos nuevos
    _notifyUI(now);
    return now;
  }
  return null;
}

// ── Sync completo (al arrancar o manualmente) ─────────────────────────────────

export async function syncAll() {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return { ok: true, skipped: true };

    // 1. Subir datos locales primero (contribuye lo que tiene este browser)
    //    pushSync ya filtra arrays vacíos → no sobrescribe datos de otros
    await pushSync().catch(() => {});

    // 2. Jalar del servidor (recibe datos de todos los demás dispositivos)
    const res = await axios.get(
      `${BACKEND}/api/clouddata/pull`,
      { headers, timeout: 15000 }
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
    console.warn("[Sync] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── WebSocket en tiempo real ──────────────────────────────────────────────────

let _socket    = null;
let _listeners = [];   // callbacks registrados por la UI

/**
 * Conecta el socket con el token de sesión.
 * Llamar después de login exitoso.
 */
// Inyectar en window para que db.js pueda llamarlo sin import circular
if (typeof window !== "undefined") {
  window.__orgPush = schedulePush;
}

export async function connectSocket() {
  const token = await getToken();
  if (!token) return;

  // Evitar conexiones duplicadas
  if (_socket?.connected) return;
  if (_socket) { _socket.disconnect(); _socket = null; }

  _socket = socketIO(BACKEND, {
    auth: { token },
    transports:        ["websocket", "polling"],
    reconnection:       true,
    reconnectionDelay:  2000,
    reconnectionAttempts: Infinity,
  });

  _socket.on("connect", () => {
    console.log("[WS] Conectado al servidor — sync en tiempo real activo");
    // Hacer un sync inicial al reconectar para no perder cambios
    syncAll().catch(() => {});
  });

  _socket.on("data:changed", async ({ updatedAt, origen } = {}) => {
    console.log(`[WS] data:changed recibido (origen: ${origen})`);
    try {
      await pullSync();   // pullSync ya llama _notifyUI internamente
    } catch (err) {
      console.warn("[WS] Error al hacer pull:", err.message);
    }
  });

  _socket.on("connect_error", (err) => {
    console.warn("[WS] Error de conexión:", err.message);
  });

  _socket.on("disconnect", (reason) => {
    console.log("[WS] Desconectado:", reason);
  });
}

/**
 * Desconectar el socket (al hacer logout).
 */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _listeners = [];
}

/**
 * Registrar un callback que se llama cuando llegan datos nuevos.
 * Retorna una función para desuscribirse.
 *
 * Uso en cualquier componente React:
 *   useEffect(() => {
 *     const off = onSyncUpdate(() => recargarDatos());
 *     return off;
 *   }, []);
 */
export function onSyncUpdate(callback) {
  _listeners.push(callback);
  return () => { _listeners = _listeners.filter(fn => fn !== callback); };
}

function _notifyUI(updatedAt) {
  _listeners.forEach(fn => {
    try { fn({ updatedAt }); } catch {}
  });
  // También notificar via evento de window para que los hooks puedan escuchar
  try { window.dispatchEvent(new CustomEvent("organizalo:sync", { detail: { updatedAt } })); } catch {}
}

// ── Auto-push debounced (llamado por db.js tras cada write) ──────────────────

let _pushTimer = null;

export function schedulePush() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) return; // no logueado, no push
      await pushSync();
      // Notificar al servidor para que avise a los demás clientes
      if (_socket?.connected) {
        _socket.emit("data:push", {});
      }
    } catch (err) {
      console.warn("[Sync] Auto-push error:", err.message);
    }
  }, 1200); // esperar 1.2s para agrupar múltiples writes seguidos
}

// ── Auto-sync polling (fallback si WebSocket no disponible) ───────────────────

let _interval = null;

export function startAutoSync(onSync) {
  if (_interval) return;
  _interval = setInterval(async () => {
    // Solo hacer polling si el socket no está conectado
    if (_socket?.connected) return;
    const result = await syncAll();
    if (onSync) onSync(result);
  }, 3 * 60 * 1000);
}

export function stopAutoSync() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

// ── Estado de conexión ────────────────────────────────────────────────────────

export function isSocketConnected() {
  return _socket?.connected ?? false;
}
