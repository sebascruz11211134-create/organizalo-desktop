import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FileText, Send, Copy, ChevronDown, Search, X, Check } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";

const IVA_PCT = { "01":0,"02":1,"03":2,"04":4,"05":0,"06":4,"07":8,"08":13 };

const ESTADOS = [
  { value:"borrador",  label:"Borrador",   color:"bg-slate-100 text-slate-600" },
  { value:"enviada",   label:"Enviada",    color:"bg-blue-100 text-blue-700" },
  { value:"aceptada",  label:"Aceptada",   color:"bg-green-100 text-emerald-700" },
  { value:"rechazada", label:"Rechazada",  color:"bg-red-100 text-red-600" },
  { value:"vencida",   label:"Vencida",    color:"bg-amber-100 text-amber-700" },
];

function calcLinea(l) {
  const cant = parseFloat(l.cantidad)||0, precio=parseFloat(l.precioUnit)||0;
  const desc = (cant*precio*(parseFloat(l.pctDesc)||0))/100;
  const sub  = cant*precio - desc;
  const pct  = IVA_PCT[l.codigoIVA]??13;
  return { ...l, montoDesc:desc, subTotal:sub, pctIVA:pct, montoIVA:(sub*pct)/100, total:sub+(sub*pct)/100 };
}

function lineaVacia() {
  return { id:genId(), descripcion:"", cantidad:"1", unidad:"Unid", codigoCabys:"", precioUnit:"", pctDesc:"0", codigoIVA:"08", montoDesc:0, subTotal:0, pctIVA:13, montoIVA:0, total:0 };
}

