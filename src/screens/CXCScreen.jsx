/**
 * CXCScreen — Cuentas por Cobrar (desktop)
 * Tabla con todas las CXC, modal de pago, historial de recibos.
 */
import React, { useState, useEffect, useCallback } from "react";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import { Plus, Search, ChevronDown, ChevronUp, Printer, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteCXC, sheetsReporteCXC } from "../utils/reportHelpers";
import { cancelarEventoCalendario } from "../utils/clienteUtils";

const ESTADO = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", cls: "bg-green-100 text-green-800" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", cls: "bg-amber-100 text-amber-700" };
  return { label: "Pendiente", cls: "bg-gray-100 text-slate-600" };
};

function PagoModal({ deuda, onClose, onSave, settings, token }) {
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
    const num   = `RC-${String(Date.now()).slice(-5)}`;
    const pago  = { id: genId(), numero: num, fecha, monto: m, metodo, notas, creadoEn: new Date().toISOString() };
    const upd   = todos.map((x) =>
      x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + m, pagos: [...(x.pagos || []), pago] }
    );
    await db.setDebts(upd);

    // Guardar recibo en RecibosScreen
    const recibos = await db.getRecibos();
    await db.setRecibos([{
      id: genId(), numero: num, fecha, monto: m, metodo,
      concepto: `Cobro CXC — ${deuda.nombre}${deuda.facturaRef ? ` (${deuda.facturaRef})` : ""}`,
      cliente: deuda.nombre, notas,
      creadoEn: new Date().toISOString(),
    }, ...recibos]);

    // Asiento contable de cobro: Db Caja/Efectivo / Cr CxC
    try {
      const asientos = await db.getAsientos();
      const numAJ = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
      await db.setAsientos([...asientos, {
        id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
        descripcion: `Cobro CXC — ${deuda.nombre} (${num})`,
        fecha, totalDebe: m, totalHaber: m,
        lineas: [
          { cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",       debe: m, haber: 0 },
          { cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar",    debe: 0, haber: m },
        ],
        creadoEn: new Date().toISOString(),
      }]);
    } catch (e) { console.warn("[CXC] asiento:", e.message); }

    // Si queda saldada → eliminar eventos de calendario relacionados
    const nuevoPagado = (deuda.pagado || 0) + m;
    if (nuevoPagado >= deuda.total - 0.01 && token) {
      await cancelarEventoCalendario({ token, tituloMatch: `Cobro: ${deuda.nombre}`, fecha: deuda.fechaVencimiento });
      await cancelarEventoCalendario({ token, tituloMatch: `Cobro próximo: ${deuda.nombre}` });
    }

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Registrar pago</h3>
        <p className="text-sm text-slate-500 mb-5">{deuda.nombre} — Saldo: <strong>{fmtMoney(saldo, mon)}</strong></p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto ({mon})</label>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
              placeholder="0" max={saldo}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque","Otro"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas (opcional)</label>
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Referencia, comprobante…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-green-700 rounded-lg text-sm font-semibold text-white hover:bg-green-800">Guardar pago</button>
        </div>
      </div>
    </div>
  );
}

