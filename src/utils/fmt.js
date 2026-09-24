/** Formateadores de moneda, fecha y números */

export function fmtMoney(num, moneda = "CRC", short = false) {
  if (!num && num !== 0) return "—";
  const n = Number(num);
  if (short) {
    if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `₡${(n / 1_000).toFixed(0)}K`;
    return `₡${n.toFixed(0)}`;
  }
  const opts = {
    minimumFractionDigits: moneda === "USD" ? 2 : 0,
    maximumFractionDigits: moneda === "USD" ? 2 : 0,
  };
  const formatted = n.toLocaleString("es-CR", opts);
  return moneda === "USD" ? `$ ${formatted}` : `₡ ${formatted}`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Fechas de calendario en la hora LOCAL del equipo (Costa Rica). toISOString()
// usa UTC: después de las 6 p.m. daba la fecha de mañana (y el mes siguiente
// el último día del mes).
const p2 = n => String(n).padStart(2, "0");
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export function mesLocal(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
// "YYYY-MM-DD" → Date a medianoche LOCAL. new Date("YYYY-MM-DD") la toma como
// medianoche UTC, que en Costa Rica es el día anterior a las 6 p.m.
export function parseFechaLocal(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Fecha "YYYY-MM-DD" desplazada n días (en calendario local).
export function fechaDesplazada(ymd, n) {
  const d = parseFechaLocal(ymd);
  d.setDate(d.getDate() + n);
  return fechaLocal(d);
}

// "YYYY-MM" desplazado n meses (sin el salto de mes del día 31).
export function mesDesplazado(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  return mesLocal(new Date(y, m - 1 + n, 1));
}

export function hoy() {
  return fechaLocal();
}

export function mesLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
