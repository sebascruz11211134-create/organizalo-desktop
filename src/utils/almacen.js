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
 *  • Si el navegador tiene IndexedDB pero no abre, el almacén queda BLOQUEADO
 *    (la app pide reintentar): nunca se trabaja sobre una copia vacía ni se
 *    escriben datos en otro lado que después haya que combinar.
 *  • Cada espacio queda ligado a la sesión con que se abrió: si en otra pestaña
 *    entra o sale una cuenta, las escrituras de la sesión vieja se rechazan.
 *  • Solo en navegadores sin IndexedDB se usa localStorage, como antes.
 */

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
const REGISTRO    = "monki:espacios";     // { empresa: última vez abierto } — solo informativo
const MARCA_SESION = "monki:sesion";      // cambia en cada login/logout (compartida entre pestañas)

export const esDatoDelNegocio = k => typeof k === "string" && k.startsWith(PREFIJO) && !EN_LOCALSTORAGE.has(k);

const cache = new Map();
const generacion = new Map(); // clave → número de la última escritura (para deshacer solo la propia)
let contador = 0;
let idb = null;              // conexión del espacio abierto; null = localStorage o sin sesión
let espacioAbierto = null;   // empresa cuyo espacio está abierto
let bloqueo = null;          // Error si el espacio existe pero no se pudo abrir
let iniciado = null;         // promesa de iniciarAlmacen()
let canal = null;            // aviso entre pestañas del mismo espacio
let sesionLigada = null;     // marca de sesión con la que se abrió el espacio
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
// ── ¿De qué empresa son unos datos viejos? ───────────────────────────────────
// Señales: la marca de dueño y las claves "syncBaseline:<empresa>". Si no hay
// ninguna, el dueño es desconocido; si hay varias distintas, es AMBIGUO. En
// ambos casos no se migra solo: se pregunta al usuario (ver datosSinDueno).
const AMBIGUO = Symbol("ambiguo");
function senalesDeDueno(claves) {
  const c = new Set();
  const marca = localStorage.getItem(MARCA_DUENO);
  if (marca) c.add(marca);
  for (const k of claves) if (k.startsWith(PREFIJO_BASELINE)) c.add(k.slice(PREFIJO_BASELINE.length));
  return c.size === 0 ? null : c.size === 1 ? [...c][0] : AMBIGUO;
}

const estable = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x);

// Listas con id se pueden unir sin perder registros (gana lo que ya estaba en el espacio)
function fusionarPorId(enEspacio, viejo) {
  const conId = l => Array.isArray(l) && l.every(x => x && typeof x === "object" && x.id != null);
  if (!conId(enEspacio) || !conId(viejo)) return undefined;
  const porId = new Map(viejo.map(x => [x.id, x]));
  for (const x of enEspacio) porId.set(x.id, x);
  return [...porId.values()];
}

/**
 * Copia pares al espacio de una empresa y devuelve las claves que quedaron A SALVO
 * (copiadas, idénticas a lo que ya había o —si se permite— unidas por id). Solo
 * esas se pueden borrar del origen; el resto se deja intacto.
 */
async function copiarAEspacio(cubeta, pares, conexionAbierta, { unir = false } = {}) {
  const aSalvo = new Set();
  if (!pares.length) return aSalvo;
  const conexion = conexionAbierta || await abrir(nombreBase(cubeta));
  try {
    const actuales = new Map(await leerTodoIdb(conexion));
    const escribirPares = [];
    for (const [k, v] of pares) {
      if (v === null) {
        // Valor vacío (borrado) de la versión anterior: seguro solo si el espacio tampoco lo tiene
        if (!actuales.has(k)) aSalvo.add(k);
        continue;
      }
      if (!actuales.has(k)) { escribirPares.push([k, v]); aSalvo.add(k); continue; }
      if (estable(actuales.get(k)) === estable(v)) { aSalvo.add(k); continue; }
      const unido = unir ? fusionarPorId(actuales.get(k), v) : undefined;
      if (unido) { escribirPares.push([k, unido]); aSalvo.add(k); }
      // distinto y no se puede unir: no se toca ninguna de las dos copias
    }
    if (escribirPares.length) await guardarIdb(conexion, escribirPares); // una sola transacción
  } finally {
    if (!conexionAbierta) conexion.close();
  }
  registrar(cubeta);
  return aSalvo;
}

function clavesDelNegocioEnLocal() {
  const claves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (esDatoDelNegocio(k)) claves.push(k);
  }
  return claves;
}

/**
 * Datos del negocio que quedaron en localStorage → espacio de su dueño.
 * duenoSeguro: la empresa actual es la dueña cuando NO hay señales (sesión que
 * ya estaba abierta y confirmada en este equipo). forzar: el usuario confirmó
 * que son de la empresa actual (se ignoran las señales y se une por id).
 */
