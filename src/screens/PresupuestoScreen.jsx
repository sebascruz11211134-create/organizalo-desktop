/**
 * PresupuestoScreen — Presupuesto vs Real por cuenta contable
 * Permite ingresar presupuesto mensual por cuenta, y compara vs asientos reales.
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Save, Target, TrendingUp, ListTree } from "lucide-react";
import { Modulo, Boton, BotonIcono, Pestanas, Tarjeta, Vacio, Indicadores, Indicador } from "../components/ui";
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

  const TH = "monki-tag text-monki-k/50 font-medium px-4 py-3 border-b-2 border-black/10";
  const pctTotal = totalPresupMes>0 ? totalRealMes/totalPresupMes*100 : null;
  const pastilla = pct => pct>=80 ? "bg-[#dcfce7] text-[#166534]" : pct>=50 ? "bg-monki-y text-monki-k" : "bg-red-100 text-red-700";

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Presupuesto"
      descripcion={`Lo que planeaste contra lo que pasó, por cuenta contable · ${ano}`}
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Año anterior" onClick={()=>setAno(a=>a-1)}/>
          <span className="text-sm font-black w-14 text-center">{ano}</span>
          <BotonIcono icono={ChevronRight} titulo="Año siguiente" onClick={()=>setAno(a=>a+1)}/>
        </div>
        {editado && <Boton icono={Save} onClick={guardar}>Guardar cambios</Boton>}
      </>}
      indicadores={cuentasRelevantes.length>0 && (
        <Indicadores>
          <Indicador etiqueta={`Presupuesto ${MESES[mesVista]}`} valor={fmtMoney(totalPresupMes,"CRC")} icono={Target} delay={40}/>
          <Indicador etiqueta={`Real ${MESES[mesVista]}`} valor={fmtMoney(totalRealMes,"CRC")} icono={TrendingUp} delay={90}/>
          <Indicador etiqueta="Varianza" valor={`${varianza>=0?"+":""}${fmtMoney(varianza,"CRC")}`} alerta={varianza<0} delay={140}/>
          <Indicador etiqueta="Ejecución" valor={pctTotal!=null ? `${pctTotal.toFixed(0)}%` : "—"} detalle={`${cuentasRelevantes.length} cuentas`} icono={ListTree} destacado delay={190}/>
        </Indicadores>
      )}
    >
      <Pestanas activa={mesVista} onCambiar={setMesVista} className="mb-3 overflow-x-auto" items={MESES.map((m,i)=>({ key:i, label:m }))}/>
      {cuentasRelevantes.length===0 ? (
        <Tarjeta className="flex-1 flex items-center justify-center">
          <Vacio icono={ListTree} titulo="Sin cuentas contables configuradas" texto="Andá a Contabilidad → Catálogo de cuentas y configurá tu plan."/>
        </Tarjeta>
      ) : (
        <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="ui-tabla w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className={TH+" text-left w-72"}>Cuenta</th>
                  <th className={TH+" text-right"}>Presupuesto {MESES[mesVista]}</th>
                  <th className={TH+" text-right"}>Real {MESES[mesVista]}</th>
                  <th className={TH+" text-right"}>Varianza</th>
                  <th className={TH+" text-right"}>Ejecución</th>
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
                    <tr key={c.codigo} className="border-b border-black/5 hover:bg-monki-cream/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-monki-k">{c.nombre}</p>
                        <p className="font-mono text-[10px] text-monki-k/45">{c.codigo} · {c.tipo}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" min="0" step="any"
                          value={presupuestos?.[ano]?.[c.codigo]?.[mesVista]||""}
                          onChange={e=>setPresup(c.codigo,mesVista,e.target.value)} placeholder="0"
                          className="w-32 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-2.5 py-1.5 text-sm text-right transition-colors"/>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtMoney(real,"CRC")}</td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${presp===0?"text-monki-k/30":ok?"text-monki-k":"text-red-600"}`}>
                        {presp===0?"—":`${var_>=0?"+":""}${fmtMoney(var_,"CRC")}`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {pct!==null ? <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pastilla(parseInt(pct))}`}>{pct}%</span> : <span className="text-monki-k/25">—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-monki-k text-white font-black">
                  <td className="px-4 py-3 monki-tag text-monki-y">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totalPresupMes,"CRC")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totalRealMes,"CRC")}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${varianza>=0?"text-monki-y":"text-red-300"}`}>{varianza>=0?"+":""}{fmtMoney(varianza,"CRC")}</td>
                  <td className="px-4 py-3 text-right">{pctTotal!=null && <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pastilla(pctTotal)}`}>{pctTotal.toFixed(0)}%</span>}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modulo>
  );
}