function NuevaCXCModal({ onClose, onSave, settings }) {
  const [nombre,   setNombre]   = useState("");
  const [total,    setTotal]    = useState("");
  const [moneda,   setMoneda]   = useState(settings.moneda || "CRC");
  const [vence,    setVence]    = useState("");
  const [notas,    setNotas]    = useState("");

  const guardar = async () => {
    if (!nombre.trim() || !total) return;
    const todos = await db.getDebts();
    const nueva = {
      id: genId(), tipo: "cobrar", nombre: nombre.trim(), total: parseFloat(total),
      pagado: 0, pagos: [], moneda, fechaVencimiento: vence || null,
      notas: notas.trim(), creadoEn: new Date().toISOString(),
    };
    await db.setDebts([nueva, ...todos]);
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-5">Nueva cuenta por cobrar</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente *</label>
            <ClienteAutocomplete
              value={nombre}
              onChange={(c, str) => {
                setNombre(str);
                if (c && c.dias_credito > 0) {
                  // auto-sugerir fecha de vencimiento según plazo del cliente
                  const d = new Date();
                  d.setDate(d.getDate() + c.dias_credito);
                  setVence(d.toISOString().slice(0, 10));
                }
              }}
              tipo="cliente"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto *</label>
              <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha vencimiento</label>
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Referencia / Notas</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura, descripción…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-green-700 rounded-lg text-sm font-semibold text-white hover:bg-green-800">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function CXCScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [busq,     setBusq]     = useState("");
  const [expanded, setExpanded] = useState(null);
  const [modal,    setModal]    = useState(null);  // "nueva" | { deuda }
  const [filtro,   setFiltro]   = useState("todos"); // todos | pendientes | vencidas | saldadas
  const [token,    setToken]    = useState(null);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "cobrar"));
    setSettings(s);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const busqL = busq.trim().toLowerCase();
  const visibles = debts
    .filter((d) => {
      if (busqL && !d.nombre?.toLowerCase().includes(busqL) && !d.notas?.toLowerCase().includes(busqL)) return false;
      if (filtro === "pendientes") return Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "vencidas")  return d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "saldadas")  return Math.max(0, d.total - (d.pagado || 0)) <= 0;
      return true;
    })
    .sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || ""));

  const totCRC = visibles.filter((d) => (d.moneda || "CRC") === "CRC").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const totUSD = visibles.filter((d) => d.moneda === "USD").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar cliente…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
          <option value="todos">Todos</option>
          <option value="pendientes">Pendientes</option>
          <option value="vencidas">Vencidas</option>
          <option value="saldadas">Saldadas</option>
        </select>
        <button onClick={() => {
            const crc = debts.filter(d=>(d.tipo||"pagar")==="cobrar"&&(d.moneda||"CRC")==="CRC");
            const usd = debts.filter(d=>(d.tipo||"pagar")==="cobrar"&&d.moneda==="USD");
            printHTML(htmlReporteCXC(crc, usd, settings));
          }}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors" title="Imprimir">
          <Printer size={15} /> Imprimir
        </button>
        <button onClick={() => {
            const crc = debts.filter(d=>(d.tipo||"pagar")==="cobrar"&&(d.moneda||"CRC")==="CRC");
            const usd = debts.filter(d=>(d.tipo||"pagar")==="cobrar"&&d.moneda==="USD");
            exportExcel(sheetsReporteCXC(crc, usd), "reporte-cxc");
          }}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors" title="Exportar Excel">
          <FileSpreadsheet size={15} /> Excel
        </button>
        <button onClick={() => setModal("nueva")}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus size={15} /> Nueva CXC
        </button>
      </div>

      {/* Totales */}
      {(totCRC > 0 || totUSD > 0) && (
        <div className="flex gap-4 px-6 py-2 bg-green-50 border-b border-green-100 text-sm">
          <span className="text-green-800 font-semibold">Pendiente total:</span>
          {totCRC > 0 && <span className="font-black text-green-900">{fmtMoney(totCRC, "CRC")}</span>}
          {totUSD > 0 && <span className="font-black text-green-900">{fmtMoney(totUSD, "USD")}</span>}
          <span className="text-green-600 ml-auto">{visibles.length} cuenta{visibles.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin cuentas por cobrar</td></tr>
            ) : visibles.map((d) => {
              const mon    = d.moneda || settings.moneda || "CRC";
              const saldo  = Math.max(0, d.total - (d.pagado || 0));
              const estado = ESTADO(d);
              const isExp  = expanded === d.id;

              return (
                <React.Fragment key={d.id}>
                  <tr className="cursor-pointer" onClick={() => setExpanded(isExp ? null : d.id)}>
                    <td className="font-semibold text-slate-900">{d.nombre}</td>
                    <td className="text-slate-500 text-xs">{d.notas || "—"}</td>
                    <td>{fmtMoney(d.total, mon)}</td>
                    <td className="text-green-700">{fmtMoney(d.pagado || 0, mon)}</td>
                    <td className={`font-bold ${saldo > 0 ? "text-red-600" : "text-green-700"}`}>{fmtMoney(saldo, mon)}</td>
                    <td className={d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                      {fmtDate(d.fechaVencimiento)}
                    </td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estado.cls}`}>{estado.label}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        {saldo > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); setModal({ deuda: d }); }}
                            className="px-3 py-1 bg-green-700 text-white text-xs rounded-lg font-semibold hover:bg-green-800">
                            Pagar
                          </button>
                        )}
                        {isExp ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={8} className="bg-gray-50 px-8 py-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Recibos aplicados</p>
                        {(d.pagos || []).length === 0 ? (
                          <p className="text-xs text-slate-400">Sin pagos registrados.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-500">
                              <th className="text-left pb-1">N° Recibo</th><th className="text-left pb-1">Fecha</th>
                              <th className="text-left pb-1">Método</th><th className="text-left pb-1">Monto</th>
                              <th className="text-left pb-1">Notas</th>
                            </tr></thead>
                            <tbody>
                              {(d.pagos || []).map((p) => (
                                <tr key={p.id}>
                                  <td className="py-0.5 font-mono text-green-700">{p.numero}</td>
                                  <td className="py-0.5">{p.fecha}</td>
                                  <td className="py-0.5">{p.metodo}</td>
                                  <td className="py-0.5 font-bold">{fmtMoney(p.monto, mon)}</td>
                                  <td className="py-0.5 text-slate-400">{p.notas || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      {modal === "nueva" && <NuevaCXCModal settings={settings} onClose={() => setModal(null)} onSave={cargar} />}
      {modal?.deuda && <PagoModal deuda={modal.deuda} settings={settings} token={token} onClose={() => setModal(null)} onSave={cargar} />}
    </div>
  );
}
