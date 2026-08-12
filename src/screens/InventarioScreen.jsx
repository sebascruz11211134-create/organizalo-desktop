/**
 * InventarioScreen — Gestión de inventario / productos (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Edit2, Package } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, genId } from "../utils/fmt";

const CATEGORIAS = ["Producto", "Servicio", "Materia Prima", "Consumible", "Activo", "Otro"];
const UNIDADES   = ["Unid", "Kg", "g", "L", "mL", "m", "cm", "h", "Días", "Servicio", "Otro"];

function ProductoModal({ prod, onClose, onSave }) {
  const esNuevo = !prod?.id;
  const [form, setForm] = useState(prod || {
    nombre: "", codigoInterno: "", codigoCabys: "", descripcion: "",
    precio: "", costo: "", stock: "", stockMin: "0",
    unidad: "Unid", categoria: "Producto", activo: true,
  });
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    const todos = await db.getProductos();
    const item  = { ...form, precio: parseFloat(form.precio) || 0, costo: parseFloat(form.costo) || 0, stock: parseFloat(form.stock) || 0, stockMin: parseFloat(form.stockMin) || 0 };
    if (esNuevo) {
      item.id        = genId();
      item.creadoEn  = new Date().toISOString();
      await db.setProductos([...todos, item]);
    } else {
      await db.setProductos(todos.map((x) => x.id === item.id ? item : x));
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNuevo ? "Nuevo producto" : "Editar producto"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Nombre *", "nombre", "text", "col-span-2"],
            ["Código interno", "codigoInterno", "text", ""],
            ["Código CABYS", "codigoCabys", "text", ""],
            ["Precio de venta", "precio", "number", ""],
            ["Costo", "costo", "number", ""],
            ["Stock actual", "stock", "number", ""],
            ["Stock mínimo", "stockMin", "number", ""],
          ].map(([label, key, type, extraCls]) => (
            <label key={key} className={`block ${extraCls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
              <input type={type} value={form[key] ?? ""} onChange={(e) => u(key, e.target.value)}
                step={type === "number" ? "any" : undefined} min={type === "number" ? "0" : undefined}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Categoría</span>
            <select value={form.categoria} onChange={(e) => u("categoria", e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Unidad</span>
            <select value={form.unidad} onChange={(e) => u("unidad", e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span>
            <textarea value={form.descripcion} onChange={(e) => u("descripcion", e.target.value)}
              rows={2} className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
          </label>
          <label className="flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={form.activo} onChange={(e) => u("activo", e.target.checked)}
              className="rounded" />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function InventarioScreen() {
  const [productos, setProductos] = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [cat,       setCat]       = useState("Todos");
  const [modal,     setModal]     = useState(null); // null | {} (nuevo) | prod (editar)

  const cargar = useCallback(async () => {
    const [p, s] = await Promise.all([db.getProductos(), db.getSettings()]);
    setProductos(p.sort((a, b) => a.nombre?.localeCompare(b.nombre || "") || 0));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = productos.filter((p) => {
    if (cat !== "Todos" && p.categoria !== cat) return false;
    if (busqL && !p.nombre?.toLowerCase().includes(busqL) && !p.codigoInterno?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const categorias = ["Todos", ...new Set(productos.map((p) => p.categoria).filter(Boolean))];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar producto…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-6 px-6 py-2 bg-gray-50 border-b border-gray-200 text-sm text-slate-500">
        <span>{productos.length} productos</span>
        <span className="text-amber-600 font-semibold">
          {productos.filter((p) => (p.stock || 0) <= (p.stockMin || 0) && p.activo !== false).length} bajo mínimo
        </span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>CABYS</th>
              <th>Precio venta</th>
              <th>Costo</th>
              <th>Stock</th>
              <th>Mín.</th>
              <th>Unidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-16 text-slate-400">
                {productos.length === 0 ? "Sin productos en inventario." : "Sin resultados."}
              </td></tr>
            ) : visibles.map((p) => {
              const bajoMin = (p.stock || 0) <= (p.stockMin || 0) && p.activo !== false;
              return (
                <tr key={p.id} className={p.activo === false ? "opacity-40" : ""}>
                  <td className="text-xs font-mono text-slate-400">{p.codigoInterno || "—"}</td>
                  <td className="font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Package size={13} className="text-green-600 shrink-0" />
                      {p.nombre}
                    </div>
                  </td>
                  <td className="text-slate-500 text-xs">{p.categoria || "—"}</td>
                  <td className="text-xs font-mono text-slate-400">{p.codigoCabys || "—"}</td>
                  <td className="text-green-700 font-semibold">{fmtMoney(p.precio, settings.moneda || "CRC")}</td>
                  <td className="text-slate-500">{p.costo ? fmtMoney(p.costo, settings.moneda || "CRC") : "—"}</td>
                  <td className={`font-bold ${bajoMin ? "text-red-600" : "text-slate-700"}`}>
                    {p.stock ?? "—"}
                    {bajoMin && <span className="ml-1 text-xs text-red-500">⚠</span>}
                  </td>
                  <td className="text-slate-400">{p.stockMin ?? "0"}</td>
                  <td className="text-slate-400 text-xs">{p.unidad || "Unid"}</td>
                  <td>
                    <button onClick={() => setModal(p)}
                      className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-700">
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <ProductoModal prod={Object.keys(modal).length > 0 ? modal : null}
          onClose={() => setModal(null)} onSave={cargar} />
      )}
    </div>
  );
}
