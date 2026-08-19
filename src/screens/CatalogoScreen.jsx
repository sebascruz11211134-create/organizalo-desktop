import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, X, Check, Package } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, genId } from "../utils/fmt";

const CATEGORIAS = ["General","Alimentos","Bebidas","Ropa","Electrónica","Herramientas","Servicios","Otro"];
const UNIDADES   = ["Unid","Kg","g","L","mL","m","h","Caja","Par","Docena","Servicio"];

function FormProducto({ prod, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre:       prod?.nombre || "",
    descripcion:  prod?.descripcion || "",
    categoria:    prod?.categoria || "General",
    codigoInterno:prod?.codigoInterno || "",
    codigoBarras: prod?.codigoBarras || "",
    codigoCabys:  prod?.codigoCabys || "",
    precio:       prod?.precio || "",
    precioCompra: prod?.precioCompra || "",
    unidad:       prod?.unidad || "Unid",
    pctIVA:       prod?.pctIVA ?? 13,
    stock:        prod?.stock ?? "",
    stockMin:     prod?.stockMin ?? "",
    activo:       prod?.activo ?? true,
  });
  const u = k => e => setF(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));

  const margen = f.precio && f.precioCompra
    ? (((parseFloat(f.precio)-parseFloat(f.precioCompra))/parseFloat(f.precioCompra))*100).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-800">{prod ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onCancelar}><X size={18} className="text-slate-400 hover:text-slate-700"/></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Info básica */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Nombre *</label>
              <input value={f.nombre} onChange={u("nombre")} placeholder="Nombre del producto o servicio"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descripción</label>
              <textarea value={f.descripcion} onChange={u("descripcion")} rows={2}
                placeholder="Descripción detallada…"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Categoría</label>
                <select value={f.categoria} onChange={u("categoria")}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Unidad de medida</label>
                <select value={f.unidad} onChange={u("unidad")}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  {UNIDADES.map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Códigos */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Códigos</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Cód. interno</label>
                <input value={f.codigoInterno} onChange={u("codigoInterno")} placeholder="SKU-001"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Código barras</label>
                <input value={f.codigoBarras} onChange={u("codigoBarras")} placeholder="7XXXXXXXXXX"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">CABYS</label>
                <input value={f.codigoCabys} onChange={u("codigoCabys")} placeholder="Hacienda"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
            </div>
          </div>

          {/* Precios */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Precios</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Precio venta *</label>
                <input type="number" value={f.precio} onChange={u("precio")} min="0" step="any" placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 text-right" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Precio compra</label>
                <input type="number" value={f.precioCompra} onChange={u("precioCompra")} min="0" step="any" placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 text-right" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">% IVA</label>
                <select value={f.pctIVA} onChange={e=>setF(p=>({...p,pctIVA:Number(e.target.value)}))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  <option value={0}>0% Exento</option>
                  <option value={4}>4%</option>
                  <option value={8}>8%</option>
                  <option value={13}>13%</option>
                </select>
              </div>
            </div>
            {margen && (
              <p className="text-xs text-emerald-600 font-semibold">Margen: {margen}% · Precio con IVA: {fmtMoney(parseFloat(f.precio)*(1+f.pctIVA/100),"CRC")}</p>
            )}
          </div>

          {/* Stock */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Inventario</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Stock actual</label>
                <input type="number" value={f.stock} onChange={u("stock")} min="0" placeholder="—"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 text-center" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Stock mínimo</label>
                <input type="number" value={f.stockMin} onChange={u("stockMin")} min="0" placeholder="—"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 text-center" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={f.activo} onChange={u("activo")} className="rounded" />
                  <span className="text-slate-600 font-medium">Activo</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onCancelar} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={()=>onGuardar({ id:prod?.id||genId(), ...f, precio:parseFloat(f.precio)||0, precioCompra:parseFloat(f.precioCompra)||0, stock:f.stock!==""?Number(f.stock):null, stockMin:f.stockMin!==""?Number(f.stockMin):null })}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
            <Check size={14}/> Guardar producto
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoScreen() {
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [catFiltro, setCatFiltro] = useState("Todos");
  const [vista,     setVista]     = useState("grid"); // "grid" | "tabla"

  const cargar = useCallback(async () => {
    setProductos(await db.getProductos() || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (p) => {
    const all = await db.getProductos();
    const idx = all.findIndex(x=>x.id===p.id);
    await db.setProductos(idx>=0 ? all.map((x,i)=>i===idx?p:x) : [...all,p]);
    cargar(); setForm(false); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const all = await db.getProductos();
    await db.setProductos(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = productos.filter(p =>
    (catFiltro==="Todos" || p.categoria===catFiltro) &&
    (p.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
     p.codigoBarras?.includes(busq) || p.codigoInterno?.includes(busq))
  );

  const stockBajo = productos.filter(p => p.stock!=null && p.stockMin!=null && p.stock<=p.stockMin).length;

  return (
    <div className="flex flex-col h-full">
      {form && <FormProducto prod={editando} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}} />}

      {/* Barra */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto, código…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-56" />
        </div>
        <select value={catFiltro} onChange={e=>setCatFiltro(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
          <option>Todos</option>
          {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
        </select>
        {stockBajo>0 && (
          <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">⚠️ {stockBajo} con stock bajo</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">{filtrados.length} productos</span>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            {["grid","tabla"].map(v=>(
              <button key={v} onClick={()=>setVista(v)}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${vista===v?"bg-emerald-600 text-white":"text-slate-500 hover:bg-slate-50"}`}>
                {v==="grid"?"⊞":"☰"}
              </button>
            ))}
          </div>
          <button onClick={()=>{setEditando(null);setForm(true);}}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-700">
            <Plus size={14}/> Nuevo producto
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        {filtrados.length===0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Package size={40} className="text-slate-200"/>
            <p className="text-sm">No hay productos en el catálogo.</p>
          </div>
        ) : vista==="grid" ? (
          <div className="grid grid-cols-4 gap-4">
            {filtrados.map(p => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm group transition-all">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <span className="text-emerald-700 font-black text-xl">{(p.nombre||"?").charAt(0)}</span>
                </div>
                <p className="font-bold text-sm text-slate-800 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400 truncate mb-2">{p.categoria} {p.codigoInterno && `· ${p.codigoInterno}`}</p>
                <p className="text-base font-black text-emerald-700">{fmtMoney(p.precio||0,"CRC")}</p>
                {p.stock!=null && (
                  <p className={`text-[10px] font-semibold mt-0.5 ${p.stockMin!=null&&p.stock<=p.stockMin?"text-red-500":"text-slate-400"}`}>
                    Stock: {p.stock} {p.stockMin!=null&&p.stock<=p.stockMin?"⚠️":""}
                  </p>
                )}
                <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>{setEditando(p);setForm(true);}} className="flex-1 text-xs py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">Editar</button>
                  <button onClick={()=>eliminar(p.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm bg-white border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-500 uppercase">
                <th className="text-left px-4 py-2.5">Nombre</th>
                <th className="text-left px-4 py-2.5">Categoría</th>
                <th className="text-left px-4 py-2.5">Código</th>
                <th className="text-right px-4 py-2.5">Precio</th>
                <th className="text-center px-4 py-2.5">IVA</th>
                <th className="text-center px-4 py-2.5">Stock</th>
                <th className="w-20"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(p=>(
                <tr key={p.id} className="hover:bg-slate-50 group">
                  <td className="px-4 py-2.5 font-semibold">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.categoria||"—"}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{p.codigoInterno||p.codigoBarras||"—"}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{fmtMoney(p.precio||0,"CRC")}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{p.pctIVA||13}%</td>
                  <td className={`px-4 py-2.5 text-center font-semibold ${p.stock!=null&&p.stockMin!=null&&p.stock<=p.stockMin?"text-red-500":"text-slate-600"}`}>
                    {p.stock!=null?p.stock:"—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={()=>{setEditando(p);setForm(true);}} className="text-xs px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-500">Editar</button>
                      <button onClick={()=>eliminar(p.id)} className="p-1 hover:bg-red-50 text-red-400 rounded"><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
