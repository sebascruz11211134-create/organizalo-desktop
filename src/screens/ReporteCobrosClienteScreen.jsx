/**
 * ReporteCobrosClienteScreen
 * Estado de cuenta por cliente: cuánto debe, cuánto pagó, facturas pendientes/pagadas.
 * Conecta: facturas ↔ debts (CXC) para calcular saldos reales.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

/**
 * Devuelve la estructura:
 * { [clienteNombre]: { facturas: [...], totalFacturado, totalPagado, totalSaldo } }
 *
 * Lógica:
 * - Cada factura puede tener una CXC asociada (facturaRef === factura.numero)
 * - Si tiene CXC: pagado = cxc.pagado
 * - Si no tiene CXC y condPago es al contado (≠ "02"): pagado = factura.total
 * - Si no tiene CXC y condPago es crédito ("02"): pagado = 0
 */
function buildResumen(facturas, debts) {
  // Índice CXC por facturaRef
  const cxcMap = {};
  debts.filter(d => d.tipo !== "pagar").forEach(d => {
    if (d.facturaRef) cxcMap[d.facturaRef] = d;
  });

  const porCliente = {};
  facturas.forEach(f => {
    const nombre  = f.cliente?.nombre || f.clienteNombre || "Consumidor Final";
    const cxc     = cxcMap[f.numero];
    const pagado  = cxc
      ? (cxc.pagado  || 0)
      : (f.condPago !== "02" ? (f.total || 0) : 0);
    const saldo   = Math.max(0, (f.total || 0) - pagado);
    const estado  = saldo <= 0 ? "pagada" : pagado > 0 ? "parcial" : "pendiente";
    const vence   = cxc?.fechaVencimiento || f.fechaVencimiento || null;
    const vencida = vence && vence < hoy() && estado !== "pagada";

    if (!porCliente[nombre]) {
      porCliente[nombre] = { facturas: [], totalFacturado: 0, totalPagado: 0, totalSaldo: 0 };
    }
    porCliente[nombre].facturas.push({ ...f, cxc, pagado, saldo, estado, vence, vencida });
    porCliente[nombre].totalFacturado += f.total || 0;
    porCliente[nombre].totalPagado    += pagado;
    porCliente[nombre].totalSaldo     += saldo;
  });

  return porCliente;
}

const ESTADO_BADGE = {
  pagada:    "bg-green-100 text-yellow-700",
  parcial:   "bg-yellow-100 text-yellow-700",
  pendiente: "bg-red-100 text-red-700",
};
const ESTADO_LABEL = { pagada: "Pagada", parcial: "Parcial", pendiente: "Pendiente" };

