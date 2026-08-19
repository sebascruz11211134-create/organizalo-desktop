/**
 * ReporteRecibosScreen — Reporte de recibos por mes (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Printer, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, mesLabel } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteRecibos, sheetsReporteRecibos } from "../utils/reportHelpers";

function ymHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const METODOS = ["Todos", "Efectivo", "SINPE Móvil", "Transferencia", "Tarjeta", "Cheque", "Otro"];

export default function ReporteRecibosScreen() {
  const [recibos,  setRecibos]  = useState([]);
  const [settings, setSettings] = useState({});
  const [mes,      setMes]      = useState(ymHoy());
  const [metodo,   setMetodo]   = useState("Todos");

  const cargar = useCallback(async () => {
    const [r, s] = await Promise.all([db.getRecibos(), db.getSettings()]);
    setRecibos(r);
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = recibos.filter((r) => {
    if (!r.fecha?.startsWith(mes)) return false;
    if (metodo !== "Todos" && r.metodo !== metodo) return false;
    return true;
  }).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const tots = {};
  visibles.forEach((r) => { tots[r.moneda] = (tots[r.moneda] || 0) + (r.monto || 0); });
  const etiq = mesLabel(mes);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        {/* Navegador de mes */}
        <button onClick={() => setMes(prevMes(mes))} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">{etiq}</span>
        <button onClick={() => setMes(nextMes(mes))} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight size={16} className="text-slate-600" />
        </button>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
          {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="flex-1" />
        <button onClick={() => printHTML(htmlReporteRecibos(visibles, etiq, settings))}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsReporteRecibos(visibles), `recibos-${mes}`)}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>

      {/* Totales */}
      <div className="flex gap-4 px-6 py-2 bg-green-50 border-b border-emerald-300 text-sm">
        {Object.entries(tots).map(([m, t]) => (
          <span key={m} className="text-green-800 font-semibold">{m}: <strong>{fmtMoney(t, m)}</strong></span>
        ))}
        {Object.keys(tots).length === 0 && <span className="text-slate-400">Sin ingresos este mes</span>}
        <span className="ml-auto text-slate-400">{visibles.length} recibo{visibles.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>N°</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Método</th>
              <th>Moneda</th>
              <th>Monto</th>
              <th>Concepto</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin recibos en {etiq}</td></tr>
            ) : visibles.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs text-emerald-700 font-bold">{r.numero}</td>
                <td className="text-slate-500 text-xs">{r.tipo || "Caja"}</td>
                <td className="text-slate-500">{fmtDate(r.fecha)}</td>
                <td className="font-semibold text-slate-900">{r.cliente}</td>
                <td>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{r.metodo}</span>
                </td>
                <td className="text-slate-500">{r.moneda}</td>
                <td className="font-bold text-emerald-700">{fmtMoney(r.monto, r.moneda)}</td>
                <td className="text-slate-400 text-xs">{r.concepto || r.notas || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
