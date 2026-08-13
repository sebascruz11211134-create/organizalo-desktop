/**
 * clienteUtils.js — Lógica compartida entre módulos
 *
 * Conexiones lógicas implementadas:
 *   Facturación / POS  → reduce inventario
 *   Factura crédito    → crea CXC automáticamente
 *   Compra crédito     → crea CXP automáticamente
 *   Nota crédito dev.  → restaura inventario
 *   Contactos          → código de cliente CLI-XXXX
 */
import db from "./db";
import { genId, hoy } from "./fmt";
import { BACKEND } from "./config";

// ── Crear evento en el calendario (backend) ───────────────────────────────────
async function crearEvento({ token, titulo, descripcion, fecha, tipo = "recordatorio", color }) {
  if (!token || !fecha) return;
  try {
    await fetch(`${BACKEND}/api/eventos`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ titulo, descripcion, tipo, fecha, hora: "08:00", todo_el_dia: true, color: color || "#f59e0b" }),
    });
  } catch (e) {
    console.warn("[clienteUtils] No se pudo crear evento:", e.message);
  }
}

// ── Eliminar evento de calendario por título (al saldar CXC/CXP) ─────────────
export async function cancelarEventoCalendario({ token, tituloMatch, fecha }) {
  if (!token || !tituloMatch) return;
  try {
    await fetch(`${BACKEND}/api/eventos/por-titulo`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tituloMatch, fecha }),
    });
  } catch (e) {
    console.warn("[clienteUtils] No se pudo cancelar evento:", e.message);
  }
}

// ── Código de cliente ─────────────────────────────────────────────────────────

/**
 * Genera el siguiente código CLI-XXXX disponible.
 * @param {Array} contactos - Lista actual de contactos
 * @returns {string} Código único, ej: "CLI-0042"
 */
