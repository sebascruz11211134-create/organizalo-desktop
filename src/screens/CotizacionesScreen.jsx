import { getAutorSync } from "../utils/auth";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FileText, Send, Copy, X, Check, Edit2, Clock, CheckCircle2 } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Selector, Tabla, Vacio, Estado, Indicadores, Indicador, Tarjeta, Campo, Entrada, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";

const IVA_PCT = { "01":0,"02":1,"03":2,"04":4,"05":0,"06":4,"07":8,"08":13 };

const ESTADOS = [
  { value:"borrador",  label:"Borrador",   tono:"neutro" },
  { value:"enviada",   label:"Enviada",    tono:"oscuro" },
  { value:"aceptada",  label:"Aceptada",   tono:"exito" },
  { value:"rechazada", label:"Rechazada",  tono:"peligro" },
  { value:"vencida",   label:"Vencida",    tono:"alerta" },
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
  return <Estado tono={e.tono}>{e.label}</Estado>;
};

// ── Vista lista ───────────────────────────────────────────────────────────────
function ListView({ cotizaciones, onNueva, onEditar, onConvertir, onDuplicar, onEliminar, busq, setBusq, dialogo }) {
  const [selected, setSelected] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todas");

  const filtradas = cotizaciones.filter(c =>
    (c.numero?.includes(busq) || c.cliente?.nombre?.toLowerCase().includes(busq.toLowerCase())) &&
    (filtroEstado === "todas" || (c.estado || "borrador") === filtroEstado)
  );
  const sel = filtradas.find(c => c.id === selected);
  const totalDe = c => c.total || (c.lineas||[]).map(calcLinea).reduce((s,l)=>s+l.total,0);
  const abiertas = cotizaciones.filter(c => ["borrador","enviada"].includes(c.estado || "borrador"));
  const aceptadas = cotizaciones.filter(c => c.estado === "aceptada");

  const columnas = [
    { key:"numero", titulo:"N.°", render:c => <span className="font-mono text-xs font-bold">{c.numero}</span> },
    { key:"cliente", titulo:"Cliente", render:c => <b className="text-monki-k">{c.cliente?.nombre || "—"}</b> },
    { key:"fecha", titulo:"Fecha", render:c => <div><div>{fmtDate(c.fecha)}</div>{c.creadoPor && <div className="text-[10px] text-monki-k/45">Por {c.creadoPor}</div>}</div> },
    { key:"validez", titulo:"Válida por", render:c => <span className="text-monki-k/60">{c.validez ? `${c.validez} días` : "—"}</span> },
    { key:"total", titulo:"Total", alinear:"right", render:c => <b>{fmtMoney(totalDe(c),"CRC")}</b> },
    { key:"estado", titulo:"Estado", render:c => BADGE(c.estado) },
    { key:"acciones", titulo:"", alinear:"right", render:c => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Send} titulo="Convertir en factura" onClick={()=>onConvertir(c)} />
        <BotonIcono icono={Copy} titulo="Duplicar" onClick={()=>onDuplicar(c)} />
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>onEditar(c)} />
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>onEliminar(c.id)} />
      </div>) },
  ];

  return (
    <Modulo
      seccion="Ventas"
      titulo="Cotizaciones"
      descripcion="Proformas para tus clientes. Cuando te dicen que sí, se convierten en factura con un clic."
      acciones={<Boton icono={Plus} onClick={onNueva}>Nueva cotización</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Cotizaciones" valor={cotizaciones.length} detalle="En total" icono={FileText} delay={40} onClick={()=>setFiltroEstado("todas")} />
          <Indicador etiqueta="Abiertas" valor={abiertas.length} detalle="Borrador o enviada" icono={Clock} delay={90} onClick={()=>setFiltroEstado("enviada")} />
          <Indicador etiqueta="Aceptadas" valor={aceptadas.length} detalle="Ya facturadas" icono={CheckCircle2} delay={140} onClick={()=>setFiltroEstado("aceptada")} />
          <Indicador etiqueta="Monto abierto" valor={fmtMoney(abiertas.reduce((t,c)=>t+totalDe(c),0),"CRC")} detalle="Por cerrar" destacado delay={190} />
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${filtradas.length} de ${cotizaciones.length}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por número o cliente…" />
        <Selector valor={filtroEstado} onCambio={setFiltroEstado} opciones={[{value:"todas",label:"Todos los estados"}, ...ESTADOS]} />
      </BarraFiltros>
      <Tabla columnas={columnas} filas={filtradas} seleccionada={selected}
        onFila={c=>setSelected(selected===c.id?null:c.id)}
        vacio={<Vacio icono={FileText} titulo={cotizaciones.length ? "Sin resultados" : "Todavía no hay cotizaciones"}
          texto={cotizaciones.length ? "Probá con otra búsqueda o estado." : "Creá una proforma y enviásela a tu cliente."}
          accion={!cotizaciones.length && <Boton icono={Plus} onClick={onNueva}>Nueva cotización</Boton>} />} />
      {sel && (
        <div className="animate-desplegar mt-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.numero}</b><span className="text-white/60">{sel.cliente?.nombre}</span>
          <div className="flex-1" />
          <Boton variante="amarillo" tamano="sm" icono={Send} onClick={()=>onConvertir(sel)}>Facturar</Boton>
          <Boton variante="secundario" tamano="sm" icono={Edit2} onClick={()=>onEditar(sel)}>Editar</Boton>
        </div>
      )}
      {dialogo}
    </Modulo>
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
    onGuardar({ id: cotizacion?.id || genId(), numero:num, cliente, estado, fecha, validez, notas, lineas:lineasCalc, subtotal, totalIVA, total, creadoEn: cotizacion?.creadoEn || new Date().toISOString(), creadoPor: cotizacion?.creadoPor || getAutorSync() });
  };

  const CELDA = "w-full border-0 bg-transparent text-sm outline-none py-2 px-2 rounded-lg focus:bg-monki-y/25 transition-colors";

  return (
    <Modulo
      seccion="Cotizaciones"
      titulo={esNueva ? "Nueva cotización" : cotizacion.numero}
      descripcion={esNueva ? "Llená el cliente y las líneas. Se guarda como borrador." : `Cliente: ${cliente.nombre || "—"}`}
      acciones={<>
        <Selector valor={estado} onCambio={setEstado} opciones={ESTADOS} />
        <Boton variante="fantasma" icono={X} onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={guardar}>Guardar</Boton>
      </>}
    >
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[15rem_1fr_15rem] gap-3">
        <Tarjeta titulo="Cliente" className="overflow-y-auto" cuerpo="px-4 pb-4 pt-1 space-y-3">
          <div className="relative">
            <Campo etiqueta="Nombre">
              <Entrada value={busqCliente} autoComplete="off"
                onChange={e=>{setBusqCliente(e.target.value);setCliente(p=>({...p,nombre:e.target.value}));setShowClientes(true);}}
                onFocus={()=>setShowClientes(true)} onBlur={()=>setTimeout(()=>setShowClientes(false),150)}
                placeholder="Buscar cliente…" />
            </Campo>
            {showClientes && filtrados.length>0 && (
              <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-44 overflow-auto">
                {filtrados.map(c=>(
                  <button key={c.id} type="button" onMouseDown={()=>{setCliente({nombre:c.nombre,cedula:c.cedula||"",email:c.email||"",tipo:c.tipoCedula||"01"});setBusqCliente(c.nombre);setShowClientes(false);}}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                    {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                    <span className="font-semibold">{c.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Campo etiqueta="Cédula"><Entrada value={cliente.cedula} onChange={e=>setCliente(p=>({...p,cedula:e.target.value}))} placeholder="Número…" /></Campo>
          <Campo etiqueta="Correo"><Entrada value={cliente.email} onChange={e=>setCliente(p=>({...p,email:e.target.value}))} placeholder="cliente@…" /></Campo>
          <div className="border-t border-black/10" />
          <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e=>setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Válida por (días)"><Entrada type="number" value={validez} onChange={e=>setValidez(e.target.value)} min="1" /></Campo>
        </Tarjeta>

        <Tarjeta titulo="Líneas" acciones={<Boton variante="secundario" tamano="sm" icono={Plus} onClick={()=>setLineas(p=>[...p,lineaVacia()])}>Agregar línea</Boton>}
          className="flex flex-col min-h-[280px] lg:min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="monki-tag text-monki-k/50 border-b-2 border-black/10">
                  <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
                  <th className="text-center px-2 py-2.5 font-medium w-16">Cant.</th>
                  <th className="text-right px-3 py-2.5 font-medium w-28">P. unit.</th>
                  <th className="text-center px-2 py-2.5 font-medium w-16">% Desc</th>
                  <th className="text-center px-2 py-2.5 font-medium w-20">IVA</th>
                  <th className="text-right px-4 py-2.5 font-medium w-28">Total</th>
                  <th className="w-10"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {lineas.map((l,i)=>(
                  <tr key={l.id} className="group hover:bg-monki-cream/60 transition-colors">
                    <td className="px-2"><input value={l.descripcion} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,descripcion:e.target.value}:x))} placeholder="Descripción…" className={CELDA+" ui-sin-foco"}/></td>
                    <td className="px-1"><input value={l.cantidad} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))} type="number" min="0" className={CELDA+" ui-sin-foco text-center"}/></td>
                    <td className="px-1"><input value={l.precioUnit} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,precioUnit:e.target.value}:x))} type="number" min="0" placeholder="0" className={CELDA+" ui-sin-foco text-right"}/></td>
                    <td className="px-1"><input value={l.pctDesc} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,pctDesc:e.target.value}:x))} type="number" min="0" max="100" placeholder="0" className={CELDA+" ui-sin-foco text-center"}/></td>
                    <td className="px-1">
                      <select value={l.codigoIVA} onChange={e=>setLineas(p=>p.map((x,j)=>j===i?{...x,codigoIVA:e.target.value}:x))} className={CELDA+" text-xs text-center cursor-pointer"}>
                        <option value="01">0%</option><option value="07">8%</option><option value="08">13%</option>
                      </select>
                    </td>
                    <td className="text-right font-bold px-4">{fmtMoney(calcLinea(l).total,"CRC")}</td>
                    <td className="pr-2"><span className="opacity-0 group-hover:opacity-100 transition-opacity"><BotonIcono icono={Trash2} titulo="Quitar línea" tono="peligro" onClick={()=>setLineas(p=>p.filter((_,j)=>j!==i))}/></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="animate-entrar bg-monki-k text-white rounded-[18px] p-5">
            <p className="monki-tag text-monki-y mb-3">Resumen</p>
            <div className="flex justify-between text-sm text-white/70 py-1"><span>Subtotal</span><span>{fmtMoney(subtotal,"CRC")}</span></div>
            <div className="flex justify-between text-sm text-white/70 py-1"><span>IVA</span><span>{fmtMoney(totalIVA,"CRC")}</span></div>
            <div className="border-t border-white/15 mt-2 pt-3">
              <p className="monki-tag text-white/50">Total</p>
              <p className="text-[26px] font-black tracking-[-0.03em] text-monki-y leading-tight">{fmtMoney(total,"CRC")}</p>
            </div>
          </div>
          <Tarjeta titulo="Notas y condiciones" className="flex-1" cuerpo="px-4 pb-4 pt-1">
            <AreaTexto value={notas} onChange={e=>setNotas(e.target.value)} rows={6} placeholder="Condiciones de pago, validez…" />
          </Tarjeta>
        </div>
      </div>
    </Modulo>
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

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar cotización", "¿Eliminar esta cotización? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
    const all = await db.getCotizaciones();
    await db.setCotizaciones(all.filter(x=>x.id!==id));
    cargar();
  };

  const duplicar = async (cot) => {
    const nueva = { ...cot, id:genId(), numero:`COT-${Date.now().toString().slice(-5)}`, estado:"borrador", creadoEn:new Date().toISOString(), creadoPor:getAutorSync() };
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
      creadoEn: new Date().toISOString(), creadoPor: getAutorSync(), origenCotizacion: cot.numero,
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
    onConvertir={convertirAFactura} onDuplicar={duplicar} onEliminar={eliminar} dialogo={dialogo} />;
}
