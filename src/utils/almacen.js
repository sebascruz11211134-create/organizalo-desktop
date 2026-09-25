/**
 * almacen.js — Dónde vive la información del negocio en el navegador.
 *
 * Antes todo iba a localStorage (~5 MB por sitio): una empresa con un año de
 * facturas, clientes y fotos lo llenaba y los datos nuevos dejaban de guardarse
 * sin aviso. Ahora los datos del negocio van a IndexedDB (cientos de MB) con
 * una copia en memoria, así que leer sigue siendo inmediato y sincrónico.
 *
 *  • Sesión y preferencias chicas (token, usuario, idioma…) siguen en localStorage.
 *  • Al iniciar se migra lo que haya en localStorage; solo se borra de ahí
 *    DESPUÉS de confirmar que quedó guardado en IndexedDB.
 *  • Sin IndexedDB (o si falla al abrir) se usa localStorage como antes.
 *  • Varias pestañas abiertas se avisan los cambios entre sí.
 */

const BASE = "monki";
const TABLA = "datos";
const PREFIJO = "@finanzia/";
// Se quedan en localStorage: son chicas y otras partes las leen al instante.
const EN_LOCALSTORAGE = new Set([
  "@finanzia/authToken", "@finanzia/refreshToken", "@finanzia/authUser", "@finanzia/modulosHabilitados",
  "@finanzia/onboarding_completado",
]);

export const esDatoDelNegocio = k => typeof k === "string" && k.startsWith(PREFIJO) && !EN_LOCALSTORAGE.has(k);

const cache = new Map();
let idb = null;          // conexión abierta; null = modo localStorage
let iniciado = null;     // promesa de iniciarAlmacen()
let canal = null;         // aviso entre pestañas; se abre solo si IndexedDB funciona

const copia = v => (v === null || v === undefined || typeof v !== "object") ? v
  : (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// ── IndexedDB con promesas ───────────────────────────────────────────────────
function abrir() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABLA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error("IndexedDB bloqueado por otra pestaña"));
  });
}

function transaccion(modo, trabajo) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(TABLA, modo);
    const tabla = tx.objectStore(TABLA);
    let resultado;
    trabajo(tabla, r => { resultado = r; });
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Escritura cancelada"));
  });
}

function leerTodoIdb() {
  return transaccion("readonly", (tabla, listo) => {
    const pares = [];
    const cursor = tabla.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { pares.push([c.key, c.value]); c.continue(); } else listo(pares);
    };
  });
}

const guardarIdb = (pares) => transaccion("readwrite", tabla => {
  for (const [k, v] of pares) (v === null || v === undefined) ? tabla.delete(k) : tabla.put(v, k);
});

// ── Arranque y migración ─────────────────────────────────────────────────────
export function iniciarAlmacen() {
  if (iniciado) return iniciado;
  iniciado = (async () => {
    if (typeof indexedDB === "undefined") return;
    try {
      idb = await abrir();
      const guardadas = await leerTodoIdb();
      for (const [k, v] of guardadas) {
        if (esDatoDelNegocio(k)) { cache.set(k, v); continue; }
        // Clave que debe vivir en localStorage (p. ej. se agregó a EN_LOCALSTORAGE después)
        if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v));
        await guardarIdb([[k, null]]);
      }

      // Migración única desde localStorage (lo que ya esté en IndexedDB manda)
      const viejas = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (esDatoDelNegocio(k)) viejas.push(k);
      }
      if (viejas.length) {
        const nuevos = [];
        const aLiberar = [];
        for (const k of viejas) {
          if (cache.has(k)) { aLiberar.push(k); continue; }
          // Un valor que no es JSON se deja donde está: nunca se borra algo que no se copió
          try { nuevos.push([k, JSON.parse(localStorage.getItem(k))]); aLiberar.push(k); } catch { /* se queda en localStorage */ }
        }
        if (nuevos.length) await guardarIdb(nuevos);
        nuevos.forEach(([k, v]) => cache.set(k, v));
        aLiberar.forEach(k => localStorage.removeItem(k)); // ya está a salvo en IndexedDB
      }
      navigator.storage?.persist?.().catch(() => {}); // pedir que el navegador no lo borre por espacio
      if (typeof BroadcastChannel !== "undefined") {
        canal = new BroadcastChannel("monki-almacen");
        canal.onmessage = alCambiarOtraPestana;
      }
    } catch (e) {
      console.warn("[almacen] IndexedDB no disponible, se usa localStorage:", e?.message || e);
      idb = null;
      cache.clear();
    }
  })();
  return iniciado;
}