export function generarCodigoCliente(contactos) {
  const nums = (contactos || [])
    .map((c) => parseInt((c.codigoCliente || "").replace(/^CLI-/, "")) || 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `CLI-${String(next).padStart(4, "0")}`;
}

// ── Inventario ────────────────────────────────────────────────────────────────

/**
 * Reduce el stock de los productos que aparecen en las líneas de una venta.
 * Hace match por productoId (si está guardado en la línea) o por nombre exacto.
 * Solo afecta productos que tienen campo 'stock' definido.
 *
 * @param {Array} lineas - Líneas de la factura/venta
 */
export async function reducirInventario(lineas) {
  if (!lineas?.length) return;
  const productos = await db.getProductos();
  let changed = false;

  const actualizados = productos.map((p) => {
    const linea = lineas.find(
      (l) =>
        (l.productoId && l.productoId === p.id) ||
        (l.descripcion?.toLowerCase().trim() === p.nombre?.toLowerCase().trim())
    );
    if (linea && p.stock != null) {
      changed = true;
      const cant = parseFloat(linea.cantidad) || 0;
      return { ...p, stock: Math.max(0, (parseFloat(p.stock) || 0) - cant) };
    }
    return p;
  });

  if (changed) await db.setProductos(actualizados);
}

/**
 * Aumenta el stock de los productos que aparecen en las líneas de una compra.
 * Inverso de reducirInventario. Solo afecta productos con campo 'stock' definido.
 *
 * @param {Array} lineas - Líneas de la compra/pedido
 */
export async function aumentarInventario(lineas) {
  if (!lineas?.length) return;
  const productos = await db.getProductos();
  let changed = false;

  const actualizados = productos.map((p) => {
    const linea = lineas.find(
      (l) =>
        (l.productoId && l.productoId === p.id) ||
        (l.descripcion?.toLowerCase().trim() === p.nombre?.toLowerCase().trim())
    );
    if (linea && p.stock != null) {
      changed = true;
      const cant = parseFloat(linea.cantidad) || 0;
      return { ...p, stock: (parseFloat(p.stock) || 0) + cant };
    }
    return p;
  });

  if (changed) await db.setProductos(actualizados);
}

/**
 * Restaura el stock de los productos de una factura anulada.
 * Se usa cuando se emite una Nota de Crédito por Devolución.
 *
 * @param {string} facturaRef - Número de factura (ej: "FE-00012")
 */
export async function restaurarInventarioPorFactura(facturaRef) {
  if (!facturaRef) return;
  const facturas = await db.getFacturas();
  const factura = facturas.find((f) => f.numero === facturaRef);
  if (!factura?.lineas?.length) return;

  const productos = await db.getProductos();
  let changed = false;

  const actualizados = productos.map((p) => {
    const linea = factura.lineas.find(
      (l) =>
        (l.productoId && l.productoId === p.id) ||
        (l.descripcion?.toLowerCase().trim() === p.nombre?.toLowerCase().trim())
    );
    if (linea && p.stock != null) {
      changed = true;
      const cant = parseFloat(linea.cantidad) || 0;
      return { ...p, stock: (parseFloat(p.stock) || 0) + cant };
    }
    return p;
  });

  if (changed) await db.setProductos(actualizados);
}

// ── CXC / CXP automáticas ─────────────────────────────────────────────────────

/**
 * Crea una Cuenta por Cobrar a partir de una factura a crédito.
 * Solo se llama cuando condPago === "02".
 *
 * @param {{ cliente, total, moneda, plazo, facturaRef, token }} params
 */
export async function crearCXC({ cliente, total, moneda, plazo, facturaRef, token }) {
  const debts = await db.getDebts();

  const dias = parseInt(plazo) || 30;
  const vence = new Date();
  vence.setDate(vence.getDate() + dias);
  const fechaVencimiento = vence.toISOString().slice(0, 10);

  const monto = parseFloat(total) || 0;
  const nombreCliente = cliente?.nombre || "Consumidor Final";
  const montoFmt = monto.toLocaleString("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0 });

  const nueva = {
    id: genId(),
    tipo: "cobrar",
    nombre: nombreCliente,
    cedula: cliente?.cedula || "",
    email: cliente?.email || "",
    total: monto,
    pagado: 0,
    pagos: [],
    moneda: moneda || "CRC",
    fechaVencimiento,
    notas: `Auto-generada desde ${facturaRef}`,
    creadoEn: new Date().toISOString(),
    autoGenerada: true,
    facturaRef,
  };

  await db.setDebts([nueva, ...debts]);

  // Crear evento en el calendario para el día de vencimiento
  await crearEvento({
    token,
    titulo:      `💰 Cobro: ${nombreCliente}`,
    descripcion: `Vence ${facturaRef} por ${montoFmt}. Plazo: ${dias} días.`,
    fecha:       fechaVencimiento,
    tipo:        "recordatorio",
    color:       "#10b981",
  });

  // También crear recordatorio 3 días antes si el plazo lo permite
  if (dias > 3) {
    const antes = new Date(vence);
    antes.setDate(antes.getDate() - 3);
    await crearEvento({
      token,
      titulo:      `⏰ Cobro próximo: ${nombreCliente}`,
      descripcion: `Factura ${facturaRef} vence en 3 días (${fechaVencimiento}). ${montoFmt}`,
      fecha:       antes.toISOString().slice(0, 10),
      tipo:        "recordatorio",
      color:       "#f59e0b",
    });
  }
}

/**
 * Crea una Cuenta por Pagar a partir de una compra a crédito.
 * Solo se llama cuando medio === "Crédito proveedor".
 *
 * @param {{ proveedor, total, moneda, fechaVence, facturaRef, token }} params
 */
export async function crearCXP({ proveedor, total, moneda, fechaVence, facturaRef, token }) {
  const debts = await db.getDebts();

  const monto = parseFloat(total) || 0;
  const nombreProveedor = proveedor || "Proveedor";
  const montoFmt = monto.toLocaleString("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0 });

  const nueva = {
    id: genId(),
    tipo: "pagar",
    nombre: nombreProveedor,
    total: monto,
    pagado: 0,
    pagos: [],
    moneda: moneda || "CRC",
    fechaVencimiento: fechaVence || null,
    notas: `Auto-generada desde compra ${facturaRef || ""}`,
    creadoEn: new Date().toISOString(),
    autoGenerada: true,
    facturaRef,
  };

  await db.setDebts([nueva, ...debts]);

  // Crear evento en el calendario para el día de pago
  if (fechaVence) {
    await crearEvento({
      token,
      titulo:      `🏦 Pago: ${nombreProveedor}`,
      descripcion: `Vence pago ${facturaRef || ""} por ${montoFmt}`,
      fecha:       fechaVence,
      tipo:        "recordatorio",
      color:       "#ef4444",
    });

    // Recordatorio 3 días antes
    const vence = new Date(fechaVence);
    const antes = new Date(vence);
    antes.setDate(antes.getDate() - 3);
    const hoyStr = new Date().toISOString().slice(0, 10);
    if (antes.toISOString().slice(0, 10) > hoyStr) {
      await crearEvento({
        token,
        titulo:      `⏰ Pago próximo: ${nombreProveedor}`,
        descripcion: `Factura ${facturaRef || ""} a ${nombreProveedor} vence en 3 días (${fechaVence}). ${montoFmt}`,
        fecha:       antes.toISOString().slice(0, 10),
        tipo:        "recordatorio",
        color:       "#f97316",
      });
    }
  }
}
