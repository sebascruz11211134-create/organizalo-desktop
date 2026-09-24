/**
 * ReporteVencidosScreen — Cobros vencidos agrupados por antigüedad (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import { Modulo, Boton, Tarjeta, Vacio, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteVencidos, sheetsReporteVencidos } from "../utils/reportHelpers";

function diasVenc(d) {
  if (!d.fechaVencimiento) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(d.fechaVencimiento)) / 86400000));
}

function grupo(dias) {
  if (dias <= 30)  return "1–30 días";
  if (dias <= 60)  return "31–60 días";
  if (dias <= 90)  return "61–90 días";
  return "Más de 90 días";
}

const GRUPOS = ["1–30 días", "31–60 días", "61–90 días", "Más de 90 días"];

export default function ReporteVencidosScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "cobrar"));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const vencidas = debts.filter((d) => {
    const saldo = Math.max(0, d.total - (d.pagado || 0));
    return saldo > 0 && d.fechaVencimiento && d.fechaVencimiento < hoy();
  });

  const grupos = GRUPOS.map((label) => ({
    label,
    cuentas: vencidas.filter((d) => grupo(diasVenc(d)) === label),
  }));

  const totalCRC = vencidas.filter(d=>(d.moneda||"CRC")==="CRC").reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);
  const totalUSD = vencidas.filter(d=>d.moneda==="USD").reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);

  const saldoDe = d => Math.max(0, d.total - (d.pagado || 0));
  const TH = "monki-tag text-monki-k/50 font-medium px-4 py-2.5 text-left whitespace-nowrap";
  const TD = "px-4 py-2.5 border-t border-black/5";

  return (
    <Modulo
      seccion="Reportes"
      titulo="Cobros vencidos"
      descripcion="Lo que te deben y ya pasó la fecha, agrupado por antigüedad."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => printHTML(htmlReporteVencidos(grupos, settings))}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => exportExcel(sheetsReporteVencidos(grupos, settings), "cobros-vencidos")}>Excel</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Cobros vencidos" valor={vencidas.length} icono={AlertTriangle} alerta={vencidas.length>0} delay={40}/>
          <Indicador etiqueta="Vencido CRC" valor={fmtMoney(totalCRC, "CRC")} destacado delay={90}/>
          <Indicador etiqueta="Vencido USD" valor={fmtMoney(totalUSD, "USD")} delay={140}/>
          <Indicador etiqueta="Más de 90 días" valor={grupos[3].cuentas.length} detalle="Los más difíciles" delay={190}/>
        </Indicadores>
      }
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-3">
        {vencidas.length === 0 ? (
          <Tarjeta className="h-full flex items-center justify-center">
            <Vacio icono={CheckCircle} titulo="¡Todo al día!" texto="No hay cobros vencidos."/>
          </Tarjeta>
        ) : grupos.filter((g) => g.cuentas.length > 0).map((g, gi) => {
          const salCRC = g.cuentas.filter(d=>(d.moneda||"CRC")==="CRC").reduce((s,d)=>s+saldoDe(d),0);
          const salUSD = g.cuentas.filter(d=>d.moneda==="USD").reduce((s,d)=>s+saldoDe(d),0);
          const grave = gi >= 2;
          return (
            <div key={g.label} style={{ animationDelay: `${gi*60}ms` }} className="animate-entrar bg-white border-2 border-black/10 rounded-[18px] overflow-hidden">
              <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${grave ? "bg-red-600 text-white" : "bg-monki-y text-monki-k"}`}>
                <span className="text-[15px] font-black">{g.label}</span>
                <span className="font-mono text-[11px] opacity-70">{g.cuentas.length} cuenta{g.cuentas.length !== 1 ? "s" : ""}</span>
                <span className="ml-auto font-black">
                  {salCRC > 0 ? fmtMoney(salCRC, "CRC") : ""}{salCRC > 0 && salUSD > 0 ? " · " : ""}{salUSD > 0 ? fmtMoney(salUSD, "USD") : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="ui-tabla w-full text-sm">
                  <thead><tr>{["Cliente","Saldo vencido","Moneda","Total original","Cobrado","Vencimiento","Días"].map(t=><th key={t} className={TH}>{t}</th>)}</tr></thead>
                  <tbody>
                    {g.cuentas.map((d) => {
                      const mon = d.moneda || settings.moneda || "CRC";
                      const dias = diasVenc(d);
                      return (
                        <tr key={d.id} className="hover:bg-monki-cream/60 transition-colors">
                          <td className={TD+" font-bold text-monki-k"}>{d.nombre}</td>
                          <td className={TD+" font-black text-red-600"}>{fmtMoney(saldoDe(d), mon)}</td>
                          <td className={TD+" font-mono text-xs text-monki-k/55"}>{mon}</td>
                          <td className={TD}>{fmtMoney(d.total, mon)}</td>
                          <td className={TD+" text-monki-k/60"}>{fmtMoney(d.pagado || 0, mon)}</td>
                          <td className={TD}>{fmtDate(d.fechaVencimiento)}</td>
                          <td className={TD}><span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${dias > 60 ? "bg-red-100 text-red-700" : "bg-monki-y text-monki-k"}`}>{dias} días</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Modulo>
  );
}
