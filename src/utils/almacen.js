/**
 * almacen.js — Dónde vive la información del negocio en el navegador.
 *
 * Antes todo iba a localStorage (~5 MB por sitio): una empresa con un año de
 * facturas, clientes y fotos lo llenaba y los datos nuevos dejaban de guardarse
 * sin aviso. Ahora los datos del negocio van a IndexedDB (cientos de MB) con
 * una copia en memoria, así que leer sigue siendo inmediato y sincrónico.
 *
 *  • Sesión y preferencias chicas (token, usuario, onboarding…) siguen en localStorage.
 *  • Al iniciar se migra lo que haya en localStorage, con un candado para que
 *    dos pestañas no migren a la vez. Solo se borra de localStorage lo que ya
 *    quedó confirmado en IndexedDB.
 *  • Sin IndexedDB se usa localStorage ("respaldo"). Si luego IndexedDB vuelve,
 *    lo escrito en el respaldo se COMBINA con lo guardado (nunca lo pisa).
 *  • Varias pestañas abiertas se avisan los cambios entre sí.
 */

const BASE = "monki";
const TABLA = "datos";
const PREFIJO = "@finanzia/";
// Se quedan en localStorage: son chicas y otras partes las leen al instante.
const EN_LOCALSTORAGE = new Set([
  "@finanzia/authToken", "@finanzia/refreshToken", "@finanzia/authUser", "@finanzia/modulosHabilitados",
  "@finanzia/onboarding_completado", "@finanzia/chatWidgetPos",
]);
// Marcas internas (sin el prefijo del negocio: nunca se sincronizan)
const MARCA_MIGRADO  = "monki:almacenEnIndexedDB";  // este equipo ya usa IndexedDB
const MARCA_RESPALDO = "monki:datosEnRespaldo";     // hubo escrituras en localStorage sin IndexedDB

export const esDatoDelNegocio = k => typeof k === "string" && k.startsWith(PREFIJO) && !EN_LOCALSTORAGE.has(k);

const cache = new Map();
let idb = null;          // conexión lista; null = modo respaldo (localStorage)
let iniciado = null;     // promesa de iniciarAlmacen()
let canal = null;        // aviso entre pestañas; se abre solo si IndexedDB funciona
const hayIndexedDB = () => typeof indexedDB !== "undefined";

const copia = v => (v === null || v === undefined || typeof v !== "object") ? v
  : (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

const avisarError = (mensaje, error) =>
  window.dispatchEvent?.(new CustomEvent("monki:almacen-error", { detail: { mensaje, error } }));

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

// Candado entre pestañas (Web Locks); sin soporte, se ejecuta directo
const conCandado = (nombre, fn) => navigator.locks?.request ? navigator.locks.request(nombre, fn) : fn();

// Lo escrito en el respaldo es más nuevo: listas con id se unen (gana el
// respaldo en el mismo id) para no perder nada; el resto lo toma el respaldo.
function combinar(guardado, respaldo) {
  const conId = l => Array.isArray(l) && l.every(x => x && typeof x === "object" && x.id != null);
  if (conId(guardado) && conId(respaldo)) {
    const porId = new Map(guardado.map(x => [x.id, x]));
    for (const x of respaldo) porId.set(x.id, x);
    return [...porId.values()];
  }
  return respaldo;
}

// ── Arranque y migración ─────────────────────────────────────────────────────
export function iniciarAlmacen() {
  if (iniciado) return iniciado;
  iniciado = (async () => {
    if (!hayIndexedDB()) return;
    let conexion;
    try {
      conexion = await abrir();
    } catch (e) {
      console.warn("[almacen] IndexedDB no disponible, se usa localStorage:", e?.message || e);
      if (localStorage.getItem(MARCA_MIGRADO)) {
        avisarError("No se pudo abrir el almacenamiento de este dispositivo. Recargá la página antes de seguir trabajando.", e);
      }
      return;
    }

    const datos = new Map();
    try {
      await conCandado("monki-migracion", async () => {
        const respaldoMasNuevo = localStorage.getItem(MARCA_RESPALDO) !== null;
        for (const [k, v] of await leerTodoIdb(conexion)) {
          if (esDatoDelNegocio(k)) { datos.set(k, v); continue; }
          // Clave que debe vivir en localStorage (p. ej. se agregó a EN_LOCALSTORAGE después)
          if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v));
          await guardarIdb(conexion, [[k, null]]);
        }

        const pendientes = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (esDatoDelNegocio(k)) pendientes.push(k);
        }
        const nuevos = [];
        const aLiberar = [];
        for (const k of pendientes) {
          const crudo = localStorage.getItem(k);
          if (crudo === null) continue;                          // otra pestaña ya la movió
          let valor;
          try { valor = JSON.parse(crudo); } catch { continue; } // no es JSON: se deja donde está
          if (valor === null) { aLiberar.push(k); continue; }
          if (datos.has(k)) {
            // Ya estaba en IndexedDB: solo el respaldo (escrito sin IndexedDB) trae algo más nuevo
            if (respaldoMasNuevo) nuevos.push([k, combinar(datos.get(k), valor)]);
            aLiberar.push(k);
            continue;
          }
          nuevos.push([k, valor]);
          aLiberar.push(k);
        }
        if (nuevos.length) await guardarIdb(conexion, nuevos); // una sola transacción
        nuevos.forEach(([k, v]) => datos.set(k, v));
        aLiberar.forEach(k => localStorage.removeItem(k));    // solo después del commit
        localStorage.removeItem(MARCA_RESPALDO);
        localStorage.setItem(MARCA_MIGRADO, "1");
      });
    } catch (e) {
      // Nada se borró de localStorage sin estar confirmado en IndexedDB: seguir en respaldo
      console.warn("[almacen] No se pudo migrar; se sigue con localStorage:", e?.message || e);
      try { conexion.close(); } catch { /* ignorar */ }
      if (localStorage.getItem(MARCA_MIGRADO)) {
        avisarError("No se pudo abrir el almacenamiento de este dispositivo. Recargá la página antes de seguir trabajando.", e);
      }
      return;
    }

    // Recién ahora la app pasa a usar IndexedDB
    for (const [k, v] of datos) cache.set(k, v);
    idb = conexion;

    // Extras: si fallan no afectan los datos
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignorar */ }
    try {
      if (typeof BroadcastChannel !== "undefined") {
        canal = new BroadcastChannel("monki-almacen");
        canal.onmessage = alCambiarOtraPestana;
        canal.unref?.(); // en Node (pruebas) no mantener vivo el proceso
      }
    } catch { canal = null; }
  })();
  return iniciado;
}

