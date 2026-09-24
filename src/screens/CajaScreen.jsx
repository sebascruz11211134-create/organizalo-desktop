/**
 * CajaScreen — Control de caja diario
 * Apertura → movimientos del día → cierre con arqueo físico
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Lock, Unlock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trash2, Wallet } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tabla, Tarjeta, Vacio, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, genId, hoy, fechaLocal } from "../utils/fmt";

// Crea un asiento contable automático al cerrar la caja
async function crearAsientoCaja({ fecha, totalIngresos, totalEgresos, saldoInicial }) {
  try {
    const asientos = await db.getAsientos();
    const seq = String(asientos.length + 1).padStart(5, "0");
    const neto = totalIngresos - totalEgresos;
    if (neto === 0 && totalIngresos === 0) return; // nada que registrar

    const lineas = [];
    if (totalIngresos > 0) {
      lineas.push({ cuentaCodigo:"1101", cuentaNombre:"Caja / Efectivo",  debe: totalIngresos, haber: 0 });
      lineas.push({ cuentaCodigo:"4101", cuentaNombre:"Ingresos del día", debe: 0, haber: totalIngresos });
    }
    if (totalEgresos > 0) {
      lineas.push({ cuentaCodigo:"5201", cuentaNombre:"Gastos operativos", debe: totalEgresos, haber: 0 });
      lineas.push({ cuentaCodigo:"1101", cuentaNombre:"Caja / Efectivo",   debe: 0, haber: totalEgresos });
    }

    // Agrupa líneas del mismo código
    const agrupadas = [];
    for (const l of lineas) {
      const ex = agrupadas.find(a => a.cuentaCodigo === l.cuentaCodigo);
      if (ex) { ex.debe += l.debe; ex.haber += l.haber; }
      else agrupadas.push({ ...l });
    }

    const totalDebe  = agrupadas.reduce((s, l) => s + l.debe, 0);
    const totalHaber = agrupadas.reduce((s, l) => s + l.haber, 0);
    if (Math.abs(totalDebe - totalHaber) > 0.01) return; // no balanceado, skip

    const asiento = {
      id: genId(), numero: `AJ-${seq}`,
      descripcion: `Cierre de caja — ${fecha}`,
      fecha, totalDebe, totalHaber,
      estado: "confirmado",
      lineas: agrupadas,
      creadoEn: new Date().toISOString(),
      autoGenerado: true,
    };
    await db.setAsientos([asiento, ...asientos]);
  } catch (e) {
    console.warn("[CajaScreen] No se pudo crear asiento:", e.message);
  }
}

const TIPOS_MOV = ["Venta efectivo","Pago a proveedor","Gasto operativo","Fondo de cambio","Retiro","Depósito a banco","Otro ingreso","Otro egreso"];

// ── helpers ──────────────────────────────────────────────────────────────────
function fechaHoy() { return hoy(); }
function prevDia(f) { const d=new Date(f+"T12:00:00"); d.setDate(d.getDate()-1); return fechaLocal(d); }
function nextDia(f) { const d=new Date(f+"T12:00:00"); d.setDate(d.getDate()+1); return fechaLocal(d); }
function labelFecha(f) { return new Date(f+"T12:00:00").toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }

// ── Modal movimiento ─────────────────────────────────────────────────────────
function MovModal({ onClose, onSave }) {
  const [form, setForm] = useState({ tipo:"Venta efectivo", monto:"", descripcion:"", esIngreso:true });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.monto || isNaN(parseFloat(form.monto))) return alert("Monto requerido.");
    onSave({ ...form, monto: parseFloat(form.monto), id: genId(), hora: new Date().toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit"}) });
    onClose();
  };

  const esIngreso = ["Venta efectivo","Fondo de cambio","Depósito a banco","Otro ingreso"].includes(form.tipo);

  const Opcion = ({ activo, onClick, children, peligro }) => (
    <button type="button" onClick={onClick}
      className={`ui-boton flex-1 py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${activo ? (peligro ? "bg-red-600 text-white" : "bg-monki-k text-monki-y") : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>{children}</button>
  );
  return (
    <Modal titulo="Nuevo movimiento" subtitulo="Entrada o salida de efectivo de la caja" onCerrar={onClose} ancho="max-w-sm"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton icono={Plus} onClick={guardar}>Agregar</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Tipo"><Seleccion value={form.tipo} onChange={e=>u("tipo",e.target.value)} opciones={TIPOS_MOV}/></Campo>
        <Campo etiqueta="Monto (₡)"><Entrada type="number" min="0" step="any" value={form.monto} onChange={e=>u("monto",e.target.value)}/></Campo>
        <Campo etiqueta="Es">
          <div className="flex gap-2">
            <Opcion activo={form.esIngreso} onClick={()=>u("esIngreso",true)}>↑ Ingreso</Opcion>
            <Opcion activo={!form.esIngreso} peligro onClick={()=>u("esIngreso",false)}>↓ Egreso</Opcion>
          </div>
        </Campo>
        <Campo etiqueta="Descripción"><Entrada value={form.descripcion} onChange={e=>u("descripcion",e.target.value)} placeholder="Detalle del movimiento…"/></Campo>
      </div>
    </Modal>
  );
}

// ── Modal cierre / arqueo ─────────────────────────────────────────────────────
function CierreModal({ saldoEsperado, onClose, onCerrar }) {
  const BILLETES = [50000,20000,10000,5000,2000,1000,500,100,50,25,10,5];
  const [conteo, setConteo] = useState(Object.fromEntries(BILLETES.map(b=>[b,0])));
  const u = (b,v) => setConteo(p=>({...p,[b]: parseInt(v)||0}));
  const totalFisico = BILLETES.reduce((s,b)=>s+b*(conteo[b]||0),0);
  const diferencia  = totalFisico - saldoEsperado;

  return (
    <Modal titulo="Cierre de caja" subtitulo="Contá el efectivo que hay físicamente en la caja" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton icono={Lock} onClick={()=>onCerrar({ conteo, totalFisico, diferencia })}>Confirmar cierre</Boton></>}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {BILLETES.map(b=>(
          <div key={b} className="flex items-center gap-2">
            <span className="w-16 text-right text-sm font-bold text-monki-k">₡{b.toLocaleString("es-CR")}</span>
            <span className="text-monki-k/35 text-xs">×</span>
            <input type="number" min="0" value={conteo[b]||""} onChange={e=>u(b,e.target.value)}
              className="w-16 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-2 py-1 text-sm text-center"/>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-monki-k text-white rounded-2xl p-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-white/65"><span>Saldo esperado (sistema)</span><span>{fmtMoney(saldoEsperado,"CRC")}</span></div>
        <div className="flex justify-between text-white/65"><span>Conteo físico</span><span>{fmtMoney(totalFisico,"CRC")}</span></div>
        <div className="flex justify-between items-end border-t border-white/15 pt-2">
          <span className="monki-tag text-white/55">Diferencia</span>
          <span className={`text-[20px] font-black ${diferencia===0?"text-monki-y":diferencia>0?"text-white":"text-red-300"}`}>{diferencia>=0?"+":""}{fmtMoney(diferencia,"CRC")}</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CajaScreen() {
  const [fecha,    setFecha]    = useState(fechaHoy());
  const [cajas,    setCajas]    = useState([]);
  const [modal,    setModal]    = useState(null); // null | "movimiento" | "cierre" | "apertura"
  const [apertura, setApertura] = useState("");

  const cargar = useCallback(async () => {
    setCajas(await db.getCaja());
  }, []);
  useEffect(()=>{ cargar(); },[cargar]);
  useSyncRefresh(cargar);

  const cajaDia   = cajas.find(c=>c.fecha===fecha);
  const abierta   = cajaDia && !cajaDia.cerrada;
  const cerrada   = cajaDia?.cerrada;

  const saldoEsperado = cajaDia
    ? cajaDia.saldoInicial
      + cajaDia.movimientos.filter(m=>m.esIngreso).reduce((s,m)=>s+m.monto,0)
      - cajaDia.movimientos.filter(m=>!m.esIngreso).reduce((s,m)=>s+m.monto,0)
    : 0;

  const totalIngresos = cajaDia?.movimientos.filter(m=>m.esIngreso).reduce((s,m)=>s+m.monto,0)||0;
  const totalEgresos  = cajaDia?.movimientos.filter(m=>!m.esIngreso).reduce((s,m)=>s+m.monto,0)||0;

  const abrirCaja = async () => {
    const saldo = parseFloat(apertura)||0;
    const nueva = { id:genId(), fecha, saldoInicial:saldo, movimientos:[], cerrada:false, creadoEn:new Date().toISOString() };
    const todas = await db.getCaja();
    await db.setCaja([...todas.filter(c=>c.fecha!==fecha), nueva]);
    cargar(); setModal(null); setApertura("");
  };

  const addMovimiento = async (mov) => {
    const todas = await db.getCaja();
    const upd   = todas.map(c=>c.fecha===fecha?{...c,movimientos:[...c.movimientos,mov]}:c);
    await db.setCaja(upd); cargar();
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminarMovimiento = async (movId) => {
    if (!(await confirmar("Eliminar movimiento", "¿Eliminar este movimiento de caja?", { peligro: true, boton: "Eliminar" }))) return;
    const todas = await db.getCaja();
    const upd   = todas.map(c=>c.fecha===fecha?{...c,movimientos:c.movimientos.filter(m=>m.id!==movId)}:c);
    await db.setCaja(upd); cargar();
  };

  const cerrarCaja = async (arqueo) => {
    const todas = await db.getCaja();
    const upd   = todas.map(c=>c.fecha===fecha?{...c,cerrada:true,arqueo,cierreEn:new Date().toISOString()}:c);
    await db.setCaja(upd);

    // Crear asiento contable automático del día
    await crearAsientoCaja({ fecha, totalIngresos, totalEgresos, saldoInicial: cajaDia?.saldoInicial || 0 });

    cargar(); setModal(null);
  };

  const columnas = [
    { key: "hora", titulo: "Hora", render: m => <span className="font-mono text-xs text-monki-k/55">{m.hora}</span> },
    { key: "tipo", titulo: "Tipo", render: m => <b className="text-monki-k">{m.tipo}</b> },
    { key: "desc", titulo: "Descripción", render: m => <span className="text-monki-k/55 text-xs">{m.descripcion||"—"}</span> },
    { key: "ing", titulo: "Ingreso", alinear: "right", render: m => m.esIngreso ? <b>{fmtMoney(m.monto,"CRC")}</b> : "" },
    { key: "egr", titulo: "Egreso", alinear: "right", render: m => !m.esIngreso ? <b className="text-red-600">{fmtMoney(m.monto,"CRC")}</b> : "" },
    { key: "acc", titulo: "", alinear: "right", render: m => abierta && <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminarMovimiento(m.id)}/> },
  ];

  return (
    <Modulo
      seccion="Operaciones"
      titulo="Control de caja"
      descripcion="Abrí la caja, anotá cada entrada y salida de efectivo, y cerrá con el arqueo."
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Día anterior" onClick={()=>setFecha(prevDia(fecha))}/>
          <span className="text-sm font-bold min-w-[200px] text-center capitalize">{labelFecha(fecha)}</span>
          <BotonIcono icono={ChevronRight} titulo="Día siguiente" onClick={()=>setFecha(nextDia(fecha))} disabled={fecha>=fechaHoy()}/>
        </div>
        {abierta && <>
          <Boton variante="secundario" icono={Plus} onClick={()=>setModal("movimiento")}>Movimiento</Boton>
          <Boton icono={Lock} onClick={()=>setModal("cierre")}>Cerrar caja</Boton>
        </>}
        {!cajaDia && <Boton icono={Unlock} onClick={()=>setModal("apertura")}>Abrir caja</Boton>}
      </>}
      indicadores={cajaDia && (
        <Indicadores>
          <Indicador etiqueta="Saldo inicial" valor={fmtMoney(cajaDia.saldoInicial,"CRC")} icono={Wallet} delay={40}/>
          <Indicador etiqueta="Ingresos" valor={fmtMoney(totalIngresos,"CRC")} icono={TrendingUp} delay={90}/>
          <Indicador etiqueta="Egresos" valor={fmtMoney(totalEgresos,"CRC")} icono={TrendingDown} delay={140}/>
          <Indicador etiqueta={cerrada?"Saldo al cierre":"Saldo actual"} valor={fmtMoney(cerrada?(cajaDia.arqueo?.totalFisico||saldoEsperado):saldoEsperado,"CRC")} destacado delay={190}/>
        </Indicadores>
      )}
    >
      {!cajaDia ? (
        <Tarjeta className="flex-1 flex items-center justify-center">
          <Vacio icono={Unlock} titulo="La caja no está abierta" texto="Abrí la caja para empezar a registrar movimientos del día."
            accion={<Boton icono={Unlock} onClick={()=>setModal("apertura")}>Abrir caja del día</Boton>}/>
        </Tarjeta>
      ) : (<>
        {cerrada && cajaDia.arqueo && (
          <div className={`animate-desplegar mb-3 flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold
            ${cajaDia.arqueo.diferencia===0?"bg-[#dcfce7] text-[#166534]":cajaDia.arqueo.diferencia>0?"bg-monki-y text-monki-k":"bg-red-100 text-red-700"}`}>
            {cajaDia.arqueo.diferencia===0?<CheckCircle size={16}/>:<AlertTriangle size={16}/>}
            Caja cerrada · diferencia en el arqueo {cajaDia.arqueo.diferencia>=0?"+":""}{fmtMoney(cajaDia.arqueo.diferencia,"CRC")}
            <span className="font-mono text-[11px] font-normal opacity-70">{cajaDia.cierreEn ? new Date(cajaDia.cierreEn).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit"}) : ""}</span>
          </div>
        )}
        <Tabla columnas={columnas} filas={cajaDia.movimientos}
          vacio={<Vacio icono={Wallet} titulo="Sin movimientos registrados" texto="Anotá cada venta en efectivo, pago o retiro."
            accion={abierta && <Boton icono={Plus} onClick={()=>setModal("movimiento")}>Agregar movimiento</Boton>}/>}/>
      </>)}

      {modal==="apertura" && (
        <Modal titulo="Apertura de caja" subtitulo="Con cuánto efectivo arranca el día" onCerrar={()=>setModal(null)} ancho="max-w-sm"
          pie={<><Boton variante="fantasma" onClick={()=>setModal(null)}>Cancelar</Boton><Boton icono={Unlock} onClick={abrirCaja}>Abrir caja</Boton></>}>
          <Campo etiqueta="Saldo inicial en efectivo (₡)"><Entrada type="number" min="0" step="any" value={apertura} onChange={e=>setApertura(e.target.value)} placeholder="0"/></Campo>
        </Modal>
      )}
      {modal==="movimiento" && <MovModal onClose={()=>setModal(null)} onSave={addMovimiento}/>}
      {modal==="cierre"     && <CierreModal saldoEsperado={saldoEsperado} onClose={()=>setModal(null)} onCerrar={cerrarCaja}/>}
      {dialogo}
    </Modulo>
  );
}
