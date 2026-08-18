import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Printer, Trash2 } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId, mesLabel } from "../utils/fmt";

function NuevoReciboModal({ onClose, onSave, settings, contactos = [] }) {
  const [cliente, setCliente] = useState("");
  const [monto,   setMonto]   = useState("");
  const [moneda,  setMoneda]  = useState(settings.moneda || "CRC");
  const [metodo,  setMetodo]  = useState("Transferencia");
  const [fecha,   setFecha]   = useState(hoy());
  const [concepto,setConcepto]= useState("");
  const [busqCli, setBusqCli] = useState("");
  const [showCli, setShowCli] = useState(false);

  const filtCli = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli) ||
    c.codigoCliente?.toUpperCase().includes(busqCli.toUpperCase())
  ).slice(0, 6);

  const guardar = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    const todos = await db.getRecibos();
    const num   = String((todos.length || 0) + 1).padStart(5, "0");
    const nuevo = {
      id: genId(), numero: num, clienteNombre: cliente.trim(), monto: m,
      moneda, metodoPago: metodo, fecha, concepto: concepto.trim(),
      creadoEn: new Date().toISOString(),
    };
    await db.setRecibos([nuevo, ...todos]);
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-5">Nuevo recibo de caja</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
            <div className="relative">
              <input
                value={busqCli}
                onChange={(e) => { setBusqCli(e.target.value); setCliente(e.target.value); setShowCli(true); }}
                onFocus={() => setShowCli(true)}
                onBlur={() => setTimeout(() => setShowCli(false), 150)}
                placeholder="Nombre o código CLI-XXXX…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              {showCli && filtCli.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-40 overflow-auto">
                  {filtCli.map((c) => (
                    <button key={c.id} type="button"
                      onMouseDown={() => { setBusqCli(c.nombre); setCliente(c.nombre); setShowCli(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
                      {c.codigoCliente && (
                        <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>
                      )}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-2">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto *</label>
              <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
                <option value="CRC">₡ CRC</option><option value="USD">$ USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de pago</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
              {["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque","Otro"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del pago"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-green-700 rounded-lg text-sm font-semibold text-white hover:bg-green-800">Guardar recibo</button>
        </div>
      </div>
    </div>
  );
}

export default function RecibosScreen() {
  const [recibos,   setRecibos]   = useState([]);
  const [settings,  setSettings]  = useState({});
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  const [mes,       setMes]       = useState(() => hoy().slice(0, 7));
  const [showModal, setShowModal] = useState(false);

  const cargar = useCallback(async () => {
    const [r, s, c] = await Promise.all([db.getRecibos(), db.getSettings(), db.getContactos()]);
    setRecibos(r); setSettings(s); setContactos(c || []);
  }, []);

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar el recibo #${r.numero}?`)) return;
    const todos = await db.getRecibos();
    await db.setRecibos(todos.filter((x) => x.id !== r.id));
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const mesesDisp = [...new Set(recibos.map((r) => (r.fecha || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const navMes = (dir) => {
    const idx = mesesDisp.indexOf(mes);
    const nx = idx + dir;
    if (nx >= 0 && nx < mesesDisp.length) setMes(mesesDisp[nx]);
  };

  const busqL = busq.trim().toLowerCase();
  const visibles = recibos.filter((r) => {
    const enMes = (r.fecha || "").startsWith(mes);
    const match = !busqL || (r.clienteNombre || "").toLowerCase().includes(busqL) || r.numero?.includes(busqL);
    return enMes && match;
  });

  const totCRC = visibles.filter((r) => (settings.moneda || "CRC") === "CRC").reduce((s, r) => s + (r.monto || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <button onClick={() => navMes(1)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50">‹</button>
        <span className="text-sm font-semibold w-28 text-center">{mesLabel(mes)}</span>
        <button onClick={() => navMes(-1)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50">›</button>
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
          <Plus size={15} /> Nuevo recibo
        </button>
      </div>

      {visibles.length > 0 && (
        <div className="flex gap-4 px-6 py-2 bg-green-50 border-b border-green-100 text-sm">
          <span className="text-green-800 font-semibold">{visibles.length} recibos</span>
          <span className="font-black text-green-900">{fmtMoney(totCRC, settings.moneda || "CRC")}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead><tr><th>N° Recibo</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Moneda</th><th>Monto</th><th>Concepto</th><th></th></tr></thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin recibos en {mesLabel(mes)}</td></tr>
            ) : visibles.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-green-700 font-bold">#{r.numero}</td>
                <td>{fmtDate(r.fecha)}</td>
                <td className="font-medium">{r.clienteNombre || "Consumidor Final"}</td>
                <td>{r.metodoPago}</td>
                <td>{settings.moneda || "CRC"}</td>
                <td className="font-bold">{fmtMoney(r.monto, settings.moneda || "CRC")}</td>
                <td className="text-slate-500">{r.concepto || "—"}</td>
                <td>
                  <button onClick={() => eliminar(r)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NuevoReciboModal settings={settings} contactos={contactos} onClose={() => setShowModal(false)} onSave={cargar} />}
    </div>
  );
}
