/**
 * PresupuestoScreen — Presupuesto vs Real por cuenta contable
 * Permite ingresar presupuesto mensual por cuenta, y compara vs asientos reales.
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Save, TrendingUp, TrendingDown } from "lucide-react";
import db from "../utils/db";
import { fmtMoney } from "../utils/fmt";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function anoActual() { return new Date().getFullYear(); }
function mesActual()  { return new Date().getMonth(); } // 0-11

// ── helpers ───────────────────────────────────────────────────────────────────
function realPorCuentaMes(asientos, codigoCuenta, ano, mes) {
  // mes: 0-11
  const prefix = codigoCuenta;
  return asientos
    .filter(a => {
      const d = new Date(a.fecha + "T12:00:00");
      return d.getFullYear()===ano && d.getMonth()===mes;
    })
    .flatMap(a => a.lineas || [])
    .filter(l => l.cuenta && l.cuenta.startsWith(prefix))
    .reduce((s,l) => {
      const tipo = l.tipoCuenta;
      const saldo = (tipo==="activo"||tipo==="costo"||tipo==="gasto")
        ? (l.debe||0) - (l.haber||0)
        : (l.haber||0) - (l.debe||0);
      return s + saldo;
    }, 0);
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PresupuestoScreen() {
  const [ano,           setAno]           = useState(anoActual());
  const [cuentas,       setCuentas]       = useState([]);
  const [asientos,      setAsientos]      = useState([]);
  const [presupuestos,  setPresupuestos]  = useState({}); // {ano: {codigoCuenta: [12 valores]}}
  const [editado,       setEditado]       = useState(false);
  const [mesVista,      setMesVista]      = useState(mesActual());

  const cargar = useCallback(async () => {
    const [c, a, p] = await Promise.all([db.getCuentasContables(), db.getAsientos(), db.getPresupuestos()]);
    setCuentas((c || []).filter(x=>!x.esGrupo));
    setAsientos(a || []);
    setPresupuestos(p || {});
  }, []);
  useEffect(()=>{ cargar(); },[cargar]);

  const getPresup = (codigo, mes) => {
    return presupuestos?.[ano]?.[codigo]?.[mes] ?? "";
  };

  const setPresup = (codigo, mes, valor) => {
    setPresupuestos(prev => {
      const n = { ...prev };
      if (!n[ano]) n[ano] = {};
      if (!n[ano][codigo]) n[ano][codigo] = Array(12).fill(0);
      n[ano][codigo][mes] = parseFloat(valor)||0;
      return n;
    });
    setEditado(true);
  };

  const guardar = async () => {
    await db.setPresupuestos(presupuestos);
    setEditado(false);
    alert("Presupuesto guardado.");
  };

  // Cuentas de ingreso, costo y gasto para la tabla
  const cuentasRelevantes = cuentas.filter(c => ["ingreso","costo","gasto"].includes(c.tipo));

  // Totales columna
  const totalPresupMes  = cuentasRelevantes.reduce((s,c)=>s+(presupuestos?.[ano]?.[c.codigo]?.[mesVista]||0),0);
  const totalRealMes    = cuentasRelevantes.reduce((s,c)=>s+realPorCuentaMes(asientos,c.codigo,ano,mesVista),0);
  const varianza        = totalRealMes - totalPresupMes;

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Presupuesto vs Real</h1>
            <p className="text-sm text-slate-500">Comparación por cuenta contable · Año {ano}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={()=>setAno(a=>a-1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={14}/></button>
              <span className="text-sm font-bold text-slate-800 w-12 text-center">{ano}</span>
              <button onClick={()=>setAno(a=>a+1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={14}/></button>
            </div>
            {editado && (
              <button onClick={guardar} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Save size={14}/> Guardar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="flex gap-1 px-8 py-3 bg-white border-b border-slate-100 overflow-x-auto">
        {MESES.map((m,i)=>(
          <button key={i} onClick={()=>setMesVista(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
              ${mesVista===i?"bg-emerald-600 text-white":"text-slate-500 hover:bg-slate-100"}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {cuentasRelevantes.length===0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="font-semibold">Sin cuentas contables configuradas</p>
            <p className="text-sm mt-1">Andá a Contabilidad → Catálogo de cuentas y configurá tu plan.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase w-64">Cuenta</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Presupuesto {MESES[mesVista]}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Real {MESES[mesVista]}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Varianza</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">% Ejec.</th>
                </tr>
              </thead>
              <tbody>
                {cuentasRelevantes.map(c=>{
                  const presp = presupuestos?.[ano]?.[c.codigo]?.[mesVista]||0;
                  const real  = realPorCuentaMes(asientos, c.codigo, ano, mesVista);
                  const var_  = real - presp;
                  const pct   = presp>0 ? (real/presp*100).toFixed(0) : null;
                  const ok    = var_ >= 0;
                  return (
                    <tr key={c.codigo} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{c.nombre}</p>
                        <p className="text-[11px] text-slate-400">{c.codigo} · {c.tipo}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number" min="0" step="any"
                          value={presupuestos?.[ano]?.[c.codigo]?.[mesVista]||""}
                          onChange={e=>setPresup(c.codigo,mesVista,e.target.value)}
                          placeholder="0"
                          className="w-28 border border-slate-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"/>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{fmtMoney(real,"CRC")}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${presp===0?"text-slate-400":ok?"text-emerald-700":"text-red-600"}`}>
                        {presp===0?"—":`${var_>=0?"+":""}${fmtMoney(var_,"CRC")}`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {pct!==null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${parseInt(pct)>=80?"bg-green-50 text-emerald-700":parseInt(pct)>=50?"bg-yellow-50 text-yellow-700":"bg-red-50 text-red-600"}`}>
                            {pct}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}

                {/* Totales */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-4 py-3 text-slate-900">TOTAL</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(totalPresupMes,"CRC")}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{fmtMoney(totalRealMes,"CRC")}</td>
                  <td className={`px-4 py-3 text-right ${varianza>=0?"text-emerald-700":"text-red-600"}`}>
                    {varianza>=0?"+":""}{fmtMoney(varianza,"CRC")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {totalPresupMes>0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(totalRealMes/totalPresupMes)>=0.8?"bg-green-50 text-emerald-700":"bg-red-50 text-red-600"}`}>
                        {(totalRealMes/totalPresupMes*100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
