import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FileText, Send, Copy, ChevronDown, Search, X, Check } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";

const IVA_PCT = { "01":0,"02":1,"03":2,"04":4,"05":0,"06":4,"07":8,"08":13 };

const ESTADOS = [
  { value:"borrador",  label:"Borrador",   color:"bg-slate-100 text-slate-600" },
  { value:"enviada",   label:"Enviada",    color:"bg-blue-100 text-blue-700" },
  { value:"aceptada",  label:"Aceptada",   color:"bg-green-100 text-green-700" },
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
  const filtradas = cotizaciones.filter(c =>
    c.numero?.includes(busq) ||
    c.cliente?.nombre?.toLowerCase().includes(busq.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busq} onChange={e=>setBusq(e.target.value)}
            placeholder="Buscar cotización o cliente…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
        <button onClick={onNueva}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
          <Plus size={14}/> Nueva cotización
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <FileText size={40} className="text-slate-200"/>
            <p className="text-sm">No hay cotizaciones. Creá una nueva.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(c => {
              const totCalc = (c.lineas||[]).map(calcLinea).reduce((s,l)=>s+l.total,0);
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-brand-300 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-slate-800">{c.numero}</span>
                      {BADGE(c.estado)}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.cliente?.nombre || "Sin cliente"} · {fmtDate(c.fecha)}</p>
                  </div>
                  <p className="font-bold text-slate-800 text-sm shrink-0">{fmtMoney(c.total||totCalc,"CRC")}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>onEditar(c)} title="Ver / editar"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 text-xs">Ver</button>
                    <button onClick={()=>onConvertir(c)} title="Convertir a factura"
                      className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 text-xs flex items-center gap-1">
                      <Send size={11}/> Facturar
                    </button>
                    <button onClick={()=>onDuplicar(c)} title="Duplicar"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500">
                      <Copy size={13}/>
                    </button>
                    <button onClick={()=>onEliminar(c.id)} title="Eliminar"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <button onClick={onCancelar} className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1">
          <X size={14}/> Cancelar
        </button>
        <span className="text-slate-300">|</span>
        <h2 className="font-bold text-slate-700 text-sm flex-1">{esNueva ? "Nueva cotización" : cotizacion.numero}</h2>
        <select value={estado} onChange={e=>setEstado(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
          {ESTADOS.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <button onClick={guardar}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600">
          <Check size={14}/> Guardar
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Encabezado */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4">
          {/* Cliente */}
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Cliente</label>
            <div className="relative">
              <input value={busqCliente}
                onChange={e=>{setBusqCliente(e.target.value);setCliente(p=>({...p,nombre:e.target.value}));setShowClientes(true);}}
                onFocus={()=>setShowClientes(true)} onBlur={()=>setTimeout(()=>setShowClientes(false),150)}
                placeholder="Nombre del cliente…"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              {showClientes && filtrados.length>0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-36 overflow-auto">
                  {filtrados.map(c=>(
                    <button key={c.id} onMouseDown={()=>{setCliente({nombre:c.nombre,cedula:c.cedula||"",email:c.email||"",tipo:c.tipoCedula||"01"});setBusqCliente(c.nombre);setShowClientes(false);}}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-2">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={cliente.cedula} onChange={e=>setCliente(p=>({...p,cedula:e.target.value}))}
                placeholder="Cédula" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              <input value={cliente.email} onChange={e=>setCliente(p=>({...p,email:e.target.value}))}
                placeholder="Correo" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
          </div>
          {/* Fechas */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Válida por (días)</label>
              <input type="number" value={validez} onChange={e=>setValidez(e.target.value)} min="1"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
          </div>
        </div>

        {/* Líneas */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[11px] font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-2">Descripción</th>
                <th className="text-center px-2 py-2 w-16">Cant.</th>
                <th className="text-right px-4 py-2 w-28">P. Unit.</th>
                <th className="text-center px-2 py-2 w-14">%Desc</th>
                <th className="text-center px-2 py-2 w-20">IVA</th>
                <th className="text-right px-4 py-2 w-28">Total</th>
                <th className="w-8"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineas.map((l,i)=>(
                <tr key={l.id} className="group">
                  <td className="relative px-1">
                    <input value={l.descripcion}
                      onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,descripcion:e.target.value}:x))}
                      placeholder="Descripción…"
                      className="w-full border-0 bg-transparent text-sm outline-none py-2 px-3 rounded focus:bg-green-50" />
                  </td>
                  <td className="px-1">
                    <input value={l.cantidad} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                      type="number" min="0"
                      className="w-full border-0 bg-transparent text-sm outline-none py-2 px-2 rounded focus:bg-green-50 text-center" />
                  </td>
                  <td className="px-1">
                    <input value={l.precioUnit} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,precioUnit:e.target.value}:x))}
                      type="number" min="0" placeholder="0"
                      className="w-full border-0 bg-transparent text-sm outline-none py-2 px-3 rounded focus:bg-green-50 text-right" />
                  </td>
                  <td className="px-1">
                    <input value={l.pctDesc} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,pctDesc:e.target.value}:x))}
                      type="number" min="0" max="100" placeholder="0"
                      className="w-full border-0 bg-transparent text-sm outline-none py-2 px-2 rounded focus:bg-green-50 text-center" />
                  </td>
                  <td className="px-1">
                    <select value={l.codigoIVA} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,codigoIVA:e.target.value}:x))}
                      className="border-0 bg-transparent text-xs outline-none py-2 px-1 rounded focus:bg-green-50">
                      <option value="01">0%</option>
                      <option value="07">8%</option>
                      <option value="08">13%</option>
                    </select>
                  </td>
                  <td className="text-right font-semibold text-sm px-4">{fmtMoney(calcLinea(l).total,"CRC")}</td>
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
          <div className="px-4 py-2 border-t border-slate-100">
            <button onClick={()=>setLineas(p=>[...p,lineaVacia()])}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold">
              <Plus size={12}/> Agregar línea
            </button>
          </div>
        </div>

        {/* Totales + Notas */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Notas / condiciones</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={3}
              placeholder="Validez, condiciones de pago, notas adicionales…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 w-60 space-y-1.5 text-sm self-start">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtMoney(subtotal,"CRC")}</span></div>
            <div className="flex justify-between text-slate-500"><span>IVA</span><span>{fmtMoney(totalIVA,"CRC")}</span></div>
            <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1.5 mt-1">
              <span>Total</span><span>{fmtMoney(total,"CRC")}</span>
            </div>
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
    const facturas = await db.getFacturas();
    const num = `FE-${String(facturas.length+1).padStart(5,"0")}`;
    const factura = { id:genId(), numero:num, tipoDoc:"01", fecha:hoy(), condPago:"01", medioPago:"01", plazo:0, moneda:"CRC", cliente:cot.cliente, lineas:cot.lineas, subtotal:cot.subtotal, totalDescuento:0, totalIVA:cot.totalIVA, total:cot.total, notas:cot.notas, estado:"guardada", creadoEn:new Date().toISOString(), origenCotizacion:cot.numero };
    await db.setFacturas([...facturas, factura]);
    // Marcar cotización como aceptada
    await guardar({ ...cot, estado:"aceptada" });
    alert(`✓ Factura ${num} creada desde ${cot.numero}`);
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
