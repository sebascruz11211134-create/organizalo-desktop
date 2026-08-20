/**
 * BalancesScreen — Libro Mayor, Balance General, Estado de Resultados
 * Calcula automáticamente desde los asientos contables registrados.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import db from "../utils/db";
import { PLAN_DEFAULT } from "../utils/planCuentas";
import { fmtMoney } from "../utils/fmt";

// ── Helpers ──────────────────────────────────────────────────────────────────
function ymHoy() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function prevMes(ym) { const [y,m]=ym.split("-").map(Number); const d=new Date(y,m-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function nextMes(ym) { const [y,m]=ym.split("-").map(Number); const d=new Date(y,m,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function mesLabel(ym) { const [y,m]=ym.split("-").map(Number); return new Date(y,m-1,1).toLocaleDateString("es-CR",{month:"long",year:"numeric"}); }

/**
 * Calcular saldo por cuenta desde asientos.
 * - Activos/Costos/Gastos: naturaleza deudora → saldo = debe − haber
 * - Pasivos/Patrimonio/Ingresos: naturaleza acreedora → saldo = haber − debe
 */
function calcSaldos(asientos, cuentas, filtroMes = null) {
  const map = {}; // codigo → { debe, haber }
  for (const a of asientos) {
    if (filtroMes && !(a.fecha||"").startsWith(filtroMes)) continue;
    for (const l of (a.lineas||[])) {
      if (!map[l.cuentaCodigo]) map[l.cuentaCodigo] = { debe:0, haber:0 };
      map[l.cuentaCodigo].debe  += parseFloat(l.debe||0);
      map[l.cuentaCodigo].haber += parseFloat(l.haber||0);
    }
  }
  // Calcular saldo por tipo de cuenta
  const resultado = {};
  for (const [cod, mov] of Object.entries(map)) {
    const cuenta = cuentas.find(c=>c.codigo===cod);
    const tipo   = cuenta?.tipo || "activo";
    let saldo;
    if (["activo","costo","gasto"].includes(tipo)) {
      saldo = mov.debe - mov.haber;
    } else {
      saldo = mov.haber - mov.debe;
    }
    resultado[cod] = { ...mov, saldo, tipo, nombre: cuenta?.nombre||cod };
  }
  return resultado;
}

