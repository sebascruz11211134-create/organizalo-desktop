/**
 * BalancesScreen — Libro Mayor, Balance General, Estado de Resultados
 * Calcula automáticamente desde los asientos contables registrados.
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Modulo, BotonIcono, Tarjeta, Vacio, Estado } from "../components/ui";
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
    <div className="space-y-3">
      {detalle.length === 0 ? (
        <Tarjeta><Vacio icono={BookOpen} titulo={`Sin movimientos en ${etiqs}`} texto="Cuando registres asientos, cada cuenta aparece acá con su saldo."/></Tarjeta>
      ) : detalle.map((cuenta, ci) => {
        const s = saldos[cuenta.codigo];
        const asientosCuenta = asientos.filter(a =>
          (a.fecha||"").startsWith(mes) && a.lineas?.some(l=>l.cuentaCodigo===cuenta.codigo)
        ).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));

        return (
          <div key={cuenta.codigo} style={{ animationDelay: `${Math.min(ci,10)*40}ms` }} className="animate-entrar bg-white border-2 border-black/10 rounded-[18px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b-2 border-black/10">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] bg-monki-cream px-2 py-0.5 rounded-md">{cuenta.codigo}</span>
                <span className="font-extrabold text-monki-k">{cuenta.nombre}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-monki-k/55">
                <span>Debe <b className="text-monki-k">{fmtMoney(s.debe,"CRC")}</b></span>
                <span>Haber <b className="text-monki-k">{fmtMoney(s.haber,"CRC")}</b></span>
                <span className="bg-monki-k text-monki-y rounded-full px-3 py-1 font-black">Saldo {fmtMoney(s.saldo,"CRC")}</span>
              </div>
            </div>
            <table className="ui-tabla w-full text-sm">
              <thead>
                <tr className="monki-tag text-monki-k/45">
                  <th className="text-left px-4 py-2 font-medium">Fecha</th><th className="text-left px-4 py-2 font-medium">Asiento</th><th className="text-left px-4 py-2 font-medium">Descripción</th>
                  <th className="text-right px-4 py-2 font-medium">Debe</th><th className="text-right px-4 py-2 font-medium">Haber</th>
                </tr>
              </thead>
              <tbody>
                {asientosCuenta.map(a => {
                  const linea = a.lineas?.find(l=>l.cuentaCodigo===cuenta.codigo);
                  return (
                    <tr key={a.id} className="border-t border-black/5 hover:bg-monki-cream/60 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-monki-k/55">{a.fecha}</td>
                      <td className="px-4 py-2 font-mono text-xs">{a.numero}</td>
                      <td className="px-4 py-2 text-monki-k/80">{a.descripcion}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{linea?.debe>0?fmtMoney(linea.debe,"CRC"):""}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-monki-k/55">{linea?.haber>0?fmtMoney(linea.haber,"CRC"):""}</td>
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
      <p className="monki-tag text-monki-k/50 mb-1.5">{titulo}</p>
      {items.map(([lbl,val])=>(
        <div key={lbl} className="flex justify-between text-sm py-1 border-b border-black/5">
          <span className="text-monki-k/70 pl-3">{lbl}</span>
          <span className="text-monki-k tabular-nums">{fmtMoney(val,"CRC")}</span>
        </div>
      ))}
      <div className={`flex justify-between font-extrabold mt-1.5 text-sm ${cls}`}>
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
      <div className="animate-entrar bg-white border-2 border-black/10 rounded-[18px] p-5">
        <h3 className="text-[20px] font-black tracking-[-0.03em] text-monki-k mb-4">Activo<span className="text-monki-y" style={{ WebkitTextStroke: "1px #111" }}>.</span></h3>
        <Section titulo="Activo Circulante"
          items={cuentasActCir.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={activoCir}/>
        <Section titulo="Activo No Circulante"
          items={cuentasActFijo.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={activoFijo}/>
        <div className="flex justify-between items-center font-black bg-monki-k text-monki-y rounded-2xl px-4 py-3 mt-2">
          <span className="monki-tag">Total activo</span>
          <span className="text-lg">{fmtMoney(totalActivo,"CRC")}</span>
        </div>
      </div>

      <div className="animate-entrar bg-white border-2 border-black/10 rounded-[18px] p-5" style={{ animationDelay: "80ms" }}>
        <h3 className="text-[20px] font-black tracking-[-0.03em] text-monki-k mb-4">Pasivo y patrimonio<span className="text-monki-y" style={{ WebkitTextStroke: "1px #111" }}>.</span></h3>
        <Section titulo="Pasivo Circulante"
          items={cuentasPasCir.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={pasivoCir}/>
        <Section titulo="Pasivo No Circulante"
          items={cuentasPasLP.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={pasivoLP}/>
        <Section titulo="Patrimonio"
          items={cuentasPat.map(c=>[c.nombre, saldos[c.codigo]?.saldo||0])}
          total={patrimonio}/>
        <div className={`flex justify-between items-center font-black rounded-2xl px-4 py-3 mt-2 ${balanceado?"bg-monki-k text-monki-y":"bg-red-600 text-white"}`}>
          <span className="monki-tag">Total pasivo + patrimonio</span>
          <span className="text-lg">{fmtMoney(totalPasivoPat,"CRC")}</span>
        </div>
        <div className="mt-2">{balanceado ? <Estado tono="exito">El balance cuadra</Estado> : <Estado tono="peligro">No cuadra: revisá los asientos</Estado>}</div>
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
    <div className={`flex justify-between py-1.5 text-sm ${subrow?"pl-3":""} ${bold?"font-extrabold":"font-normal"} border-b border-black/5`}>
      <span className={color||"text-monki-k/75"}>{label}</span>
      <span className={`tabular-nums ${color||"text-monki-k"}`}>{fmtMoney(value,"CRC")}</span>
    </div>
  );

  const cuentasIngreso = cuentas.filter(c=>!c.esGrupo&&c.tipo==="ingreso"&&saldos[c.codigo]);
  const cuentasCosto   = cuentas.filter(c=>!c.esGrupo&&c.tipo==="costo"&&saldos[c.codigo]);
  const cuentasGasto   = cuentas.filter(c=>!c.esGrupo&&c.tipo==="gasto"&&saldos[c.codigo]);

  return (
    <div className="animate-entrar bg-white border-2 border-black/10 rounded-[18px] p-5 max-w-xl">
      <h3 className="text-[20px] font-black tracking-[-0.03em] text-monki-k">Estado de resultados<span className="text-monki-y" style={{ WebkitTextStroke: "1px #111" }}>.</span></h3>
      <p className="font-mono text-[11px] text-monki-k/45 mb-4 capitalize">{etiqs}</p>

      <p className="monki-tag text-monki-k/50 mb-1">Ingresos</p>
      {cuentasIngreso.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total ingresos" value={ingresos} bold/>

      <p className="monki-tag text-monki-k/50 mb-1 mt-4">(−) Costos</p>
      {cuentasCosto.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total costos" value={costos} bold/>
      <div className="flex justify-between items-center bg-monki-y rounded-xl px-3 py-2 mt-2 text-sm font-black"><span>Utilidad bruta</span><span className={utilBruta>=0?"":"text-red-700"}>{fmtMoney(utilBruta,"CRC")}</span></div>

      <p className="monki-tag text-monki-k/50 mb-1 mt-4">(−) Gastos operativos</p>
      {cuentasGasto.map(c=><Row key={c.codigo} label={c.nombre} value={saldos[c.codigo]?.saldo||0} subrow/>)}
      <Row label="Total gastos" value={gastos} bold/>

      <div className={`flex justify-between items-center rounded-2xl px-4 py-3 mt-4 font-black ${utilNeta>=0?"bg-monki-k text-monki-y":"bg-red-600 text-white"}`}>
        <span className="monki-tag">Utilidad neta</span>
        <span className="text-xl">{fmtMoney(utilNeta,"CRC")}</span>
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
    <Modulo
      seccion="Contabilidad"
      titulo="Mayor y balances"
      descripcion="Libro mayor, balance general y estado de resultados, calculados desde los asientos."
      acciones={tab !== "Balance General" && (
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={()=>setMes(prevMes(mes))}/>
          <span className="text-sm font-bold min-w-[140px] text-center capitalize">{mesLabel(mes)}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={()=>setMes(nextMes(mes))}/>
        </div>
      )}
      pestanas={{ activa: tab, onCambiar: setTab, items: TABS.map(t => ({ key: t, label: t })) }}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        {tab==="Libro Mayor"           && <LibroMayor    asientos={asientos} cuentas={cuentas} mes={mes}/>}
        {tab==="Balance General"       && <BalanceGeneral asientos={asientos} cuentas={cuentas} settings={settings}/>}
        {tab==="Estado de Resultados"  && <EstadoResultados asientos={asientos} cuentas={cuentas} mes={mes}/>}
      </div>
    </Modulo>
  );
}