const BADGE = (estado) => {
  const e = ESTADOS.find(x=>x.value===estado) || ESTADOS[0];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${e.color}`}>{e.label}</span>;
};

// ── Vista lista ───────────────────────────────────────────────────────────────
function ListView({ cotizaciones, onNueva, onEditar, onConvertir, onDuplicar, onEliminar, busq, setBusq }) {
  const [selected, setSelected] = useState(null);

  const filtradas = cotizaciones.filter(c =>
    c.numero?.includes(busq) ||
    c.cliente?.nombre?.toLowerCase().includes(busq.toLowerCase())
  );
  const sel = filtradas.find(c => c.id === selected);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 shrink-0">
        <button onClick={onNueva}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
          <Plus size={13}/> Nueva
        </button>
        <button disabled={!sel} onClick={()=>sel&&onEditar(sel)}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          Editar
        </button>
        <button disabled={!sel} onClick={()=>sel&&onConvertir(sel)}
          className="flex items-center gap-1.5 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          <Send size={11}/> Facturar
        </button>
        <button disabled={!sel} onClick={()=>sel&&onDuplicar(sel)}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          <Copy size={11}/> Duplicar
        </button>
        <button disabled={!sel} onClick={()=>sel&&onEliminar(sel.id)}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-30">
          <Trash2 size={13}/> Eliminar
        </button>
        <div className="ml-auto flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
          <Search size={12} className="text-slate-300"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar…"
            className="bg-transparent text-white text-xs outline-none w-44 placeholder-slate-400"/>
        </div>
      </div>
      {sel ? (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs shrink-0">
          <span className="text-blue-700 font-semibold">Seleccionado:</span>
          <span className="font-bold">{sel.numero}</span>
          <span className="text-slate-400">{sel.cliente?.nombre}</span>
          <button onClick={()=>setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
        </div>
      ) : (
        <div className="px-4 py-1.5 bg-slate-50 border-b text-[10px] text-slate-400 shrink-0">
          {filtradas.length} cotizaciones — clic en fila para seleccionar
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <FileText size={40} className="text-slate-200"/>
            <p className="text-sm">No hay cotizaciones. Creá una nueva.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">N.°</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Cliente</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Válida por</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Total</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map(c => {
                const totCalc = (c.lineas||[]).map(calcLinea).reduce((s,l)=>s+l.total,0);
                return (
                  <tr key={c.id} onClick={()=>setSelected(selected===c.id?null:c.id)}
                    className={`cursor-pointer transition-colors ${selected===c.id?"bg-blue-50 border-l-4 border-blue-500":"hover:bg-slate-50"}`}>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-600">{c.numero}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{c.cliente?.nombre || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(c.fecha)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{c.validez ? `${c.validez} días` : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">{fmtMoney(c.total||totCalc,"CRC")}</td>
                    <td className="px-3 py-2.5">{BADGE(c.estado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Formulario de cotización ──────────────────────────────────────────────────
function FormView({ cotizacion, contactos, productos, onGuardar, onCancelar }) {
  const esNueva = !cotizacion?.id;
  const [cliente,    setCliente]    = useState(cotizacion?.cliente || { nombre:"", cedula:"", email:"", tipo:"01" });
  const [busqCliente,setBusqCliente]= useState(cotizacion?.cliente?.nombre || "");
  const [showClientes,setShowClientes]=useState(false);
  const [estado,     setEstado]     = useState(cotizacion?.estado || "borrador");
  const [fecha,      setFecha]      = useState(cotizacion?.fecha || hoy());
  const [validez,    setValidez]    = useState(cotizacion?.validez || "30");
  const [notas,      setNotas]      = useState(cotizacion?.notas || "");
  const [lineas,     setLineas]     = useState(cotizacion?.lineas?.length ? cotizacion.lineas : [lineaVacia()]);

  const filtrados = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busqCliente.toLowerCase()) ||
    c.cedula?.includes(busqCliente) ||
    c.codigoCliente?.toUpperCase().includes(busqCliente.toUpperCase())
  ).slice(0,6);

  const lineasCalc = lineas.map(calcLinea);
  const subtotal   = lineasCalc.reduce((s,l)=>s+l.subTotal,0);
  const totalIVA   = lineasCalc.reduce((s,l)=>s+l.montoIVA,0);
  const total      = lineasCalc.reduce((s,l)=>s+l.total,0);

  const guardar = () => {
    const num = cotizacion?.numero || `COT-${Date.now().toString().slice(-5)}`;
    onGuardar({ id: cotizacion?.id || genId(), numero:num, cliente, estado, fecha, validez, notas, lineas:lineasCalc, subtotal, totalIVA, total, creadoEn: cotizacion?.creadoEn || new Date().toISOString() });
  };

  const INP = "w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400";
  const LBL = "block text-[10px] font-bold text-slate-500 uppercase mb-1";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600 shrink-0">
        <button onClick={onCancelar} className="flex items-center gap-1.5 border border-slate-500 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-semibold">
          <X size={13}/> Cancelar
        </button>
        <span className="text-slate-300 text-xs font-bold flex-1">{esNueva ? "Nueva cotización" : cotizacion.numero}</span>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="text-white font-black">{fmtMoney(total,"CRC")}</span>
        </div>
        <select value={estado} onChange={e=>setEstado(e.target.value)}
          className="text-xs border border-slate-500 bg-slate-600 text-white rounded px-2 py-1.5 focus:outline-none">
          {ESTADOS.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <button onClick={guardar} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-semibold">
          <Check size={13}/> Guardar
        </button>
      </div>

      {/* Body 3 paneles */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel izquierdo */}
        <div className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto px-3 py-3 space-y-3">
          <div>
            <label className={LBL}>Cliente</label>
            <div className="relative">
              <input value={busqCliente} autoComplete="off"
                onChange={e=>{setBusqCliente(e.target.value);setCliente(p=>({...p,nombre:e.target.value}));setShowClientes(true);}}
                onFocus={()=>setShowClientes(true)} onBlur={()=>setTimeout(()=>setShowClientes(false),150)}
                placeholder="Nombre del cliente…" className={INP}/>
              {showClientes && filtrados.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded shadow-lg z-20 max-h-40 overflow-auto">
                  {filtrados.map(c=>(
                    <button key={c.id} onMouseDown={()=>{setCliente({nombre:c.nombre,cedula:c.cedula||"",email:c.email||"",tipo:c.tipoCedula||"01"});setBusqCliente(c.nombre);setShowClientes(false);}}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 rounded mr-1">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={LBL}>Cédula</label>
            <input value={cliente.cedula} onChange={e=>setCliente(p=>({...p,cedula:e.target.value}))} placeholder="Número…" className={INP}/>
          </div>
          <div>
            <label className={LBL}>Correo</label>
            <input value={cliente.email} onChange={e=>setCliente(p=>({...p,email:e.target.value}))} placeholder="cliente@…" className={INP}/>
          </div>
          <div className="border-t border-slate-200"/>
          <div>
            <label className={LBL}>Fecha</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} className={INP}/>
          </div>
          <div>
            <label className={LBL}>Válida por (días)</label>
            <input type="number" value={validez} onChange={e=>setValidez(e.target.value)} min="1" className={INP}/>
          </div>
        </div>

        {/* Panel central: líneas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Descripción</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-16">Cant.</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-28">P. Unit.</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-14">%Desc</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase w-20">IVA</th>
                  <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-500 uppercase w-28">Total</th>
                  <th className="w-8"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineas.map((l,i)=>(
                  <tr key={l.id} className="group">
                    <td className="px-1">
                      <input value={l.descripcion}
                        onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,descripcion:e.target.value}:x))}
                        placeholder="Descripción…"
                        className="w-full border-0 bg-transparent text-sm outline-none py-2 px-3 rounded focus:bg-emerald-50"/>
                    </td>
                    <td className="px-1">
                      <input value={l.cantidad} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                        type="number" min="0"
                        className="w-full border-0 bg-transparent text-sm outline-none py-2 px-2 rounded focus:bg-emerald-50 text-center"/>
                    </td>
                    <td className="px-1">
                      <input value={l.precioUnit} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,precioUnit:e.target.value}:x))}
                        type="number" min="0" placeholder="0"
                        className="w-full border-0 bg-transparent text-sm outline-none py-2 px-3 rounded focus:bg-emerald-50 text-right"/>
                    </td>
                    <td className="px-1">
                      <input value={l.pctDesc} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,pctDesc:e.target.value}:x))}
                        type="number" min="0" max="100" placeholder="0"
                        className="w-full border-0 bg-transparent text-sm outline-none py-2 px-2 rounded focus:bg-emerald-50 text-center"/>
                    </td>
                    <td className="px-1">
                      <select value={l.codigoIVA} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,codigoIVA:e.target.value}:x))}
                        className="border-0 bg-transparent text-xs outline-none py-2 px-1 rounded focus:bg-emerald-50">
                        <option value="01">0%</option>
                        <option value="07">8%</option>
                        <option value="08">13%</option>
                      </select>
                    </td>
                    <td className="text-right font-semibold text-sm px-4 text-emerald-700">{fmtMoney(calcLinea(l).total,"CRC")}</td>
                    <td>
                      <button onClick={()=>setLineas(p=>p.filter((_,j)=>j!==i))}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                        <Trash2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-2">
            <button onClick={()=>setLineas(p=>[...p,lineaVacia()])}
              className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold">
              <Plus size={13}/> Agregar línea
            </button>
          </div>
        </div>

        {/* Panel derecho: totales + notas */}
        <div className="w-52 shrink-0 bg-white border-l border-slate-200 overflow-y-auto px-4 py-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Resumen</p>
          <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span>{fmtMoney(subtotal,"CRC")}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>IVA</span><span>{fmtMoney(totalIVA,"CRC")}</span></div>
          <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
            <span>TOTAL</span><span className="text-emerald-700">{fmtMoney(total,"CRC")}</span>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <label className={LBL}>Notas / condiciones</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={5}
              placeholder="Condiciones de pago, validez…"
              className="w-full border border-slate-200 rounded px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function CotizacionesScreen() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [contactos,    setContactos]    = useState([]);
  const [productos,    setProductos]    = useState([]);
  const [vista,        setVista]        = useState("lista"); // "lista" | "form"
  const [editando,     setEditando]     = useState(null);
  const [busq,         setBusq]         = useState("");

  const cargar = useCallback(async () => {
    const [c, ct, p] = await Promise.all([db.getCotizaciones(), db.getContactos(), db.getProductos()]);
    setCotizaciones(c || []);
    setContactos(ct || []);
    setProductos(p || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (cot) => {
    const all = await db.getCotizaciones();
    const idx = all.findIndex(x => x.id === cot.id);
    const nueva = idx >= 0 ? all.map((x,i)=>i===idx?cot:x) : [...all, cot];
    await db.setCotizaciones(nueva);
    cargar();
    setVista("lista");
    setEditando(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const all = await db.getCotizaciones();
    await db.setCotizaciones(all.filter(x=>x.id!==id));
    cargar();
  };

  const duplicar = async (cot) => {
    const nueva = { ...cot, id:genId(), numero:`COT-${Date.now().toString().slice(-5)}`, estado:"borrador", creadoEn:new Date().toISOString() };
    const all   = await db.getCotizaciones();
    await db.setCotizaciones([...all, nueva]);
    cargar();
  };

  const convertirAFactura = async (cot) => {
    const [facturas, contactos] = await Promise.all([db.getFacturas(), db.getContactos()]);
    const num = `FE-${String(facturas.length+1).padStart(5,"0")}`;

    // Buscar dias_credito del cliente en Contactos
    const nombreCliente = (cot.cliente?.nombre || "").toLowerCase();
    const contacto = contactos.find(c =>
      c.nombre?.toLowerCase() === nombreCliente ||
      (cot.cliente?.cedula && c.cedula === cot.cliente.cedula)
    );
    const diasCred = contacto?.dias_credito || 0;
    const condPago = diasCred > 0 ? "02" : "01";

    const factura = {
      id: genId(), numero: num, tipoDoc: "01", fecha: hoy(),
      condPago, medioPago: "01", plazo: diasCred, moneda: "CRC",
      cliente: cot.cliente, lineas: cot.lineas,
      subtotal: cot.subtotal, totalDescuento: 0, totalIVA: cot.totalIVA, total: cot.total,
      notas: cot.notas, estado: "guardada",
      creadoEn: new Date().toISOString(), origenCotizacion: cot.numero,
    };
    await db.setFacturas([...facturas, factura]);
    // Marcar cotización como aceptada
    await guardar({ ...cot, estado:"aceptada" });
    const credMsg = diasCred > 0 ? ` — crédito ${diasCred} días` : "";
    alert(`✓ Factura ${num} creada desde ${cot.numero}${credMsg}`);
  };

  if (vista === "form") {
    return <FormView cotizacion={editando} contactos={contactos} productos={productos}
      onGuardar={guardar} onCancelar={()=>{setVista("lista");setEditando(null);}} />;
  }

  return <ListView cotizaciones={cotizaciones} busq={busq} setBusq={setBusq}
    onNueva={()=>{setEditando(null);setVista("form");}}
    onEditar={c=>{setEditando(c);setVista("form");}}
    onConvertir={convertirAFactura} onDuplicar={duplicar} onEliminar={eliminar} />;
}
