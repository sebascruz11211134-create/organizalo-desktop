/**
 * FacturasHistorialScreen — Historial de facturas emitidas (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, ChevronDown, FileText, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

const ESTADOS = {
  aceptada: { label: "Aceptada", cls: "bg-green-100 text-green-800", icon: CheckCircle },
  guardada: { label: "Borrador",  cls: "bg-gray-100 text-slate-600",   icon: FileText },
  pendiente: { label: "Pendiente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  rechazada: { label: "Rechazada", cls: "bg-red-100 text-red-700",    icon: XCircle },
};

function DetalleFact({ f, moneda }) {
  return (
    <div className="bg-gray-50 px-8 py-4">
      {/* Líneas */}
      {(f.lineas || []).length > 0 && (
        <>
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Líneas de factura</p>
          <table className="w-full text-xs mb-4">
            <thead><tr className="text-slate-400">
              <th className="text-left pb-1">Descripción</th>
              <th className="text-center pb-1">Cant.</th>
              <th className="text-right pb-1">P. Unit.</th>
              <th className="text-right pb-1">IVA</th>
              <th className="text-right pb-1">Total</th>
            </tr></thead>
            <tbody>
              {f.lineas.map((l, i) => (
                <tr key={i}>
                  <td className="py-0.5">{l.descripcion}</td>
                  <td className="py-0.5 text-center">{l.cantidad} {l.unidad}</td>
                  <td className="py-0.5 text-right">{fmtMoney(l.precioUnit, moneda)}</td>
                  <td className="py-0.5 text-right text-slate-400">{l.pctIVA}%</td>
                  <td className="py-0.5 text-right font-bold text-green-700">{fmtMoney(l.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {/* Totales */}
      <div className="flex gap-6 text-xs text-slate-500">
        <span>Subtotal: <strong>{fmtMoney(f.subtotal, f.moneda)}</strong></span>
        {(f.totalDescuento || 0) > 0 && <span className="text-red-500">Desc: −{fmtMoney(f.totalDescuento, f.moneda)}</span>}
        <span>IVA: <strong>{fmtMoney(f.totalIVA, f.moneda)}</strong></span>
      </div>
      {f.notas && <p className="mt-2 text-xs text-slate-400 italic">{f.notas}</p>}
      {f.haciendaRes && (
        <p className="mt-2 text-xs text-slate-400">Hacienda: {JSON.stringify(f.haciendaRes).slice(0, 120)}</p>
      )}
    </div>
  );
}

export default function FacturasHistorialScreen() {
  const [facturas,  setFacturas]  = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const [expanded,  setExpanded]  = useState(null);

  const cargar = useCallback(async () => {
    const [f, s] = await Promise.all([db.getFacturas(), db.getSettings()]);
    setFacturas(f.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = facturas.filter((f) => {
    if (filtroEst !== "todos" && f.estado !== filtroEst) return false;
    if (busqL && !f.numero?.toLowerCase().includes(busqL) && !f.cliente?.nombre?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const totCRC = visibles.filter(f=>f.moneda==="CRC").reduce((s,f)=>s+(f.total||0),0);
  const totUSD = visibles.filter(f=>f.moneda==="USD").reduce((s,f)=>s+(f.total||0),0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar por número o cliente…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <select value={filtroEst} onChange={(e) => setFiltroEst(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
          <option value="todos">Todos los estados</option>
          <option value="aceptada">Aceptadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="guardada">Borradores</option>
          <option value="rechazada">Rechazadas</option>
        </select>
      </div>

      {/* Totales */}
      <div className="flex gap-4 px-6 py-2 bg-green-50 border-b border-green-100 text-sm">
        {totCRC > 0 && <span className="text-green-800">CRC: <strong>{fmtMoney(totCRC, "CRC")}</strong></span>}
        {totUSD > 0 && <span className="text-green-800">USD: <strong>{fmtMoney(totUSD, "USD")}</strong></span>}
        <span className="ml-auto text-slate-400">{visibles.length} factura{visibles.length !== 1 ? "s" : ""}</span>
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
              <th>Cédula</th>
              <th>Moneda</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-slate-400">Sin facturas emitidas</td></tr>
            ) : visibles.map((f) => {
              const est   = ESTADOS[f.estado] || ESTADOS.pendiente;
              const isExp = expanded === f.id;
              const Icon  = est.icon;
              return (
                <React.Fragment key={f.id}>
                  <tr className="cursor-pointer" onClick={() => setExpanded(isExp ? null : f.id)}>
                    <td className="font-mono text-xs text-green-700 font-bold">{f.numero}</td>
                    <td className="text-slate-400 text-xs">{f.tipoDoc || "01"}</td>
                    <td className="text-slate-500">{fmtDate(f.fecha)}</td>
                    <td className="font-semibold text-slate-900">{f.cliente?.nombre || "—"}</td>
                    <td className="text-slate-400 text-xs font-mono">{f.cliente?.cedula || "—"}</td>
                    <td className="text-slate-500">{f.moneda}</td>
                    <td className="font-bold text-green-700">{fmtMoney(f.total, f.moneda)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${est.cls}`}>
                        <Icon size={10} /> {est.label}
                      </span>
                    </td>
                    <td><ChevronDown size={14} className={`text-slate-400 transition-transform ${isExp ? "rotate-180" : ""}`} /></td>
                  </tr>
                  {isExp && (
                    <tr><td colSpan={9} className="p-0"><DetalleFact f={f} moneda={f.moneda} /></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
