/**
 * almacen.js — Dónde vive la información del negocio en el navegador.
 *
 * Antes todo iba a localStorage (~5 MB por sitio): una empresa con un año de
 * facturas, clientes y fotos lo llenaba y los datos nuevos dejaban de guardarse
 * sin aviso. Ahora los datos del negocio van a IndexedDB (cientos de MB) con
 * una copia en memoria, así que leer sigue siendo inmediato y sincrónico.
 *
 *  • Cada empresa tiene su PROPIO espacio en el equipo (base "monki-<empresa>").
 *    Si entra otra cuenta, se abre su espacio y el de la anterior queda aparte,
 *    intacto (incluidos cambios sin sincronizar): nunca se mezclan ni se borran.
 *  • Sesión y preferencias chicas (token, usuario, onboarding…) siguen en localStorage.
 *  • Lo que había en localStorage (versión anterior) se mueve al espacio de su
 *    empresa, con un candado para que dos pestañas no lo hagan a la vez, y solo
 *    se borra de localStorage después de confirmar que quedó en IndexedDB.
 *  • Si el espacio de una empresa YA existe pero IndexedDB no abre, el almacén
 *    queda BLOQUEADO (la app pide reintentar): nunca se trabaja sobre una copia
 *    vacía ni se escriben datos en otro lado que después haya que combinar.
 *  • Solo en navegadores sin IndexedDB se usa localStorage, como antes.
 */

const BASE_VIEJA = "monki";                  // versión anterior: una sola base para todo
const nombreBase = cubeta => `monki-${cubeta}`;
const TABLA = "datos";
const PREFIJO = "@finanzia/";
const PREFIJO_BASELINE = "@finanzia/syncBaseline:";
// Se quedan en localStorage: son chicas y otras partes las leen al instante.
const EN_LOCALSTORAGE = new Set([
  "@finanzia/authToken", "@finanzia/refreshToken", "@finanzia/authUser", "@finanzia/modulosHabilitados",
  "@finanzia/onboarding_completado", "@finanzia/chatWidgetPos",
]);
// Marcas internas (sin el prefijo del negocio: nunca se sincronizan)
const MARCA_DUENO = "monki:duenoDatos";   // empresa dueña de los datos que haya en localStorage
const REGISTRO    = "monki:espacios";     // { empresa: última vez abierto } — espacios que existen

export const esDatoDelNegocio = k => typeof k === "string" && k.startsWith(PREFIJO) && !EN_LOCALSTORAGE.has(k);

const cache = new Map();
const generacion = new Map(); // clave → número de la última escritura (para deshacer solo la propia)
let contador = 0;
let idb = null;              // conexión del espacio abierto; null = localStorage o sin sesión
let espacioAbierto = null;   // empresa cuyo espacio está abierto
let bloqueo = null;          // Error si el espacio existe pero no se pudo abrir
let iniciado = null;         // promesa de iniciarAlmacen()
let canal = null;            // aviso entre pestañas del mismo espacio
const hayIndexedDB = () => typeof indexedDB !== "undefined";

const copia = v => (v === null || v === undefined || typeof v !== "object") ? v
  : (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

const MSJ_BLOQUEO = "No se pudo abrir el almacenamiento de este dispositivo. Recargá la página antes de seguir trabajando.";
const avisarError = (mensaje, error) =>
  window.dispatchEvent?.(new CustomEvent("monki:almacen-error", { detail: { mensaje, error } }));

// ── IndexedDB con promesas ───────────────────────────────────────────────────
function abrir(nombre, alCrear) {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(nombre, 1);
    pedido.onupgradeneeded = () => { pedido.result.createObjectStore(TABLA); alCrear?.(); };
    pedido.onsuccess = () => {
      const conexion = pedido.result;
      conexion.onversionchange = () => conexion.close(); // otra pestaña quiere borrarla
      resolve(conexion);
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error("IndexedDB bloqueado por otra pestaña"));
  });
}

function transaccion(conexion, modo, trabajo) {
  return new Promise((resolve, reject) => {
    const tx = conexion.transaction(TABLA, modo);
    const tabla = tx.objectStore(TABLA);
    let resultado;
    trabajo(tabla, r => { resultado = r; });
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Escritura cancelada"));
  });
}

