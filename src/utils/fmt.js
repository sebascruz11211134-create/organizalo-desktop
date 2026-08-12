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

export function hoy() {
  return new Date().toISOString().slice(0, 10);
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
