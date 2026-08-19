/**
 * auth.js — Gestión de sesión de usuario en el desktop.
 *
 * El token se guarda en electron-store (persiste entre reinicios).
 * El usuario decodificado también se cachea localmente.
 */
import axios from "axios";
import { BACKEND } from "./config";
const isElectron = !!window.electronAPI?.store;

const TOKEN_KEY   = "@finanzia/authToken";
const REFRESH_KEY = "@finanzia/refreshToken";
const USER_KEY    = "@finanzia/authUser";
const MODULOS_KEY = "@finanzia/modulosHabilitados";

// ── Helpers de store (Electron o localStorage) ────────────────────────────────

async function storeGet(key) {
  if (isElectron) return window.electronAPI.store.get(key) ?? null;
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function storeSet(key, value) {
  if (isElectron) return window.electronAPI.store.set(key, value);
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

// ── Registro ──────────────────────────────────────────────────────────────────

export async function register({ nombre, email, password, telefono, codigoAcceso }) {
  const res = await axios.post(
    `${BACKEND}/api/auth/register`,
    { nombre, email, password, telefono, codigoAcceso },
    { timeout: 20000 }
  );
  await storeSet(TOKEN_KEY, res.data.token);
  await storeSet(REFRESH_KEY, res.data.refreshToken || null);
  await storeSet(USER_KEY, res.data.user);
  return res.data;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login({ email, password }) {
  const res = await axios.post(
    `${BACKEND}/api/auth/login`,
    { email, password },
    { timeout: 20000 }
  );
  await storeSet(TOKEN_KEY, res.data.token);
  await storeSet(REFRESH_KEY, res.data.refreshToken || null);
  await storeSet(USER_KEY, res.data.user);
  return res.data;
}

// ── Limpiar datos locales de la empresa ───────────────────────────────────────
// Borra TODAS las claves @finanzia/ excepto las de autenticación.
// Se llama al hacer logout y antes de guardar un nuevo login,
// para evitar que datos de una cuenta contaminen otra.

const AUTH_KEYS = new Set([TOKEN_KEY, REFRESH_KEY, USER_KEY, MODULOS_KEY]);

export function clearLocalData() {
  if (isElectron) {
    // En Electron no podemos iterar las claves fácilmente — limpiamos las conocidas
    const DATA_KEYS = [
      "@finanzia/settings","@finanzia/debts","@finanzia/recibos","@finanzia/facturas",
      "@finanzia/notasCredito","@finanzia/productos","@finanzia/contactos",
      "@finanzia/empleados","@finanzia/transactions","@finanzia/ingresos",
      "@finanzia/cuentas","@finanzia/reconciliadas","@finanzia/pedidos",
      "@finanzia/ordenesTrabajo","@finanzia/cotizaciones","@finanzia/lastSync",
      "@finanzia/empresaId","@finanzia/planillas","@finanzia/asientosContables",
      "@finanzia/cuentasContables","@finanzia/empresas","@finanzia/usuarios",
      "@finanzia/usuarioActivo","@finanzia/compras","@finanzia/caja",
      "@finanzia/activosFijos","@finanzia/presupuestos","@finanzia/proyectos",
      "@finanzia/tiendaConfig","@finanzia/portalConfig","@finanzia/ordenes",
      "@finanzia/ordenesPedido","@finanzia/movimientosInventario",
      "@finanzia/asistencia","@finanzia/onboarding_completado",
    ];
    DATA_KEYS.forEach(k => window.electronAPI?.store?.delete?.(k));
  } else {
    // Web: iterar localStorage y borrar todo lo que sea @finanzia/ y no sea auth
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("@finanzia/") && !AUTH_KEYS.has(key)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  const token        = await getToken();
  const refreshToken = await storeGet(REFRESH_KEY);
  try {
    await axios.post(
      `${BACKEND}/api/auth/logout`,
      { refreshToken },
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 8000 }
    );
  } catch { /* ignorar si falla la red */ }
  // Limpiar datos de la empresa ANTES de borrar el token
  clearLocalData();
  await storeSet(TOKEN_KEY, null);
  await storeSet(REFRESH_KEY, null);
  await storeSet(USER_KEY, null);
  await storeSet(MODULOS_KEY, null);
}

// ── Refresh session ───────────────────────────────────────────────────────────

export async function refreshSession() {
  const refreshToken = await storeGet(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await axios.post(
      `${BACKEND}/api/auth/refresh`,
      { refreshToken },
      { timeout: 10000 }
    );
    await storeSet(TOKEN_KEY, res.data.token);
    await storeSet(REFRESH_KEY, res.data.refreshToken);
    return true;
  } catch {
    await storeSet(TOKEN_KEY, null);
    await storeSet(REFRESH_KEY, null);
    await storeSet(USER_KEY, null);
    return false;
  }
}

// ── Getters ───────────────────────────────────────────────────────────────────

export async function getToken() {
  return storeGet(TOKEN_KEY);
}

export async function getUser() {
  return storeGet(USER_KEY);
}

/** Devuelve el nombre del usuario activo de forma síncrona (solo web, no Electron).
 *  Útil para estampar creadoPor al guardar documentos. */
export function getCurrentUserSync() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u;
  } catch { return null; }
}

/** Devuelve solo el nombre display del usuario activo (síncrono). */
export function getAutorSync() {
  const u = getCurrentUserSync();
  return u?.nombre || u?.username || u?.email || "Sistema";
}

export async function isAuthenticated() {
  const token = await getToken();
  return typeof token === "string" && token.length > 10;
}

// ── Verificar sesión en servidor ──────────────────────────────────────────────
// Llama al backend para confirmar que el token sigue vigente.
// Útil al arrancar la app (por si venció o fue revocado).

export async function verifySession() {
  let token = await getToken();
  if (!token) {
    // Sin JWT — intentar renovar con refresh token
    const renewed = await refreshSession();
    if (!renewed) return false;
    token = await getToken();
  }
  try {
    const res = await axios.get(
      `${BACKEND}/api/auth/me`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
    );
    await storeSet(USER_KEY, res.data.user);
    await storeSet(MODULOS_KEY, res.data.modulosHabilitados ?? null);
    return true;
  } catch (err) {
    if (err.response?.status === 401) {
      // JWT vencido — intentar renovar con refresh token
      const renewed = await refreshSession();
      if (renewed) {
        token = await getToken();
        try {
          const res2 = await axios.get(
            `${BACKEND}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
          );
          await storeSet(USER_KEY, res2.data.user);
          await storeSet(MODULOS_KEY, res2.data.modulosHabilitados ?? null);
          return true;
        } catch { return false; }
      }
      await storeSet(MODULOS_KEY, null);
    }
    return false;
  }
}

export async function getModulosHabilitados() {
  return storeGet(MODULOS_KEY);
}

// ── Plan / trial ──────────────────────────────────────────────────────────────

export async function getPlanStatus() {
  const user = await getUser();
  if (!user) return { plan: "none", daysLeft: 0, expired: true };

  const plan = user.plan || "trial";
  if (plan === "activo") return { plan: "activo", daysLeft: Infinity, expired: false };

  const trialEnd = user.trialEnds ? new Date(user.trialEnds) : null;
  if (!trialEnd) return { plan: "trial", daysLeft: 0, expired: true };

  const msLeft   = trialEnd.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  return { plan: "trial", daysLeft, expired: daysLeft === 0 };
}