// Otra pestaña cambió algo: refrescar esas claves desde IndexedDB
async function alCambiarOtraPestana({ data }) {
  if (!idb) return;
  const lista = data?.claves || [];
  try {
    for (const clave of lista) {
      const v = await transaccion(idb, "readonly", (tabla, listo) => {
        const p = tabla.get(clave); p.onsuccess = () => listo(p.result);
      });
      if (v === undefined) cache.delete(clave); else cache.set(clave, v);
    }
    if (lista.length) window.dispatchEvent?.(new CustomEvent("organizalo:sync", { detail: { updatedAt: new Date().toISOString() } }));
  } catch { /* se corrige en la próxima sincronización */ }
}

const usaIdb = k => idb && esDatoDelNegocio(k);

function escribirRespaldo(k, v) {
  if (v === null || v === undefined) localStorage.removeItem(k);
  else localStorage.setItem(k, JSON.stringify(v)); // lanza si no hay espacio
  // Este equipo tiene IndexedDB pero no se pudo usar: lo del respaldo es lo más nuevo
  if (hayIndexedDB() && esDatoDelNegocio(k)) localStorage.setItem(MARCA_RESPALDO, new Date().toISOString());
}

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
  return escribirVarias({ [clave]: valor });
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

/** Guarda muchas claves en una sola transacción (null = borrar la clave). */
export async function escribirVarias(datos) {
  const pares = Object.entries(datos || {});
  for (const [k, v] of pares.filter(([k]) => !usaIdb(k))) escribirRespaldo(k, v);
  const enIdb = pares.filter(([k]) => usaIdb(k));
  if (!enIdb.length) return;
  // Memoria al instante; se recuerda qué se puso para deshacer solo eso si falla
  const cambios = enIdb.map(([k, v]) => {
    const anterior = cache.get(k);
    const puesto = (v === null || v === undefined) ? undefined : copia(v);
    if (puesto === undefined) cache.delete(k); else cache.set(k, puesto);
    return { k, anterior, puesto };
  });
  try {
    await guardarIdb(idb, enIdb);
    canal?.postMessage({ claves: enIdb.map(([k]) => k) });
  } catch (e) {
    for (const { k, anterior, puesto } of cambios) {
      if (cache.get(k) !== puesto) continue; // alguien escribió después: no pisarlo
      if (anterior === undefined) cache.delete(k); else cache.set(k, anterior);
    }
    avisarError("No se pudo guardar un cambio en este dispositivo (¿poco espacio?). Liberá espacio o sincronizá antes de seguir.", e);
    throw new Error("No se pudo guardar en este dispositivo (¿poco espacio disponible?). " + (e?.message || ""));
  }
}

/** Borra todos los datos del negocio de este dispositivo, excepto las claves indicadas. */
export async function borrarDatosDelNegocio(conservar = new Set()) {
  const aBorrar = claves().filter(k => !conservar.has(k) && !EN_LOCALSTORAGE.has(k));
  await escribirVarias(Object.fromEntries(aBorrar.map(k => [k, null])));
}

// ── Dueño de los datos ───────────────────────────────────────────────────────
// Los datos locales pertenecen a una sola empresa. Si entra otra cuenta/empresa
// en el mismo equipo, se borran antes de mostrarlos o sincronizarlos, para que
// nunca se mezclen ni se suban al servidor de otra empresa.
const MARCA_DUENO = "monki:duenoDatos";
export const cubetaDe = user => user ? String(user.empresaId || user.empresa_id || user.id || "") || null : null;

export async function asegurarDueno(user) {
  const cubeta = cubetaDe(user);
  if (!cubeta) return;
  const anterior = localStorage.getItem(MARCA_DUENO);
  if (anterior && anterior !== cubeta) await borrarDatosDelNegocio();
  localStorage.setItem(MARCA_DUENO, cubeta);
}

/** Espacio usado/disponible (para mostrar en Configuración). */
export async function espacio() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage || 0, total: e.quota || 0, motor: idb ? "IndexedDB" : "localStorage" } : null;
  } catch { return null; }
}