function leerTodoIdb(conexion) {
  return transaccion(conexion, "readonly", (tabla, listo) => {
    const pares = [];
    const cursor = tabla.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { pares.push([c.key, c.value]); c.continue(); } else listo(pares);
    };
  });
}

// null/undefined = borrar la clave
const guardarIdb = (conexion, pares) => transaccion(conexion, "readwrite", tabla => {
  for (const [k, v] of pares) (v === null || v === undefined) ? tabla.delete(k) : tabla.put(v, k);
});

function borrarBase(nombre) {
  return new Promise(resolve => {
    const p = indexedDB.deleteDatabase(nombre);
    p.onsuccess = p.onerror = () => resolve();
    p.onblocked = () => resolve(); // se completa sola cuando otra pestaña la suelte
  });
}

// Candado entre pestañas (Web Locks); sin soporte, se ejecuta directo
const conCandado = (nombre, fn) => navigator.locks?.request ? navigator.locks.request(nombre, fn) : fn();

// ── Registro de espacios y dueños ────────────────────────────────────────────
export const cubetaDe = user => user ? String(user.empresaId || user.empresa_id || user.id || "") || null : null;
function cubetaDeSesion() {
  try { return cubetaDe(JSON.parse(localStorage.getItem("@finanzia/authUser"))); } catch { return null; }
}
const leerRegistro = () => { try { return JSON.parse(localStorage.getItem(REGISTRO) || "{}"); } catch { return {}; } };
function registrar(cubeta, existe = true) {
  try {
    const r = leerRegistro();
    if (existe) r[cubeta] = new Date().toISOString(); else delete r[cubeta];
    localStorage.setItem(REGISTRO, JSON.stringify(r));
  } catch { /* solo informativo */ }
}
// La clave del baseline de sincronización dice de qué empresa son unos datos
const cubetaDeClaves = claves => claves.find(k => k.startsWith(PREFIJO_BASELINE))?.slice(PREFIJO_BASELINE.length) || null;

// Agrega pares a un espacio sin pisar lo que ya tenga (lo que ya está manda)
async function agregarFaltantes(cubeta, pares, conexionAbierta) {
  if (!pares.length) return;
  const conexion = conexionAbierta || await abrir(nombreBase(cubeta));
  try {
    const yaEstan = new Set((await leerTodoIdb(conexion)).map(([k]) => k));
    const faltan = pares.filter(([k]) => !yaEstan.has(k));
    if (faltan.length) await guardarIdb(conexion, faltan);
  } finally {
    if (!conexionAbierta) conexion.close();
  }
  registrar(cubeta);
}

// Versión con una sola base "monki": se pasa al espacio de su dueño y se elimina
async function migrarBaseVieja(cubetaActual, conexionActual) {
  let nueva = false;
  const vieja = await abrir(BASE_VIEJA, () => { nueva = true; });
  let pares = [];
  try { if (!nueva) pares = (await leerTodoIdb(vieja)).filter(([k]) => esDatoDelNegocio(k)); }
  finally { vieja.close(); }
  if (pares.length) {
    const dueno = localStorage.getItem(MARCA_DUENO) || cubetaDeClaves(pares.map(([k]) => k)) || cubetaActual;
    await agregarFaltantes(dueno, pares, dueno === cubetaActual ? conexionActual : null);
  }
  await borrarBase(BASE_VIEJA);
}

// Datos del negocio que quedaron en localStorage: al espacio de su dueño
async function migrarLocalStorage(cubetaActual, conexionActual) {
  const claves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (esDatoDelNegocio(k)) claves.push(k);
  }
  if (!claves.length) return;
  const pares = [];
  const aLiberar = [];
  for (const k of claves) {
    const crudo = localStorage.getItem(k);
    if (crudo === null) continue;                          // otra pestaña ya la movió
    let valor;
    try { valor = JSON.parse(crudo); } catch { continue; } // no es JSON: se deja donde está
    aLiberar.push(k);
    if (valor !== null) pares.push([k, valor]);
  }
  const dueno = localStorage.getItem(MARCA_DUENO) || cubetaDeClaves(claves) || cubetaActual;
  await agregarFaltantes(dueno, pares, dueno === cubetaActual ? conexionActual : null);
  aLiberar.forEach(k => localStorage.removeItem(k)); // solo después de confirmar la copia
  localStorage.removeItem(MARCA_DUENO);
}