// Otra pestaña cambió algo: refrescar esa clave desde IndexedDB
async function alCambiarOtraPestana({ data }) {
  if (!idb || !data?.clave) return;
  try {
    const v = await transaccion("readonly", (tabla, listo) => {
      const p = tabla.get(data.clave); p.onsuccess = () => listo(p.result);
    });
    if (v === undefined) cache.delete(data.clave); else cache.set(data.clave, v);
    window.dispatchEvent(new CustomEvent("organizalo:sync", { detail: { updatedAt: new Date().toISOString() } }));
  } catch { /* se corrige en la próxima sincronización */ }
}

const usaIdb = k => idb && esDatoDelNegocio(k);

// ── API ──────────────────────────────────────────────────────────────────────
/** Lee una clave (sincrónico). Devuelve una copia: modificarla no cambia lo guardado. */
export function leer(clave, porDefecto = null) {
  if (usaIdb(clave)) return cache.has(clave) ? copia(cache.get(clave)) : porDefecto;
  try {
    const raw = localStorage.getItem(clave);
    return raw !== null ? JSON.parse(raw) : porDefecto;
  } catch { return porDefecto; }
}

/**
 * Guarda una clave. La memoria se actualiza al instante; la promesa se cumple
 * cuando quedó escrito en disco y FALLA si no se pudo (espacio lleno, etc.).
 */
export async function escribir(clave, valor) {
  if (!usaIdb(clave)) {
    if (valor === null || valor === undefined) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor)); // lanza si no hay espacio
    return;
  }
  const anterior = cache.get(clave);
  const puesto = (valor === null || valor === undefined) ? undefined : copia(valor);
  if (puesto === undefined) cache.delete(clave); else cache.set(clave, puesto);
  try {
    await guardarIdb([[clave, valor]]);
    canal?.postMessage({ clave });
  } catch (e) {
    // Deshacer solo si nadie escribió esa clave después
    if (cache.get(clave) === puesto) { if (anterior === undefined) cache.delete(clave); else cache.set(clave, anterior); }
    window.dispatchEvent(new CustomEvent("monki:almacen-error", { detail: { clave, error: e } }));
    throw new Error("No se pudo guardar en este dispositivo (¿poco espacio disponible?). " + (e?.message || ""));
  }
}

export const borrar = clave => escribir(clave, null);

/** Todas las claves del negocio guardadas (IndexedDB + localStorage). */
export function claves() {
  const todas = new Set(idb ? cache.keys() : []);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIJO)) todas.add(k);
  }
  return [...todas];
}

/** Guarda muchas claves en una sola escritura (usado por la sincronización). */
export async function escribirVarias(datos) {
  const pares = Object.entries(datos || {});
  const enIdb = pares.filter(([k]) => usaIdb(k));
  for (const [k, v] of pares.filter(([k]) => !usaIdb(k))) {
    if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  }
  if (!enIdb.length) return;
  const anteriores = enIdb.map(([k]) => [k, cache.get(k)]);
  for (const [k, v] of enIdb) (v === null || v === undefined) ? cache.delete(k) : cache.set(k, copia(v));
  try {
    await guardarIdb(enIdb);
    enIdb.forEach(([clave]) => canal?.postMessage({ clave }));
  } catch (e) {
    for (const [k, v] of anteriores) v === undefined ? cache.delete(k) : cache.set(k, v);
    window.dispatchEvent(new CustomEvent("monki:almacen-error", { detail: { error: e } }));
    throw e;
  }
}

/** Borra todos los datos del negocio de este dispositivo, excepto las claves indicadas. */
export async function borrarDatosDelNegocio(conservar = new Set()) {
  const aBorrar = claves().filter(k => !conservar.has(k) && !EN_LOCALSTORAGE.has(k));
  const nulos = Object.fromEntries(aBorrar.map(k => [k, null]));
  await escribirVarias(nulos);
}

/** Espacio usado/disponible (para mostrar en Configuración). */
export async function espacio() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage || 0, total: e.quota || 0, motor: idb ? "IndexedDB" : "localStorage" } : null;
  } catch { return null; }
}