export default function ReporteCobrosClienteScreen() {
  const [facturas,  setFacturas]  = useState([]);
  const [debts,     setDebts]     = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [filtro,    setFiltro]    = useState("todos"); // todos | pendientes | pagadas | vencidas
  const [expanded,  setExpanded]  = useState({});
  const [desde,     setDesde]     = useState("");
  const [hasta,     setHasta]     = useState(hoy());

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [f, d, s] = await Promise.all([db.getFacturas(), db.getDebts(), db.getSettings()]);
    setFacturas(f);
    setDebts(d);
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const moneda = settings.moneda || "CRC";

  // Filtrar facturas por fecha
  const facFiltradas = facturas.filter(f => {
    if (desde && f.fecha < desde) return false;
    if (hasta && f.fecha > hasta) return false;
    return true;
  });

  const resumen = buildResumen(facFiltradas, debts);

  // Filtrar y ordenar clientes
  const clientes = Object.keys(resumen)
    .filter(c => !busq.trim() || c.toLowerCase().includes(busq.toLowerCase()))
    .filter(c => {
      if (filtro === "pendientes") return resumen[c].totalSaldo > 0;
      if (filtro === "pagadas")    return resumen[c].totalSaldo <= 0;
      if (filtro === "vencidas")   return resumen[c].facturas.some(f => f.vencida);
      return true;
    })
    .sort((a, b) => resumen[b].totalSaldo - resumen[a].totalSaldo); // mayor deuda primero

  const toggle = (c) => setExpanded(p => ({ ...p, [c]: !p[c] }));

  // Totales globales
  const totalGlobalSaldo = clientes.reduce((s, c) => s + resumen[c].totalSaldo, 0);

  const exportar = () => {
    const rows = [];
    clientes.forEach(cliente => {
      resumen[cliente].facturas.forEach(f => {
        rows.push({
          Cliente: cliente,
          Factura: f.numero,
          Fecha: fmtDate(f.fecha),
          Vencimiento: f.vence ? fmtDate(f.vence) : "—",
          Vencida: f.vencida ? "Sí" : "No",
          Total: f.total,
          Pagado: f.pagado,
          Saldo: f.saldo,
          Estado: ESTADO_LABEL[f.estado],
        });
      });
    });
    exportExcel(rows, "cobros-por-cliente");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-400 shrink-0"/>
          <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar cliente…"
            className="bg-transparent text-sm flex-1 outline-none min-w-0"/>
        </div>

        {/* Filtro rápido */}
        <div className="flex gap-1">
          {[
            { id: "todos",      label: "Todos" },
            { id: "pendientes", label: "Pendientes" },
            { id: "vencidas",   label: "Vencidas" },
            { id: "pagadas",    label: "Pagadas" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setFiltro(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === id
                  ? "bg-yellow-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <label className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
          Desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm"/>
        </label>
        <label className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
          Hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm"/>
        </label>
        <button onClick={exportar}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 shrink-0">
          <FileSpreadsheet size={14}/> Excel
        </button>
      </div>

      {/* Resumen global */}
      <div className="flex gap-6 px-4 md:px-6 py-2 bg-red-50 border-b border-red-100">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Clientes</p>
          <p className="text-sm font-bold text-slate-700">{clientes.length}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total por cobrar</p>
          <p className="text-sm font-bold text-red-700">{fmtMoney(totalGlobalSaldo, moneda)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Facturas vencidas</p>
          <p className="text-sm font-bold text-orange-600">
            {clientes.reduce((s, c) => s + resumen[c].facturas.filter(f => f.vencida).length, 0)}
          </p>
        </div>
      </div>

      {/* Lista por cliente */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-3">
        {clientes.length === 0 && (
          <p className="text-center text-slate-400 py-16">Sin resultados</p>
        )}

        {clientes.map(cliente => {
          const res    = resumen[cliente];
          const isOpen = expanded[cliente];
          const tieneVencidas = res.facturas.some(f => f.vencida);

          return (
            <div key={cliente} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              {/* Cabecera cliente */}
              <button onClick={() => toggle(cliente)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                {isOpen
                  ? <ChevronDown  size={15} className="text-slate-400 shrink-0"/>
                  : <ChevronRight size={15} className="text-slate-400 shrink-0"/>}

                <span className="font-bold text-slate-800 flex-1 min-w-0 truncate">{cliente}</span>

                {tieneVencidas && (
                  <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">
                    Vencida
                  </span>
                )}

                <span className="text-xs text-slate-400 shrink-0">{res.facturas.length} fact.</span>

                <span className="text-xs font-semibold text-slate-600 ml-3 shrink-0">
                  Fact: {fmtMoney(res.totalFacturado, moneda)}
                </span>
                <span className="text-xs font-semibold text-yellow-700 ml-3 shrink-0">
                  Cobrado: {fmtMoney(res.totalPagado, moneda)}
                </span>
                <span className={`text-xs font-bold ml-3 shrink-0 ${res.totalSaldo > 0 ? "text-red-600" : "text-yellow-700"}`}>
                  Saldo: {fmtMoney(res.totalSaldo, moneda)}
                </span>
              </button>

              {/* Tabla de facturas */}
              {isOpen && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wide">
                        <th className="px-4 py-2 text-left font-medium">Factura</th>
                        <th className="px-3 py-2 text-left font-medium">Fecha</th>
                        <th className="px-3 py-2 text-left font-medium">Vencimiento</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Pagado</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo</th>
                        <th className="px-4 py-2 text-center font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {res.facturas.map(f => (
                        <tr key={f.id} className={f.vencida ? "bg-orange-50" : ""}>
                          <td className="px-4 py-2 font-mono font-bold text-slate-700">{f.numero}</td>
                          <td className="px-3 py-2 text-slate-400">{fmtDate(f.fecha)}</td>
                          <td className={`px-3 py-2 ${f.vencida ? "text-orange-600 font-semibold" : "text-slate-400"}`}>
                            {f.vence ? fmtDate(f.vence) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">
                            {fmtMoney(f.total, f.moneda || moneda)}
                          </td>
                          <td className="px-3 py-2 text-right text-yellow-700">
                            {fmtMoney(f.pagado, f.moneda || moneda)}
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${f.saldo > 0 ? "text-red-600" : "text-yellow-700"}`}>
                            {fmtMoney(f.saldo, f.moneda || moneda)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_BADGE[f.estado]}`}>
                              {ESTADO_LABEL[f.estado]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                        <td colSpan={3} className="px-4 py-2 text-xs text-slate-500">Subtotal</td>
                        <td className="px-3 py-2 text-right text-xs">{fmtMoney(res.totalFacturado, moneda)}</td>
                        <td className="px-3 py-2 text-right text-xs text-yellow-700">{fmtMoney(res.totalPagado, moneda)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${res.totalSaldo > 0 ? "text-red-600" : "text-yellow-700"}`}>
                          {fmtMoney(res.totalSaldo, moneda)}
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
