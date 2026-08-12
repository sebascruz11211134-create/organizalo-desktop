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
 * @param {{ cliente, total, moneda, plazo, facturaRef }} params
 */
export async function crearCXC({ cliente, total, moneda, plazo, facturaRef }) {
  const debts = await db.getDebts();

  // Calcular fecha de vencimiento según los días de plazo
  let fechaVencimiento = null;
  const dias = parseInt(plazo) || 30;
  const vence = new Date();
  vence.setDate(vence.getDate() + dias);
  fechaVencimiento = vence.toISOString().slice(0, 10);

  const nueva = {
    id: genId(),
    tipo: "cobrar",
    nombre: cliente?.nombre || "Consumidor Final",
    cedula: cliente?.cedula || "",
    email: cliente?.email || "",
    total: parseFloat(total) || 0,
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
}

/**
 * Crea una Cuenta por Pagar a partir de una compra a crédito.
 * Solo se llama cuando medio === "Crédito proveedor".
 *
 * @param {{ proveedor, total, moneda, fechaVence, facturaRef }} params
 */
export async function crearCXP({ proveedor, total, moneda, fechaVence, facturaRef }) {
  const debts = await db.getDebts();

  const nueva = {
    id: genId(),
    tipo: "pagar",
    nombre: proveedor || "Proveedor",
    total: parseFloat(total) || 0,
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
}