async function migrarLocalStorage(cubetaActual, conexionActual, { duenoSeguro = false, forzar = false } = {}) {
  const claves = clavesDelNegocioEnLocal();
  if (!claves.length) return;
  const senal = senalesDeDueno(claves);
  const dueno = forzar ? cubetaActual
    : senal === AMBIGUO ? null
    : senal || (duenoSeguro ? cubetaActual : null);
  if (!dueno) return; // no se sabe de quién son: quedan intactos hasta que alguien lo confirme
  const pares = [];
  const crudos = new Map();
  for (const k of claves) {
    const crudo = localStorage.getItem(k);
    if (crudo === null) continue;                          // otra pestaña ya la movió
    let valor;
    try { valor = JSON.parse(crudo); } catch { continue; } // no es JSON: se deja donde está
    pares.push([k, valor]);
    crudos.set(k, crudo);
  }
  const aSalvo = await copiarAEspacio(dueno, pares,
    dueno === cubetaActual ? conexionActual : null, { unir: forzar });
  // Solo se borra lo confirmado y si nadie lo cambió mientras tanto (p. ej. una
  // pestaña con la versión anterior que no respeta el candado)
  for (const k of aSalvo) if (localStorage.getItem(k) === crudos.get(k)) localStorage.removeItem(k);
  if (!clavesDelNegocioEnLocal().length) localStorage.removeItem(MARCA_DUENO);
}

// ── Abrir / cerrar espacios ──────────────────────────────────────────────────
// Una sesión solo es "confirmada" cuando el login terminó entero. Un login
// cortado a la mitad deja la marca de pendiente y nunca se trata como dueño seguro.
const MARCA_CONFIRMADA = "monki:sesionConfirmada";
const MARCA_PENDIENTE  = "monki:loginPendiente";
export function marcarLoginPendiente(user) { localStorage.setItem(MARCA_PENDIENTE, cubetaDe(user) || "?"); }
export function confirmarLogin(user) {
  localStorage.setItem(MARCA_CONFIRMADA, cubetaDe(user) || "");
  localStorage.removeItem(MARCA_PENDIENTE);
}

