/**
 * ReporteVencidosScreen — Cobros vencidos agrupados por antigüedad (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet, AlertTriangle } from "lucide-react";
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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <AlertTriangle size={16} className="text-red-500" />
        <span className="text-sm font-semibold text-slate-700 flex-1">{vencidas.length} cobro{vencidas.length !== 1 ? "s" : ""} vencido{vencidas.length !== 1 ? "s" : ""}</span>
        <button onClick={() => printHTML(htmlReporteVencidos(grupos, settings))}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsReporteVencidos(grupos, settings), "cobros-vencidos")}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>

      {/* Resumen */}
      <div className="flex gap-6 px-6 py-2 bg-red-50 border-b border-red-100 text-sm">
        {totalCRC > 0 && <span className="text-red-800">CRC: <strong className="font-black">{fmtMoney(totalCRC, "CRC")}</strong></span>}
        {totalUSD > 0 && <span className="text-red-800">USD: <strong className="font-black">{fmtMoney(totalUSD, "USD")}</strong></span>}
        {vencidas.length === 0 && <span className="text-yellow-700 font-semibold">✓ Sin cobros vencidos</span>}
      </div>

      {/* Grupos */}
      <div className="flex-1 overflow-auto">
        {vencidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-yellow-600">
            <span className="text-4xl mb-3">✓</span>
            <p className="text-lg font-bold">¡Todo al día!</p>
            <p className="text-sm text-slate-400 mt-1">No hay cobros vencidos.</p>
          </div>
        ) : grupos.filter((g) => g.cuentas.length > 0).map((g) => {
          const salCRC = g.cuentas.filter(d=>(d.moneda||"CRC")==="CRC").reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);
          const salUSD = g.cuentas.filter(d=>d.moneda==="USD").reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);
          return (
            <div key={g.label} className="mb-2">
              <div className="flex items-center gap-3 px-6 py-2 bg-red-50 border-b border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase">{g.label}</span>
                <span className="text-xs text-red-500">{g.cuentas.length} cuenta{g.cuentas.length !== 1 ? "s" : ""}</span>
                <span className="ml-auto text-xs font-bold text-red-700">
                  {salCRC > 0 ? fmtMoney(salCRC, "CRC") : ""}
                  {salCRC > 0 && salUSD > 0 ? " · " : ""}
                  {salUSD > 0 ? fmtMoney(salUSD, "USD") : ""}
                </span>
              </div>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Saldo vencido</th>
                    <th>Moneda</th>
                    <th>Total original</th>
                    <th>Cobrado</th>
                    <th>Vencimiento</th>
                    <th>Días vencido</th>
                  </tr>
                </thead>
                <tbody>
                  {g.cuentas.map((d) => {
                    const mon   = d.moneda || settings.moneda || "CRC";
                    const saldo = Math.max(0, d.total - (d.pagado || 0));
                    const dias  = diasVenc(d);
                    return (
                      <tr key={d.id}>
                        <td className="font-semibold text-slate-900">{d.nombre}</td>
                        <td className="font-bold text-red-600">{fmtMoney(saldo, mon)}</td>
                        <td className="text-slate-500">{mon}</td>
                        <td>{fmtMoney(d.total, mon)}</td>
                        <td className="text-yellow-700">{fmtMoney(d.pagado || 0, mon)}</td>
                        <td className="text-red-600 font-semibold">{fmtDate(d.fechaVencimiento)}</td>
                        <td className={`font-bold ${dias > 90 ? "text-red-700" : dias > 60 ? "text-red-600" : "text-yellow-600"}`}>
                          {dias} días
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
