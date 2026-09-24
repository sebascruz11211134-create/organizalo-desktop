import { getAutorSync } from "../utils/auth";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Minus, Trash2, ShoppingBasket, Printer, RotateCcw, Check, ScanBarcode } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, genId, hoy } from "../utils/fmt";
import { reducirInventario } from "../utils/clienteUtils";
import EscanerCodigo from "../components/EscanerCodigo";

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
  const [escaner, setEscaner] = useState(false);

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
      <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
        <div className="w-24 h-24 rounded-full bg-monki-y flex items-center justify-center shadow-[6px_6px_0_#111] animate-flotar">
          <Check size={44} strokeWidth={3} className="text-monki-k" />
        </div>
        <div className="text-center animate-entrar">
          <p className="monki-tag text-monki-k/55">Venta cobrada</p>
          <p className="text-[40px] font-black tracking-[-0.04em] text-monki-k leading-tight">{fmtMoney(mensaje.total,"CRC")}</p>
          <p className="text-monki-k/55 text-sm font-mono">{mensaje.num} · {mensaje.medio}</p>
          {mensaje.medio==="Efectivo" && mensaje.cambio>0 && (
            <p className="inline-block mt-3 bg-monki-k text-monki-y rounded-full px-4 py-1.5 text-lg font-black">Cambio {fmtMoney(mensaje.cambio,"CRC")}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Boton variante="secundario" icono={Printer} onClick={()=>imprimirTicket(mensaje)}>Imprimir tiquete</Boton>
          <Boton icono={RotateCcw} onClick={()=>setMensaje(null)}>Nueva venta</Boton>
        </div>
      </div>
    );
  }

  const unidades = carrito.reduce((t,x)=>t+x.cant,0);

  // Escaneo: si el código coincide con un producto se agrega al carrito; si no, queda en la búsqueda
  const alEscanear = (codigo) => {
    setEscaner(false);
    const prod = productos.find(p => p.codigoBarras === codigo || p.codigoInterno === codigo);
    if (prod) agregar(prod); else setBusq(codigo);
  };

  return (
    <Modulo seccion="Ventas" titulo="Punto de venta" descripcion="Tocá un producto para agregarlo. Cobrás y se emite el tiquete.">
      <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
        <div className="flex-1 min-w-0 flex flex-col min-h-[340px] lg:min-h-0">
          <label className="group flex items-center gap-2.5 bg-white rounded-full pl-4 pr-3 py-2.5 border-2 border-black/10 focus-within:border-monki-k transition-colors mb-3">
            <Search size={16} className="text-monki-k/40 group-focus-within:text-monki-k"/>
            <input ref={inputRef} value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="Buscar producto o código de barras…"
              className="ui-sin-foco flex-1 bg-transparent outline-none border-0 text-sm text-monki-k placeholder:text-monki-k/35" />
            <button type="button" onClick={() => setEscaner(true)} title="Escanear código de barras"
              className="shrink-0 w-8 h-8 -my-1 rounded-full bg-monki-k text-monki-y flex items-center justify-center hover:shadow-[3px_3px_0_#FFD600] transition-all">
              <ScanBarcode size={15}/>
            </button>
          </label>
          {escaner && <EscanerCodigo titulo="Escanear producto" onCerrar={() => setEscaner(false)} onDetectado={alEscanear}/>}
          <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
            {filtrados.length===0 ? (
              <Tarjeta className="h-full flex items-center justify-center"><Vacio icono={Search} titulo="No hay productos" texto="Probá con otra búsqueda o agregá productos en Inventario."/></Tarjeta>
            ) : (
              <div className="ui-rejilla grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtrados.map((p,i) => {
                  const enCarrito = carrito.find(x=>x.id===p.id);
                  return (
                    <button key={p.id} type="button" onClick={()=>agregar(p)} style={{ animationDelay: `${Math.min(i,12)*25}ms` }}
                      className={`ui-boton animate-entrar relative bg-white border-2 rounded-[18px] p-3.5 text-left transition-all duration-300 ease-monki active:scale-95 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111] ${enCarrito ? "border-monki-k" : "border-black/10 hover:border-monki-k"}`}>
                      {enCarrito && <span className="absolute top-2.5 right-2.5 min-w-[24px] h-6 px-1.5 rounded-full bg-monki-k text-monki-y text-xs font-black flex items-center justify-center">{enCarrito.cant}</span>}
                      <span className="w-9 h-9 rounded-full bg-monki-y flex items-center justify-center mb-2.5 text-monki-k font-black">{(p.nombre||"?").charAt(0).toUpperCase()}</span>
                      <p className="text-sm font-bold text-monki-k leading-tight line-clamp-2">{p.nombre}</p>
                      <p className="text-[15px] font-black text-monki-k mt-1">{fmtMoney(p.precio||0,"CRC")}</p>
                      {p.stock != null && <p className="font-mono text-[10px] text-monki-k/45">Stock {p.stock}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[21rem] shrink-0 flex flex-col bg-white rounded-[18px] border-2 border-monki-k overflow-hidden shadow-[6px_6px_0_#111]">
          <div className="px-4 py-3 flex items-center justify-between border-b-2 border-black/10">
            <h2 className="text-[16px] font-black tracking-[-0.02em] text-monki-k">Carrito <span className="font-mono text-xs text-monki-k/45 ml-1">{unidades} art.</span></h2>
            {carrito.length>0 && <Boton variante="fantasma" tamano="sm" icono={Trash2} onClick={()=>setCarrito([])}>Limpiar</Boton>}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2 min-h-[140px]">
            {carrito.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-monki-k/30 gap-2 py-6">
                <ShoppingBasket size={30}/>
                <p className="text-xs font-semibold">Tocá productos para agregarlos</p>
              </div>
            ) : carrito.map(x => (
              <div key={x.id} className="animate-desplegar flex items-center gap-2 bg-monki-cream rounded-2xl pl-3 pr-1.5 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-monki-k truncate">{x.nombre}</p>
                  <p className="text-xs text-monki-k/55">{fmtMoney((x.precio||0)*x.cant,"CRC")}</p>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-full p-0.5">
                  <button type="button" onClick={()=>cambiarCant(x.id,-1)} className="ui-boton w-7 h-7 rounded-full flex items-center justify-center hover:bg-monki-k hover:text-monki-y transition-colors"><Minus size={12}/></button>
                  <span className="w-6 text-center text-sm font-black">{x.cant}</span>
                  <button type="button" onClick={()=>cambiarCant(x.id,1)} className="ui-boton w-7 h-7 rounded-full flex items-center justify-center hover:bg-monki-k hover:text-monki-y transition-colors"><Plus size={12}/></button>
                </div>
                <BotonIcono icono={Trash2} titulo="Quitar" tono="peligro" onClick={()=>setCarrito(p=>p.filter(i=>i.id!==x.id))}/>
              </div>
            ))}
          </div>

          <div className="bg-monki-k text-white p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{fmtMoney(subtotal,"CRC")}</span></div>
              <div className="flex justify-between text-white/60"><span>IVA</span><span>{fmtMoney(iva,"CRC")}</span></div>
              <div className="flex justify-between items-end pt-2 border-t border-white/15">
                <span className="monki-tag text-white/55">Total</span><span className="text-[26px] font-black tracking-[-0.03em] text-monki-y leading-none">{fmtMoney(total,"CRC")}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MEDIOS.map(m=>(
                <button key={m} type="button" onClick={()=>setMedio(m)}
                  className={`ui-boton py-1.5 text-[11px] font-bold rounded-full transition-all duration-200 ${medio===m?"bg-monki-y text-monki-k":"bg-white/10 text-white/70 hover:bg-white/20"}`}>{m}</button>
              ))}
            </div>
            {medio==="Efectivo" && (
              <div>
                <p className="monki-tag text-white/55 mb-1">Monto recibido</p>
                <input type="number" value={efectivo} onChange={e=>setEfectivo(e.target.value)} placeholder="0"
                  className="w-full bg-white/10 border-2 border-white/15 rounded-xl px-3 py-2 text-base font-black text-right text-white placeholder:text-white/30 focus:border-monki-y" />
                {parseFloat(efectivo)>0 && <p className="text-sm text-right text-monki-y mt-1 font-bold">Cambio {fmtMoney(cambio,"CRC")}</p>}
              </div>
            )}
            <button type="button" onClick={cobrar} disabled={carrito.length===0}
              className="ui-boton w-full bg-monki-y text-monki-k py-3.5 rounded-full font-black text-[15px] transition-all duration-300 ease-monki hover:-translate-y-0.5 hover:shadow-[4px_4px_0_rgba(255,255,255,.9)] active:scale-95 disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:shadow-none">
              Cobrar {fmtMoney(total,"CRC")}
            </button>
          </div>
        </div>
      </div>
    </Modulo>
  );
}
