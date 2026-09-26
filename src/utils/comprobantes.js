// Emisión de comprobantes electrónicos contra el backend.
//
// El backend guarda cada comprobante ANTES de firmarlo/enviarlo. Si algo falla
// responde error pero incluye `comprobante` (con su id y clave): hay que
// conservarlo y reintentar con reenviar(), nunca volver a emitir — eso crearía
// otra clave para la misma venta. La Idempotency-Key hace que repetir la misma
// emisión (doble clic, reintento tras corte) devuelva el mismo comprobante.

import { BACKEND } from "./config.js";
import { fechaLocal } from "./fmt.js";

// Estados que se pueden retomar con reenviar().
export const REINTENTABLES = new Set(["pendiente", "error_firma", "error_envio", "envio_incierto"]);

// Ya tiene un comprobante en Hacienda (o simulado): no se debe volver a emitir.
export const yaEnviada = nota =>
  !!nota?.haciendaEstado && nota.haciendaEstado !== "sin_conexion" && !REINTENTABLES.has(nota.haciendaEstado);

export function etiquetaEstado(estado) {
  switch (estado) {
    case "simulado":       return "Simulada (modo prueba)";
    case "enviado":        return "Enviada a Hacienda ✓";
    case "aceptado":
    case "aceptada":       return "Aceptada por Hacienda ✓";
    case "rechazado":      return "Rechazada por Hacienda";
    case "guardada":       return "Guardada como borrador";
    case "error_firma":    return "No se pudo firmar";
    case "error_envio":    return "Hacienda rechazó el envío";
    case "envio_incierto": return "Envío sin confirmar";
    case "sin_conexion":   return "Sin conexión con el servidor";
    default:               return "Pendiente de envío";
  }
}