// ── Libro Mayor ──────────────────────────────────────────────────────────────
function LibroMayor({ asientos, cuentas, mes }) {
  const saldos = calcSaldos(asientos, cuentas, mes);
  const detalle = cuentas.filter(c => !c.esGrupo && saldos[c.codigo]);
  const etiqs  = mesLabel(mes);

  return (
    <div className="space-y-4">
      {detalle.length === 0 ? (
        <p className="text-center text-slate-400 py-16">Sin movimientos en {etiqs}</p>
      ) : detalle.map(cuenta => {
        const s = saldos[cuenta.codigo];
        const asientosCuenta = asientos.filter(a =>
          (a.fecha||"").startsWith(mes) && a.lineas?.some(l=>l.cuentaCodigo===cuenta.codigo)
        ).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));

        return (
          <div key={cuenta.codigo} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <span className="font-mono text-xs text-slate-400">{cuenta.codigo}</span>
                <span className="ml-3 font-semibold text-slate-900">{cuenta.nombre}</span>
              </div>
              <div className="flex gap-6 text-xs text-slate-500">
                <span>Debe: <strong className="text-slate-800">{fmtMoney(s.debe,"CRC")}</strong></span>
                <span>Haber: <strong className="text-slate-800">{fmtMoney(s.haber,"CRC")}</strong></span>
                <span className="font-bold text-slate-900">Saldo: {fmtMoney(s.saldo,"CRC")}</span>
              </div>
            </div>
            <table className="table-base text-xs">
              <thead>
                <tr><th>Fecha</th><th>Asiento</th><th>Descripción</th><th className="text-right">Debe</th><th className="text-right">Haber</th></tr>
              </thead>
              <tbody>
                {asientosCuenta.map(a => {
                  const linea = a.lineas?.find(l=>l.cuentaCodigo===cuenta.codigo);
                  return (
                    <tr key={a.id}>
                      <td className="text-slate-500">{a.fecha}</td>
                      <td className="font-mono text-slate-400">{a.numero}</td>
                      <td className="text-slate-700">{a.descripcion}</td>
                      <td className="text-right">{linea?.debe>0?fmtMoney(linea.debe,"CRC"):""}</td>
                      <td className="text-right text-slate-400">{linea?.haber>0?fmtMoney(linea.haber,"CRC"):""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── Balance General ──────────────────────────────────────────────────────────
function BalanceGeneral({ asientos, cuentas, settings }) {
  // Balance usa TODOS los asientos (acumulado)
  const saldos = calcSaldos(asientos, cuentas);

  const sumarGrupo = (tipo, codigoInicia = null) => {
    return cuentas
      .filter(c => !c.esGrupo && c.tipo===tipo && (!codigoInicia || c.codigo.startsWith(codigoInicia)))
      .reduce((s,c) => s + (saldos[c.codigo]?.saldo||0), 0);
  };

  const activoCir  = sumarGrupo("activo","1.1");
  const activoFijo = sumarGrupo("activo","1.2");
  const totalActivo= activoCir + activoFijo;

  const pasivoCir  = sumarGrupo("pasivo","2.1");
  const pasivoLP   = sumarGrupo("pasivo","2.2");
  const totalPasivo= pasivoCir + pasivoLP;

  const patrimonio = sumarGrupo("patrimonio");
  const totalPasivoPat = totalPasivo + patrimonio;

  const balanceado = Math.abs(totalActivo - totalPasivoPat) < 1;
  const fecha = new Date().toLocaleDateString("es-CR");

  const Section = ({ titulo, items, total, cls="" }) => (
    <div className="mb-4">
      <p className="font-bold text-slate-700 text-sm mb-1 uppercase">{titulo}</p>
      {items.map(([lbl,val])=>(
        <div key={lbl} className="flex justify-between text-sm py-0.5">
          <span className="text-slate-600 pl-4">{lbl}</span>
          <span className="text-slate-800">{fmtMoney(val,"CRC")}</span>
        </div>
      ))}
      <div className={`flex justify-between font-bold border-t border-slate-200 mt-1 pt-1 text-sm ${cls}`}>
        <span>Total {titulo}</span>
        <span>{fmtMoney(total,"CRC")}</span>
      </div>
    </div>
  );

  const cuentasActCir  = cuentas.filter(c=>!c.esGrupo&&c.tipo==="activo"&&c.codigo.startsWith("1.1")&&saldos[c.codigo]);
  const cuentasActFijo = cuentas.filter(c=>!c.esGrupo&&c.tipo==="activo"&&c.codigo.startsWith("1.2")&&saldos[c.codigo]);
  const cuentasPasCir  = cuentas.filter(c=>!c.esGrupo&&c.tipo==="pasivo"&&c.codigo.startsWith("2.1")&&saldos[c.codigo]);
  const cuentasPasLP   = cuentas.filter(c=>!c.esGrupo&&c.tipo==="pasivo"&&c.codigo.startsWith("2.2")&&saldos[c.codigo]);
  const cuentasPat     = cuentas.filter(c=>!c.esGrupo&&c.tipo==="patrimonio"&&saldos[c.codigo]);

  return (
    <div className="grid grid-cols-2 gap-6 max-w-4xl">
      {/* ACTIVO */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-black text-slate-900 mb-4 pb-2 border-b border-slate-200">ACTIVO</h3>
        <Section titulo="Activo Circulante"
          items={cuentasActCir.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={activoCir}/>
        <Section titulo="Activo No Circulante"
          items={cuentasActFijo.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={activoFijo}/>
        <div className="flex justify-between font-black text-base border-t-2 border-slate-900 mt-2 pt-2">
          <span>TOTAL ACTIVO</span>
          <span>{fmtMoney(totalActivo,"CRC")}</span>
        </div>
      </div>

      {/* PASIVO + PATRIMONIO */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-black text-slate-900 mb-4 pb-2 border-b border-slate-200">PASIVO Y PATRIMONIO</h3>
        <Section titulo="Pasivo Circulante"
          items={cuentasPasCir.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={pasivoCir}/>
        <Section titulo="Pasivo No Circulante"
          items={cuentasPasLP.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={pasivoLP}/>
        <Section titulo="Patrimonio"
          items={cuentasPat.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={patrimonio}/>
        <div className={`flex justify-between font-black text-base border-t-2 mt-2 pt-2 ${balanceado?"border-amber-300 text-green-800":"border-red-500 text-red-700"}`}>
          <span>TOTAL PASIVO + PATRIMONIO</span>
          <span>{fmtMoney(totalPasivoPat,"CRC")}</span>
        </div>
        {!balanceado && <p className="text-xs text-red-600 mt-1">⚠ Balance no cuadra. Revisá los asientos.</p>}
      </div>
    </div>
  );
}

// ── Estado de Resultados ─────────────────────────────────────────────────────
function EstadoResultados({ asientos, cuentas, mes }) {
  const saldos = calcSaldos(asientos, cuentas, mes);

  const sumarTipo = (tipo) => cuentas
    .filter(c=>!c.esGrupo&&c.tipo===tipo)
    .reduce((s,c)=>s+(saldos[c.codigo]?.saldo||0),0);

  const ingresos  = sumarTipo("ingreso");
  const costos    = sumarTipo("costo");
  const gastos    = sumarTipo("gasto");
  const utilBruta = ingresos - costos;
  const utilNeta  = utilBruta - gastos;
  const etiqs = mesLabel(mes);

  const Row = ({ label, value, bold=false, subrow=false, color="" }) => (
    <div className={`flex justify-between py-1 text-sm ${subrow?"pl-4":""} ${bold?"font-bold":"font-normal"} border-b border-slate-50`}>
      <span className={color||"text-slate-700"}>{label}</span>
      <span className={color||"text-slate-900"}>{fmtMoney(value,"CRC")}</span>
    </div>
  );

  const cuentasIngreso = cuentas.filter(c=>!c.esGrupo&&c.tipo==="ingreso"&&saldos[c.codigo]);
  const cuentasCosto   = cuentas.filter(c=>!c.esGrupo&&c.tipo==="costo"&&saldos[c.codigo]);
  const cuentasGasto   = cuentas.filter(c=>!c.esGrupo&&c.tipo==="gasto"&&saldos[c.codigo]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl">
      <h3 className="text-base font-black text-slate-900 mb-1">Estado de Resultados</h3>
      <p className="text-xs text-slate-400 mb-4">{etiqs}</p>

      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ingresos</p>
      {cuentasIngreso.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total Ingresos" value={ingresos} bold color="text-green-800"/>

      <div className="my-3 border-t border-slate-200"/>

      <p className="text-xs font-bold text-slate-500 uppercase mb-1">(-) Costos</p>
      {cuentasCosto.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total Costos" value={costos} bold/>
      <Row label="Utilidad Bruta" value={utilBruta} bold color={utilBruta>=0?"text-blue-800":"text-red-700"}/>

      <div className="my-3 border-t border-slate-200"/>

      <p className="text-xs font-bold text-slate-500 uppercase mb-1">(-) Gastos operativos</p>
      {cuentasGasto.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total Gastos" value={gastos} bold/>

      <div className="my-2 border-t-2 border-slate-900"/>
      <div className={`flex justify-between font-black text-base py-2 ${utilNeta>=0?"text-green-800":"text-red-700"}`}>
        <span>UTILIDAD NETA</span>
        <span>{fmtMoney(utilNeta,"CRC")}</span>
      </div>
    </div>
  );
}

// ── Screen principal ─────────────────────────────────────────────────────────
const TABS = ["Libro Mayor","Balance General","Estado de Resultados"];

export default function BalancesScreen() {
  const [tab,      setTab]      = useState("Libro Mayor");
  const [asientos, setAsientos] = useState([]);
  const [cuentas,  setCuentas]  = useState([]);
  const [settings, setSettings] = useState({});
  const [mes,      setMes]      = useState(ymHoy());

  const cargar = useCallback(async () => {
    const [a,c,s] = await Promise.all([db.getAsientos(), db.getCuentasContables(), db.getSettings()]);
    setAsientos(a);
    setCuentas(c || PLAN_DEFAULT);
    setSettings(s);
  },[]);

  useEffect(()=>{ cargar(); },[cargar]);

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex gap-1">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab===t?"bg-amber-600 text-white":"text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Selector de mes (solo para Mayor y Estado de Resultados) */}
        {tab !== "Balance General" && (
          <div className="flex items-center gap-2">
            <button onClick={()=>setMes(prevMes(mes))} className="p-1.5 rounded hover:bg-slate-100 border border-slate-200">
              <ChevronLeft size={14}/>
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center capitalize">{mesLabel(mes)}</span>
            <button onClick={()=>setMes(nextMes(mes))} className="p-1.5 rounded hover:bg-slate-100 border border-slate-200">
              <ChevronRight size={14}/>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        {tab==="Libro Mayor"           && <LibroMayor    asientos={asientos} cuentas={cuentas} mes={mes}/>}
        {tab==="Balance General"       && <BalanceGeneral asientos={asientos} cuentas={cuentas} settings={settings}/>}
        {tab==="Estado de Resultados"  && <EstadoResultados asientos={asientos} cuentas={cuentas} mes={mes}/>}
      </div>
    </div>
  );
}