/** Arranque: abre el espacio de la sesión guardada (si hay). */
export function iniciarAlmacen() {
  if (iniciado) return iniciado;
  const cubeta = cubetaDeSesion();
  // Sesión de la versión anterior de producción: nunca pasó por el login nuevo
  const sesionHeredada = cubeta && !localStorage.getItem(MARCA_SESION) && !localStorage.getItem(MARCA_PENDIENTE);
  if (sesionHeredada) {
    localStorage.setItem(MARCA_SESION, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(MARCA_CONFIRMADA, cubeta);
  }
  // Login que se cortó a la mitad: las credenciales pueden estar mezcladas (token
  // de una cuenta, usuario de otra). Se descartan y se pide entrar de nuevo.
  if (localStorage.getItem(MARCA_PENDIENTE)) {
    ["@finanzia/authToken", "@finanzia/refreshToken", "@finanzia/authUser", "@finanzia/modulosHabilitados"]
      .forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(MARCA_PENDIENTE);
    iniciado = Promise.resolve();
    return iniciado;
  }
  // Mientras otra pestaña cierra la sesión no se abre nada
  if (sesionCerrada()) { iniciado = Promise.resolve(); return iniciado; }
  const duenoSeguro = !!cubeta && localStorage.getItem(MARCA_CONFIRMADA) === cubeta;
  // Un error acá (p. ej. navegador sin IndexedDB con datos de otra empresa) bloquea
  // la app en vez de abrirla leyendo datos ajenos
  iniciado = abrirEspacio(cubeta, { duenoSeguro }).catch(e => { bloqueo = bloqueo || (e instanceof Error ? e : new Error(String(e))); });
  return iniciado;
}

let cola = Promise.resolve();
/**
 * Abre el espacio de una empresa (recibe el usuario o el id de la empresa).
 * Si había otro abierto lo cierra SIN borrarlo. Falla si el almacén quedó bloqueado.
 */
export function abrirEspacio(userOCubeta, { duenoSeguro = false } = {}) {
  // En fila: arranque, login y sincronización pueden pedirlo a la vez
  const siguiente = cola.then(() => abrirEspacioAhora(userOCubeta, duenoSeguro));
  cola = siguiente.catch(() => {});
  return siguiente;
}

async function abrirEspacioAhora(userOCubeta, duenoSeguro) {
  const cubeta = typeof userOCubeta === "string" ? userOCubeta : cubetaDe(userOCubeta);
  if (!cubeta) return;
  if (!hayIndexedDB()) return usarLocalStorage(cubeta, duenoSeguro);
  if (idb && espacioAbierto === cubeta) return;
  cerrarEspacio();
  bloqueo = null;

  let conexion;
  const datos = new Map();
  try {
    conexion = await abrir(nombreBase(cubeta));
    await conCandado("monki-migracion", async () => {
      await migrarLocalStorage(cubeta, conexion, { duenoSeguro });
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
    // Nunca caer a otro almacenamiento: podría ser una copia vacía de datos que sí existen
    bloqueo = e instanceof Error ? e : new Error(String(e));
    avisarError(MSJ_BLOQUEO, e);
    throw new Error(MSJ_BLOQUEO);
  }

  // Recién ahora la app pasa a usar este espacio
  for (const [k, v] of datos) cache.set(k, v);
  idb = conexion;
  espacioAbierto = cubeta;
  sesionLigada = localStorage.getItem(MARCA_SESION);
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

// Sin IndexedDB (navegadores muy viejos): todo en localStorage, sin espacios
// separados. Si hay datos de OTRA empresa no se borran: se pide cerrar esa
// cuenta primero (así se suben sus cambios pendientes).
function usarLocalStorage(cubeta, duenoSeguro) {
  const claves = clavesDelNegocioEnLocal();
  const senal = senalesDeDueno(claves);
  const dueno = senal === AMBIGUO ? null : senal || (duenoSeguro ? cubeta : null);
  if (claves.length && dueno !== cubeta) {
    throw new Error("Este navegador tiene datos de otra empresa o de una sesión anterior. Entrá con esa cuenta y cerrá sesión antes de usar otra.");
  }
  localStorage.setItem(MARCA_DUENO, cubeta);
  espacioAbierto = cubeta;
  sesionLigada = localStorage.getItem(MARCA_SESION);
}

/** Cierra el espacio abierto sin borrar nada (al cerrar sesión o cambiar de cuenta). */
export function cerrarEspacio() {
  try { canal?.close(); } catch { /* ignorar */ }
  try { idb?.close(); } catch { /* ignorar */ }
  canal = null; idb = null; espacioAbierto = null; sesionLigada = null;
  cache.clear();
  generacion.clear();
}

/** Elimina el espacio de una empresa de este equipo (solo cuando todo está sincronizado). */
export async function borrarEspacio(cubeta = espacioAbierto) {
  if (!cubeta) return;
  if (cubeta === espacioAbierto) cerrarEspacio();
  if (hayIndexedDB()) await borrarBase(nombreBase(cubeta));
  else {
    // Sin IndexedDB: los datos están en localStorage
    const aBorrar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (esDatoDelNegocio(k)) aBorrar.push(k);
    }
    aBorrar.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(MARCA_DUENO);
  }
  registrar(cubeta, false);
}

export const espacioActual = () => espacioAbierto;
const sesionCerrada = () => (localStorage.getItem(MARCA_SESION) || "").startsWith("cerrada");
/** Liga el espacio abierto a la sesión actual (lo llama el login después de publicarla). */
export function ligarSesion() { if (espacioAbierto) sesionLigada = localStorage.getItem(MARCA_SESION); }

/** ¿Quedaron en este equipo datos de una sesión anterior sin dueño identificable? */
export function datosSinDueno() {
  if (!idb) return false;
  const claves = clavesDelNegocioEnLocal();
  if (!claves.length) return false;
  const senal = senalesDeDueno(claves);
  return senal === null || senal === AMBIGUO; // (con un dueño claro ya se movieron solas)
}

/** El usuario confirmó que esos datos son de la empresa abierta: se incorporan a su espacio. */
export async function adoptarDatosSinDueno() {
  if (!idb || !espacioAbierto) return;
  await conCandado("monki-migracion", () => migrarLocalStorage(espacioAbierto, idb, { forzar: true }));
  for (const [k, v] of await leerTodoIdb(idb)) if (esDatoDelNegocio(k)) cache.set(k, v);
  canal?.postMessage({ claves: [...cache.keys()] });
}
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
  if (pares.some(([k]) => esDatoDelNegocio(k))) {
    if (bloqueo) throw new Error(MSJ_BLOQUEO);
    // Otra pestaña cambió la sesión (entró otra cuenta o se cerró): no escribir con la vieja
    if (sesionCerrada() || (espacioAbierto && localStorage.getItem(MARCA_SESION) !== sesionLigada)) {
      throw new Error("La sesión cambió en otra pestaña. Recargá la página.");
    }
  }
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

/** Lee una clave directo de IndexedDB (lo último confirmado, aunque venga de otra pestaña). */
export async function leerDeDisco(clave, porDefecto = null) {
  if (!usaIdb(clave)) return leer(clave, porDefecto);
  const v = await transaccion(idb, "readonly", (tabla, listo) => {
    const p = tabla.get(clave); p.onsuccess = () => listo(p.result);
  });
  return v === undefined ? porDefecto : copia(v);
}

/** Ejecuta fn con un candado compartido entre pestañas (operaciones que no pueden correr dos veces). */
export const conCandadoEntrePestanas = (nombre, fn) => conCandado(`monki-${nombre}`, fn);

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
