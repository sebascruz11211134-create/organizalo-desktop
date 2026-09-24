/**
 * ReporteHistorialPagosScreen
 * Muestra, por cliente, cada factura y los recibos con que fue pagada.
 * Conecta: facturas ↔ debts (CXC) ↔ recibos
 */
import React, { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, ChevronDown, ChevronRight, History, Users, FileText, Receipt } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Tarjeta, Vacio, Estado, Indicadores, Indicador, Entrada } from "../components/ui";
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
    <Modulo
      seccion="Reportes"
      titulo="Historial de pagos"
      descripcion="Por cliente: cada factura y los recibos con que se pagó."
      acciones={<Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Clientes" valor={clientes.length} icono={Users} delay={40}/>
          <Indicador etiqueta="Facturas" valor={facFiltradas.length} detalle="En el rango" icono={FileText} delay={90}/>
          <Indicador etiqueta="Recibos" valor={recibos.length} icono={Receipt} delay={140}/>
          <Indicador etiqueta="Saldo pendiente" valor={fmtMoney(clientes.reduce((t,c)=>t+data[c].reduce((s,x)=>s+x.saldo,0),0), moneda)} destacado delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar cliente…"/>
        <label className="flex items-center gap-2 monki-tag text-monki-k/55">Desde <Entrada type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="!w-auto !py-1.5"/></label>
        <label className="flex items-center gap-2 monki-tag text-monki-k/55">Hasta <Entrada type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="!w-auto !py-1.5"/></label>
      </BarraFiltros>

      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-2">
        {clientes.length === 0 && (
          <Tarjeta className="h-full flex items-center justify-center"><Vacio icono={History} titulo="Sin resultados" texto="Probá con otro cliente o rango de fechas."/></Tarjeta>
        )}
        {clientes.map((cliente, ci) => {
          const items = data[cliente];
          const totalFacturado = items.reduce((s, x) => s + (x.factura.total || 0), 0);
          const totalPagado    = items.reduce((s, x) => s + x.pagado, 0);
          const totalSaldo     = items.reduce((s, x) => s + x.saldo, 0);
          const isOpen = expanded[cliente];
          return (
            <div key={cliente} style={{ animationDelay: `${Math.min(ci,10)*35}ms` }}
              className={`animate-entrar border-2 rounded-[18px] bg-white overflow-hidden transition-all duration-300 ease-monki ${isOpen ? "border-monki-k shadow-[5px_5px_0_#111]" : "border-black/10 hover:border-black/25"}`}>
              <button type="button" onClick={() => toggle(cliente)} className="ui-boton w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-monki-k text-monki-y" : "bg-monki-y text-monki-k"}`}>
                  {isOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </span>
                <span className="font-extrabold text-monki-k flex-1 min-w-[140px]">{cliente}</span>
                <span className="font-mono text-[11px] text-monki-k/45">{items.length} factura{items.length !== 1 ? "s" : ""}</span>
                <span className="text-xs text-monki-k/55">Facturado <b className="text-monki-k">{fmtMoney(totalFacturado, moneda)}</b></span>
                <span className="text-xs text-monki-k/55">Cobrado <b className="text-monki-k">{fmtMoney(totalPagado, moneda)}</b></span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${totalSaldo > 0 ? "bg-red-100 text-red-700" : "bg-[#dcfce7] text-[#166534]"}`}>Saldo {fmtMoney(totalSaldo, moneda)}</span>
              </button>
              {isOpen && (
                <div className="animate-desplegar border-t-2 border-black/5">
                  {items.map(({ factura, pagos, pagado, saldo }) => (
                    <div key={factura.id} className="px-5 py-3 border-b border-black/5 last:border-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="font-mono text-xs font-bold bg-monki-cream px-2 py-0.5 rounded-md">{factura.numero}</span>
                        <span className="text-xs text-monki-k/45">{fmtDate(factura.fecha)}</span>
                        <b className="text-sm">{fmtMoney(factura.total, factura.moneda || moneda)}</b>
                        <div className="flex-1"/>
                        {saldo <= 0 ? <Estado tono="exito">Pagada</Estado>
                          : pagado > 0 ? <Estado tono="alerta">Parcial — debe {fmtMoney(saldo, moneda)}</Estado>
                          : <Estado tono="peligro">Pendiente {fmtMoney(saldo, moneda)}</Estado>}
                      </div>
                      {pagos.length === 0 ? (
                        <p className="text-xs text-monki-k/35 pl-2">Sin recibos de cobro registrados</p>
                      ) : (
                        <div className="pl-2 space-y-1">
                          {pagos.map(r => (
                            <div key={r.id} className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-monki-k shrink-0"/>
                              <span className="font-mono font-bold">{r.numero}</span>
                              <span className="text-monki-k/45">{fmtDate(r.fecha)}</span>
                              <b>{fmtMoney(r.monto, r.moneda || moneda)}</b>
                              <span className="text-monki-k/45">{r.metodo}</span>
                              {r.notas && <span className="text-monki-k/35 truncate max-w-[160px]">{r.notas}</span>}
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
    </Modulo>
  );
}
