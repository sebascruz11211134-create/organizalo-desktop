import { getAutorSync } from "../utils/auth";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Printer, RotateCcw } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, genId, hoy } from "../utils/fmt";
import { reducirInventario } from "../utils/clienteUtils";

const MEDIOS = ["Efectivo","SINPE Móvil","Tarjeta","Transferencia"];

export default function POSScreen() {
  const [productos,  setProductos]  = useState([]);
  const [carrito,    setCarrito]    = useState([]);
  const [busq,       setBusq]       = useState("");
  const [medio,      setMedio]      = useState("Efectivo");
  const [efectivo,   setEfectivo]   = useState("");
  const [mensaje,    setMensaje]    = useState(null);
  const [settings,   setSettings]   = useState({});
  const inputRef = useRef(null);

  const cargar = useCallback(async () => {
    const [p, s] = await Promise.all([db.getProductos(), db.getSettings()]);
    setProductos(p || []);
    setSettings(s || {});
  }, []);

  useEffect(() => { cargar(); inputRef.current?.focus(); }, [cargar]);

  const filtrados = busq
    ? productos.filter(p =>
        p.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
        p.codigoBarras?.includes(busq) ||
        p.codigoInterno?.includes(busq)
      ).slice(0,12)
    : productos.slice(0, 24);

  const agregar = (prod) => {
    setCarrito(prev => {
      const idx = prev.findIndex(x => x.id === prod.id);
      if (idx >= 0) return prev.map((x,i) => i===idx ? {...x, cant: x.cant+1} : x);
      return [...prev, { ...prod, cant:1 }];
    });
    setBusq("");
    inputRef.current?.focus();
  };

  const cambiarCant = (id, delta) => {
    setCarrito(prev => prev
      .map(x => x.id===id ? {...x, cant: x.cant+delta} : x)
      .filter(x => x.cant > 0)
    );
  };

  const subtotal = carrito.reduce((s,x) => s + (x.precio||0)*x.cant, 0);
  const iva      = carrito.reduce((s,x) => s + (x.precio||0)*x.cant*((x.pctIVA||13)/100), 0);
  const total    = subtotal + iva;
  const cambio   = Math.max(0, (parseFloat(efectivo)||0) - total);

  const cobrar = async () => {
    if (carrito.length === 0) return;
    const facturas = await db.getFacturas();
    const num = `TIQ-${String(facturas.length+1).padStart(5,"0")}`;
    const factura = {
      id: genId(), numero: num, tipoDoc:"04", fecha: hoy(),
      condPago:"01", medioPago:"01", moneda:"CRC",
      cliente: { nombre:"Consumidor Final", cedula:"", email:"", tipo:"01" },
      lineas: carrito.map(x=>({ descripcion:x.nombre, cantidad:x.cant, precioUnit:x.precio||0, pctIVA:x.pctIVA||13, codigoIVA:"08", total:(x.precio||0)*x.cant*(1+(x.pctIVA||13)/100) })),
      subtotal, totalIVA:iva, total,
      medioPagoLabel: medio, estado:"aceptada",
      creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
    await db.setFacturas([...facturas, factura]);

    // Reducir inventario por los productos vendidos en el POS
    await reducirInventario(
      carrito.map((x) => ({ descripcion: x.nombre, productoId: x.id, cantidad: x.cant }))
    );

    setMensaje({ num, total, cambio, medio });
    setCarrito([]);
    setEfectivo("");
  };

  const imprimirTicket = (info) => {
    const s = settings;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${info.num}</title>
<style>body{font-family:monospace;font-size:12px;max-width:280px;margin:0 auto;padding:16px}
h1{font-size:14px;text-align:center;margin:0}p{margin:2px 0}hr{border-top:1px dashed #999}
.total{font-size:18px;font-weight:bold;text-align:right}.right{text-align:right}
@media print{body{padding:0}}</style></head>
<body>
<h1>${s.nombreNegocio||"Mi negocio"}</h1>
<p style="text-align:center">${s.cedula||""}</p>
<p style="text-align:center">${s.telefono||""}</p>
<hr><p><strong>Tiquete: ${info.num}</strong></p>
<p>${new Date().toLocaleString("es-CR")}</p><hr>
${carrito.map(x=>`<p>${x.nombre} x${x.cant}<span class="right" style="float:right">${fmtMoney((x.precio||0)*x.cant,"CRC")}</span></p>`).join("")}
<hr><p class="right">IVA: ${fmtMoney(iva,"CRC")}</p>
<p class="total">TOTAL: ${fmtMoney(info.total,"CRC")}</p>
${info.medio==="Efectivo"?`<p>Recibido: ${fmtMoney(parseFloat(efectivo)||0,"CRC")}</p><p>Cambio: ${fmtMoney(info.cambio,"CRC")}</p>`:""}
<hr><p style="text-align:center">¡Gracias por su compra!</p>
</body></html>`;
    const w = window.open("","_blank","width=360,height=500");
    w.document.write(html); w.document.close();
    setTimeout(()=>w.print(),400);
  };

  if (mensaje) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center text-4xl">✓</div>
        <div className="text-center">
          <p className="text-2xl font-black text-slate-900">{fmtMoney(mensaje.total,"CRC")}</p>
          <p className="text-slate-500 text-sm mt-1">{mensaje.num} · {mensaje.medio}</p>
          {mensaje.medio==="Efectivo" && mensaje.cambio>0 && (
            <p className="text-lg font-bold text-yellow-700 mt-2">Cambio: {fmtMoney(mensaje.cambio,"CRC")}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={()=>imprimirTicket(mensaje)} className="flex items-center gap-2 border border-slate-200 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <Printer size={15}/> Imprimir ticket
          </button>
          <button onClick={()=>setMensaje(null)} className="flex items-center gap-2 bg-yellow-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700">
            <RotateCcw size={15}/> Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0">
      {/* Panel izquierdo: productos */}
      <div className="flex-1 flex flex-col border-r border-slate-200">
        {/* Búsqueda */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input ref={inputRef} value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="Buscar producto, código de barras…"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {filtrados.map(p => (
              <button key={p.id} onClick={()=>agregar(p)}
                className="bg-white border border-slate-200 rounded-xl p-3 text-left hover:border-yellow-400 hover:shadow-sm transition-all active:scale-95">
                <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center mb-2">
                  <span className="text-yellow-700 font-bold text-sm">{(p.nombre||"?").charAt(0)}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{p.nombre}</p>
                <p className="text-xs font-bold text-yellow-700 mt-0.5">{fmtMoney(p.precio||0,"CRC")}</p>
                {p.stock != null && <p className="text-[10px] text-slate-400">Stock: {p.stock}</p>}
              </button>
            ))}
            {filtrados.length===0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-12 text-slate-400">
                <Search size={32} className="text-slate-200 mb-2"/>
                <p className="text-sm">No hay productos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel derecho: carrito */}
      <div className="w-80 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">Carrito</h2>
          {carrito.length>0 && (
            <button onClick={()=>setCarrito([])} className="text-xs text-red-400 hover:text-red-600">Limpiar</button>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {carrito.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
              <CreditCard size={32}/>
              <p className="text-xs">Seleccioná productos</p>
            </div>
          ) : carrito.map(x => (
            <div key={x.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{x.nombre}</p>
                <p className="text-xs text-yellow-700">{fmtMoney((x.precio||0)*x.cant,"CRC")}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={()=>cambiarCant(x.id,-1)} className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                  <Minus size={10}/>
                </button>
                <span className="w-6 text-center text-xs font-bold">{x.cant}</span>
                <button onClick={()=>cambiarCant(x.id,1)} className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                  <Plus size={10}/>
                </button>
              </div>
              <button onClick={()=>setCarrito(p=>p.filter(i=>i.id!==x.id))} className="text-red-400 hover:text-red-600">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>

        {/* Totales y cobro */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtMoney(subtotal,"CRC")}</span></div>
            <div className="flex justify-between text-slate-500"><span>IVA</span><span>{fmtMoney(iva,"CRC")}</span></div>
            <div className="flex justify-between font-black text-lg text-slate-900 border-t border-slate-200 pt-2">
              <span>Total</span><span className="text-yellow-700">{fmtMoney(total,"CRC")}</span>
            </div>
          </div>

          {/* Medio de pago */}
          <div className="flex gap-1">
            {MEDIOS.map(m=>(
              <button key={m} onClick={()=>setMedio(m)}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${medio===m?"bg-yellow-600 text-white border-yellow-600":"border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                {m}
              </button>
            ))}
          </div>

          {medio==="Efectivo" && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Monto recibido</label>
              <input type="number" value={efectivo} onChange={e=>setEfectivo(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm font-bold text-right focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              {parseFloat(efectivo)>0 && (
                <p className="text-xs text-right text-yellow-600 mt-1 font-semibold">Cambio: {fmtMoney(cambio,"CRC")}</p>
              )}
            </div>
          )}

          <button onClick={cobrar} disabled={carrito.length===0}
            className="w-full bg-yellow-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-yellow-700 disabled:opacity-40 transition-all active:scale-95">
            Cobrar {fmtMoney(total,"CRC")}
          </button>
        </div>
      </div>
    </div>
  );
}
