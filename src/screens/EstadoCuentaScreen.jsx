/**
 * EstadoCuentaScreen — Estado de cuenta por cliente (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, Printer, FileSpreadsheet, ChevronDown } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { printHTML, exportExcel, htmlEstadoCuenta, sheetsEstadoCuenta } from "../utils/reportHelpers";

const EST = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", cls: "bg-green-100 text-green-800" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", cls: "bg-amber-100 text-amber-700" };
  return { label: "Pendiente", cls: "bg-gray-100 text-slate-600" };
};

export default function EstadoCuentaScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [clientes, setClientes] = useState([]);
  const [cliente,  setCliente]  = useState("");
  const [expanded, setExpanded] = useState(null);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    const cxc = d.filter((x) => (x.tipo || "pagar") === "cobrar");
    setDebts(cxc);
    setSettings(s);
    const uniq = [...new Set(cxc.map((x) => x.nombre).filter(Boolean))].sort();
    setClientes(uniq);
    if (uniq.length) setCliente((prev) => prev || uniq[0]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = debts.filter((d) => d.nombre === cliente);
  const mon  = filtradas[0]?.moneda || settings.moneda || "CRC";
  const totB = filtradas.reduce((s, d) => s + (d.total || 0), 0);
  const totP = filtradas.reduce((s, d) => s + (d.pagado || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <Search size={14} className="text-slate-400 shrink-0" />
        <select value={cliente} onChange={(e) => setCliente(e.target.value)}
          className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
          {clientes.length === 0 && <option value="">Sin clientes con CXC</option>}
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => printHTML(htmlEstadoCuenta(cliente, filtradas, settings))}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsEstadoCuenta(cliente, filtradas, settings), `estado-${cliente}`)}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>

      {/* Resumen */}
      {filtradas.length > 0 && (
        <div className="flex gap-6 px-6 py-2 bg-green-50 border-b border-emerald-300 text-sm">
          <span className="text-slate-500">Total: <strong>{fmtMoney(totB, mon)}</strong></span>
          <span className="text-emerald-700">Cobrado: <strong>{fmtMoney(totP, mon)}</strong></span>
          <span className={`font-bold ${totB - totP > 0 ? "text-red-600" : "text-emerald-700"}`}>
            Saldo: {fmtMoney(Math.max(0, totB - totP), mon)}
          </span>
          <span className="ml-auto text-slate-400">{filtradas.length} cuenta{filtradas.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            {clientes.length === 0 ? "No hay cuentas por cobrar." : "Seleccione un cliente."}
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Referencia / Notas</th>
                <th>Total</th>
                <th>Cobrado</th>
                <th>Saldo</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => {
                const saldo  = Math.max(0, d.total - (d.pagado || 0));
                const estado = EST(d);
                const isExp  = expanded === d.id;
                const dMon   = d.moneda || settings.moneda || "CRC";
                return (
                  <React.Fragment key={d.id}>
                    <tr className="cursor-pointer" onClick={() => setExpanded(isExp ? null : d.id)}>
                      <td className="text-slate-700">{d.notas || "—"}</td>
                      <td>{fmtMoney(d.total, dMon)}</td>
                      <td className="text-emerald-700">{fmtMoney(d.pagado || 0, dMon)}</td>
                      <td className={`font-bold ${saldo > 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(saldo, dMon)}</td>
                      <td className={d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                        {fmtDate(d.fechaVencimiento)}
                      </td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estado.cls}`}>{estado.label}</span></td>
                      <td><ChevronDown size={14} className={`text-slate-400 transition-transform ${isExp ? "rotate-180" : ""}`} /></td>
                    </tr>
                    {isExp && (d.pagos || []).length > 0 && (
                      <tr>
                        <td colSpan={7} className="bg-green-50 px-8 py-3">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Pagos registrados</p>
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-500">
                              <th className="text-left pb-1">N° Recibo</th>
                              <th className="text-left pb-1">Fecha</th>
                              <th className="text-left pb-1">Método</th>
                              <th className="text-left pb-1">Monto</th>
                              <th className="text-left pb-1">Notas</th>
                            </tr></thead>
                            <tbody>
                              {(d.pagos || []).map((p) => (
                                <tr key={p.id}>
                                  <td className="py-0.5 font-mono text-emerald-700">{p.numero}</td>
                                  <td className="py-0.5">{p.fecha}</td>
                                  <td className="py-0.5">{p.metodo}</td>
                                  <td className="py-0.5 font-bold">{fmtMoney(p.monto, dMon)}</td>
                                  <td className="py-0.5 text-slate-400">{p.notas || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
