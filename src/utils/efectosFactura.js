// Guarda una factura y aplica sus efectos (inventario, CxC, asiento) UNA vez.
// Cada efecto se marca en factura.efectos al terminar: si la app se cierra a la
// mitad, al volver a llamar con la misma factura solo se completan los que faltan.
// Como el efecto y su marca son escrituras distintas, cada acción además debe
// deduplicarse sola por factura.id (inventario, CxC y asiento lo hacen).
//
// Todo corre bajo UN bloqueo exclusivo para todas las ventas (Web Locks: también
// entre pestañas): las facturas, productos, CxC y asientos se guardan como listas
// completas, así que dos ventas en paralelo (aunque sean facturas distintas) se
// pisarían entre sí, y dos recuperaciones de la misma aplicarían un efecto dos veces.

const colas = new Map();
function conBloqueo(nombre, fn) {
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request(nombre, { mode: "exclusive" }, fn);
  // Sin Web Locks (entornos viejos o tests): cola en memoria de esta pestaña.
  const anterior = colas.get(nombre) || Promise.resolve();
  const actual = anterior.catch(() => {}).then(fn);
  colas.set(nombre, actual.catch(() => {}));
  return actual;
}

const efectosActuales = async (getFacturas, id) => {
  const f = (await getFacturas()).find(x => x.id === id);
  // Facturas guardadas antes de existir "efectos" ya tenían todo aplicado.
  if (f && !f.efectos) return { inventario: true, cxc: true, asiento: true };
  return { ...(f?.efectos || {}) };
};

export function guardarFacturaConEfectos(factura, { getFacturas, setFacturas, efectos: acciones }) {
  return conBloqueo("monki:ventas", async () => {
    const all = await getFacturas();
    const existente = all.find(x => x.id === factura.id);
    const efectos = await efectosActuales(getFacturas, factura.id);
    const registro = { ...existente, ...factura, efectos };
    await setFacturas(existente ? all.map(x => x.id === factura.id ? registro : x) : [...all, registro]);

    // Cada acción: [nombre, aplica(f), accion(f), limpiar?(f)]. limpiar corre
    // después de marcar el efecto (p. ej. borrar marcas de deduplicación).
    for (const [nombre, aplica, accion, limpiar] of acciones) {
      // Releer dentro del bloqueo: otro proceso pudo haberlo aplicado ya.
      const hechos = await efectosActuales(getFacturas, factura.id);
      if (hechos[nombre] || !aplica(registro)) { efectos[nombre] = hechos[nombre]; continue; }
      await accion(registro);
      efectos[nombre] = true;
      const actuales = await getFacturas();
      await setFacturas(actuales.map(x => x.id === factura.id ? { ...x, efectos: { ...x.efectos, [nombre]: true } } : x));
      if (limpiar) await limpiar(registro).catch(() => {});
    }
    return registro;
  });
}
