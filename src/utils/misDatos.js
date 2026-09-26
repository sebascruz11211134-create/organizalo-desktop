// "Respaldos y tus datos" (Configuración): estado de los respaldos automáticos y
// descarga de una copia de los datos de la empresa (Excel legible o JSON completo).
import { BACKEND } from "./config.js";
import db from "./db";

class SinConexion extends Error {}

async function pedir(ruta, token) {
  let res;
  try { res = await fetch(`${BACKEND}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); }
  catch (e) { throw new SinConexion(e.message); } // solo esto es "sin conexión"
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || `Error ${res.status}`); // 401/403/500: NO se usa la copia local
  }
  return res;
}

// Nunca salen del equipo PIN, contraseñas ni tokens (igual que en el servidor)
const CAMPO_SECRETO = /^(pin|pins|password|passwd|pass|contrasena|contraseña|clave_acceso|token|tokens|secret|secreto|refresh_token|api_key|apikey)$|(hash|_enc|Enc)$/i;
function sinSecretos(v) {
  if (Array.isArray(v)) return v.map(sinSecretos);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !CAMPO_SECRETO.test(k)).map(([k, x]) => [k, sinSecretos(x)]));
  return v;
}

export const estadoRespaldos = async token => (await pedir("/api/respaldos/estado", token)).json();

function bajar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const hoy = () => new Date().toISOString().slice(0, 10);

/** Copia completa (JSON) generada por el servidor: datos + comprobantes con su XML. */
export async function descargarJson(token) {
  const res = await pedir("/api/respaldos/mis-datos", token);
  bajar(await res.blob(), `monki-datos-${hoy()}.json`);
}

// Nombres de hoja de Excel: máximo 31 caracteres, sin []:*?/\ y sin repetir
function nombreHoja(clave, usados) {
  let n = String(clave).replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Datos";
  for (let i = 2; usados.has(n); i++) n = `${n.slice(0, 28)}~${i}`;
  usados.add(n);
  return n;
}
const plano = v => (v && typeof v === "object" ? JSON.stringify(v) : v);

/**
 * Excel con una hoja por módulo (clientes, facturas, productos…). Usa la copia del
 * servidor; si no hay conexión, los datos guardados en este equipo.
 */
export async function descargarExcel(token) {
  let datos, tablas = {}, otros = {}, noLegibles = [], omitidos = [], origen = "servidor";
  try {
    const exp = await (await pedir("/api/respaldos/mis-datos", token)).json();
    datos = exp.datos; tablas = exp.tablas || {}; otros = exp.otros || {}; noLegibles = exp.noLegibles || []; omitidos = exp.omitidosPorSeguridad || [];
  } catch (e) {
    if (!(e instanceof SinConexion)) throw e; // el servidor respondió que no: no se arma nada local
    origen = "este equipo (sin conexión)";
    const todo = await db.getAll();
    datos = Object.fromEntries(Object.entries(todo)
      .filter(([k]) => k.startsWith("@finanzia/") && !/authToken|refreshToken|authUser|syncBaseline|lastSync|usuarioActivo|modulosHabilitados/.test(k))
      .map(([k, v]) => [k.slice("@finanzia/".length), sinSecretos(v)]));
  }
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  const usados = new Set();
  const resumen = [{ Dato: "Generado", Valor: new Date().toLocaleString("es-CR") }, { Dato: "Origen", Valor: origen }];
  if (omitidos.length) resumen.push({ Dato: "No incluido por seguridad (sesiones y credenciales)", Valor: omitidos.map(o => o.clave).join(", ") });
  if (noLegibles.length) resumen.push({ Dato: "Datos que no se pudieron leer", Valor: noLegibles.map(n => n.clave).join(", ") });
  const agregar = (clave, filas) => {
    const hoja = XLSX.utils.json_to_sheet(filas.map(f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plano(v)]))));
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(clave, usados));
    resumen.push({ Dato: clave, Valor: `${filas.length} registros` });
  };
  for (const [clave, valor] of Object.entries(datos || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (Array.isArray(valor) && valor.length && valor.every(x => x && typeof x === "object")) agregar(clave, valor);
    else if (valor && typeof valor === "object" && !Array.isArray(valor)) agregar(clave, [valor]);
  }
  // Otros datos (historial y configuración de Rocky, conversaciones de WhatsApp…)
  for (const [clave, valor] of Object.entries(otros)) {
    if (Array.isArray(valor) && valor.length && valor.every(x => x && typeof x === "object")) agregar(`otros_${clave}`, valor);
    else if (valor && typeof valor === "object") agregar(`otros_${clave}`, [valor]);
    else if (valor != null) agregar(`otros_${clave}`, [{ valor }]);
  }
  for (const [tabla, filas] of Object.entries(tablas)) {
    // Los XML y textos técnicos van en la copia JSON; en Excel solo los datos legibles
    if (filas?.length) agregar(`tabla_${tabla}`, filas.map(({ xml_firmado_base64, xml_sin_firmar, respuesta_hacienda, ...resto }) => resto));
  }
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), nombreHoja("Resumen", usados));
  libro.SheetNames.unshift(libro.SheetNames.pop()); // Resumen primero
  const binario = XLSX.write(libro, { bookType: "xlsx", type: "array" });
  bajar(new Blob([binario], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `monki-datos-${hoy()}.xlsx`);
}
