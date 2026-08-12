/**
 * ComprasScreen — Facturas de proveedor / compras
 * Registra gastos con crédito fiscal de IVA.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, X, Check, ShoppingCart } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { crearCXP } from "../utils/clienteUtils";

const CATEGORIAS = ["Mercadería","Materia prima","Servicios","Equipo","Suministros","Alquiler","Publicidad","Transporte","Otro"];
const MEDIOS = ["Efectivo","Transferencia","SINPE Móvil","Tarjeta","Cheque","Crédito proveedor"];

const ESTADOS = {
  pendiente:  { label:"Pendiente",   cls:"bg-amber-100 text-amber-700" },
  pagada:     { label:"Pagada",      cls:"bg-green-100 text-green-700" },
  vencida:    { label:"Vencida",     cls:"bg-red-100 text-red-600" },
};

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${e.cls}`}>{e.label}</span>;
}

function FormCompra({ compra, contactos, onGuardar, onCancelar }) {
  const [proveedor,  setProveedor]  = useState(compra?.proveedor || "");
  const [numFactura, setNumFactura] = useState(compra?.numFactura || "");
  const [fecha,      setFecha]      = useState(compra?.fecha || hoy());
  const [fechaVence, setFechaVence] = useState(compra?.fechaVence || "");
  const [categoria,  setCategoria]  = useState(compra?.categoria || "Mercadería");
  const [medio,      setMedio]      = useState(compra?.medio || "Transferencia");
  const [estado,     setEstado]     = useState(compra?.estado || "pendiente");
  const [montoBase,  setMontoBase]  = useState(compra?.montoBase || "");
  const [pctIVA,     setPctIVA]     = useState(compra?.pctIVA ?? 13);
  const [notas,      setNotas]      = useState(compra?.notas || "");
  const [busq,       setBusq]       = useState(compra?.proveedor || "");
  const [showProv,   setShowProv]   = useState(false);

  const base      = parseFloat(montoBase) || 0;
  const montoIVA  = (base * pctIVA) / 100;
  const total     = base + montoIVA;

  const filtrados = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
    c.cedula?.includes(busq) ||
    c.codigoCliente?.toUpperCase().includes(busq.toUpperCase())
  ).slice(0,6);

  const guardar = () => {
    onGuardar({
      id: compra?.id || genId(),
      proveedor, numFactura, fecha, fechaVence, categoria, medio, estado,
      montoBase: base, pctIVA, montoIVA, total, notas,
      creadoEn: compra?.creadoEn || new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <button onClick={onCancelar} className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1">
          <X size={14}/> Cancelar
        </button>
        <span className="text-slate-300">|</span>
        <h2 className="font-bold text-slate-700 text-sm flex-1">{compra ? "Editar compra" : "Nueva compra / factura de proveedor"}</h2>
        <button onClick={guardar}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
          <Check size={14}/> Guardar
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Proveedor */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Proveedor</h3>
            <div className="relative">
              <input value={busq}
                onChange={e=>{setBusq(e.target.value);setProveedor(e.target.value);setShowProv(true);}}
                onFocus={()=>setShowProv(true)} onBlur={()=>setTimeout(()=>setShowProv(false),150)}
                placeholder="Nombre del proveedor…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              {showProv && filtrados.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-36 overflow-auto">
                  {filtrados.map(c=>(
                    <button key={c.id} onMouseDown={()=>{setProveedor(c.nombre);setBusq(c.nombre);setShowProv(false);}}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-2">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">N.º factura proveedor</label>
                <input value={numFactura} onChange={e=>setNumFactura(e.target.value)}
                  placeholder="Ej. FAC-0012345"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Categoría</label>
                <select value={categoria} onChange={e=>setCategoria(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                  {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Fechas y estado */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha factura</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha vencimiento</label>
              <input type="date" value={fechaVence} onChange={e=>setFechaVence(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Estado</label>
              <select value={estado} onChange={e=>setEstado(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Monto */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Importes</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Monto base (sin IVA)</label>
                <input type="number" value={montoBase} onChange={e=>setMontoBase(e.target.value)} min="0" step="any"
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 text-right" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">% IVA (crédito fiscal)</label>
                <select value={pctIVA} onChange={e=>setPctIVA(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                  <option value={0}>0% - Exento</option>
                  <option value={1}>1%</option>
                  <option value={2}>2%</option>
                  <option value={4}>4%</option>
                  <option value={8}>8%</option>
                  <option value={13}>13%</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Medio de pago</label>
                <select value={medio} onChange={e=>setMedio(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                  {MEDIOS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Base imponible</span><span>{fmtMoney(base,"CRC")}</span></div>
              <div className="flex justify-between text-slate-500"><span>IVA ({pctIVA}%) — crédito fiscal</span><span>{fmtMoney(montoIVA,"CRC")}</span></div>
              <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Total a pagar</span><span className="text-lg">{fmtMoney(total,"CRC")}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Notas</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={2}
              placeholder="Observaciones, referencia interna…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function ComprasScreen() {
  const [compras,   setCompras]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [vista,     setVista]     = useState("lista");
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");

  const cargar = useCallback(async () => {
    const [c, ct] = await Promise.all([db.getCompras(), db.getContactos()]);
    setCompras(c || []);
    setContactos(ct || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (c) => {
    const all = await db.getCompras();
    const idx = all.findIndex(x=>x.id===c.id);
    const esNueva = idx < 0;
    await db.setCompras(esNueva ? [...all, c] : all.map((x,i)=>i===idx?c:x));

    // Si es nueva compra a crédito de proveedor → crear CXP automáticamente
    if (esNueva && c.medio === "Crédito proveedor") {
      await crearCXP({
        proveedor:  c.proveedor,
        total:      c.total,
        moneda:     "CRC",
        fechaVence: c.fechaVence || null,
        facturaRef: c.numFactura || "",
      });
    }

    cargar(); setVista("lista"); setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta compra?")) return;
    const all = await db.getCompras();
    await db.setCompras(all.filter(x=>x.id!==id));
    cargar();
  };

  const marcarPagada = async (id) => {
    const all = await db.getCompras();
    await db.setCompras(all.map(x=>x.id===id?{...x,estado:"pagada"}:x));
    cargar();
  };

  if (vista==="form") {
    return <FormCompra compra={editando} contactos={contactos}
      onGuardar={guardar} onCancelar={()=>{setVista("lista");setEditando(null);}} />;
  }

  const filtradas = compras.filter(c =>
    (filtroEst==="todos" || c.estado===filtroEst) &&
    (c.proveedor?.toLowerCase().includes(busq.toLowerCase()) || c.numFactura?.includes(busq))
  );

  const totPendiente = compras.filter(x=>x.estado==="pendiente").reduce((s,c)=>s+c.total,0);
  const totMes = compras.filter(x=>x.fecha?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,c)=>s+c.total,0);
  const totIVA  = compras.filter(x=>x.estado!=="vencida").reduce((s,c)=>s+(c.montoIVA||0),0);

  return (
    <div className="flex flex-col h-full">
      {/* KPIs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-6">
        {[
          { label:"Por pagar", val:fmtMoney(totPendiente,"CRC"), sub:"facturas pendientes", color:"text-amber-600" },
          { label:"Compras del mes", val:fmtMoney(totMes,"CRC"), sub:"acumulado", color:"text-slate-800" },
          { label:"IVA crédito fiscal", val:fmtMoney(totIVA,"CRC"), sub:"deducible", color:"text-green-600" },
        ].map(k=>(
          <div key={k.label} className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">{k.label}</span>
            <span className={`text-lg font-black ${k.color}`}>{k.val}</span>
            <span className="text-[10px] text-slate-400">{k.sub}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar…"
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </div>
          <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
            <option value="todos">Todos</option>
            {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={()=>{setEditando(null);setVista("form");}}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
            <Plus size={14}/> Nueva compra
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <ShoppingCart size={40} className="text-slate-200"/>
            <p className="text-sm">Sin compras registradas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(c=>(
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-brand-300 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm">{c.proveedor || "Proveedor"}</span>
                    {c.numFactura && <span className="text-xs text-slate-400">#{c.numFactura}</span>}
                    <Badge estado={c.estado}/>
                  </div>
                  <p className="text-xs text-slate-400">{c.categoria} · {fmtDate(c.fecha)}{c.fechaVence?` · vence ${fmtDate(c.fechaVence)}`:""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmtMoney(c.total,"CRC")}</p>
                  <p className="text-[10px] text-green-600">IVA {fmtMoney(c.montoIVA||0,"CRC")}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>{setEditando(c);setVista("form");}} className="text-xs px-2 py-1 rounded hover:bg-slate-100 text-slate-500">Editar</button>
                  {c.estado==="pendiente" && (
                    <button onClick={()=>marcarPagada(c.id)} className="text-xs px-2 py-1 rounded hover:bg-green-50 text-green-600 font-semibold">Marcar pagada</button>
                  )}
                  <button onClick={()=>eliminar(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
