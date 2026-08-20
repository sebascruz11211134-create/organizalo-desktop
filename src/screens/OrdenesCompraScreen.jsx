/**
 * OrdenesCompraScreen — Órdenes de Compra (Purchase Orders)
 * Estados: borrador → enviada → recibida / cancelada
 * "Recibir" → crea entrada en ComprasScreen automáticamente
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, ShoppingCart, Check, X, Trash2, FileSpreadsheet, Printer } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

const ESTADOS = {
  borrador:  { label: "Borrador",  cls: "bg-slate-100 text-slate-600" },
  enviada:   { label: "Enviada",   cls: "bg-blue-100 text-blue-700" },
  recibida:  { label: "Recibida",  cls: "bg-yellow-100 text-yellow-700" },
  cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-600" },
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-900">{esNueva ? "Nueva orden de compra" : "Editar OC"}</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor *</label>
            <select value={form.proveedor} onChange={e => {
              const c = proveedores.find(p => p.nombre === e.target.value);
              u("proveedor", e.target.value);
              if (c) u("cedulaProveedor", c.cedula || "");
            }} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm">
              <option value="">Seleccionar…</option>
              {proveedores.map(p => <option key={p.id}>{p.nombre}</option>)}
            </select>
            {!proveedores.length && <input value={form.proveedor} onChange={e=>u("proveedor",e.target.value)}
              placeholder="Nombre del proveedor" className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula proveedor</label>
            <input value={form.cedulaProveedor||""} onChange={e=>u("cedulaProveedor",e.target.value)}
              placeholder="3-000-000000" className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha entrega esperada</label>
            <input type="date" value={form.fechaEntrega||""} onChange={e=>u("fechaEntrega",e.target.value)}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
            <select value={form.moneda||"CRC"} onChange={e=>u("moneda",e.target.value)}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm">
              <option value="CRC">₡ CRC</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
        </div>

        {/* Líneas */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex gap-2">
            <input value={linea.producto} onChange={e=>setLinea(p=>({...p,producto:e.target.value}))}
              placeholder="Producto / descripción" list="prod-list"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs"/>
            <datalist id="prod-list">
              {productos.map(p => <option key={p.id} value={p.nombre}/>)}
            </datalist>
            <input type="number" value={linea.cantidad} min={1} onChange={e=>setLinea(p=>({...p,cantidad:e.target.value}))}
              className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center" placeholder="Cant."/>
            <input type="number" value={linea.precioUnit} onChange={e=>setLinea(p=>({...p,precioUnit:e.target.value}))}
              className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" placeholder="Precio unit."/>
            <button onClick={addLinea} className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">+ Agregar</button>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400">
              <th className="px-4 py-2 text-left">Producto</th>
              <th className="px-4 py-2 text-center">Cant.</th>
              <th className="px-4 py-2 text-right">Precio unit.</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2"/>
            </tr></thead>
            <tbody>
              {!(form.lineas||[]).length && <tr><td colSpan={5} className="text-center text-slate-400 py-4">Sin productos</td></tr>}
              {(form.lineas||[]).map(l => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{l.producto}</td>
                  <td className="px-4 py-2 text-center">{l.cantidad}</td>
                  <td className="px-4 py-2 text-right">{fmtMoney(l.precioUnit,settings)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtMoney(l.cantidad*l.precioUnit,settings)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={()=>removeLinea(l.id)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-right space-y-1">
            <p>Subtotal: <span className="font-semibold">{fmtMoney(subtotal,settings)}</span></p>
            <p>IVA 13%: <span className="font-semibold text-yellow-600">{fmtMoney(iva,settings)}</span></p>
            <p className="text-sm font-bold text-slate-900">Total: {fmtMoney(total,settings)}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas / condiciones</label>
          <textarea value={form.notas||""} onChange={e=>u("notas",e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm resize-none"/>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-yellow-700 text-white rounded-lg text-sm font-semibold">Guardar OC</button>
        </div>
      </div>
    </div>
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

  async function recibirOC(oc) {
    if (!confirm(`¿Marcar la OC ${oc.numero} como recibida? Se creará una factura de proveedor en Compras.`)) return;
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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <button onClick={() => setModal("nueva")}
          className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Plus size={13}/> Nueva OC
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        <button disabled={!sel || sel.estado==="recibida" || sel.estado==="cancelada"}
          onClick={() => sel && cambiarEstado(sel.id, "enviada")}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white px-3 py-1.5 rounded text-xs font-semibold">
          Marcar enviada
        </button>
        <button disabled={!sel || sel.estado==="recibida" || sel.estado==="cancelada"}
          onClick={() => sel && recibirOC(sel)}
          className="flex items-center gap-1.5 bg-yellow-700 hover:bg-yellow-800 disabled:opacity-30 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Check size={13}/> Recibir
        </button>
        <button disabled={!sel || sel.estado==="recibida"}
          onClick={() => sel && cambiarEstado(sel.id, "cancelada")}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <X size={13}/> Cancelar
        </button>
        <div className="flex-1"/>
        <select value={filtro} onChange={e=>setFiltro(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1.5">
          <option value="todos">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviadas</option>
          <option value="recibida">Recibidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <button onClick={() => exportExcel(ocs.map(o => ({
          "N° OC": o.numero, Proveedor: o.proveedor, Fecha: fmtDate(o.fecha),
          Estado: o.estado, Total: o.total, Moneda: o.moneda,
        })), "ordenes-compra")} className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto p-4">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Borradores",  val: ocs.filter(o=>o.estado==="borrador").length,  color: "slate" },
            { label: "Enviadas",    val: ocs.filter(o=>o.estado==="enviada").length,   color: "blue" },
            { label: "Recibidas",   val: ocs.filter(o=>o.estado==="recibida").length,  color: "emerald" },
            { label: "Canceladas",  val: ocs.filter(o=>o.estado==="cancelada").length, color: "red" },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-medium">{k.label}</p>
              <p className="text-2xl font-bold text-slate-800">{k.val}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead><tr>
              <th>N° OC</th><th>Proveedor</th><th>Fecha</th><th>Entrega esp.</th>
              <th>Estado</th><th className="text-right">Total</th><th>Notas</th>
            </tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">Sin órdenes de compra</td></tr>}
              {visibles.map(o => {
                const est = ESTADOS[o.estado] || ESTADOS.borrador;
                return (
                  <tr key={o.id} onClick={()=>setSelected(s=>s===o.id?null:o.id)}
                    className={`cursor-pointer ${selected===o.id?"bg-yellow-50 ring-1 ring-inset ring-yellow-300":""}`}>
                    <td className="font-mono text-xs font-bold">{o.numero}</td>
                    <td className="font-semibold">{o.proveedor}</td>
                    <td>{fmtDate(o.fecha)}</td>
                    <td className="text-slate-500">{o.fechaEntrega ? fmtDate(o.fechaEntrega) : "—"}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${est.cls}`}>{est.label}</span></td>
                    <td className="text-right font-semibold">{fmtMoney(o.total, o.moneda || settings?.moneda || "CRC")}</td>
                    <td className="text-slate-400 text-xs max-w-[150px] truncate">{o.notas||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <OCModal
          oc={modal === "nueva" ? null : modal}
          contactos={contactos} productos={productos} settings={settings}
          onClose={() => setModal(null)} onSave={cargar}
        />
      )}
    </div>
  );
}
