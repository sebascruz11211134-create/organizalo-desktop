/**
 * AsientosScreen — Diario de asientos contables (partida doble)
 * Cada asiento: fecha + descripción + N líneas (cuenta, debe, haber)
 * Validación: suma(debe) === suma(haber)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, ChevronDown, ChevronRight, Printer } from "lucide-react";
import db from "../utils/db";
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{esNuevo?"Nuevo asiento contable":"Editar asiento"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>

        {/* Header del asiento */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Fecha *</span>
            <input type="date" value={form.fecha} onChange={e=>u("fecha",e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase">Referencia</span>
            <input value={form.referencia} onChange={e=>u("referencia",e.target.value)}
              placeholder="Ej: Fact-00123, Cheque 001"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
          </label>
          <label className="block col-span-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">Descripción *</span>
            <input value={form.descripcion} onChange={e=>u("descripcion",e.target.value)}
              placeholder="Registro de venta, pago de planilla…"
              className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"/>
          </label>
        </div>

        {/* Líneas */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-0 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase px-4 py-2 border-b border-slate-200">
            <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span><span></span>
          </div>
          {form.lineas.map((l,i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-3 py-2 border-b border-slate-100 last:border-b-0 items-center">
              <select value={l.cuentaCodigo} onChange={e=>selCuenta(i,e.target.value)}
                className="border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400">
                <option value="">— Seleccionar cuenta —</option>
                {detalleCuentas.map(c=>(
                  <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                ))}
              </select>
              <input type="number" min="0" step="any" value={l.debe||""} onChange={e=>updLinea(i,"debe",e.target.value)}
                placeholder="0" className="border border-slate-200 rounded-md px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"/>
              <input type="number" min="0" step="any" value={l.haber||""} onChange={e=>updLinea(i,"haber",e.target.value)}
                placeholder="0" className="border border-slate-200 rounded-md px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"/>
              <button onClick={()=>delLinea(i)} disabled={form.lineas.length<=2} className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-20">
                <X size={14}/>
              </button>
            </div>
          ))}
          {/* Totales */}
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-3 py-2.5 bg-slate-50 border-t-2 border-slate-200 items-center">
            <span className="text-xs font-bold text-slate-700">TOTALES</span>
            <span className={`text-xs font-bold text-right ${balanceado?"text-green-700":"text-red-600"}`}>
              {fmtMoney(totalDebe,"CRC")}
            </span>
            <span className={`text-xs font-bold text-right ${balanceado?"text-green-700":"text-red-600"}`}>
              {fmtMoney(totalHaber,"CRC")}
            </span>
            <span className="text-xs">{balanceado?"✓":""}</span>
          </div>
        </div>

        {!balanceado && (
          <p className="text-xs text-red-600 mt-2">
            ⚠ Diferencia: {fmtMoney(Math.abs(totalDebe-totalHaber),"CRC")} — el asiento debe balancear (Debe = Haber).
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <button onClick={addLinea} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            + Agregar línea
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="border border-gray-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
            <button onClick={guardar} disabled={!balanceado}
              className="bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
              Guardar asiento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fila expandible ──────────────────────────────────────────────────────────
function AsientoRow({ a, onEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <td className="font-mono text-xs text-slate-500">{a.numero}</td>
        <td className="text-slate-500">{fmtDate(a.fecha)}</td>
        <td className="font-semibold text-slate-900">{a.descripcion}</td>
        <td className="text-slate-400 text-xs">{a.referencia||"—"}</td>
        <td className="text-right font-semibold">{fmtMoney(a.totalDebe,"CRC")}</td>
        <td className="text-right text-slate-400">{fmtMoney(a.totalHaber,"CRC")}</td>
        <td>
          <button onClick={e=>{e.stopPropagation();onEdit(a)}} className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-700">
            <ChevronRight size={13}/>
          </button>
        </td>
      </tr>
      {open && a.lineas?.map((l,i)=>(
        <tr key={i} className="bg-slate-50 text-xs">
          <td></td>
          <td></td>
          <td className="text-slate-600 pl-6">{l.cuentaCodigo} — {l.cuentaNombre}</td>
          <td></td>
          <td className="text-right font-mono">{l.debe>0?fmtMoney(l.debe,"CRC"):""}</td>
          <td className="text-right font-mono text-slate-400">{l.haber>0?fmtMoney(l.haber,"CRC"):""}</td>
          <td></td>
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

  const cargar = useCallback(async () => {
    const [a, c] = await Promise.all([db.getAsientos(), db.getCuentasContables()]);
    setAsientos(a.sort((x,y)=>(y.fecha||"").localeCompare(x.fecha||"")));
    setCuentas(c || PLAN_DEFAULT);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = asientos.filter(a =>
    !busqL || a.descripcion?.toLowerCase().includes(busqL) ||
    a.numero?.toLowerCase().includes(busqL) || a.referencia?.toLowerCase().includes(busqL)
  );

  const totDebe  = visibles.reduce((s,a)=>s+a.totalDebe,0);
  const totHaber = visibles.reduce((s,a)=>s+a.totalHaber,0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)}
            placeholder="Buscar asiento…" className="bg-transparent text-sm flex-1 outline-none"/>
        </div>
        <button onClick={()=>setModal({})}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
          <Plus size={14}/> Nuevo asiento
        </button>
      </div>

      {/* Totales */}
      <div className="flex gap-6 px-6 py-2 bg-slate-50 border-b border-slate-200 text-sm">
        <span className="text-slate-500">{visibles.length} asientos</span>
        <span className="text-slate-700">Total debe: <strong>{fmtMoney(totDebe,"CRC")}</strong></span>
        <span className="text-slate-700">Total haber: <strong>{fmtMoney(totHaber,"CRC")}</strong></span>
        {Math.abs(totDebe-totHaber)<0.01 && visibles.length>0 &&
          <span className="text-green-600 font-semibold">✓ Balanceado</span>}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>N°</th><th>Fecha</th><th>Descripción</th><th>Referencia</th>
              <th className="text-right">Debe</th><th className="text-right">Haber</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length===0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-400">Sin asientos contables</td></tr>
            ) : visibles.map(a=>(
              <AsientoRow key={a.id} a={a} onEdit={setModal}/>
            ))}
          </tbody>
        </table>
      </div>

      {modal!==null && (
        <AsientoModal asiento={Object.keys(modal).length>0?modal:null} cuentas={cuentas}
          onClose={()=>setModal(null)} onSave={cargar}/>
      )}
    </div>
  );
}
