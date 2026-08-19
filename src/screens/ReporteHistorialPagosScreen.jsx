/**
 * ReporteHistorialPagosScreen
 * Muestra, por cliente, cada factura y los recibos con que fue pagada.
 * Conecta: facturas ↔ debts (CXC) ↔ recibos
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, Printer, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function buildData(facturas, debts, recibos) {
  // Índice de recibos por facturaRef
  const recibosPorFactura = {};
  recibos.forEach(r => {
    const ref = r.facturaRef || extraerRef(r.concepto);
    if (!ref) return;
    if (!recibosPorFactura[ref]) recibosPorFactura[ref] = [];
    recibosPorFactura[ref].push(r);
  });

  // Índice de CXC por facturaRef
  const cxcPorFactura = {};
  debts.filter(d => d.tipo !== "pagar").forEach(d => {
    if (d.facturaRef) cxcPorFactura[d.facturaRef] = d;
  });

  // Agrupar facturas por cliente
  const porCliente = {};
  facturas.forEach(f => {
    const nombre = f.cliente?.nombre || f.clienteNombre || "Consumidor Final";
    if (!porCliente[nombre]) porCliente[nombre] = [];
    const cxc     = cxcPorFactura[f.numero];
    const pagos   = recibosPorFactura[f.numero] || [];
    const pagado  = cxc ? (cxc.pagado || 0) : (f.condPago !== "02" ? f.total : 0); // contado = pagado completo
    const saldo   = Math.max(0, (f.total || 0) - pagado);
    porCliente[nombre].push({ factura: f, cxc, pagos, pagado, saldo });
  });

  return porCliente;
}

// Extrae facturaRef de strings legacy como "Cobro CXC — Cliente (FE-00012)"
function extraerRef(concepto = "") {
  const m = concepto.match(/\(([A-Z]{2}-\d+)\)/);
  return m ? m[1] : null;
}

export default function ReporteHistorialPagosScreen() {
  const [facturas,  setFacturas]  = useState([]);
  const [debts,     setDebts]     = useState([]);
  const [recibos,   setRecibos]   = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [expanded,  setExpanded]  = useState({});
  const [desde,     setDesde]     = useState("");
  const [hasta,     setHasta]     = useState(hoy());

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [f, d, r, s] = await Promise.all([db.getFacturas(), db.getDebts(), db.getRecibos(), db.getSettings()]);
    setFacturas(f);
    setDebts(d);
    setRecibos(r);
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const moneda = settings.moneda || "CRC";

  const facFiltradas = facturas.filter(f => {
    if (desde && f.fecha < desde) return false;
    if (hasta && f.fecha > hasta) return false;
    return true;
  });

  const data = buildData(facFiltradas, debts, recibos);

  const clientes = Object.keys(data).filter(c =>
    !busq.trim() || c.toLowerCase().includes(busq.toLowerCase())
  ).sort();

  const toggle = (c) => setExpanded(p => ({ ...p, [c]: !p[c] }));

  const exportar = () => {
    const rows = [];
    clientes.forEach(cliente => {
      data[cliente].forEach(({ factura, pagos, pagado, saldo }) => {
        if (pagos.length === 0) {
          rows.push({ Cliente: cliente, Factura: factura.numero, "Fecha factura": fmtDate(factura.fecha), "Total factura": factura.total, Pagado: pagado, Saldo: saldo, "Nº Recibo": "—", "Fecha recibo": "—", "Monto recibo": "—", Método: "—" });
        } else {
          pagos.forEach(r => {
            rows.push({ Cliente: cliente, Factura: factura.numero, "Fecha factura": fmtDate(factura.fecha), "Total factura": factura.total, Pagado: pagado, Saldo: saldo, "Nº Recibo": r.numero, "Fecha recibo": fmtDate(r.fecha), "Monto recibo": r.monto, Método: r.metodo });
          });
        }
      });
    });
    exportExcel(rows, "historial-pagos");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-400 shrink-0"/>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar cliente…"
            className="bg-transparent text-sm flex-1 outline-none min-w-0"/>
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-1">
          Desde <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm"/>
        </label>
        <label className="text-xs text-slate-500 flex items-center gap-1">
          Hasta <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm"/>
        </label>
        <button onClick={exportar}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
          <FileSpreadsheet size={14}/> Excel
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-4 md:px-6 py-2 bg-green-50 border-b border-emerald-300 text-xs text-slate-500">
        <span>{clientes.length} clientes</span>
        <span>{facFiltradas.length} facturas</span>
        <span>{recibos.length} recibos</span>
      </div>

      {/* Lista por cliente */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-3">
        {clientes.length === 0 && (
          <p className="text-center text-slate-400 py-16">Sin resultados</p>
        )}
        {clientes.map(cliente => {
          const items = data[cliente];
          const totalFacturado = items.reduce((s, x) => s + (x.factura.total || 0), 0);
          const totalPagado    = items.reduce((s, x) => s + x.pagado, 0);
          const totalSaldo     = items.reduce((s, x) => s + x.saldo, 0);
          const isOpen = expanded[cliente];

          return (
            <div key={cliente} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              {/* Cabecera cliente */}
              <button onClick={() => toggle(cliente)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                {isOpen ? <ChevronDown size={15} className="text-slate-400 shrink-0"/> : <ChevronRight size={15} className="text-slate-400 shrink-0"/>}
                <span className="font-bold text-slate-800 flex-1">{cliente}</span>
                <span className="text-xs text-slate-400">{items.length} factura{items.length !== 1 ? "s" : ""}</span>
                <span className="text-xs font-semibold text-slate-600 ml-4">Facturado: {fmtMoney(totalFacturado, moneda)}</span>
                <span className="text-xs font-semibold text-emerald-700 ml-4">Cobrado: {fmtMoney(totalPagado, moneda)}</span>
                <span className={`text-xs font-bold ml-4 ${totalSaldo > 0 ? "text-red-600" : "text-emerald-700"}`}>
                  Saldo: {fmtMoney(totalSaldo, moneda)}
                </span>
              </button>

              {/* Facturas del cliente */}
              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {items.map(({ factura, pagos, pagado, saldo }) => (
                    <div key={factura.id} className="px-6 py-3">
                      {/* Factura */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{factura.numero}</span>
                        <span className="text-xs text-slate-400">{fmtDate(factura.fecha)}</span>
                        <span className="text-sm font-semibold text-slate-800">{fmtMoney(factura.total, factura.moneda || moneda)}</span>
                        <div className="flex-1"/>
                        {saldo <= 0
                          ? <span className="text-[10px] font-bold bg-green-100 text-emerald-700 px-2 py-0.5 rounded-full">Pagada</span>
                          : pagado > 0
                          ? <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Parcial — debe {fmtMoney(saldo, moneda)}</span>
                          : <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Pendiente {fmtMoney(saldo, moneda)}</span>
                        }
                      </div>
                      {/* Recibos de esa factura */}
                      {pagos.length === 0 ? (
                        <p className="text-[11px] text-slate-300 pl-2">Sin recibos de cobro registrados</p>
                      ) : (
                        <div className="pl-2 space-y-1">
                          {pagos.map(r => (
                            <div key={r.id} className="flex items-center gap-3 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"/>
                              <span className="font-mono font-semibold text-emerald-700">{r.numero}</span>
                              <span className="text-slate-400">{fmtDate(r.fecha)}</span>
                              <span className="font-semibold text-slate-700">{fmtMoney(r.monto, r.moneda || moneda)}</span>
                              <span className="text-slate-400">{r.metodo}</span>
                              {r.notas && <span className="text-slate-300 truncate max-w-[120px]">{r.notas}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