// ── Abrir / cerrar espacios ──────────────────────────────────────────────────
/** Arranque: abre el espacio de la sesión guardada (si hay). */
export function iniciarAlmacen() {
  if (iniciado) return iniciado;
  iniciado = abrirEspacio(cubetaDeSesion()).catch(() => {});
  return iniciado;
}

let cola = Promise.resolve();
/**
 * Abre el espacio de una empresa (recibe el usuario o el id de la empresa).
 * Si había otro abierto lo cierra SIN borrarlo. Falla si el almacén quedó bloqueado.
 */
export function abrirEspacio(userOCubeta) {
  // En fila: arranque, login y sincronización pueden pedirlo a la vez
  const siguiente = cola.then(() => abrirEspacioAhora(userOCubeta));
  cola = siguiente.catch(() => {});
  return siguiente;
}

async function abrirEspacioAhora(userOCubeta) {
  const cubeta = typeof userOCubeta === "string" ? userOCubeta : cubetaDe(userOCubeta);
  if (!cubeta) return;
  if (!hayIndexedDB()) return usarLocalStorage(cubeta);
  if (idb && espacioAbierto === cubeta) return;
  cerrarEspacio();
  bloqueo = null;

  const yaExistia = !!leerRegistro()[cubeta];
  let conexion;
  const datos = new Map();
  try {
    conexion = await abrir(nombreBase(cubeta));
    await conCandado("monki-migracion", async () => {
      await migrarBaseVieja(cubeta, conexion);
      await migrarLocalStorage(cubeta, conexion);
      for (const [k, v] of await leerTodoIdb(conexion)) {
        if (esDatoDelNegocio(k)) { datos.set(k, v); continue; }
        // Clave que debe vivir en localStorage (p. ej. se agregó a EN_LOCALSTORAGE después)
        if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v));
        await guardarIdb(conexion, [[k, null]]);
      }
    });
  } catch (e) {
    try { conexion?.close(); } catch { /* ignorar */ }
    console.warn("[almacen] No se pudo abrir el espacio:", e?.message || e);
    if (yaExistia) {
      // Sus datos están en IndexedDB: trabajar sin ellos sería trabajar sobre una copia vacía
      bloqueo = e instanceof Error ? e : new Error(String(e));
      avisarError(MSJ_BLOQUEO, e);
      throw new Error(MSJ_BLOQUEO);
    }
    return usarLocalStorage(cubeta); // espacio nuevo: todo lo de esta empresa sigue en localStorage
  }

  // Recién ahora la app pasa a usar este espacio
  for (const [k, v] of datos) cache.set(k, v);
  idb = conexion;
  espacioAbierto = cubeta;
  registrar(cubeta);

  // Extras: si fallan no afectan los datos
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignorar */ }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      canal = new BroadcastChannel(`monki-almacen-${cubeta}`);
      canal.onmessage = alCambiarOtraPestana;
      canal.unref?.(); // en Node (pruebas) no mantener vivo el proceso
    }
  } catch { canal = null; }
}

// Sin IndexedDB: todo en localStorage (5 MB). Otra empresa en el mismo equipo
// no puede tener espacio propio aquí, así que se borran los datos de la anterior.
function usarLocalStorage(cubeta) {
  const dueno = localStorage.getItem(MARCA_DUENO);
  if (dueno && dueno !== cubeta) {
    const aBorrar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (esDatoDelNegocio(k)) aBorrar.push(k);
    }
    aBorrar.forEach(k => localStorage.removeItem(k));
  }
  localStorage.setItem(MARCA_DUENO, cubeta);
  espacioAbierto = cubeta;
}

/** Cierra el espacio abierto sin borrar nada (al cerrar sesión o cambiar de cuenta). */
export function cerrarEspacio() {
  try { canal?.close(); } catch { /* ignorar */ }
  try { idb?.close(); } catch { /* ignorar */ }
  canal = null; idb = null; espacioAbierto = null;
  cache.clear();
  generacion.clear();
}

