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
