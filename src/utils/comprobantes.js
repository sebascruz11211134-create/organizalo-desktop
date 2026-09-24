// Emisión de comprobantes electrónicos contra el backend.
//
// El backend guarda cada comprobante ANTES de firmarlo/enviarlo. Si algo falla
// responde error pero incluye `comprobante` (con su id y clave): hay que
// conservarlo y reintentar con reenviar(), nunca volver a emitir — eso crearía
// otra clave para la misma venta. La Idempotency-Key hace que repetir la misma
// emisión (doble clic, reintento tras corte) devuelva el mismo comprobante.

import { BACKEND } from "./config.js";

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
    error: resultado.ok ? null : resultado.error,
  };
}

export const idempotencyFactura = factura => `fe-${factura.id}`;

// ¿Se puede retomar el envío de esta factura sin crear otro comprobante?
export const facturaReintentable = f =>
  !!f && ((f.haciendaId && REINTENTABLES.has(f.estado)) || (!f.haciendaId && f.estado === "sin_conexion" && !!f.payload));

// Retoma el envío de una factura guardada: reenviar si el backend ya la tiene,
// o repetir la emisión con la MISMA Idempotency-Key si nunca respondió.
export async function reintentarFactura(factura, token) {
  const r = factura.haciendaId
    ? await reenviar(`/api/invoices/${factura.haciendaId}/reenviar`, { token })
    : await emitir("/api/invoices", factura.payload, { token, idempotencyKey: idempotencyFactura(factura) });
  return { r, campos: camposFactura(r, factura) };
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
