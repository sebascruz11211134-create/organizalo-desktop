/**
 * AsientosScreen — Diario de asientos contables (partida doble)
 * Cada asiento: fecha + descripción + N líneas (cuenta, debe, haber)
 * Validación: suma(debe) === suma(haber)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, ChevronDown, ChevronRight, Trash2, BookOpen, Scale, Edit2 } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { PLAN_DEFAULT } from "../utils/planCuentas";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

// ── Modal asiento ─────────────────────────────────────────────────────────────
function AsientoModal({ asiento, cuentas, onClose, onSave }) {
  const esNuevo = !asiento?.id;
  const [form, setForm] = useState(asiento || {
    fecha: hoy(), referencia:"", descripcion:"",
    lineas: [
      { cuentaCodigo:"", cuentaNombre:"", debe:0, haber:0 },
      { cuentaCodigo:"", cuentaNombre:"", debe:0, haber:0 },
    ],
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const updLinea = (i,k,v) => setForm(p=>({
    ...p,
    lineas: p.lineas.map((l,idx)=>idx===i?{...l,[k]:v}:l)
  }));

  const selCuenta = (i, codigo) => {
    const c = cuentas.find(x=>x.codigo===codigo);
    updLinea(i,"cuentaCodigo",codigo);
    updLinea(i,"cuentaNombre",c?.nombre||"");
  };

  const addLinea = () => setForm(p=>({...p,lineas:[...p.lineas,{cuentaCodigo:"",cuentaNombre:"",debe:0,haber:0}]}));
  const delLinea = (i) => setForm(p=>({...p,lineas:p.lineas.filter((_,idx)=>idx!==i)}));

  const totalDebe  = form.lineas.reduce((s,l)=>s+parseFloat(l.debe||0),0);
  const totalHaber = form.lineas.reduce((s,l)=>s+parseFloat(l.haber||0),0);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01;

  const guardar = async () => {
    if (!form.descripcion) return alert("Descripción requerida.");
    if (!balanceado) return alert(`Asiento no balanceado: Debe=${totalDebe.toFixed(2)}, Haber=${totalHaber.toFixed(2)}`);
    if (form.lineas.some(l=>!l.cuentaCodigo)) return alert("Todas las líneas deben tener una cuenta.");
    const todos = await db.getAsientos();
    const seq   = (todos.length+1).toString().padStart(5,"0");
    const item  = {
      ...form,
      id:       asiento?.id || genId(),
      numero:   asiento?.numero || `AJ-${seq}`,
      totalDebe,
      totalHaber,
      creadoEn: asiento?.creadoEn || new Date().toISOString(),
    };
    if (esNuevo) await db.setAsientos([...todos, item]);
    else         await db.setAsientos(todos.map(x=>x.id===item.id?item:x));
    onSave(); onClose();
  };

  const detalleCuentas = cuentas.filter(c=>!c.esGrupo);

  const CELDA = "w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-2.5 py-2 text-sm transition-colors";
  return (
    <Modal titulo={esNuevo?"Nuevo asiento contable":"Editar asiento"} subtitulo="Partida doble: el debe tiene que igualar al haber" onCerrar={onClose} ancho="max-w-3xl"
      pie={<>
        <Boton variante="secundario" icono={Plus} onClick={addLinea} className="mr-auto">Agregar línea</Boton>
        <Boton variante="fantasma" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!balanceado}>Guardar asiento</Boton>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Campo etiqueta="Fecha *"><Entrada type="date" value={form.fecha} onChange={e=>u("fecha",e.target.value)}/></Campo>
        <Campo etiqueta="Referencia"><Entrada value={form.referencia} onChange={e=>u("referencia",e.target.value)} placeholder="Fact-00123, cheque 001…"/></Campo>
        <Campo etiqueta="Descripción *"><Entrada value={form.descripcion} onChange={e=>u("descripcion",e.target.value)} placeholder="Registro de venta, pago de planilla…"/></Campo>
      </div>

      <div className="border-2 border-black/10 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 monki-tag text-monki-k/50 px-3 py-2.5 border-b-2 border-black/10">
          <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span><span className="w-8"/>
        </div>
        {form.lineas.map((l,i) => (
          <div key={i} className="animate-desplegar grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-3 py-2 border-b border-black/5 last:border-b-0 items-center">
            <select value={l.cuentaCodigo} onChange={e=>selCuenta(i,e.target.value)} className={CELDA+" cursor-pointer"}>
              <option value="">— Seleccionar cuenta —</option>
              {detalleCuentas.map(c=>(<option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>))}
            </select>
            <input type="number" min="0" step="any" value={l.debe||""} onChange={e=>updLinea(i,"debe",e.target.value)} placeholder="0" className={CELDA+" text-right"}/>
            <input type="number" min="0" step="any" value={l.haber||""} onChange={e=>updLinea(i,"haber",e.target.value)} placeholder="0" className={CELDA+" text-right"}/>
            <BotonIcono icono={X} titulo="Quitar línea" tono="peligro" onClick={()=>delLinea(i)} disabled={form.lineas.length<=2}/>
          </div>
        ))}
        <div className={`grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-3 py-3 items-center transition-colors ${balanceado?"bg-monki-k text-white":"bg-red-600 text-white"}`}>
          <span className="monki-tag">{balanceado ? "Balanceado ✓" : "No balancea"}</span>
          <span className="text-sm font-black text-right">{fmtMoney(totalDebe,"CRC")}</span>
          <span className="text-sm font-black text-right">{fmtMoney(totalHaber,"CRC")}</span>
          <span className="w-8"/>
        </div>
      </div>
      {!balanceado && (
        <p className="text-sm text-red-600 font-semibold mt-2">Diferencia de {fmtMoney(Math.abs(totalDebe-totalHaber),"CRC")}: el debe tiene que ser igual al haber.</p>
      )}
    </Modal>
  );
}

// ── Fila expandible ──────────────────────────────────────────────────────────
function AsientoRow({ a, onEdit, isSel, onSelect, onEliminar }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`ui-fila animate-desplegar cursor-pointer border-b border-black/5 transition-colors ${isSel ? "bg-[#FFF4B8]" : "hover:bg-monki-cream/60"}`}
        onClick={onSelect}>
        <td className="px-4 py-2.5 font-mono text-xs font-bold">{a.numero}</td>
        <td className="px-4 py-2.5">{fmtDate(a.fecha)}</td>
        <td className="px-4 py-2.5"><b className="text-monki-k">{a.descripcion}</b>{a.autoGenerado && <span className="ml-2"><Estado>Automático</Estado></span>}</td>
        <td className="px-4 py-2.5 text-monki-k/50 text-xs">{a.referencia||"—"}</td>
        <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtMoney(a.totalDebe,"CRC")}</td>
        <td className="px-4 py-2.5 text-right text-monki-k/55 tabular-nums">{fmtMoney(a.totalHaber,"CRC")}</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap" onClick={e=>e.stopPropagation()}>
          <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>onEdit(a)}/>
          <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>onEliminar(a)}/>
          <BotonIcono icono={open ? ChevronDown : ChevronRight} titulo={open ? "Ocultar líneas" : "Ver líneas"} onClick={()=>setOpen(o=>!o)}/>
        </td>
      </tr>
      {open && a.lineas?.map((l,i)=>(
        <tr key={i} className="animate-desplegar bg-monki-cream/60 text-xs border-b border-black/5">
          <td/><td/>
          <td className="px-4 py-2 text-monki-k/70 pl-8"><span className="font-mono">{l.cuentaCodigo}</span> — {l.cuentaNombre}</td>
          <td/>
          <td className="px-4 py-2 text-right font-mono">{l.debe>0?fmtMoney(l.debe,"CRC"):""}</td>
          <td className="px-4 py-2 text-right font-mono text-monki-k/50">{l.haber>0?fmtMoney(l.haber,"CRC"):""}</td>
          <td/>
        </tr>
      ))}
    </>
  );
}

// ── Screen principal ─────────────────────────────────────────────────────────
export default function AsientosScreen() {
  const [asientos, setAsientos] = useState([]);
  const [cuentas,  setCuentas]  = useState([]);
  const [busq,     setBusq]     = useState("");
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);

  const cargar = useCallback(async () => {
    const [a, c] = await Promise.all([db.getAsientos(), db.getCuentasContables()]);
    setAsientos(a.sort((x,y)=>(y.fecha||"").localeCompare(x.fecha||"")));
    setCuentas(c || PLAN_DEFAULT);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (objetivo = sel) => {
    if (!objetivo) return;
    if (!(await confirmar("Eliminar asiento", `¿Eliminar el asiento ${objetivo.numero}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getAsientos();
    await db.setAsientos(todos.filter(x => x.id !== objetivo.id));
    setSelected(null);
    cargar();
  };

  const busqL    = busq.trim().toLowerCase();
  const visibles = asientos.filter(a =>
    !busqL || a.descripcion?.toLowerCase().includes(busqL) ||
    a.numero?.toLowerCase().includes(busqL) || a.referencia?.toLowerCase().includes(busqL)
  );

  const totDebe  = visibles.reduce((s,a)=>s+a.totalDebe,0);
  const totHaber = visibles.reduce((s,a)=>s+a.totalHaber,0);
  const sel      = visibles.find(a => a.id === selected);

  const balanceados = Math.abs(totDebe-totHaber)<0.01;
  const mesActual = hoy().slice(0,7);

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Asientos contables"
      descripcion="El diario: cada movimiento en partida doble. Los automáticos salen de facturas, compras y recibos."
      acciones={<Boton icono={Plus} onClick={()=>setModal({})}>Nuevo asiento</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Asientos" valor={visibles.length} detalle={busq ? "Con la búsqueda" : "En total"} icono={BookOpen} delay={40}/>
          <Indicador etiqueta="Este mes" valor={asientos.filter(a=>(a.fecha||"").startsWith(mesActual)).length} delay={90}/>
          <Indicador etiqueta="Total debe" valor={fmtMoney(totDebe,"CRC")} delay={140}/>
          <Indicador etiqueta={balanceados ? "Balanceado" : "Descuadre"} valor={balanceados ? "✓" : fmtMoney(Math.abs(totDebe-totHaber),"CRC")} detalle="Debe contra haber" icono={Scale} destacado={balanceados} alerta={!balanceados} delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} asientos`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por descripción, número o referencia…"/>
      </BarraFiltros>
      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="ui-tabla w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="monki-tag text-monki-k/55">
                {["N.°","Fecha","Descripción","Referencia"].map(t=><th key={t} className="font-semibold px-4 py-3 border-b-2 border-black/10 text-left whitespace-nowrap">{t}</th>)}
                <th className="font-semibold px-4 py-3 border-b-2 border-black/10 text-right">Debe</th>
                <th className="font-semibold px-4 py-3 border-b-2 border-black/10 text-right">Haber</th>
                <th className="border-b-2 border-black/10"/>
              </tr>
            </thead>
            <tbody>
              {visibles.length===0 ? (
                <tr><td colSpan={7}><Vacio icono={BookOpen} titulo={asientos.length ? "Sin resultados" : "Todavía no hay asientos"} texto={asientos.length ? "Probá con otra búsqueda." : "Se crean solos al facturar y cobrar, o podés registrar uno a mano."}
                  accion={!asientos.length && <Boton icono={Plus} onClick={()=>setModal({})}>Nuevo asiento</Boton>}/></td></tr>
              ) : visibles.map(a=>{
                const isSel = selected === a.id;
                return <AsientoRow key={a.id} a={a} onEdit={setModal} onEliminar={eliminar} isSel={isSel} onSelect={()=>setSelected(isSel?null:a.id)}/>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal!==null && (
        <AsientoModal asiento={Object.keys(modal).length>0?modal:null} cuentas={cuentas}
          onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {dialogo}
    </Modulo>
  );
}
