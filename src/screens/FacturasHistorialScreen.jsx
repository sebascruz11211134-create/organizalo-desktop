/**
 * FacturasHistorialScreen — Historial de facturas emitidas (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, FileText, CheckCircle, Clock, XCircle, Trash2, Ban } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

const ESTADOS = {
  aceptada: { label: "Aceptada", cls: "bg-green-100 text-green-800", icon: CheckCircle },
  guardada: { label: "Borrador",  cls: "bg-gray-100 text-slate-600",   icon: FileText },
  pendiente: { label: "Pendiente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  rechazada: { label: "Rechazada", cls: "bg-red-100 text-red-700",    icon: XCircle },
  anulada:   { label: "Anulada",   cls: "bg-slate-100 text-slate-500", icon: Ban },
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
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [f, s] = await Promise.all([db.getFacturas(), db.getSettings()]);
    setFacturas(f.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
  }, []);

  const anular = async (f) => {
    if (!confirm(`¿Anular la factura ${f.numero}? Quedará marcada como anulada.`)) return;
    const todas = await db.getFacturas();
    await db.setFacturas(todas.map((x) => x.id === f.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  const eliminar = async (f) => {
    if (!confirm(`¿Eliminar definitivamente la factura ${f.numero}? Esta acción no se puede deshacer.`)) return;
    const todas = await db.getFacturas();
    await db.setFacturas(todas.filter((x) => x.id !== f.id));
    if (selected === f.id) setSelected(null);
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = facturas.filter((f) => {
    if (filtroEst !== "todos" && f.estado !== filtroEst) return false;
    if (busqL && !f.numero?.toLowerCase().includes(busqL) && !f.cliente?.nombre?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const totCRC = visibles.filter(f=>f.moneda==="CRC").reduce((s,f)=>s+(f.total||0),0);
  const totUSD = visibles.filter(f=>f.moneda==="USD").reduce((s,f)=>s+(f.total||0),0);
  const sel = visibles.find((f) => f.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar principal */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        {/* Anular — outline ámbar: acción reversible (la factura queda, solo se marca) */}
        <button
          disabled={!sel || sel.estado === "anulada"}
          onClick={() => sel && anular(sel)}
          className="flex items-center gap-1.5 border border-amber-400 text-amber-300 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Ban size={13} /> Anular
        </button>
        {/* Eliminar — sólido rojo: acción permanente e irreversible */}
        <button
          disabled={!sel}
          onClick={() => sel && eliminar(sel)}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Trash2 size={13} /> Eliminar
        </button>
        <div className="flex-1" />
        <select value={filtroEst} onChange={(e) => setFiltroEst(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1.5 focus:outline-none">
          <option value="todos">Todos los estados</option>
          <option value="aceptada">Aceptadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="guardada">Borradores</option>
          <option value="rechazada">Rechazadas</option>
        </select>
        <div className="flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
          <Search size={12} className="text-slate-300" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar…" className="bg-transparent text-white text-xs outline-none w-36 placeholder-slate-400" />
        </div>
      </div>

      {/* Barra de registro seleccionado */}
      {sel ? (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs">
          <span className="text-blue-700 font-semibold">Seleccionada:</span>
          <span className="font-bold text-slate-800">{sel.numero}</span>
          <span className="text-slate-500">{sel.cliente?.nombre || "Consumidor Final"}</span>
          <span className="font-bold text-green-700">{fmtMoney(sel.total, sel.moneda)}</span>
          {sel.estado === "anulada" && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">Anulada</span>}
          <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-xs">✕ Deseleccionar</button>
        </div>
      ) : (
        <div className="flex gap-4 px-4 py-1.5 bg-green-50 border-b border-green-100 text-xs text-slate-500">
          {totCRC > 0 && <span>CRC: <strong className="text-green-800">{fmtMoney(totCRC,"CRC")}</strong></span>}
          {totUSD > 0 && <span>USD: <strong className="text-green-800">{fmtMoney(totUSD,"USD")}</strong></span>}
          <span className="ml-auto">{visibles.length} factura{visibles.length!==1?"s":""} — haz clic en una fila para seleccionarla</span>
        </div>
      )}

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
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin facturas emitidas</td></tr>
            ) : visibles.map((f) => {
              const est       = ESTADOS[f.estado] || ESTADOS.pendiente;
              const isSel     = selected === f.id;
              const Icon      = est.icon;
              const esAnulada = f.estado === "anulada";
              return (
                <React.Fragment key={f.id}>
                  <tr
                    className={`cursor-pointer transition-colors ${isSel ? "bg-blue-100 border-l-4 border-blue-500" : esAnulada ? "opacity-50 hover:bg-slate-50" : "hover:bg-slate-50"}`}
                    onClick={() => setSelected(isSel ? null : f.id)}
                  >
                    <td className={`font-mono text-xs font-bold ${esAnulada ? "line-through text-slate-400" : "text-green-700"}`}>{f.numero}</td>
                    <td className="text-slate-400 text-xs">{f.tipoDoc || "01"}</td>
                    <td className="text-slate-500">{fmtDate(f.fecha)}</td>
                    <td className={`font-semibold ${esAnulada ? "line-through text-slate-400" : "text-slate-900"}`}>{f.cliente?.nombre || "—"}</td>
                    <td className="text-slate-400 text-xs font-mono">{f.cliente?.cedula || "—"}</td>
                    <td className="text-slate-500">{f.moneda}</td>
                    <td className={`font-bold ${esAnulada ? "line-through text-slate-400" : "text-green-700"}`}>{fmtMoney(f.total, f.moneda)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${est.cls}`}>
                        <Icon size={10} /> {est.label}
                      </span>
                    </td>
                  </tr>
                  {isSel && (
                    <tr><td colSpan={8} className="p-0"><DetalleFact f={f} moneda={f.moneda} /></td></tr>
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
