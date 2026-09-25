// Acciones de teléfono: llamar, abrir WhatsApp y compartir textos.
// Los números de Costa Rica (8 dígitos) se completan con el prefijo 506.

export function soloDigitos(tel) {
  return String(tel || "").replace(/\D/g, "");
}

export function numeroInternacional(tel) {
  const d = soloDigitos(tel);
  return d.length === 8 ? `506${d}` : d;
}

export function enlaceLlamada(tel) {
  const d = soloDigitos(tel);
  return d ? `tel:${d.length === 8 ? "+506" + d : "+" + d}` : null;
}

export function enlaceWhatsApp(tel, texto = "") {
  const n = numeroInternacional(tel);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${n}${q}`;
}

// Con número → WhatsApp directo a ese contacto. Sin número → menú de compartir
// del teléfono (WhatsApp, correo, etc.); en computadora, WhatsApp Web.
export async function compartirTexto({ titulo, texto, telefono }) {
  if (soloDigitos(telefono)) {
    window.open(enlaceWhatsApp(telefono, texto), "_blank", "noopener");
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto }); return; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

// Teléfono del cliente de un documento, buscándolo en Contactos (cédula o nombre).
// Recibe los contactos ya cargados: compartir debe ocurrir en el mismo toque
// del usuario, o el teléfono bloquea la ventana de WhatsApp.
export function telefonoDeCliente(cliente, contactos = []) {
  if (!cliente) return "";
  if (cliente.tel || cliente.telefono) return cliente.tel || cliente.telefono;
  const ced = soloDigitos(cliente.cedula);
  const c = (ced && contactos.find(x => soloDigitos(x.cedula) === ced))
    || contactos.find(x => x.nombre && x.nombre === cliente.nombre);
  return c?.tel || c?.telefono || "";
}

// Mensaje de WhatsApp con el resumen de una factura y el SINPE para pagar
export function compartirFactura(f, { settings, contactos, fmtMoney, pdf }) {
  const s = settings || {};
  const sinpe = s.sinpe || s.telefono;
  const lineas = [
    `Hola${f.cliente?.nombre ? " " + f.cliente.nombre : ""} 👋`,
    `Le compartimos ${f.tipoDoc === "04" ? "el tiquete electrónico" : "la factura electrónica"} *${f.numero}* de ${s.nombreNegocio || "nuestro negocio"}.`,
    `Total: *${fmtMoney(f.totalGeneral || f.total, f.moneda)}*`,
    f.vencimiento ? `Vence: ${f.vencimiento}` : null,
    f.clave ? `Clave Hacienda: ${f.clave}` : null,
    sinpe ? `Puede pagar por SINPE Móvil al ${sinpe}.` : null,
    "¡Gracias por su preferencia!",
  ].filter(Boolean);
  const texto = lineas.join("\n");
  // En el teléfono, con el PDF listo: menú de compartir con el PDF adjunto (WhatsApp, correo…)
  if (pdf && typeof File !== "undefined") {
    const archivo = new File([pdf], `${f.numeroConsecutivo || f.numero || "factura"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [archivo] })) {
      return navigator.share({ files: [archivo], title: f.numero, text: texto }).catch(() => {});
    }
  }
  return compartirTexto({ titulo: f.numero, texto, telefono: telefonoDeCliente(f.cliente, contactos) });
}