async function llamar(path, { token, body, idempotencyKey }) {
  let res;
  try {
    res = await fetch(`${BACKEND}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body || {}),
    });
  } catch (err) {
    // No llegó al backend: es seguro reintentar con la misma Idempotency-Key.
    return { ok: false, comprobante: null, error: `Sin conexión con el servidor: ${err.message}` };
  }
  const json = await res.json().catch(() => null);
  if (res.ok) {
    // Un 200 con el cuerpo cortado o sin id/estado no confirma nada: se trata
    // como sin respuesta, para reintentar con la misma Idempotency-Key.
    if (!json?.id || !json?.estado) {
      return { ok: false, comprobante: null, error: "Respuesta incompleta del servidor; reintentá el envío." };
    }
    return { ok: true, comprobante: json, error: null };
  }
  if (!json) return { ok: false, comprobante: null, error: `Error ${res.status}`, status: res.status };
  return { ok: false, comprobante: json.comprobante || null, error: json.error || `Error ${res.status}`, faltantes: json.faltantes, status: res.status };
}

/** POST /api/invoices o /api/emision/nota-credito|nota-debito */
export const emitir = (path, body, { token, idempotencyKey }) => llamar(path, { token, body, idempotencyKey });

/** Retoma un comprobante guardado: /api/invoices/:id/reenviar o /api/emision/notas/:id/reenviar */
export const reenviar = (path, { token }) => llamar(path, { token });

// Campos de Hacienda para guardar en una nota local. Si no hubo respuesta del
// backend se conserva el estado fiscal previo (y su id, para seguir usando
// reenviar) y solo se anota el error de conexión.
export function camposHacienda(resultado, previo = {}) {
  const c = resultado.comprobante;
  if (!c) {
    return previo.haciendaId
      ? { haciendaError: resultado.error }
      : { haciendaEstado: "sin_conexion", haciendaError: resultado.error };
  }
  return {
    haciendaId: c.id,
    haciendaEstado: c.estado,
    haciendaClave: c.clave,
    haciendaConsecutivo: c.numeroConsecutivo,
    haciendaError: resultado.ok ? null : resultado.error,
  };
}

// ── Facturas ──────────────────────────────────────────────────────────────────
// Campos de Hacienda en el registro local de una factura (mismo criterio).
export function camposFactura(resultado, previo = {}) {
  const c = resultado.comprobante;
  if (!c) {
    return previo.haciendaId
      ? { error: resultado.error }
      : { estado: "sin_conexion", error: resultado.error };
  }
  return {
    estado: c.estado,
    clave: c.clave,
    numeroConsecutivo: c.numeroConsecutivo,
    modoSimulacion: c.modoSimulacion,
    haciendaRes: c.respuestaHacienda,
    haciendaId: c.id,
    fechaEmision: c.fechaEmision || previo.fechaEmision, // fecha y hora fiscal (va en el XML)
    // Lo emitido manda (también en reintentos): tipo y total salen del
    // comprobante que armó el backend, no del cálculo de la pantalla.
    ...(c.numeroConsecutivo ? { tipoDoc: String(c.numeroConsecutivo).slice(8, 10) } : {}),
    ...(Number.isFinite(Number(c.total)) && c.total != null ? { total: Number(c.total) } : {}),
    error: resultado.ok ? null : resultado.error,
  };
}

export const idempotencyFactura = factura => `fe-${factura.id}`;

// ¿Se puede retomar el envío de esta factura sin crear otro comprobante?
export const facturaReintentable = f =>
  !!f && ((f.haciendaId && REINTENTABLES.has(f.estado)) || (!f.haciendaId && f.estado === "sin_conexion" && !!f.payload));

// Payload listo para (re)crear una factura: si es en dólares y su cotización
// no es de hoy, usa la vigente (el comprobante se crearía hoy). Si el backend
// ya lo había recibido, la Idempotency-Key devuelve el original sin tocarlo.
// Condiciones de venta a crédito del catálogo de Hacienda (02 crédito, 08
// servicios al Estado a crédito, 10 venta a crédito hasta 90 días).
export const CONDICIONES_CREDITO = new Set(["02", "08", "10"]);
export const esCredito = c => CONDICIONES_CREDITO.has(c);

// Única regla para facturar en dólares: cotización OFICIAL del BCCR y de hoy
// (nunca la referencia de mercado ni la aproximada).
export const cotizacionOficialDeHoy = tc =>
  !!tc?.venta && tc.oficial === true && !tc.fallback && !tc.referencia && tc.fecha === fechaLocal();

export function payloadVigente(payload, tipoCambio) {
  if (payload?.moneda !== "USD") return { payload };
  // Toda creación en dólares exige la cotización oficial de hoy, aunque el
  // payload guardado sea de hoy (no hay prueba de que fuera oficial).
  if (!cotizacionOficialDeHoy(tipoCambio)) {
    return { requiereCotizacion: true, error: "El tipo de cambio de esta factura en dólares ya no es del día y no hay uno oficial vigente del BCCR. Se está actualizando; intentá de nuevo en unos segundos." };
  }
  return { payload: { ...payload, tipoCambio: tipoCambio.venta, tipoCambioFecha: tipoCambio.fecha } };
}

// Retoma el envío de una factura guardada: reenviar si el backend ya la tiene,
// o repetir la emisión con la MISMA Idempotency-Key si nunca respondió.
export async function reintentarFactura(factura, token, tipoCambio) {
  if (factura.haciendaId) {
    const r = await reenviar(`/api/invoices/${factura.haciendaId}/reenviar`, { token });
    return { r, campos: camposFactura(r, factura) };
  }
  const { payload, error, requiereCotizacion } = payloadVigente(factura.payload, tipoCambio);
  if (error) return { r: { ok: false, comprobante: null, error }, campos: { error }, requiereCotizacion };
  const r = await emitir("/api/invoices", payload, { token, idempotencyKey: idempotencyFactura(factura) });
  return { r, campos: { ...camposFactura(r, factura), payload } };
}

// Emisiones en curso: se anotan en este dispositivo ANTES de llamar al backend,
// para poder reanudarlas con la misma clave si la app se cierra a la mitad.
// Cada entrada lleva su propietario (empresa + usuario): otra cuenta que inicie
// sesión en el mismo equipo no las ve ni las puede reanudar.
const KEY_EN_CURSO = "monki:emisionesEnCurso";
const leerEnCurso = () => { try { return JSON.parse(localStorage.getItem(KEY_EN_CURSO) || "[]"); } catch { return []; } };
// Si no se puede guardar, lanza: la emisión NO debe enviarse sin poder reanudarse.
const escribirEnCurso = v => localStorage.setItem(KEY_EN_CURSO, JSON.stringify(v));
export const propietarioDe = user => (user?.id ? `${user.empresaId || user.id}:${user.id}` : null);
export const emisionesEnCurso = propietario =>
  propietario ? leerEnCurso().filter(x => x.propietario === propietario) : [];
export function registrarEmision(factura, propietario) {
  if (!propietario) throw new Error("No hay una sesión activa.");
  escribirEnCurso([...leerEnCurso().filter(x => x.id !== factura.id), { ...factura, propietario }]);
}
export const quitarEmision = id => {
  try { escribirEnCurso(leerEnCurso().filter(x => x.id !== id)); } catch { /* se reintenta al reanudar */ }
};

// Referencia de una nota al comprobante original. Hacienda espera su CLAVE
// (50 dígitos), su fecha de emisión y su tipo; en pantalla se guarda el número
// local ("FE-00001"). Devuelve { error } si no se puede armar una referencia
// válida: la nota NO se envía (antes salía con "FE-00001" o sin tipo real).
const preguntar = texto => (typeof window !== "undefined" && window.prompt ? window.prompt(texto) : "") || "";
const PREGUNTAS = {
  fecha: () => preguntar("Fecha de emisión del comprobante de referencia (AAAA-MM-DD). Hacienda la exige:"),
  tipo:  () => preguntar("Tipo del comprobante de referencia: 01 factura, 02 nota de débito, 03 nota de crédito, 04 tiquete:"),
};
export function referenciaDeFactura(facturas, facturaRef, pedir = PREGUNTAS) {
  if (!facturaRef) return {};
  const ref = String(facturaRef).trim();
  const f = (facturas || []).find(x => x.numero === ref || x.clave === ref);
  if (f && !f.clave) {
    return { error: `La factura ${ref} todavía no fue emitida a Hacienda (no tiene clave). Enviala primero y después hacé la nota.` };
  }
  if (f) {
    // La fecha debe ser la FISCAL (la del XML), no la del selector de la pantalla.
    // El backend igual la corrige con la que tiene guardada para esa clave.
    return { referenciaNumero: f.clave, referenciaFecha: f.fechaEmision || undefined, referenciaTipoDoc: f.tipoDoc === "04" ? "04" : "01" };
  }
  // Comprobante de otro sistema: clave, fecha y tipo son obligatorios.
  if (!/^\d{50}$/.test(ref)) {
    return { error: `"${ref}" no es una factura de este sistema. Para referenciar un comprobante externo usá su clave de 50 dígitos.` };
  }
  const fecha = String(pedir.fecha() || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Falta la fecha del comprobante de referencia (AAAA-MM-DD). No se envió la nota." };
  const tipo = String(pedir.tipo() || "").trim().padStart(2, "0");
  if (!/^(0[1-9]|1[0-8])$/.test(tipo)) return { error: "Falta el tipo del comprobante de referencia (01 a 18). No se envió la nota." };
  return { referenciaNumero: ref, referenciaFecha: fecha, referenciaTipoDoc: tipo };
}

// ── PDF, correo y estado de un comprobante ya emitido ───────────────────────
// base: "/api/invoices" (facturas y tiquetes) o "/api/emision/notas" (NC/ND).
async function pedir(url, { token, method = "GET", body, idempotencyKey } = {}) {
  const res = await fetch(`${BACKEND}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw Object.assign(new Error(j?.error || `Error ${res.status}`), { status: res.status, requiereConfirmacion: !!j?.requiereConfirmacion });
  }
  return res;
}

/** PDF del comprobante (armado por el servidor desde el XML firmado). Devuelve un Blob. */
export async function pdfComprobante(base, id, { token }) {
  return (await pedir(`${base}/${id}/pdf`, { token })).blob();
}

/** Envía (o reenvía) el comprobante al cliente por correo. */
export async function enviarCorreoComprobante(base, id, { token, destinatario, confirmarPrueba = false, solicitud }) {
  // solicitud: la misma para reintentos del mismo pedido → el servidor no manda dos correos
  return (await pedir(`${base}/${id}/correo`, { token, method: "POST", idempotencyKey: solicitud, body: { ...(destinatario ? { destinatario } : {}), ...(confirmarPrueba ? { confirmarPrueba: true } : {}) } })).json();
}

/** Consulta el estado en Hacienda (si quedó aceptado, el servidor envía el correo solo). */
export async function estadoComprobante(base, id, { token }) {
  return (await pedir(`${base}/${id}/status`, { token })).json();
}

const ETAPAS = { comprobante: "Comprobante", respuesta: "Respuesta de Hacienda", completo: "Comprobante y respuesta", manual: "Reenvío" };
/** Resumen legible de las entregas por correo de un comprobante (null si no hay nada que mostrar). */
export function etiquetaCorreo(correo) {
  if (!correo) return null;
  if (correo.sinCorreo) return { texto: "El cliente no tiene correo: no se le envió", tono: "alerta" };
  const e = correo.entregas?.at(-1);
  if (!e) return null;
  const etapa = ETAPAS[e.etapa] || "Correo";
  if (e.estado === "enviado") return { texto: `${etapa} enviado a ${e.destino}`, tono: "ok" };
  if (e.estado === "fallido") return { texto: `${etapa}: no se pudo enviar${e.error ? ` (${e.error})` : ""}`, tono: "error" };
  return { texto: `${etapa}: enviando a ${e.destino}…`, tono: "ok" };
}
