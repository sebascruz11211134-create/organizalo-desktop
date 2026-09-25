/**
 * auth.js — Gestión de sesión de usuario en el desktop.
 *
 * El token se guarda en electron-store (persiste entre reinicios).
 * El usuario decodificado también se cachea localmente.
 */
import axios from "axios";
import { BACKEND } from "./config";
import { abrirEspacio, borrarEspacio, cerrarEspacio, ligarSesion, marcarLoginPendiente, confirmarLogin } from "./almacen";
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

// Marca de sesión compartida entre pestañas: cambia al entrar y al salir, para
// que una sincronización que empezó con la sesión anterior no suba nada.
const MARCA_SESION = "monki:sesion";
const nuevaSesion = () => localStorage.setItem(MARCA_SESION, `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Orden al entrar: credenciales → espacio de la empresa → publicar la sesión.
// La marca de sesión cambia AL FINAL: las otras pestañas se recargan una sola
// vez y ya con la sesión nueva completa (cada empresa tiene su propio espacio;
// el de la cuenta anterior queda intacto).
async function abrirSesion(datos) {
  if (!isElectron) marcarLoginPendiente(datos.user); // si se corta a la mitad, no cuenta como sesión segura
  await storeSet(TOKEN_KEY, datos.token);
  await storeSet(REFRESH_KEY, datos.refreshToken || null);
  await storeSet(USER_KEY, datos.user);
  if (!isElectron) await abrirEspacio(datos.user);
  nuevaSesion();
  if (!isElectron) { ligarSesion(); confirmarLogin(datos.user); }
  window.__orgReanudarSync?.();
}

// ── Registro ──────────────────────────────────────────────────────────────────

export async function register({ nombre, email, password, telefono, codigoAcceso }) {
  const res = await axios.post(
    `${BACKEND}/api/auth/register`,
    { nombre, email, password, telefono, codigoAcceso },
    { timeout: 20000 }
  );
  await abrirSesion(res.data);
  return res.data;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login({ email, password }) {
  const res = await axios.post(
    `${BACKEND}/api/auth/login`,
    { email, password },
    { timeout: 20000 }
  );
  await abrirSesion(res.data);
  return res.data;
}

// ── Limpiar datos locales de la empresa ───────────────────────────────────────
// Web: cada empresa tiene su espacio propio en el equipo. Al cerrar sesión con
// todo sincronizado se elimina; si quedaron cambios sin subir (y el usuario
// eligió salir igual) se CONSERVA cerrado para no perderlos: se suben la
// próxima vez que esa empresa entre en este equipo.


export async function clearLocalData({ conservar = false } = {}) {
  if (isElectron) {
    if (conservar) return; // nunca borrar lo que el usuario decidió conservar
    // Electron no tiene espacios por empresa: al salir se borran TODOS los datos
    // del negocio (la app no deja salir en Electron con cambios sin subir).
    const AUTH = new Set([TOKEN_KEY, REFRESH_KEY, USER_KEY, MODULOS_KEY]);
    let todas = {};
    try { todas = (await window.electronAPI?.store?.getAll?.()) || {}; } catch { /* sin listado */ }
    const claves = Object.keys(todas).filter(k => k.startsWith("@finanzia/") && !AUTH.has(k));
    for (const k of claves) await window.electronAPI?.store?.delete?.(k);
    await borrarEspacio(); // pantallas que guardan directo en el almacén del navegador
  } else {
    if (conservar) return cerrarEspacio();
    await borrarEspacio(); // la base completa de esta empresa (o sus datos en localStorage)
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout({ conservarDatos = false } = {}) {
  // Antes que nada: invalidar la sesión para cualquier sincronización en curso (en todas las pestañas)
  localStorage.setItem(MARCA_SESION, `cerrada-${Date.now()}`);
  const token        = await getToken();
  const refreshToken = await storeGet(REFRESH_KEY);
  try {
    await axios.post(
      `${BACKEND}/api/auth/logout`,
      { refreshToken },
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 8000 }
    );
  } catch { /* ignorar si falla la red */ }
  // Frenar la sincronización (y esperar la que esté en curso) antes de borrar,
  // para que no vuelva a escribir datos de esta sesión después del borrado.
  await window.__orgDetenerSync?.();
  // Con las escrituras ya congeladas (sesión marcada como cerrada), revisar otra vez:
  // si otra pestaña guardó algo después de la primera revisión, no se borra.
  if (!conservarDatos && !isElectron && (await window.__orgCambiosSinSubir?.())) conservarDatos = true;
  // Limpiar datos de la empresa ANTES de borrar el token
  await clearLocalData({ conservar: conservarDatos });
  await storeSet(TOKEN_KEY, null);
  await storeSet(REFRESH_KEY, null);
  await storeSet(USER_KEY, null);
  await storeSet(MODULOS_KEY, null);
  // Segundo aviso: las pestañas que se recargaron durante el cierre vuelven al login
  localStorage.setItem(MARCA_SESION, `cerrada-${Date.now()}-fin`);
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
