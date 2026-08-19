/**
 * ReporteCXCScreen — Reporte completo de Cuentas por Cobrar (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteCXC, sheetsReporteCXC } from "../utils/reportHelpers";

const EST = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", cls: "bg-green-100 text-green-800" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", cls: "bg-amber-100 text-amber-700" };
  return { label: "Pendiente", cls: "bg-gray-100 text-slate-600" };
};

function Tabla({ cuentas, moneda }) {
  const totB = cuentas.reduce((s, d) => s + (d.total || 0), 0);
  const totP = cuentas.reduce((s, d) => s + (d.pagado || 0), 0);
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Referencia</th>
          <th>Total</th>
          <th>Cobrado</th>
          <th>Saldo</th>
          <th>Vencimiento</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {cuentas.length === 0 ? (
          <tr><td colSpan={7} className="text-center py-8 text-slate-400">Sin cuentas en {moneda}</td></tr>
        ) : cuentas.map((d) => {
          const saldo  = Math.max(0, d.total - (d.pagado || 0));
          const estado = EST(d);
          return (
            <tr key={d.id}>
              <td className="font-semibold text-slate-900">{d.nombre}</td>
              <td className="text-slate-400 text-xs">{d.notas || "—"}</td>
              <td>{fmtMoney(d.total, moneda)}</td>
              <td className="text-emerald-700">{fmtMoney(d.pagado || 0, moneda)}</td>
              <td className={`font-bold ${saldo > 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(saldo, moneda)}</td>
              <td className={d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                {fmtDate(d.fechaVencimiento)}
              </td>
              <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estado.cls}`}>{estado.label}</span></td>
            </tr>
          );
        })}
        {cuentas.length > 0 && (
          <tr className="bg-green-50 font-bold text-green-900 border-t-2 border-emerald-300">
            <td colSpan={2} className="text-emerald-700">TOTAL {moneda}</td>
            <td>{fmtMoney(totB, moneda)}</td>
            <td className="text-emerald-700">{fmtMoney(totP, moneda)}</td>
            <td className="text-red-600">{fmtMoney(Math.max(0, totB - totP), moneda)}</td>
            <td colSpan={2}></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function ReporteCXCScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [filtro,   setFiltro]   = useState("todos");

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "cobrar"));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarFiltro = (lista) => {
    if (filtro === "pendientes") return lista.filter((d) => Math.max(0, d.total - (d.pagado || 0)) > 0);
    if (filtro === "vencidas")   return lista.filter((d) => d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0);
    if (filtro === "saldadas")   return lista.filter((d) => Math.max(0, d.total - (d.pagado || 0)) <= 0);
    return lista;
  };

  const crc = aplicarFiltro(debts.filter((d) => (d.moneda || "CRC") === "CRC"));
  const usd = aplicarFiltro(debts.filter((d) => d.moneda === "USD"));

  const salCRC = crc.reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const salUSD = usd.reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
          <option value="todos">Todos los estados</option>
          <option value="pendientes">Pendientes</option>
          <option value="vencidas">Vencidas</option>
          <option value="saldadas">Saldadas</option>
        </select>
        <span className="flex-1" />
        <button onClick={() => printHTML(htmlReporteCXC(crc, usd, settings))}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsReporteCXC(crc, usd), "reporte-cxc")}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>

      {/* Resumen */}
      <div className="flex gap-6 px-6 py-2 bg-green-50 border-b border-emerald-300 text-sm">
        <span className="text-slate-500">Saldo CRC: <strong className={salCRC > 0 ? "text-red-600" : "text-emerald-700"}>{fmtMoney(salCRC, "CRC")}</strong></span>
        <span className="text-slate-500">Saldo USD: <strong className={salUSD > 0 ? "text-red-600" : "text-emerald-700"}>{fmtMoney(salUSD, "USD")}</strong></span>
        <span className="ml-auto text-slate-400">{crc.length + usd.length} cuentas</span>
      </div>

      {/* Tablas */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Colones (₡)</p>
        </div>
        <Tabla cuentas={crc} moneda="CRC" />
        <div className="px-6 pt-6 pb-2">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Dólares ($)</p>
        </div>
        <Tabla cuentas={usd} moneda="USD" />
      </div>
    </div>
  );
}
