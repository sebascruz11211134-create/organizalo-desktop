import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Check, Wrench, Receipt, Edit2, Stethoscope, PackageCheck } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import { useNavigate } from "react-router-dom";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { reducirInventario } from "../utils/clienteUtils";

const ESTADOS = {
  recibido:   { label:"Recibido",    tono:"neutro" },
  diagnostico:{ label:"Diagnóstico", tono:"oscuro" },
  reparacion: { label:"Reparación",  tono:"alerta" },
  listo:      { label:"Listo",       tono:"exito" },
  entregado:  { label:"Entregado",   tono:"neutro" },
};

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.recibido;
  return <Estado tono={e.tono}>{e.label}</Estado>;
}

function FormOrden({ orden, contactos, productos, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    cliente:      orden?.cliente || "",
    telefono:     orden?.telefono || "",
    equipo:       orden?.equipo || "",
    problema:     orden?.problema || "",
    diagnostico:  orden?.diagnostico || "",
    tecnico:      orden?.tecnico || "",
    estado:       orden?.estado || "recibido",
    fecha:        orden?.fecha || hoy(),
    fechaEntrega: orden?.fechaEntrega || "",
    manoObra:     orden?.manoObra || "",
    repuestos:    orden?.repuestos || "",
    total:        orden?.total || "",
    notas:        orden?.notas || "",
    busq:         orden?.cliente || "",
  });
  const u = k => e => setF(p=>({...p,[k]:e.target.value}));
  const [showC, setShowC] = useState(false);
  const [materiales, setMateriales] = useState(orden?.materiales || []);
  const [busqMat, setBusqMat] = useState("");
  const [showMat, setShowMat] = useState(false);

  const filtrados = contactos.filter(c=>
    c.nombre?.toLowerCase().includes(f.busq.toLowerCase()) ||
    c.cedula?.includes(f.busq) ||
    c.codigoCliente?.toUpperCase().includes(f.busq.toUpperCase())
  ).slice(0,5);

  const prodsFilt = (productos||[]).filter(p =>
    p.nombre?.toLowerCase().includes(busqMat.toLowerCase())
  ).slice(0, 6);

  const agregarMaterial = (p) => {
    const ya = materiales.find(m => m.productoId === p.id);
    if (ya) setMateriales(materiales.map(m => m.productoId === p.id ? { ...m, cantidad: (parseFloat(m.cantidad)||0)+1 } : m));
    else setMateriales([...materiales, { productoId: p.id, descripcion: p.nombre, cantidad: 1 }]);
    setBusqMat(""); setShowMat(false);
  };

  const totalSugerido = (parseFloat(f.manoObra)||0)+(parseFloat(f.repuestos)||0);
  return (
    <Modal titulo={orden ? `OT-${orden.numero}` : "Nueva orden de trabajo"} subtitulo="Equipo, diagnóstico y costo de la reparación" onCerrar={onCancelar}
      pie={<><Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={()=>onGuardar({ id:orden?.id||genId(), numero:orden?.numero||Date.now().toString().slice(-5), ...f, manoObra:parseFloat(f.manoObra)||0, repuestos:parseFloat(f.repuestos)||0, total:parseFloat(f.total)||(parseFloat(f.manoObra)||0)+(parseFloat(f.repuestos)||0), materiales, creadoEn:orden?.creadoEn||new Date().toISOString() })}>Guardar orden</Boton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Campo etiqueta="Cliente">
              <Entrada value={f.busq} onChange={e=>{setF(p=>({...p,busq:e.target.value,cliente:e.target.value}));setShowC(true);}}
                onFocus={()=>setShowC(true)} onBlur={()=>setTimeout(()=>setShowC(false),150)} placeholder="Nombre o CLI-XXXX…"/>
            </Campo>
            {showC && filtrados.length>0 && (
              <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-36 overflow-auto">
                {filtrados.map(c=>(
                  <button key={c.id} type="button" onMouseDown={()=>setF(p=>({...p,cliente:c.nombre,busq:c.nombre,telefono:c.telefono||""}))}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                    {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                    <span className="font-semibold">{c.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Campo etiqueta="Teléfono"><Entrada value={f.telefono} onChange={u("telefono")} placeholder="8888-8888"/></Campo>
        </div>
        <Campo etiqueta="Equipo, vehículo o artículo"><Entrada value={f.equipo} onChange={u("equipo")} placeholder="Marca, modelo, serie…"/></Campo>
        <Campo etiqueta="Problema reportado"><AreaTexto value={f.problema} onChange={u("problema")} rows={2} placeholder="Qué falla reporta el cliente…"/></Campo>
        <Campo etiqueta="Diagnóstico técnico"><AreaTexto value={f.diagnostico} onChange={u("diagnostico")} rows={2} placeholder="Diagnóstico y trabajo a realizar…"/></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Técnico"><Entrada value={f.tecnico} onChange={u("tecnico")} placeholder="Nombre…"/></Campo>
          <Campo etiqueta="Estado"><Seleccion value={f.estado} onChange={u("estado")} opciones={Object.entries(ESTADOS).map(([k,v])=>({value:k,label:v.label}))}/></Campo>
          <Campo etiqueta="Entrega estimada"><Entrada type="date" value={f.fechaEntrega} onChange={u("fechaEntrega")}/></Campo>
        </div>
        <div className="grid grid-cols-3 gap-3 bg-monki-cream rounded-2xl p-3">
          <Campo etiqueta="Mano de obra (₡)"><Entrada type="number" value={f.manoObra} onChange={u("manoObra")} min="0" placeholder="0" className="text-right"/></Campo>
          <Campo etiqueta="Repuestos (₡)"><Entrada type="number" value={f.repuestos} onChange={u("repuestos")} min="0" placeholder="0" className="text-right"/></Campo>
          <Campo etiqueta="Total (₡)"><Entrada type="number" value={f.total||totalSugerido} onChange={u("total")} min="0" className="text-right font-black !border-monki-k"/></Campo>
        </div>
        <div>
          <div className="relative">
            <Campo etiqueta="Materiales del inventario" ayuda="Se descuentan del stock cuando la orden se entrega.">
              <Entrada value={busqMat} onChange={e=>{setBusqMat(e.target.value);setShowMat(true);}}
                onFocus={()=>setShowMat(true)} onBlur={()=>setTimeout(()=>setShowMat(false),150)} placeholder="Buscar en el catálogo de productos…"/>
            </Campo>
            {showMat && prodsFilt.length > 0 && (
              <div className="animate-desplegar absolute top-[72px] left-0 w-full bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-36 overflow-auto">
                {prodsFilt.map(p=>(
                  <button key={p.id} type="button" onMouseDown={()=>agregarMaterial(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0 flex justify-between">
                    <span className="font-semibold">{p.nombre}</span><span className="font-mono text-[11px] text-monki-k/50">Stock {p.stock ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {materiales.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {materiales.map((m,i)=>(
                <div key={i} className="animate-desplegar flex items-center gap-2 bg-monki-cream rounded-xl pl-3 pr-1 py-1">
                  <span className="flex-1 text-sm font-semibold">{m.descripcion}</span>
                  <input type="number" min="0.01" step="any" value={m.cantidad}
                    onChange={e=>setMateriales(materiales.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}
                    className="w-20 bg-white border-2 border-black/10 rounded-lg px-2 py-1 text-sm text-right"/>
                  <BotonIcono icono={X} titulo="Quitar" tono="peligro" onClick={()=>setMateriales(materiales.filter((_,j)=>j!==i))}/>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function OrdenesTrabajoScreen() {
  const navigate    = useNavigate();
  const [ordenes,   setOrdenes]   = useState([]);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");

  const cargar = useCallback(async () => {
    const [o,c,p] = await Promise.all([db.getOrdenes(), db.getContactos(), db.getProductos()]);
    setOrdenes(o||[]); setContactos(c||[]); setProductos(p||[]);
  },[]);
  useEffect(()=>{cargar();},[cargar]);

  const guardar = async (o) => {
    const all = await db.getOrdenes();
    const idx = all.findIndex(x=>x.id===o.id);
    const anterior = idx >= 0 ? all[idx] : null;
    await db.setOrdenes(idx>=0?all.map((x,i)=>i===idx?o:x):[...all,o]);

    // Si cambia a "entregado" → reducir inventario de materiales
    if (o.estado === "entregado" && anterior?.estado !== "entregado" && o.materiales?.length) {
      await reducirInventario(o.materiales);
    }

    cargar(); setForm(false); setEditando(null);
  };

  const facturarOT = (o) => {
    // Guarda la OT en sessionStorage para pre-llenar FacturacionScreen
    sessionStorage.setItem("ot_prefill", JSON.stringify({
      cliente: o.cliente,
      notas: `OT-${o.numero} — ${o.equipo || ""} — ${o.diagnostico || ""}`,
      lineas: [
        o.manoObra > 0 && { descripcion: "Mano de obra", cantidad: "1", precioUnit: String(o.manoObra), codigoIVA: "08", pctDesc: "0" },
        o.repuestos > 0 && { descripcion: "Repuestos y materiales", cantidad: "1", precioUnit: String(o.repuestos), codigoIVA: "08", pctDesc: "0" },
      ].filter(Boolean),
    }));
    navigate("/facturacion");
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar orden", "¿Eliminar esta orden de trabajo? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
    const all = await db.getOrdenes();
    await db.setOrdenes(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtradas = ordenes.filter(o =>
    (filtroEst==="todos"||o.estado===filtroEst) &&
    (o.cliente?.toLowerCase().includes(busq.toLowerCase())||o.equipo?.toLowerCase().includes(busq.toLowerCase()))
  );

  const nueva = () => { setEditando(null); setForm(true); };
  const cuenta = e => ordenes.filter(o => o.estado === e).length;
  const columnas = [
    { key: "numero", titulo: "Orden", render: o => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0"><Wrench size={14} className="text-monki-k"/></span>
        <span className="font-mono text-xs font-bold">OT-{o.numero}</span>
      </div>) },
    { key: "cliente", titulo: "Cliente", render: o => <b className="text-monki-k">{o.cliente || "—"}</b> },
    { key: "equipo", titulo: "Equipo y problema", render: o => <div className="max-w-[260px]"><p className="font-semibold truncate">{o.equipo || "—"}</p><p className="text-xs text-monki-k/50 truncate">{o.problema}</p></div> },
    { key: "tecnico", titulo: "Técnico", render: o => <span className="text-monki-k/60">{o.tecnico || "—"}</span> },
    { key: "estado", titulo: "Estado", render: o => <Badge estado={o.estado}/> },
    { key: "fecha", titulo: "Fecha", render: o => fmtDate(o.fecha) },
    { key: "total", titulo: "Total", alinear: "right", render: o => <b>{fmtMoney(o.total||0,"CRC")}</b> },
    { key: "acciones", titulo: "", alinear: "right", render: o => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Receipt} titulo="Facturar" onClick={()=>facturarOT(o)}/>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>{setEditando(o);setForm(true);}}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(o.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="Operaciones"
      titulo="Órdenes de trabajo"
      descripcion="Reparaciones y servicios: del ingreso del equipo hasta la entrega y la factura."
      acciones={<Boton icono={Plus} onClick={nueva}>Nueva orden</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="En diagnóstico" valor={cuenta("diagnostico")+cuenta("recibido")} detalle="Recibidas o revisando" icono={Stethoscope} delay={40} onClick={()=>setFiltroEst("diagnostico")}/>
          <Indicador etiqueta="En reparación" valor={cuenta("reparacion")} icono={Wrench} destacado delay={90} onClick={()=>setFiltroEst("reparacion")}/>
          <Indicador etiqueta="Listas" valor={cuenta("listo")} detalle="Avisá al cliente" icono={Check} delay={140} onClick={()=>setFiltroEst("listo")}/>
          <Indicador etiqueta="Entregadas" valor={cuenta("entregado")} icono={PackageCheck} delay={190} onClick={()=>setFiltroEst("entregado")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtroEst, onCambiar: setFiltroEst, items: [{ key:"todos", label:"Todas", cuenta: ordenes.length }, ...Object.entries(ESTADOS).map(([key,v])=>({ key, label: v.label }))] }}
    >
      <BarraFiltros resumen={`${filtradas.length} órdenes`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por cliente o equipo…"/>
      </BarraFiltros>
      <Tabla columnas={columnas} filas={filtradas} onFila={o=>{setEditando(o);setForm(true);}}
        vacio={<Vacio icono={Wrench} titulo={ordenes.length ? "Sin resultados" : "Todavía no hay órdenes de trabajo"}
          texto={ordenes.length ? "Probá con otra búsqueda o estado." : "Registrá el primer equipo que te dejan para reparar."}
          accion={!ordenes.length && <Boton icono={Plus} onClick={nueva}>Nueva orden</Boton>}/>}/>
      {form && <FormOrden orden={editando} contactos={contactos} productos={productos} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}}/>}
      {dialogo}
    </Modulo>
  );
}
