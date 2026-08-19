import { getAutorSync } from "../utils/auth";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, Ban } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId, mesLabel } from "../utils/fmt";
import { cancelarEventoCalendario } from "../utils/clienteUtils";

/* ─── Modal unificado de recibo ──────────────────────────────────────────── */
function NuevoReciboModal({ onClose, onSave, settings, contactos = [], facturas = [], debts = [], token }) {
  const mon = settings.moneda || "CRC";

  const [cliente,    setCliente]    = useState("");
  const [busqCli,    setBusqCli]    = useState("");
  const [showCli,    setShowCli]    = useState(false);
  const [monto,      setMonto]      = useState("");
  const [moneda,     setMoneda]     = useState(mon);
  const [metodo,     setMetodo]     = useState("Transferencia");
  const [fecha,      setFecha]      = useState(hoy());
  const [concepto,   setConcepto]   = useState("");
  const [esAdelanto, setEsAdelanto] = useState(false);
  const [facturaId,  setFacturaId]  = useState("");
  const [aplicado,   setAplicado]   = useState({}); // { cxcId: monto }

  // Autocompletar contactos
  const filtCli = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli) ||
    c.codigoCliente?.toUpperCase().includes(busqCli.toUpperCase())
  ).slice(0, 6);

  // CXC pendientes del cliente seleccionado
  const cxcPendientes = debts.filter(d =>
    d.tipo !== "pagar" &&
    d.estado !== "anulada" &&
    cliente && d.nombre?.toLowerCase() === cliente.toLowerCase() &&
    Math.max(0, d.total - (d.pagado || 0)) > 0
  );

  const totalCXC = Object.values(aplicado).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const hayCXC   = cxcPendientes.length > 0;

  // Facturas del cliente seleccionado (vivas = no anuladas)
  const factSel = facturas.find(f => f.id === facturaId);
  const facturasCliente = cliente
    ? facturas.filter(f =>
        f.estado !== "anulada" &&
        (f.clienteNombre || "").toLowerCase().includes(cliente.toLowerCase())
      )
    : [];

  const seleccionarCliente = (nombre) => {
    setBusqCli(nombre); setCliente(nombre);
    setShowCli(false); setFacturaId(""); setAplicado({});
  };

  const canSave = () => {
    if (esAdelanto) return parseFloat(monto) > 0;
    if (hayCXC)     return totalCXC > 0;
    return parseFloat(monto) > 0 && !!facturaId;
  };

  const guardar = async () => {
    if (!canSave()) return;

    const todosRecibos  = await db.getRecibos();
    const num = `RC-${String(Date.now()).slice(-5)}`;

    if (!esAdelanto && hayCXC && totalCXC > 0) {
      // ── Flujo CXC: aplicar contra deudas ────────────────────────
      const lineas = cxcPendientes
        .map(d => ({ deuda: d, monto: parseFloat(aplicado[d.id]) || 0 }))
        .filter(l => l.monto > 0);

      const todosDebts   = await db.getDebts();
      const asientosAct  = await db.getAsientos();
      let updatedDebts   = [...todosDebts];
      const nuevosRecibos = [];
      let totalRecibo = 0;

      for (const { deuda, monto: m } of lineas) {
        const pago = { id: genId(), numero: num, fecha, monto: m, metodo, notas: concepto, creadoEn: new Date().toISOString(), creadoPor: getAutorSync() };
        updatedDebts = updatedDebts.map(x =>
          x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + m, pagos: [...(x.pagos || []), pago] }
        );
        nuevosRecibos.push({
          id: genId(), numero: num, fecha, monto: m, metodo,
          concepto: concepto.trim() || `Cobro CXC — ${deuda.nombre}${deuda.facturaRef ? ` (${deuda.facturaRef})` : ""}`,
          clienteNombre: deuda.nombre, notas: concepto,
          facturaRef: deuda.facturaRef || null,
          facturaNumero: deuda.facturaRef || null,
          cxcId: deuda.id,
          moneda: deuda.moneda || mon,
          esAdelanto: false,
          creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
        });
        totalRecibo += m;

        const nuevoPagado = (deuda.pagado || 0) + m;
        if (nuevoPagado >= deuda.total - 0.01 && token) {
          cancelarEventoCalendario({ token, tituloMatch: `Cobro: ${deuda.nombre}`, fecha: deuda.fechaVencimiento }).catch(() => {});
          cancelarEventoCalendario({ token, tituloMatch: `Cobro próximo: ${deuda.nombre}` }).catch(() => {});
        }
      }

      await db.setDebts(updatedDebts);
      await db.setRecibos([...nuevosRecibos, ...todosRecibos]);

      // Asiento contable
      try {
        const numAJ = `AJ-${String(asientosAct.length + 1).padStart(5, "0")}`;
        await db.setAsientos([...asientosAct, {
          id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
          descripcion: `Cobro CXC — ${cliente} (${num})`,
          fecha, totalDebe: totalRecibo, totalHaber: totalRecibo,
          lineas: [
            { cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",    debe: totalRecibo, haber: 0 },
            { cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar", debe: 0, haber: totalRecibo },
          ],
          creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
        }]);
      } catch (e) { console.warn("[Recibo] asiento:", e.message); }

    } else {
      // ── Flujo simple: adelanto o pago de factura ─────────────────
      const m = parseFloat(monto);
      const idx = todosRecibos.length;
      const numSimple = String(idx + 1).padStart(5, "0");
      const nuevo = {
        id: genId(), numero: numSimple, clienteNombre: cliente.trim(), monto: m,
        moneda, metodoPago: metodo, fecha, concepto: concepto.trim(),
        esAdelanto,
        facturaId:     esAdelanto ? null : (facturaId || null),
        facturaNumero: esAdelanto ? null : (factSel?.numero || null),
        creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
      };
      await db.setRecibos([nuevo, ...todosRecibos]);
    }

    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-700 rounded-t-2xl">
          <h3 className="text-white font-bold text-sm">Nuevo recibo</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Toggle Adelanto */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <button type="button"
              onClick={() => { setEsAdelanto(!esAdelanto); setFacturaId(""); }}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${esAdelanto ? "bg-amber-500" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${esAdelanto ? "translate-x-5" : ""}`}/>
            </button>
            <div>
              <p className="text-xs font-bold text-slate-700">{esAdelanto ? "Recibo de adelanto" : "Recibo de pago"}</p>
              <p className="text-[10px] text-slate-500">{esAdelanto ? "Pago anticipado — sin factura requerida" : "Paga contra CXC o factura existente"}</p>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
            <div className="relative">
              <input value={busqCli}
                onChange={(e) => { setBusqCli(e.target.value); setCliente(e.target.value); setShowCli(true); setFacturaId(""); setAplicado({}); }}
                onFocus={() => setShowCli(true)}
                onBlur={() => setTimeout(() => setShowCli(false), 150)}
                placeholder="Nombre o código CLI-XXXX…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              {showCli && filtCli.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-40 overflow-auto">
                  {filtCli.map((c) => (
                    <button key={c.id} type="button"
                      onMouseDown={() => seleccionarCliente(c.nombre)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b last:border-0">
                      {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 ml-2">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CXC pendientes — si hay y no es adelanto */}
          {!esAdelanto && hayCXC && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Deudas CXC pendientes — ingresar monto a cobrar
              </label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {cxcPendientes.map((d) => {
                  const saldo = d.total - (d.pagado || 0);
                  return (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0 bg-white hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{d.facturaRef || d.descripcion || "CXC"}</p>
                        <p className="text-[10px] text-slate-400">Saldo: <strong className="text-red-600">{fmtMoney(saldo, d.moneda || mon)}</strong></p>
                      </div>
                      <input
                        type="number" min="0" max={saldo} step="0.01"
                        placeholder="0"
                        value={aplicado[d.id] || ""}
                        onChange={(e) => setAplicado(p => ({ ...p, [d.id]: e.target.value }))}
                        className="w-28 border border-slate-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  );
                })}
                <div className="flex justify-end px-3 py-1.5 bg-green-50 text-xs font-bold text-green-800">
                  Total a cobrar: {fmtMoney(totalCXC, mon)}
                </div>
              </div>
            </div>
          )}

          {/* Facturas vivas del cliente — auto-desplegadas */}
          {!esAdelanto && !hayCXC && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Factura <span className="text-red-500">*</span>
                {cliente && facturasCliente.length === 0 && (
                  <span className="ml-2 font-normal text-slate-400 normal-case">— sin facturas activas para este cliente</span>
                )}
              </label>
              {!cliente ? (
                <p className="text-xs text-slate-400 italic">Seleccioná el cliente para ver sus facturas</p>
              ) : facturasCliente.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay facturas activas para aplicar</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  {facturasCliente.map((f) => {
                    const isSel = facturaId === f.id;
                    return (
                      <button key={f.id} type="button"
                        onClick={() => setFacturaId(isSel ? "" : f.id)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 border-b last:border-0 transition-colors
                          ${isSel ? "bg-green-50 border-l-4 border-emerald-300" : "bg-white hover:bg-slate-50"}`}>
                        <span className={`font-mono font-bold text-sm ${isSel ? "text-emerald-700" : "text-slate-600"}`}>#{f.numero}</span>
                        <span className="text-xs text-slate-500 flex-1 truncate">{fmtDate(f.fecha)}</span>
                        <span className={`text-xs font-bold ${isSel ? "text-emerald-700" : "text-slate-700"}`}>{fmtMoney(f.total, f.moneda)}</span>
                        {isSel && <span className="text-emerald-600 text-xs font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Monto — solo si no es modo CXC */}
          {(esAdelanto || !hayCXC) && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto *</label>
                <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
                  <option value="CRC">₡ CRC</option><option value="USD">$ USD</option>
                </select>
              </div>
            </div>
          )}

          {/* Método, Fecha, Concepto */}
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
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto / Notas</label>
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del pago"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={!canSave()}
            className="flex-1 py-2.5 bg-emerald-700 rounded-lg text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Guardar recibo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pantalla principal ─────────────────────────────────────────────────── */
export default function RecibosScreen() {
  const [recibos,   setRecibos]   = useState([]);
  const [settings,  setSettings]  = useState({});
  const [contactos, setContactos] = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [debts,     setDebts]     = useState([]);
  const [token,     setToken]     = useState(null);
  const [busq,      setBusq]      = useState("");
  const [mes,       setMes]       = useState(() => hoy().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [r, s, c, d, f] = await Promise.all([db.getRecibos(), db.getSettings(), db.getContactos(), db.getDebts(), db.getFacturas()]);
    setRecibos(r); setSettings(s); setContactos(c || []); setDebts(d || []); setFacturas(f || []);
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
    setSelected(null); cargar();
  };

  const mesesDisp = [...new Set(recibos.map((r) => (r.fecha || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const navMes = (dir) => {
    const idx = mesesDisp.indexOf(mes);
    const nx = idx + dir;
    if (nx >= 0 && nx < mesesDisp.length) setMes(mesesDisp[nx]);
  };

  const busqL = busq.trim().toLowerCase();
  const visibles = recibos.filter((r) => {
    const enMes  = (r.fecha || "").startsWith(mes);
    const match  = !busqL || (r.clienteNombre || "").toLowerCase().includes(busqL) || r.numero?.includes(busqL);
    return enMes && match;
  });

  const totCRC = visibles.filter(r => r.estado !== "anulado").reduce((s, r) => s + (r.monto || 0), 0);
  const sel = visibles.find(r => r.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13}/> Nuevo recibo
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        <button disabled={!sel || sel.estado === "anulado"} onClick={anular}
          className="flex items-center gap-1.5 border border-amber-400 text-amber-300 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Ban size={13}/> Anular
        </button>
        <button disabled={!sel} onClick={eliminar}
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

      {/* Info bar */}
      {sel ? (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs">
          <span className="text-blue-700 font-semibold">Seleccionado:</span>
          <span className="font-bold text-slate-800">#{sel.numero}</span>
          <span className="text-slate-500">{sel.clienteNombre || "Consumidor Final"}</span>
          <span className="text-slate-400">{sel.metodoPago}</span>
          <span className="font-bold text-emerald-700">{fmtMoney(sel.monto, sel.moneda || settings.moneda || "CRC")}</span>
          {sel.estado === "anulado" && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">Anulado</span>}
          <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕ Deseleccionar</button>
        </div>
      ) : (
        <div className="flex gap-4 px-4 py-1.5 bg-green-50 border-b border-emerald-300 text-xs text-slate-500">
          <span className="text-green-800 font-semibold">{visibles.length} recibo{visibles.length !== 1 ? "s" : ""}</span>
          <span className="font-black text-green-900">{fmtMoney(totCRC, settings.moneda || "CRC")}</span>
          <span className="ml-auto">clic en fila para seleccionar</span>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead><tr><th>N° Recibo</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Método</th><th>Monto</th><th>Concepto</th><th>Estado</th></tr></thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin recibos en {mesLabel(mes)}</td></tr>
            ) : visibles.map((r) => {
              const isSel     = selected === r.id;
              const esAnulado = r.estado === "anulado";
              return (
                <tr key={r.id}
                  className={`cursor-pointer transition-colors ${isSel ? "bg-blue-100 border-l-4 border-blue-500" : esAnulado ? "opacity-50 hover:bg-slate-50" : "hover:bg-slate-50"}`}
                  onClick={() => setSelected(isSel ? null : r.id)}>
                  <td className={`font-mono font-bold ${esAnulado ? "line-through text-slate-400" : "text-emerald-700"}`}>#{r.numero}</td>
                  <td><div>{fmtDate(r.fecha)}</div>{r.creadoPor && <div className="text-[10px] text-purple-600 font-medium">Por: {r.creadoPor}</div>}</td>
                  <td className={`font-medium ${esAnulado ? "line-through text-slate-400" : ""}`}>{r.clienteNombre || r.cliente || "Consumidor Final"}</td>
                  <td>
                    {r.esAdelanto
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Adelanto</span>
                      : r.cxcId
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">CXC</span>
                        : r.facturaNumero
                          ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 font-mono">Fact #{r.facturaNumero}</span>
                          : <span className="text-slate-400 text-xs">Pago</span>}
                  </td>
                  <td className="text-slate-500">{r.metodoPago || r.metodo}</td>
                  <td className={`font-bold ${esAnulado ? "line-through text-slate-400" : "text-emerald-700"}`}>{fmtMoney(r.monto, r.moneda || settings.moneda || "CRC")}</td>
                  <td className="text-slate-500 text-xs">{r.concepto || r.notas || "—"}</td>
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

      {showModal && (
        <NuevoReciboModal
          settings={settings} contactos={contactos} facturas={facturas}
          debts={debts} token={token}
          onClose={() => setShowModal(false)} onSave={cargar}
        />
      )}
    </div>
  );
}