/** Elimina el espacio de una empresa de este equipo (solo cuando todo está sincronizado). */
export async function borrarEspacio(cubeta = espacioAbierto) {
  if (!cubeta) return;
  if (cubeta === espacioAbierto) cerrarEspacio();
  if (hayIndexedDB()) await borrarBase(nombreBase(cubeta));
  registrar(cubeta, false);
}

export const espacioActual = () => espacioAbierto;
export const almacenBloqueado = () => bloqueo;

// Otra pestaña del mismo espacio cambió algo: refrescar esas claves
async function alCambiarOtraPestana({ data }) {
  if (!idb) return;
  const lista = data?.claves || [];
  try {
    for (const clave of lista) {
      const v = await transaccion(idb, "readonly", (tabla, listo) => {
        const p = tabla.get(clave); p.onsuccess = () => listo(p.result);
      });
      generacion.set(clave, ++contador);
      if (v === undefined) cache.delete(clave); else cache.set(clave, v);
    }
    if (lista.length) window.dispatchEvent?.(new CustomEvent("organizalo:sync", { detail: { updatedAt: new Date().toISOString() } }));
  } catch { /* se corrige en la próxima sincronización */ }
}

const usaIdb = k => idb && esDatoDelNegocio(k);

function escribirLocal(k, v) {
  if (v === null || v === undefined) localStorage.removeItem(k);
  else localStorage.setItem(k, JSON.stringify(v)); // lanza si no hay espacio
}

// ── API ──────────────────────────────────────────────────────────────────────
/** Lee una clave (sincrónico). Devuelve una copia: modificarla no cambia lo guardado. */
export function leer(clave, porDefecto = null) {
  if (usaIdb(clave)) return cache.has(clave) ? copia(cache.get(clave)) : porDefecto;
  if (bloqueo && esDatoDelNegocio(clave)) return porDefecto;
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
  return escribirVarias({ [clave]: valor });
}

export const borrar = clave => escribir(clave, null);

/** Todas las claves guardadas (espacio abierto + localStorage). */
export function claves() {
  const todas = new Set(idb ? cache.keys() : []);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIJO)) todas.add(k);
  }
  return [...todas];
}

/** Guarda muchas claves en una sola transacción (null = borrar la clave). */
export async function escribirVarias(datos) {
  const pares = Object.entries(datos || {});
  if (bloqueo && pares.some(([k]) => esDatoDelNegocio(k))) throw new Error(MSJ_BLOQUEO);
  for (const [k, v] of pares.filter(([k]) => !usaIdb(k))) escribirLocal(k, v);
  const enIdb = pares.filter(([k]) => usaIdb(k));
  if (!enIdb.length) return;
  const conexion = idb;
  // Memoria al instante; cada clave recuerda qué escritura fue la última
  const cambios = enIdb.map(([k, v]) => {
    const anterior = cache.get(k);
    const miGeneracion = ++contador;
    generacion.set(k, miGeneracion);
    if (v === null || v === undefined) cache.delete(k); else cache.set(k, copia(v));
    return { k, anterior, miGeneracion };
  });
  try {
    await guardarIdb(conexion, enIdb);
    canal?.postMessage({ claves: enIdb.map(([k]) => k) });
  } catch (e) {
    for (const { k, anterior, miGeneracion } of cambios) {
      if (idb !== conexion || generacion.get(k) !== miGeneracion) continue; // hubo otra escritura después
      if (anterior === undefined) cache.delete(k); else cache.set(k, anterior);
    }
    avisarError("No se pudo guardar un cambio en este dispositivo (¿poco espacio?). Liberá espacio o sincronizá antes de seguir.", e);
    throw new Error("No se pudo guardar en este dispositivo (¿poco espacio disponible?). " + (e?.message || ""));
  }
}

/** Borra todos los datos del negocio del espacio abierto, excepto las claves indicadas. */
export async function borrarDatosDelNegocio(conservar = new Set()) {
  const aBorrar = claves().filter(k => !conservar.has(k) && !EN_LOCALSTORAGE.has(k));
  await escribirVarias(Object.fromEntries(aBorrar.map(k => [k, null])));
}

/** Espacio usado/disponible (para mostrar en Configuración). */
export async function espacio() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage || 0, total: e.quota || 0, motor: idb ? "IndexedDB" : "localStorage" } : null;
  } catch { return null; }
}
