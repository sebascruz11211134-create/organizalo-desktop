import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Printer, Trash2, Ban } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId, mesLabel } from "../utils/fmt";
import { ReciboCXCModal } from "./CXCScreen";

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
  const [recibos,      setRecibos]      = useState([]);
  const [settings,     setSettings]     = useState({});
  const [contactos,    setContactos]    = useState([]);
  const [debts,        setDebts]        = useState([]);
  const [token,        setToken]        = useState(null);
  const [busq,         setBusq]         = useState("");
  const [mes,          setMes]          = useState(() => hoy().slice(0, 7));
  const [showModal,    setShowModal]    = useState(false);
  const [showCXCModal, setShowCXCModal] = useState(false);
  const [selected,     setSelected]     = useState(null);

  const cargar = useCallback(async () => {
    const [r, s, c, d] = await Promise.all([db.getRecibos(), db.getSettings(), db.getContactos(), db.getDebts()]);
    setRecibos(r); setSettings(s); setContactos(c || []); setDebts(d || []);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useSyncRefresh(cargar);

  const anular = async () => {
    if (!sel) return;
    if (!confirm(`¿Anular el recibo #${sel.numero}? Quedará marcado como anulado.`)) return;
    const todos = await db.getRecibos();
    await db.setRecibos(todos.map(x => x.id === sel.id ? { ...x, estado: "anulado" } : x));
    cargar();
  };

  const eliminar = async () => {
    if (!sel) return;
    if (!confirm(`¿Eliminar definitivamente el recibo #${sel.numero}? Esta acción no se puede deshacer.`)) return;
    const todos = await db.getRecibos();
    await db.setRecibos(todos.filter(x => x.id !== sel.id));
    setSelected(null);
    cargar();
  };

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

  const totCRC = visibles.filter(r => r.estado !== "anulado").reduce((s, r) => s + (r.monto || 0), 0);
  const sel = visibles.find(r => r.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar oscuro estilo TecApro */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13}/> Nuevo recibo
        </button>
        <button onClick={() => setShowCXCModal(true)}
          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13}/> Recibo CXC
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        {/* Anular — outline ámbar: reversible */}
        <button
          disabled={!sel || sel.estado === "anulado"}
          onClick={anular}
          className="flex items-center gap-1.5 border border-amber-400 text-amber-300 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Ban size={13}/> Anular
        </button>
        {/* Eliminar — sólido rojo: permanente */}
        <button
          disabled={!sel}
          onClick={eliminar}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Trash2 size={13}/> Eliminar
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        <button onClick={() => navMes(1)} className="text-slate-300 hover:text-white px-2 py-1.5 text-xs">‹</button>
        <span className="text-slate-200 text-xs font-semibold w-24 text-center">{mesLabel(mes)}</span>
        <button onClick={() => navMes(-1)} className="text-slate-300 hover:text-white px-2 py-1.5 text-xs">›</button>
        <div className="flex-1"/>
        <div className="flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
          <Search size={12} className="text-slate-300"/>
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar…" className="bg-transparent text-white text-xs outline-none w-36 placeholder-slate-400"/>
        </div>
      </div>

      {/* Barra de registro seleccionado / totales */}
      {sel ? (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs">
          <span className="text-blue-700 font-semibold">Seleccionado:</span>
          <span className="font-bold text-slate-800">#{sel.numero}</span>
          <span className="text-slate-500">{sel.clienteNombre || "Consumidor Final"}</span>
          <span className="text-slate-400">{sel.metodoPago}</span>
          <span className="font-bold text-green-700">{fmtMoney(sel.monto, sel.moneda || settings.moneda || "CRC")}</span>
          {sel.estado === "anulado" && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">Anulado</span>}
          <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕ Deseleccionar</button>
        </div>
      ) : (
        <div className="flex gap-4 px-4 py-1.5 bg-green-50 border-b border-green-100 text-xs text-slate-500">
          <span className="text-green-800 font-semibold">{visibles.length} recibo{visibles.length !== 1 ? "s" : ""}</span>
          <span className="font-black text-green-900">{fmtMoney(totCRC, settings.moneda || "CRC")}</span>
          <span className="ml-auto">clic en fila para seleccionar</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead><tr><th>N° Recibo</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Monto</th><th>Concepto</th><th>Estado</th></tr></thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-400">Sin recibos en {mesLabel(mes)}</td></tr>
            ) : visibles.map((r) => {
              const isSel     = selected === r.id;
              const esAnulado = r.estado === "anulado";
              return (
                <tr key={r.id}
                  className={`cursor-pointer transition-colors ${isSel ? "bg-blue-100 border-l-4 border-blue-500" : esAnulado ? "opacity-50 hover:bg-slate-50" : "hover:bg-slate-50"}`}
                  onClick={() => setSelected(isSel ? null : r.id)}>
                  <td className={`font-mono font-bold ${esAnulado ? "line-through text-slate-400" : "text-green-700"}`}>#{r.numero}</td>
                  <td>{fmtDate(r.fecha)}</td>
                  <td className={`font-medium ${esAnulado ? "line-through text-slate-400" : ""}`}>{r.clienteNombre || "Consumidor Final"}</td>
                  <td className="text-slate-500">{r.metodoPago}</td>
                  <td className={`font-bold ${esAnulado ? "line-through text-slate-400" : "text-green-700"}`}>{fmtMoney(r.monto, r.moneda || settings.moneda || "CRC")}</td>
                  <td className="text-slate-500 text-xs">{r.concepto || "—"}</td>
                  <td>
                    {esAnulado
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Anulado</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Activo</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <NuevoReciboModal settings={settings} contactos={contactos} onClose={() => setShowModal(false)} onSave={cargar} />}
      {showCXCModal && (
        <ReciboCXCModal
          clienteInicial={null}
          allDebts={debts}
          settings={settings}
          token={token}
          onClose={() => setShowCXCModal(false)}
          onSave={cargar}
        />
      )}
    </div>
  );
}
