/**
 * OrdenesCompraScreen — Órdenes de Compra (Purchase Orders)
 * Estados: borrador → enviada → recibida / cancelada
 * "Recibir" → crea entrada en ComprasScreen automáticamente
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, ShoppingCart, Check, X, FileSpreadsheet, Send, FileText, PackageCheck, Ban } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

const ESTADOS = {
  borrador:  { label: "Borrador",  tono: "neutro" },
  enviada:   { label: "Enviada",   tono: "oscuro" },
  recibida:  { label: "Recibida",  tono: "exito" },
  cancelada: { label: "Cancelada", tono: "peligro" },
};

// ── Modal crear / editar OC ────────────────────────────────────────────────────
function OCModal({ oc, contactos, productos, settings, onClose, onSave }) {
  const esNueva = !oc?.id;
  const [form, setForm] = useState(oc || {
    proveedor: "", cedulaProveedor: "", fechaEntrega: "", notas: "", moneda: "CRC", lineas: [],
  });
  const [linea, setLinea] = useState({ producto: "", cantidad: 1, precioUnit: 0 });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const proveedores = contactos.filter(c => c.tipo === "proveedor" || c.tipo === "ambos");

  function addLinea() {
    if (!linea.producto) return;
    setForm(p => ({ ...p, lineas: [...(p.lineas||[]), { ...linea, id: genId() }] }));
    setLinea({ producto: "", cantidad: 1, precioUnit: 0 });
  }
  function removeLinea(id) { setForm(p => ({ ...p, lineas: p.lineas.filter(l => l.id !== id) })); }

  const subtotal = (form.lineas||[]).reduce((s,l) => s + (parseFloat(l.cantidad||0) * parseFloat(l.precioUnit||0)), 0);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const guardar = async () => {
    if (!form.proveedor) return alert("Proveedor requerido.");
    if (!form.lineas?.length) return alert("Agregá al menos un producto.");
    const ocs = JSON.parse(localStorage.getItem("@finanzia/ordenesCompra") || "[]");
    const seq  = ocs.length + 1;
    const item = { ...form, id: genId(), numero: `OC-${String(seq).padStart(5,"0")}`,
      estado: "borrador", subtotal, iva, total,
      fecha: hoy(), creadoEn: new Date().toISOString() };
    const nuevas = esNueva ? [...ocs, item] : ocs.map(o => o.id === item.id ? item : o);
    localStorage.setItem("@finanzia/ordenesCompra", JSON.stringify(nuevas));
    if (typeof window.__orgPush === "function") window.__orgPush();
    onSave(); onClose();
  };

  const lineas = form.lineas || [];
  return (
    <Modal titulo={esNueva ? "Nueva orden de compra" : "Editar orden de compra"} subtitulo="Lo que le vas a pedir al proveedor" onCerrar={onClose} ancho="max-w-2xl"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar orden</Boton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Proveedor *">
            <Seleccion value={form.proveedor} onChange={e => {
              const c = proveedores.find(p => p.nombre === e.target.value);
              u("proveedor", e.target.value);
              if (c) u("cedulaProveedor", c.cedula || "");
            }}>
              <option value="">Seleccionar…</option>
              {proveedores.map(p => <option key={p.id}>{p.nombre}</option>)}
            </Seleccion>
            {!proveedores.length && <Entrada value={form.proveedor} onChange={e=>u("proveedor",e.target.value)} placeholder="Nombre del proveedor" className="mt-2"/>}
          </Campo>
          <Campo etiqueta="Cédula del proveedor"><Entrada value={form.cedulaProveedor||""} onChange={e=>u("cedulaProveedor",e.target.value)} placeholder="3-000-000000"/></Campo>
          <Campo etiqueta="Entrega esperada"><Entrada type="date" value={form.fechaEntrega||""} onChange={e=>u("fechaEntrega",e.target.value)}/></Campo>
          <Campo etiqueta="Moneda"><Seleccion value={form.moneda||"CRC"} onChange={e=>u("moneda",e.target.value)} opciones={[{value:"CRC",label:"₡ CRC"},{value:"USD",label:"$ USD"}]}/></Campo>
        </div>

        <div className="border-2 border-black/10 rounded-2xl overflow-hidden">
          <div className="bg-monki-cream/60 p-3 flex flex-wrap gap-2 border-b-2 border-black/10">
            <Entrada value={linea.producto} onChange={e=>setLinea(p=>({...p,producto:e.target.value}))} placeholder="Producto o descripción" list="prod-list" className="flex-1 min-w-[160px]"/>
            <datalist id="prod-list">{productos.map(p => <option key={p.id} value={p.nombre}/>)}</datalist>
            <Entrada type="number" value={linea.cantidad} min={1} onChange={e=>setLinea(p=>({...p,cantidad:e.target.value}))} className="!w-20 text-center" placeholder="Cant."/>
            <Entrada type="number" value={linea.precioUnit} onChange={e=>setLinea(p=>({...p,precioUnit:e.target.value}))} className="!w-28" placeholder="Precio unit."/>
            <Boton icono={Plus} onClick={addLinea}>Agregar</Boton>
          </div>
          <table className="ui-tabla w-full text-sm">
            <thead><tr className="monki-tag text-monki-k/50">
              <th className="px-4 py-2.5 text-left font-medium">Producto</th>
              <th className="px-4 py-2.5 text-center font-medium">Cant.</th>
              <th className="px-4 py-2.5 text-right font-medium">Precio unit.</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
              <th className="w-10"/>
            </tr></thead>
            <tbody>
              {!lineas.length && <tr><td colSpan={5} className="text-center text-monki-k/40 py-6">Todavía no agregaste productos.</td></tr>}
              {lineas.map(l => (
                <tr key={l.id} className="animate-desplegar border-t border-black/5">
                  <td className="px-4 py-2 font-semibold">{l.producto}</td>
                  <td className="px-4 py-2 text-center">{l.cantidad}</td>
                  <td className="px-4 py-2 text-right">{fmtMoney(l.precioUnit,settings)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtMoney(l.cantidad*l.precioUnit,settings)}</td>
                  <td className="pr-2"><BotonIcono icono={X} titulo="Quitar" tono="peligro" onClick={()=>removeLinea(l.id)}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-monki-k text-white px-4 py-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
            <span className="text-white/60">Subtotal <b className="text-white">{fmtMoney(subtotal,settings)}</b></span>
            <span className="text-white/60">IVA 13% <b className="text-white">{fmtMoney(iva,settings)}</b></span>
            <span className="text-monki-y text-lg font-black">{fmtMoney(total,settings)}</span>
          </div>
        </div>

        <Campo etiqueta="Notas y condiciones"><AreaTexto value={form.notas||""} onChange={e=>u("notas",e.target.value)} rows={2}/></Campo>
      </div>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function OrdenesCompraScreen() {
  const [ocs,       setOcs]       = useState([]);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [settings,  setSettings]  = useState({});
  const [modal,     setModal]     = useState(null);  // null | "nueva" | oc
  const [filtro,    setFiltro]    = useState("todos");
  const [selected,  setSelected]  = useState(null);

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [c, p, s] = await Promise.all([db.getContactos(), db.getProductos(), db.getSettings()]);
    setContactos(c); setProductos(p); setSettings(s);
    try { setOcs(JSON.parse(localStorage.getItem("@finanzia/ordenesCompra") || "[]")); } catch { setOcs([]); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiarEstado(id, estado) {
    const upd = ocs.map(o => o.id === id ? { ...o, estado } : o);
    localStorage.setItem("@finanzia/ordenesCompra", JSON.stringify(upd));
    if (typeof window.__orgPush === "function") window.__orgPush();
    setOcs(upd);
  }

  const { confirmar, dialogo } = useConfirmar();
  async function recibirOC(oc) {
    if (!(await confirmar("Recibir orden", `¿Marcar la OC ${oc.numero} como recibida? Se creará una factura de proveedor en Compras y se sumará el inventario.`, { boton: "Recibir" }))) return;
    // Crear entrada en ComprasScreen
    const compras = await db.getCompras();
    const nueva = {
      id: genId(), numero: `COMP-${String(compras.length+1).padStart(5,"0")}`,
      proveedor: oc.proveedor, cedulaProveedor: oc.cedulaProveedor||"",
      fecha: hoy(), subtotal: oc.subtotal||0, iva: oc.iva||0,
      ivaCreditoFiscal: oc.iva||0, total: oc.total||0,
      moneda: oc.moneda||"CRC", medioPago: "Crédito proveedor",
      lineas: oc.lineas||[], ocRef: oc.numero,
      notas: `Generado desde OC ${oc.numero}`, creadoEn: new Date().toISOString(),
    };
    await db.setCompras([...compras, nueva]);

    // Aumentar inventario
    const prod = await db.getProductos();
    const updProd = prod.map(p => {
      const linea = (oc.lineas||[]).find(l => (l.producto||"").toLowerCase().includes((p.nombre||"").toLowerCase().slice(0,5)));
      if (linea) return { ...p, stock: (parseFloat(p.stock)||0) + parseFloat(linea.cantidad||0) };
      return p;
    });
    await db.setProductos(updProd);

    cambiarEstado(oc.id, "recibida");
    alert(`✓ OC recibida. Compra ${nueva.numero} creada e inventario actualizado.`);
  }

  const visibles = ocs.filter(o => filtro === "todos" || o.estado === filtro)
    .sort((a,b) => (b.creadoEn||"").localeCompare(a.creadoEn||""));

  const sel = visibles.find(o => o.id === selected);

  const cuenta = e => ocs.filter(o => o.estado === e).length;
  const bloqueada = o => !o || o.estado === "recibida" || o.estado === "cancelada";
  const exportar = () => exportExcel(ocs.map(o => ({
    "N° OC": o.numero, Proveedor: o.proveedor, Fecha: fmtDate(o.fecha),
    Estado: o.estado, Total: o.total, Moneda: o.moneda,
  })), "ordenes-compra");

  const columnas = [
    { key: "numero", titulo: "N.° OC", render: o => <span className="font-mono text-xs font-bold">{o.numero}</span> },
    { key: "proveedor", titulo: "Proveedor", principal: true, render: o => <b className="text-monki-k">{o.proveedor}</b> },
    { key: "fecha", titulo: "Fecha", render: o => fmtDate(o.fecha) },
    { key: "entrega", titulo: "Entrega esp.", render: o => <span className="text-monki-k/55">{o.fechaEntrega ? fmtDate(o.fechaEntrega) : "—"}</span> },
    { key: "estado", titulo: "Estado", render: o => { const e = ESTADOS[o.estado] || ESTADOS.borrador; return <Estado tono={e.tono}>{e.label}</Estado>; } },
    { key: "total", titulo: "Total", alinear: "right", render: o => <b>{fmtMoney(o.total, o.moneda || settings?.moneda || "CRC")}</b> },
    { key: "notas", titulo: "Notas", render: o => <span className="text-monki-k/45 text-xs block max-w-[160px] truncate">{o.notas||"—"}</span> },
    { key: "acciones", titulo: "", alinear: "right", render: o => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        {!bloqueada(o) && o.estado !== "enviada" && <BotonIcono icono={Send} titulo="Marcar enviada" onClick={()=>cambiarEstado(o.id,"enviada")}/>}
        {!bloqueada(o) && <BotonIcono icono={Check} titulo="Recibir" onClick={()=>recibirOC(o)}/>}
        {o.estado !== "recibida" && o.estado !== "cancelada" && <BotonIcono icono={X} titulo="Cancelar" tono="peligro" onClick={()=>cambiarEstado(o.id,"cancelada")}/>}
      </div>) },
  ];

  return (
    <Modulo
      seccion="Compras"
      titulo="Órdenes de compra"
      descripcion="Pedidos a proveedores. Al recibirlos se crea la compra y se suma el inventario."
      acciones={<>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>
        <Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva orden</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Borradores" valor={cuenta("borrador")} icono={FileText} delay={40} onClick={()=>setFiltro("borrador")}/>
          <Indicador etiqueta="Enviadas" valor={cuenta("enviada")} detalle="Esperando entrega" icono={Send} destacado delay={90} onClick={()=>setFiltro("enviada")}/>
          <Indicador etiqueta="Recibidas" valor={cuenta("recibida")} icono={PackageCheck} delay={140} onClick={()=>setFiltro("recibida")}/>
          <Indicador etiqueta="Canceladas" valor={cuenta("cancelada")} icono={Ban} delay={190} onClick={()=>setFiltro("cancelada")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [
        { key: "todos", label: "Todas", cuenta: ocs.length },
        { key: "borrador", label: "Borrador" }, { key: "enviada", label: "Enviadas" },
        { key: "recibida", label: "Recibidas" }, { key: "cancelada", label: "Canceladas" },
      ] }}
    >
      <Tabla columnas={columnas} filas={visibles} seleccionada={selected}
        onFila={o=>setSelected(s=>s===o.id?null:o.id)}
        vacio={<Vacio icono={ShoppingCart} titulo={ocs.length ? "Nada en este estado" : "Todavía no hay órdenes de compra"}
          texto={ocs.length ? "Probá con otra pestaña." : "Creá una orden para pedirle productos a un proveedor."}
          accion={!ocs.length && <Boton icono={Plus} onClick={()=>setModal("nueva")}>Nueva orden</Boton>}/>}/>
      {sel && (
        <div className="animate-desplegar mt-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.numero}</b><span className="text-white/60">{sel.proveedor}</span>
          <div className="flex-1"/>
          <Boton variante="secundario" tamano="sm" icono={Send} disabled={bloqueada(sel)} onClick={()=>cambiarEstado(sel.id,"enviada")}>Marcar enviada</Boton>
          <Boton variante="amarillo" tamano="sm" icono={Check} disabled={bloqueada(sel)} onClick={()=>recibirOC(sel)}>Recibir</Boton>
          <Boton variante="peligro" tamano="sm" icono={X} disabled={!sel || sel.estado==="recibida"} onClick={()=>cambiarEstado(sel.id,"cancelada")}>Cancelar</Boton>
        </div>
      )}
      {modal && (
        <OCModal
          oc={modal === "nueva" ? null : modal}
          contactos={contactos} productos={productos} settings={settings}
          onClose={() => setModal(null)} onSave={cargar}
        />
      )}
      {dialogo}
    </Modulo>
  );
}
