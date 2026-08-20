/**
 * CajaScreen — Control de caja diario
 * Apertura → movimientos del día → cierre con arqueo físico
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Lock, Unlock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

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
function prevDia(f) { const d=new Date(f+"T12:00:00"); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function nextDia(f) { const d=new Date(f+"T12:00:00"); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-900">Nuevo movimiento</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Tipo</span>
            <select value={form.tipo} onChange={e=>u("tipo",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
              {TIPOS_MOV.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Monto (₡)</span>
            <input type="number" min="0" step="any" value={form.monto} onChange={e=>u("monto",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Es</span>
            <div className="flex gap-2 mt-1">
              <button onClick={()=>u("esIngreso",true)} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${form.esIngreso?"border-yellow-300 bg-green-50 text-yellow-700":"border-slate-200 text-slate-500"}`}>↑ Ingreso</button>
              <button onClick={()=>u("esIngreso",false)} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${!form.esIngreso?"border-red-500 bg-red-50 text-red-600":"border-slate-200 text-slate-500"}`}>↓ Egreso</button>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span>
            <input value={form.descripcion} onChange={e=>u("descripcion",e.target.value)}
              placeholder="Detalle del movimiento…"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Agregar</button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-900">Cierre de caja — Arqueo</h2>
          <button onClick={onClose}><X size={16} className="text-slate-400"/></button>
        </div>

        <p className="text-sm text-slate-500 mb-4">Contá el efectivo físico en caja:</p>

        <div className="space-y-1.5">
          {BILLETES.map(b=>(
            <div key={b} className="flex items-center gap-3">
              <span className="w-16 text-right text-sm font-semibold text-slate-700">₡{b.toLocaleString("es-CR")}</span>
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min="0" value={conteo[b]||""} onChange={e=>u(b,e.target.value)}
                className="w-20 border border-slate-200 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
              <span className="text-xs text-slate-400">= {fmtMoney(b*(conteo[b]||0),"CRC")}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Saldo esperado (sistema)</span>
            <span className="font-semibold">{fmtMoney(saldoEsperado,"CRC")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Conteo físico</span>
            <span className="font-semibold">{fmtMoney(totalFisico,"CRC")}</span>
          </div>
          <div className={`flex justify-between text-sm font-bold border-t border-slate-200 pt-2 ${diferencia===0?"text-yellow-700":diferencia>0?"text-blue-700":"text-red-600"}`}>
            <span>Diferencia</span>
            <span>{diferencia>=0?"+":""}{fmtMoney(diferencia,"CRC")}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={()=>onCerrar({ conteo, totalFisico, diferencia })}
            className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">
            Confirmar cierre
          </button>
        </div>
      </div>
    </div>
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

  const eliminarMovimiento = async (movId) => {
    if (!confirm("¿Eliminar este movimiento de caja?")) return;
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

  return (
    <div className="flex flex-col h-full">
      {/* Nav de fecha */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <button onClick={()=>setFecha(prevDia(fecha))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={15}/></button>
        <span className="text-sm font-semibold text-slate-800 min-w-[220px] text-center capitalize">{labelFecha(fecha)}</span>
        <button onClick={()=>setFecha(nextDia(fecha))} disabled={fecha>=fechaHoy()} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={15}/></button>
        <div className="flex-1"/>
        {abierta && (
          <>
            <button onClick={()=>setModal("movimiento")}
              className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
              <Plus size={14}/> Movimiento
            </button>
            <button onClick={()=>setModal("cierre")}
              className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">
              <Lock size={14}/> Cerrar caja
            </button>
          </>
        )}
        {!cajaDia && (
          <button onClick={()=>setModal("apertura")}
            className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">
            <Unlock size={14}/> Abrir caja
          </button>
        )}
      </div>

      {/* Estado sin caja */}
      {!cajaDia && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-3">
          <Unlock size={36} className="text-slate-300"/>
          <p className="text-lg font-semibold">Caja no abierta</p>
          <p className="text-sm">Abrí la caja para empezar a registrar movimientos.</p>
          <button onClick={()=>setModal("apertura")} className="btn-primary mt-2">Abrir caja del día</button>
        </div>
      )}

      {/* Caja activa */}
      {cajaDia && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-4 gap-0 border-b border-slate-200 bg-white text-center">
            {[
              ["Saldo inicial",     fmtMoney(cajaDia.saldoInicial,"CRC"), "text-slate-700"],
              ["Ingresos",          fmtMoney(totalIngresos,"CRC"),         "text-yellow-700"],
              ["Egresos",           fmtMoney(totalEgresos,"CRC"),          "text-red-600"],
              [cerrada?"Saldo al cierre":"Saldo actual", fmtMoney(cerrada?(cajaDia.arqueo?.totalFisico||saldoEsperado):saldoEsperado,"CRC"), "text-slate-900 font-black"],
            ].map(([lbl,val,cls])=>(
              <div key={lbl} className="py-3 px-4 border-r border-slate-100 last:border-r-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{lbl}</p>
                <p className={`text-sm mt-0.5 ${cls}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Diferencia arqueo si cerrada */}
          {cerrada && cajaDia.arqueo && (
            <div className={`flex items-center gap-3 px-6 py-3 border-b text-sm font-semibold
              ${cajaDia.arqueo.diferencia===0?"bg-green-50 border-yellow-300 text-green-800":cajaDia.arqueo.diferencia>0?"bg-blue-50 border-blue-100 text-blue-800":"bg-red-50 border-red-100 text-red-700"}`}>
              {cajaDia.arqueo.diferencia===0?<CheckCircle size={16}/>:<AlertTriangle size={16}/>}
              Caja cerrada · Diferencia en arqueo: {cajaDia.arqueo.diferencia>=0?"+":""}{fmtMoney(cajaDia.arqueo.diferencia,"CRC")}
              <span className="ml-2 font-normal text-xs opacity-70">Cerrada {cajaDia.cierreEn ? new Date(cajaDia.cierreEn).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit"}) : ""}</span>
            </div>
          )}

          {/* Movimientos */}
          <div className="flex-1 overflow-auto">
            {cajaDia.movimientos.length===0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="font-semibold">Sin movimientos registrados</p>
                {abierta && <button onClick={()=>setModal("movimiento")} className="mt-3 btn-primary">+ Agregar movimiento</button>}
              </div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th className="text-right">Ingreso</th><th className="text-right">Egreso</th><th></th></tr>
                </thead>
                <tbody>
                  {cajaDia.movimientos.map(m=>(
                    <tr key={m.id}>
                      <td className="text-slate-400 text-xs font-mono">{m.hora}</td>
                      <td className="text-slate-700">{m.tipo}</td>
                      <td className="text-slate-500 text-xs">{m.descripcion||"—"}</td>
                      <td className="text-right font-semibold text-yellow-700">{m.esIngreso?fmtMoney(m.monto,"CRC"):""}</td>
                      <td className="text-right font-semibold text-red-600">{!m.esIngreso?fmtMoney(m.monto,"CRC"):""}</td>
                      <td>{abierta && <button onClick={()=>eliminarMovimiento(m.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modal apertura */}
      {modal==="apertura" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=>setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <h2 className="text-base font-bold text-slate-900 mb-4">Apertura de caja</h2>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Saldo inicial en efectivo (₡)</span>
              <input type="number" min="0" step="any" value={apertura} onChange={e=>setApertura(e.target.value)}
                placeholder="0" autoFocus
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"/>
            </label>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setModal(null)} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
              <button onClick={abrirCaja} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Abrir caja</button>
            </div>
          </div>
        </div>
      )}

      {modal==="movimiento" && <MovModal onClose={()=>setModal(null)} onSave={addMovimiento}/>}
      {modal==="cierre"     && <CierreModal saldoEsperado={saldoEsperado} onClose={()=>setModal(null)} onCerrar={cerrarCaja}/>}
    </div>
  );
}
