/**
 * ActivosFijosScreen — Activos fijos con depreciación automática
 * Métodos: Línea recta / Saldo decreciente
 * Vida útil por años; calcula depreciación mensual y valor en libros.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Package, TrendingDown, Landmark } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

const TIPOS  = ["Equipo de cómputo","Vehículo","Mobiliario y equipo","Edificio","Terreno","Intangible","Otro"];
const METODOS = ["Línea recta","Saldo decreciente"];

// ── Cálculo de depreciación ───────────────────────────────────────────────────
function calcDepreciacion(activo) {
  const { costo = 0, valorResidual = 0, vidaUtil = 5, metodo = "Línea recta", fechaCompra } = activo;
  if (!fechaCompra || !costo) return { depMensual: 0, depAnual: 0, valorLibros: costo, acumulada: 0 };

  const inicio      = new Date(fechaCompra + "T12:00:00");
  const hoyDate     = new Date();
  const mesesUsados = Math.max(0, (hoyDate.getFullYear() - inicio.getFullYear()) * 12
    + (hoyDate.getMonth() - inicio.getMonth()));

  const vidaMeses = vidaUtil * 12;
  const baseDeprec = costo - valorResidual;

  let acumulada = 0;
  let depMensual = 0;

  if (metodo === "Línea recta") {
    depMensual = baseDeprec / vidaMeses;
    acumulada  = Math.min(depMensual * mesesUsados, baseDeprec);
  } else {
    // Saldo decreciente: tasa anual = 2/vidaUtil
    const tasaAnual   = 2 / vidaUtil;
    const tasaMensual = tasaAnual / 12;
    let   saldo       = costo;
    for (let i = 0; i < Math.min(mesesUsados, vidaMeses); i++) {
      const dep = saldo * tasaMensual;
      acumulada += dep;
      depMensual = dep;
      saldo     -= dep;
      if (saldo <= valorResidual) { acumulada += (saldo - valorResidual); saldo = valorResidual; break; }
    }
  }

  const valorLibros = Math.max(valorResidual, costo - acumulada);
  return { depMensual: metodo==="Línea recta"?depMensual:depMensual, depAnual: depMensual*12, valorLibros, acumulada, pctDeprec: Math.min(100,(acumulada/baseDeprec)*100) };
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ActivoModal({ activo, onClose, onSave }) {
  const esNuevo = !activo?.id;
  const [form, setForm] = useState(activo || {
    nombre:"", tipo:"Equipo de cómputo", costo:"", valorResidual:"", vidaUtil:5,
    metodo:"Línea recta", fechaCompra: hoy(), ubicacion:"", proveedor:"", descripcion:"",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre || !form.costo) return alert("Nombre y costo son requeridos.");
    const todos = await db.getActivosFijos();
    const item  = { ...form, costo: parseFloat(form.costo)||0, valorResidual: parseFloat(form.valorResidual)||0, vidaUtil: parseInt(form.vidaUtil)||5 };
    if (esNuevo) {
      item.id = genId(); item.creadoEn = new Date().toISOString();
      await db.setActivosFijos([...todos, item]);
    } else {
      await db.setActivosFijos(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  const OPCIONES = { tipo: TIPOS, metodo: METODOS };
  return (
    <Modal titulo={esNuevo?"Nuevo activo":"Editar activo"} subtitulo="Se deprecia solo cada mes" onCerrar={onClose}
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar activo</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Nombre del activo *", "nombre", "text", "col-span-2"],
          ["Tipo",                "tipo",   "select",""],
          ["Método",              "metodo", "select",""],
          ["Costo (₡) *",         "costo",  "number",""],
          ["Valor residual (₡)",  "valorResidual","number",""],
          ["Vida útil (años)",    "vidaUtil","number",""],
          ["Fecha de compra",     "fechaCompra","date",""],
          ["Ubicación",           "ubicacion","text",""],
          ["Proveedor",           "proveedor","text",""],
          ["Descripción",         "descripcion","text","col-span-2"],
        ].map(([lbl,key,type,cls])=>(
          <Campo key={key} etiqueta={lbl} className={cls}>
            {type==="select"
              ? <Seleccion value={form[key]||""} onChange={e=>u(key,e.target.value)} opciones={OPCIONES[key]}/>
              : <Entrada type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)} min={type==="number"?0:undefined}/>}
          </Campo>
        ))}
      </div>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ActivosFijosScreen() {
  const [activos, setActivos] = useState([]);
  const [modal,   setModal]   = useState(null);

  const cargar = useCallback(async ()=>{ setActivos(await db.getActivosFijos()); },[]);
  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar activo", "¿Eliminar este activo fijo? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getActivosFijos();
    await db.setActivosFijos(todos.filter(x=>x.id!==id));
    cargar();
  };

  // Totales
  const totalCosto     = activos.reduce((s,a)=>s+(a.costo||0),0);
  const totalLibros    = activos.reduce((s,a)=>s+calcDepreciacion(a).valorLibros,0);
  const totalAcumulada = activos.reduce((s,a)=>s+calcDepreciacion(a).acumulada,0);

  const columnas = [
    { key: "nombre", titulo: "Activo", render: a => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0"><Package size={14}/></span>
        <div><p className="font-bold text-monki-k">{a.nombre}</p><p className="font-mono text-[10px] text-monki-k/45">{fmtDate(a.fechaCompra)} · {a.vidaUtil} años</p></div>
      </div>) },
    { key: "tipo", titulo: "Tipo", render: a => <span className="text-monki-k/60 text-xs">{a.tipo}</span> },
    { key: "metodo", titulo: "Método", render: a => <Estado>{a.metodo==="Línea recta"?"Línea recta":"Saldo decr."}</Estado> },
    { key: "costo", titulo: "Costo", alinear: "right", render: a => <b>{fmtMoney(a.costo,"CRC")}</b> },
    { key: "mensual", titulo: "Dep. mensual", alinear: "right", render: a => <span className="text-red-600 text-xs">{fmtMoney(calcDepreciacion(a).depMensual,"CRC")}</span> },
    { key: "acumulada", titulo: "Acumulada", alinear: "right", render: a => <span className="text-red-600">{fmtMoney(calcDepreciacion(a).acumulada,"CRC")}</span> },
    { key: "libros", titulo: "Valor en libros", alinear: "right", render: a => <b className="text-monki-k">{fmtMoney(calcDepreciacion(a).valorLibros,"CRC")}</b> },
    { key: "pct", titulo: "Depreciado", render: a => {
      const d = calcDepreciacion(a); const total = d.pctDeprec>=100;
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 bg-black/10 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${total?"bg-red-500":"bg-monki-k"}`} style={{width:`${Math.min(100,d.pctDeprec||0)}%`}}/></div>
          <span className={`font-mono text-[11px] ${total?"text-red-600 font-bold":"text-monki-k/55"}`}>{(d.pctDeprec||0).toFixed(0)}%</span>
        </div>);
    } },
    { key: "acciones", titulo: "", alinear: "right", render: a => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal(a)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(a.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Activos fijos"
      descripcion="Equipo, vehículos y bienes de la empresa, con su depreciación calculada automáticamente."
      acciones={<Boton icono={Plus} onClick={()=>setModal({})}>Nuevo activo</Boton>}
      indicadores={activos.length>0 && (
        <Indicadores>
          <Indicador etiqueta="Activos" valor={activos.length} detalle="Registrados" icono={Package} delay={40}/>
          <Indicador etiqueta="Costo histórico" valor={fmtMoney(totalCosto,"CRC")} icono={Landmark} delay={90}/>
          <Indicador etiqueta="Dep. acumulada" valor={fmtMoney(totalAcumulada,"CRC")} icono={TrendingDown} delay={140}/>
          <Indicador etiqueta="Valor en libros" valor={fmtMoney(totalLibros,"CRC")} destacado delay={190}/>
        </Indicadores>
      )}
    >
      <Tabla columnas={columnas} filas={activos} onFila={a=>setModal(a)}
        vacio={<Vacio icono={Package} titulo="Sin activos registrados" texto="Registrá computadoras, vehículos o mobiliario para llevar su depreciación."
          accion={<Boton icono={Plus} onClick={()=>setModal({})}>Agregar activo</Boton>}/>}/>
      {modal!==null && (
        <ActivoModal activo={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {dialogo}
    </Modulo>
  );
}
