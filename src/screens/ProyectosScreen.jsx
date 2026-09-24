/**
 * ProyectosScreen — Centro de costos / Proyectos
 * Cada proyecto puede tener ingresos y gastos asignados (desde facturas y gastos).
 * Muestra un P&L simple por proyecto.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Layers, ChevronDown, ChevronRight, Link2, TrendingUp, TrendingDown } from "lucide-react";
import { Modulo, Boton, BotonIcono, Pestanas, Tarjeta, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

const ESTADOS = ["Activo","Completado","Pausado","Cancelado"];

// ── Modal proyecto ────────────────────────────────────────────────────────────
function ProyectoModal({ proyecto, onClose, onSave }) {
  const esNuevo = !proyecto?.id;
  const [form, setForm] = useState(proyecto || {
    nombre:"", codigo:"", descripcion:"", responsable:"",
    fechaInicio: hoy(), fechaFin:"", presupuesto:"", estado:"Activo",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    const todos = await db.getProyectos();
    const item  = { ...form, presupuesto: parseFloat(form.presupuesto)||0 };
    if (esNuevo) {
      item.id = genId(); item.creadoEn = new Date().toISOString();
      await db.setProyectos([...todos, item]);
    } else {
      await db.setProyectos(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  return (
    <Modal titulo={esNuevo?"Nuevo proyecto":"Editar proyecto"} subtitulo="Centro de costo para medir su rentabilidad" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar proyecto</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Nombre del proyecto *"><Entrada value={form.nombre||""} onChange={e=>u("nombre",e.target.value)}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Código"><Entrada value={form.codigo||""} onChange={e=>u("codigo",e.target.value)} className="font-mono"/></Campo>
          <Campo etiqueta="Responsable"><Entrada value={form.responsable||""} onChange={e=>u("responsable",e.target.value)}/></Campo>
          <Campo etiqueta="Fecha de inicio"><Entrada type="date" value={form.fechaInicio||""} onChange={e=>u("fechaInicio",e.target.value)}/></Campo>
          <Campo etiqueta="Fecha de fin"><Entrada type="date" value={form.fechaFin||""} onChange={e=>u("fechaFin",e.target.value)}/></Campo>
          <Campo etiqueta="Presupuesto (₡)"><Entrada type="number" min="0" value={form.presupuesto||""} onChange={e=>u("presupuesto",e.target.value)}/></Campo>
          <Campo etiqueta="Estado"><Seleccion value={form.estado||"Activo"} onChange={e=>u("estado",e.target.value)} opciones={ESTADOS}/></Campo>
        </div>
        <Campo etiqueta="Descripción"><AreaTexto value={form.descripcion||""} onChange={e=>u("descripcion",e.target.value)} rows={2}/></Campo>
      </div>
    </Modal>
  );
}

// ── Modal asignar transacción ─────────────────────────────────────────────────
function AsignarModal({ proyecto, facturas, gastos, onClose, onSave }) {
  const [tab,        setTab]        = useState("facturas");
  const [seleccion,  setSeleccion]  = useState([]);

  const toggle = (id) => setSeleccion(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const guardar = async () => {
    const todos = await db.getProyectos();
    const asig  = proyecto.asignaciones || {};
    const nuevas = { ...asig };
    seleccion.forEach(id=>{ nuevas[id] = tab; });
    await db.setProyectos(todos.map(x=>x.id===proyecto.id?{...x,asignaciones:nuevas}:x));
    onSave(); onClose();
  };

  const lista = tab==="facturas" ? facturas : gastos;

  return (
    <Modal titulo="Asignar movimientos" subtitulo={`Al proyecto “${proyecto.nombre}”`} onCerrar={onClose}
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton icono={Link2} onClick={guardar} disabled={!seleccion.length}>Asignar {seleccion.length || ""}</Boton></>}>
      <Pestanas activa={tab} onCambiar={t=>{setTab(t);setSeleccion([]);}} className="mb-3"
        items={[{key:"facturas",label:"Facturas",cuenta:facturas.length},{key:"gastos",label:"Gastos",cuenta:gastos.length}]}/>
      <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
        {lista.map(item=>{
          const yaAsig = (proyecto.asignaciones||{})[item.id];
          const sel    = seleccion.includes(item.id);
          return (
            <label key={item.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 cursor-pointer transition-all duration-200
              ${yaAsig?"border-transparent bg-monki-cream opacity-70":sel?"border-monki-k bg-monki-y/40":"border-black/10 hover:border-black/25"}`}>
              <input type="checkbox" checked={sel||!!yaAsig} onChange={()=>!yaAsig&&toggle(item.id)} disabled={!!yaAsig} className="w-4 h-4"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-monki-k truncate">{item.nombreReceptor||item.descripcion||"Sin nombre"}</p>
                <p className="text-xs text-monki-k/50">{fmtDate(item.fechaEmision||item.fecha)} · {fmtMoney(item.totalGeneral||item.monto,"CRC")}</p>
              </div>
              {yaAsig && <Estado tono="oscuro">Asignado</Estado>}
            </label>
          );
        })}
        {lista.length===0 && <Vacio titulo="Sin registros" texto="No hay movimientos de este tipo."/>}
      </div>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ProyectosScreen() {
  const [proyectos, setProyectos] = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [gastos,    setGastos]    = useState([]);
  const [modal,     setModal]     = useState(null); // null | {type:"editar"|"asignar", proy}
  const [expandido, setExpandido] = useState({});

  const cargar = useCallback(async ()=>{
    const [p,f,g,c] = await Promise.all([db.getProyectos(), db.getFacturas(), db.getGastos(), db.getCompras()]);
    setProyectos(p||[]); setFacturas(f||[]); setGastos([...(g||[]), ...(c||[])]);
  },[]);
  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar proyecto", "¿Eliminar este proyecto? Las facturas y gastos no se borran.", { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getProyectos();
    await db.setProyectos(todos.filter(x=>x.id!==id));
    cargar();
  };

  const pnl = (proyecto) => {
    const asig = proyecto.asignaciones || {};
    // Facturas: manuales + auto-imputadas por proyectoId
    const ingresos = facturas
      .filter(f => asig[f.id]==="facturas" || f.proyectoId === proyecto.id)
      .reduce((s,f) => s + (f.totalGeneral || f.total || 0), 0);
    // Gastos: manuales + compras auto-imputadas por proyectoId
    const costos = gastos
      .filter(g => asig[g.id]==="gastos" || g.proyectoId === proyecto.id)
      .reduce((s,g) => s + (g.monto || g.total || g.montoBase || 0), 0);
    return { ingresos, costos, utilidad: ingresos - costos };
  };

  const toggleExp = (id) => setExpandido(p=>({...p,[id]:!p[id]}));

  const TONO = { Activo:"exito", Completado:"oscuro", Pausado:"alerta", Cancelado:"peligro" };
  const totales = proyectos.reduce((t,p)=>{ const r=pnl(p); return { ingresos:t.ingresos+r.ingresos, costos:t.costos+r.costos }; }, { ingresos:0, costos:0 });
  const nuevo = () => setModal({type:"nuevo"});

  return (
    <Modulo
      seccion="Operaciones"
      titulo="Proyectos"
      descripcion="Centros de costo: asigná facturas y gastos a cada proyecto y mirá si deja ganancia."
      acciones={<Boton icono={Plus} onClick={nuevo}>Nuevo proyecto</Boton>}
      indicadores={proyectos.length > 0 && (
        <Indicadores>
          <Indicador etiqueta="Proyectos" valor={proyectos.length} detalle={`${proyectos.filter(p=>p.estado==="Activo").length} activos`} icono={Layers} delay={40}/>
          <Indicador etiqueta="Ingresos" valor={fmtMoney(totales.ingresos,"CRC")} icono={TrendingUp} delay={90}/>
          <Indicador etiqueta="Costos" valor={fmtMoney(totales.costos,"CRC")} icono={TrendingDown} delay={140}/>
          <Indicador etiqueta="Utilidad" valor={fmtMoney(totales.ingresos-totales.costos,"CRC")} destacado alerta={totales.ingresos-totales.costos<0} delay={190}/>
        </Indicadores>
      )}
    >
      <div className="flex-1 overflow-auto space-y-3 -mx-1 px-1 pb-1">
        {proyectos.length===0 ? (
          <Tarjeta className="h-full flex items-center justify-center">
            <Vacio icono={Layers} titulo="Todavía no hay proyectos" texto="Creá un proyecto para saber cuánto te deja cada obra, cliente o línea de negocio."
              accion={<Boton icono={Plus} onClick={nuevo}>Crear proyecto</Boton>}/>
          </Tarjeta>
        ) : proyectos.map((p,i)=>{
          const { ingresos, costos, utilidad } = pnl(p);
          const exp = expandido[p.id];
          const asig = p.asignaciones||{};
          const nAsig = Object.keys(asig).length;
          const ejec = p.presupuesto>0 ? Math.min(100,(costos/p.presupuesto)*100) : null;
          return (
            <div key={p.id} style={{ animationDelay: `${Math.min(i,10)*40}ms` }}
              className={`animate-entrar bg-white rounded-[18px] border-2 overflow-hidden transition-all duration-300 ease-monki ${exp?"border-monki-k shadow-[5px_5px_0_#111]":"border-black/10 hover:border-black/25"}`}>
              <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <BotonIcono icono={exp?ChevronDown:ChevronRight} titulo={exp?"Cerrar":"Ver detalle"} onClick={()=>toggleExp(p.id)}/>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold text-[15px] text-monki-k">{p.nombre}</p>
                    {p.codigo && <span className="text-[11px] font-mono bg-monki-cream px-1.5 py-0.5 rounded-md">{p.codigo}</span>}
                    <Estado tono={TONO[p.estado]||"neutro"}>{p.estado}</Estado>
                  </div>
                  {p.responsable && <p className="text-xs text-monki-k/50 mt-0.5">Responsable: {p.responsable}</p>}
                  {ejec != null && (
                    <div className="mt-2 flex items-center gap-2 max-w-xs">
                      <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden"><div className={`h-full rounded-full ${ejec>=100?"bg-red-500":"bg-monki-k"}`} style={{width:`${ejec}%`}}/></div>
                      <span className="font-mono text-[10px] text-monki-k/55">{((costos/p.presupuesto)*100).toFixed(0)}% del presupuesto</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-5 shrink-0">
                  <div className="text-right"><p className="monki-tag text-monki-k/45">Ingresos</p><p className="text-sm font-bold">{fmtMoney(ingresos,"CRC")}</p></div>
                  <div className="text-right"><p className="monki-tag text-monki-k/45">Costos</p><p className="text-sm font-bold text-red-600">{fmtMoney(costos,"CRC")}</p></div>
                  <div className={`text-right rounded-xl px-3 py-1 ${utilidad>=0?"bg-monki-y":"bg-red-100"}`}><p className="monki-tag text-monki-k/55">Utilidad</p><p className={`text-sm font-black ${utilidad>=0?"text-monki-k":"text-red-700"}`}>{fmtMoney(utilidad,"CRC")}</p></div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Boton variante="secundario" tamano="sm" icono={Link2} onClick={()=>setModal({type:"asignar",proy:p})}>Asignar ({nAsig})</Boton>
                  <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal({type:"editar",proy:p})}/>
                  <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(p.id)}/>
                </div>
              </div>
              {exp && (
                <div className="animate-desplegar px-5 pb-4 pt-3 border-t-2 border-black/5 bg-monki-cream/50">
                  {p.descripcion && <p className="text-sm text-monki-k/60 pb-2">{p.descripcion}</p>}
                  <div className="flex flex-wrap gap-6 font-mono text-[11px] text-monki-k/55">
                    {p.fechaInicio && <span>Inicio {fmtDate(p.fechaInicio)}</span>}
                    {p.fechaFin && <span>Fin {fmtDate(p.fechaFin)}</span>}
                    {p.presupuesto>0 && <span>Presupuesto {fmtMoney(p.presupuesto,"CRC")}</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[["Facturas", facturas.filter(f=>asig[f.id]==="facturas"), f=>f.nombreReceptor||"Sin nombre", f=>fmtMoney(f.totalGeneral,"CRC"), ""],
                      ["Gastos", gastos.filter(g=>asig[g.id]==="gastos"), g=>g.descripcion||"Sin descripción", g=>fmtMoney(g.monto,"CRC"), "text-red-600"]].map(([titulo, items, nombre, monto, cls])=>(
                      <div key={titulo} className="bg-white rounded-2xl border-2 border-black/5 p-3">
                        <p className="monki-tag text-monki-k/55 mb-1.5">{titulo} ({items.length})</p>
                        {items.length===0 && <p className="text-xs text-monki-k/35">Nada asignado todavía.</p>}
                        {items.slice(0,5).map(x=>(
                          <div key={x.id} className="flex justify-between text-sm py-1 border-b border-black/5 last:border-0">
                            <span className="truncate max-w-[180px] text-monki-k/75">{nombre(x)}</span>
                            <span className={`font-bold ${cls}`}>{monto(x)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal?.type==="nuevo"  && <ProyectoModal onClose={()=>setModal(null)} onSave={cargar}/>}
      {modal?.type==="editar" && <ProyectoModal proyecto={modal.proy} onClose={()=>setModal(null)} onSave={cargar}/>}
      {modal?.type==="asignar"&& <AsignarModal proyecto={modal.proy} facturas={facturas} gastos={gastos} onClose={()=>setModal(null)} onSave={cargar}/>}
      {dialogo}
    </Modulo>
  );
}
