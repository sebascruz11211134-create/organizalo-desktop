// Efectos locales de una venta (inventario, CxC, asiento), compartidos por
// Facturación y el historial: guardar o reintentar una factura completa solo
// los efectos que falten, sin repetir los ya aplicados.
import db from "./db";
import { genId } from "./fmt";
import { getAutorSync } from "./auth";
import { reducirInventario, limpiarVentaAplicada, crearCXC } from "./clienteUtils";
import { guardarFacturaConEfectos } from "./efectosFactura";
import { esCredito } from "./comprobantes";

// ── Asiento contable automático por factura ──────────────────────────────
export const crearAsientoFactura = async (factura) => {
  try {
    const asientos = await db.getAsientos();
    if (asientos.some(a => a.facturaId === factura.id)) return; // ya existe (reintento)
    const num  = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
    const sub  = parseFloat(factura.subtotal  || 0);
    const iva  = parseFloat(factura.totalIVA  || 0);
    const tot  = parseFloat(factura.total     || 0);
    if (tot <= 0) return;

    const lineas = [];
    if (esCredito(factura.condPago)) {
      lineas.push({ cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar", debe: tot, haber: 0 });
    } else {
      lineas.push({ cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",    debe: tot, haber: 0 });
    }
    if (sub > 0) lineas.push({ cuentaCodigo: "4101", cuentaNombre: "Ingresos por ventas", debe: 0, haber: sub });
    if (iva > 0) lineas.push({ cuentaCodigo: "2301", cuentaNombre: "IVA por pagar",       debe: 0, haber: iva });

    const totalDebe  = lineas.reduce((s, l) => s + l.debe,  0);
    const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
    if (Math.abs(totalDebe - totalHaber) > 0.02) return;

    await db.setAsientos([...asientos, {
      id: genId(), numero: num, estado: "confirmado", autoGenerado: true,
      descripcion: `Factura ${factura.numero} — ${factura.cliente?.nombre || "Consumidor Final"}`,
      fecha: factura.fecha, totalDebe, totalHaber, lineas,
      facturaRef: factura.numero, facturaId: factura.id, creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    }]);
  } catch (e) {
    console.warn("[Facturacion] No se pudo crear asiento:", e.message);
    throw e; // que no se marque como aplicado: se reintenta al reanudar
  }
};

export const efectosVenta = (token) => [
  // 1. Reducir inventario por los productos vendidos
  ["inventario", () => true, f => reducirInventario(f.lineas, f.id), f => limpiarVentaAplicada(f.id)],
  // 2. Si es a crédito (condPago "02"), crear CXC + evento calendario
  ["cxc", f => esCredito(f.condPago), f => crearCXC({
    cliente: f.cliente, total: f.total, moneda: f.moneda,
    plazo: f.plazo || 30, facturaRef: f.numero, facturaId: f.id, token,
  })],
  // 3. Asiento contable automático
  ["asiento", () => true, f => crearAsientoFactura(f)],
];

// Si la CxC ya se creó y el comprobante emitido trae otro total (p. ej. un
// reintento que por fin recibió la respuesta del backend), se ajusta la CxC.
async function ajustarCxcAlTotalEmitido(factura) {
  if (!factura?.id || !esCredito(factura.condPago) || !factura.efectos?.cxc) return;
  const total = Number(factura.total);
  if (!Number.isFinite(total)) return;
  const debts = await db.getDebts();
  const cxc = debts.find(d => d.facturaId === factura.id);
  if (!cxc || Math.abs((Number(cxc.total) || 0) - total) < 0.00001) return;
  await db.setDebts(debts.map(d => d === cxc ? { ...d, total } : d));
}

export const guardarFacturaVenta = async (factura, token) => {
  const guardada = await guardarFacturaConEfectos(factura, { getFacturas: db.getFacturas, setFacturas: db.setFacturas, efectos: efectosVenta(token) });
  await ajustarCxcAlTotalEmitido(guardada || factura);
  return guardada;
};

// ¿Le falta algún efecto local? (independiente de su estado en Hacienda).
// Facturas viejas sin registro de efectos ya tenían todo aplicado.
export const efectosPendientes = (f) =>
  !!f?.efectos && efectosVenta().some(([nombre, aplica]) => aplica(f) && !f.efectos[nombre]);
