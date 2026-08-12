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
  await storeSet(USER_KEY, res.data.user);
  return res.data;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  const token = await getToken();
  if (token) {
    try {
      await axios.post(
        `${BACKEND}/api/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
    } catch { /* ignorar si falla la red */ }
  }
  await storeSet(TOKEN_KEY, null);
  await storeSet(USER_KEY, null);
}

// ── Getters ───────────────────────────────────────────────────────────────────

export async function getToken() {
  return storeGet(TOKEN_KEY);
}

export async function getUser() {
  return storeGet(USER_KEY);
}

export async function isAuthenticated() {
  const token = await getToken();
  return typeof token === "string" && token.length > 10;
}

// ── Verificar sesión en servidor ──────────────────────────────────────────────
// Llama al backend para confirmar que el token sigue vigente.
// Útil al arrancar la app (por si venció o fue revocado).

export async function verifySession() {
  const token = await getToken();
  if (!token) return false;
  try {
    const res = await axios.get(
      `${BACKEND}/api/auth/me`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 3000 }
    );
    // Actualizar datos del usuario y módulos con los del servidor
    await storeSet(USER_KEY, res.data.user);
    await storeSet(MODULOS_KEY, res.data.modulosHabilitados ?? null);
    return true;
  } catch (err) {
    if (err.response?.status === 401) {
      await storeSet(TOKEN_KEY, null);
      await storeSet(USER_KEY, null);
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
