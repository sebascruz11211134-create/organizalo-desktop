/**
 * CXPScreen — Cuentas por Pagar (desktop)
 * Idéntico a CXCScreen pero filtra tipo === "pagar"
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, ChevronDown, ChevronUp } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";

const ESTADO = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Pagada", cls: "bg-green-100 text-green-800" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", cls: "bg-amber-100 text-amber-700" };
  return { label: "Pendiente", cls: "bg-gray-100 text-slate-600" };
};

function NuevaCXPModal({ onClose, onSave, settings }) {
  const [nombre, setNombre] = useState("");
  const [total,  setTotal]  = useState("");
  const [moneda, setMoneda] = useState(settings.moneda || "CRC");
  const [vence,  setVence]  = useState("");
  const [notas,  setNotas]  = useState("");

  const guardar = async () => {
    if (!nombre.trim() || !total) return;
    const todos = await db.getDebts();
    const nueva = {
      id: genId(), tipo: "pagar", nombre: nombre.trim(), total: parseFloat(total),
      pagado: 0, pagos: [], moneda, fechaVencimiento: vence || null,
      notas: notas.trim(), creadoEn: new Date().toISOString(),
    };
    await db.setDebts([nueva, ...todos]);
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-5">Nueva cuenta por pagar</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proveedor"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto *</label>
              <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha vencimiento</label>
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Referencia / Notas</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura del proveedor…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-semibold text-white hover:bg-red-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function CXPScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [busq,     setBusq]     = useState("");
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "pagar"));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const busqL = busq.trim().toLowerCase();
  const visibles = debts
    .filter((d) => !busqL || d.nombre?.toLowerCase().includes(busqL))
    .sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || ""));

  const totCRC = visibles.filter((d) => (d.moneda || "CRC") === "CRC").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const totUSD = visibles.filter((d) => d.moneda === "USD").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar proveedor…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={15} /> Nueva CXP
        </button>
      </div>

      {(totCRC > 0 || totUSD > 0) && (
        <div className="flex gap-4 px-6 py-2 bg-red-50 border-b border-red-100 text-sm">
          <span className="text-red-800 font-semibold">Por pagar:</span>
          {totCRC > 0 && <span className="font-black text-red-900">{fmtMoney(totCRC, "CRC")}</span>}
          {totUSD > 0 && <span className="font-black text-red-900">{fmtMoney(totUSD, "USD")}</span>}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead><tr>
            <th>Proveedor</th><th>Referencia</th><th>Total</th>
            <th>Pagado</th><th>Saldo</th><th>Vencimiento</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin cuentas por pagar</td></tr>
            ) : visibles.map((d) => {
              const mon   = d.moneda || settings.moneda || "CRC";
              const saldo = Math.max(0, d.total - (d.pagado || 0));
              const est   = ESTADO(d);
              const isExp = expanded === d.id;
              return (
                <React.Fragment key={d.id}>
                  <tr className="cursor-pointer" onClick={() => setExpanded(isExp ? null : d.id)}>
                    <td className="font-semibold">{d.nombre}</td>
                    <td className="text-slate-500 text-xs">{d.notas || "—"}</td>
                    <td>{fmtMoney(d.total, mon)}</td>
                    <td className="text-green-700">{fmtMoney(d.pagado || 0, mon)}</td>
                    <td className={`font-bold ${saldo > 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(saldo, mon)}</td>
                    <td>{fmtDate(d.fechaVencimiento)}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${est.cls}`}>{est.label}</span></td>
                    <td>{isExp ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}</td>
                  </tr>
                  {isExp && (
                    <tr><td colSpan={8} className="bg-gray-50 px-8 py-3 text-xs text-slate-500">
                      Pagos: {(d.pagos || []).map((p) => `${p.numero} ${p.fecha} ${fmtMoney(p.monto, mon)}`).join(" · ") || "Sin pagos"}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <NuevaCXPModal settings={settings} onClose={() => setShowModal(false)} onSave={cargar} />}
    </div>
  );
}
