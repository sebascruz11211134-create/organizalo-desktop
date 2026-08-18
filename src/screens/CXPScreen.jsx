/**
 * CXPScreen — Cuentas por Pagar (desktop)
 * Idéntico a CXCScreen pero filtra tipo === "pagar"
 */
import React, { useState, useEffect, useCallback } from "react";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import { Plus, Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { cancelarEventoCalendario, crearEvento } from "../utils/clienteUtils";

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

    // Crear evento en el calendario
    if (vence) {
      const { getToken } = await import("../utils/auth");
      const token = await getToken();
      const montoFmt = parseFloat(total).toLocaleString("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0 });
      await crearEvento({ token, titulo: `🧾 Pago: ${nombre.trim()}`, descripcion: `Vence por ${montoFmt}.`, fecha: vence, tipo: "recordatorio", color: "#ef4444" });
      // Recordatorio 3 días antes
      const venceD = new Date(vence);
      const antes = new Date(venceD);
      antes.setDate(antes.getDate() - 3);
      if (antes.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10)) {
        await crearEvento({ token, titulo: `⏰ Pago próximo: ${nombre.trim()}`, descripcion: `Vence en 3 días (${vence}). ${montoFmt}`, fecha: antes.toISOString().slice(0, 10), tipo: "recordatorio", color: "#f97316" });
      }
    }

    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-5">Nueva cuenta por pagar</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor *</label>
            <ClienteAutocomplete
              value={nombre}
              onChange={(c, str) => {
                setNombre(str);
                if (c && c.dias_credito > 0) {
                  const d = new Date();
                  d.setDate(d.getDate() + c.dias_credito);
                  setVence(d.toISOString().slice(0, 10));
                }
              }}
              tipo="proveedor"
              ringColor="focus:ring-red-500"
            />
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

function PagoCXPModal({ deuda, settings, token, onClose, onSave }) {
  const [monto,  setMonto]  = useState("");
  const [metodo, setMetodo] = useState("Transferencia");
  const [fecha,  setFecha]  = useState(hoy());
  const [notas,  setNotas]  = useState("");

  const saldo = Math.max(0, deuda.total - (deuda.pagado || 0));
  const mon   = deuda.moneda || settings.moneda || "CRC";

  const guardar = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    const todos = await db.getDebts();
    const pago  = { id: genId(), fecha, monto: m, metodo, notas, creadoEn: new Date().toISOString() };
    const upd   = todos.map((x) =>
      x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + m, pagos: [...(x.pagos || []), pago] }
    );
    await db.setDebts(upd);

    // Si queda saldada → eliminar eventos de calendario relacionados
    const nuevoPagado = (deuda.pagado || 0) + m;
    if (nuevoPagado >= deuda.total - 0.01 && token) {
      await cancelarEventoCalendario({ token, tituloMatch: `Pago: ${deuda.nombre}`, fecha: deuda.fechaVencimiento });
      await cancelarEventoCalendario({ token, tituloMatch: `Pago próximo: ${deuda.nombre}` });
    }

    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Registrar pago a proveedor</h3>
        <p className="text-sm text-slate-500 mb-5">{deuda.nombre} — Saldo: <strong>{fmtMoney(saldo, mon)}</strong></p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto ({mon})</label>
            <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" max={saldo}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              {["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Referencia, comprobante…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-semibold text-white hover:bg-red-700">Guardar pago</button>
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
  const [pagoModal, setPagoModal] = useState(null);
  const [token,    setToken]    = useState(null);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "pagar"));
    setSettings(s);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  const eliminar = async (d) => {
    if (!confirm(`¿Eliminar la CXP de ${d.nombre}? Esta acción no se puede deshacer.`)) return;
    const todos = await db.getDebts();
    await db.setDebts(todos.filter((x) => x.id !== d.id));
    if (token && d.fechaVencimiento) {
      await cancelarEventoCalendario({ token, tituloMatch: `Pago: ${d.nombre}`, fecha: d.fechaVencimiento });
      await cancelarEventoCalendario({ token, tituloMatch: `Pago próximo: ${d.nombre}` });
    }
    cargar();
  };

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
                    <td>
                      <div className="flex items-center gap-2">
                        {saldo > 0 && (
                          <button onClick={e => { e.stopPropagation(); setPagoModal(d); }}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg font-semibold hover:bg-red-700">
                            Pagar
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); eliminar(d); }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Eliminar CXP">
                          <Trash2 size={13} />
                        </button>
                        {isExp ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </td>
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
      {pagoModal && <PagoCXPModal deuda={pagoModal} settings={settings} token={token} onClose={() => setPagoModal(null)} onSave={cargar} />}
    </div>
  );
}
