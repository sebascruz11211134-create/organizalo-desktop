/**
 * syncQueue.js — Buffer persistente en IndexedDB.
 *
 * Garantiza que NINGÚN dato se pierda aunque el backend esté caído.
 * Toda escritura se guarda aquí primero. Solo se elimina cuando el
 * backend confirma la recepción.
 *
 * Modelo: guardamos solo el snapshot más reciente (el estado completo
 * de la empresa). No necesitamos una cola de operaciones individuales
 * porque el backend acepta el blob completo y lo reemplaza.
 */

const DB_NAME = "monki_sync_queue_v1";
const STORE   = "pending";
const DB_VER  = 1;
const KEY     = "current";

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getStore(mode) {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * Guarda el snapshot completo como pendiente.
 * Sobreescribe cualquier snapshot anterior (solo interesa el más reciente).
 * Esta operación es LOCAL — no puede fallar por red.
 */
export async function savePending(snapshot) {
  try {
    const store = await getStore("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put({ key: KEY, snapshot, savedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch (err) {
    // IndexedDB puede fallar en algunos contextos (modo incógnito, etc.)
    // No bloqueamos el flujo principal.
    console.warn("[SyncQueue] No se pudo guardar en IndexedDB:", err.message);
  }
}

/**
 * Lee el snapshot pendiente.
 * Retorna null si no hay nada pendiente.
 */
export async function getPending() {
  try {
    const store = await getStore("readonly");
    return new Promise((resolve) => {
      const req = store.get(KEY);
      req.onsuccess = (e) => resolve(e.target.result?.snapshot ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Elimina el snapshot pendiente.
 * Llamar SOLO cuando el backend confirmó la recepción.
 */
export async function clearPending() {
  try {
    const store = await getStore("readwrite");
    return new Promise((resolve) => {
      const req = store.delete(KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  } catch {
    // Silencioso — si no se puede borrar, el próximo push lo sobreescribe
  }
}

/** Retorna true si hay un snapshot pendiente de sincronizar. */
export async function hasPending() {
  const p = await getPending();
  return p !== null;
}
