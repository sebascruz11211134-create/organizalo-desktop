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
  const headers   = await authHeaders();
  const data      = await db.getAll();
  const updatedAt = new Date().toISOString();

  await axios.post(
    `${BACKEND}/api/clouddata/push`,      // endpoint correcto del VPS
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

    const lastSync = await db.getLastSync();

    const res = await axios.get(
      `${BACKEND}/api/clouddata/pull`,    // endpoint correcto del VPS
      { headers, timeout: 15000 }
    );

    const serverData = res.data?.data;

    if (serverData && Object.keys(serverData).length > 0) {
      const now = new Date().toISOString();
      await db.setAll(serverData);
      await db.setLastSync(now);
      _notifyUI(now);
      return { ok: true, serverUpdatedAt: now };
    } else {
      // No hay datos en la nube aún → subir los locales
      await pushSync();
      return { ok: true, pushed: true };
    }
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
