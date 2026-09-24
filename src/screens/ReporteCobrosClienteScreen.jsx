/**
 * ReporteCobrosClienteScreen
 * Estado de cuenta por cliente: cuánto debe, cuánto pagó, facturas pendientes/pagadas.
 * Conecta: facturas ↔ debts (CXC) para calcular saldos reales.
 */
import React, { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, ChevronDown, ChevronRight, Users, Wallet, AlertTriangle } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Tarjeta, Vacio, Estado, Indicadores, Indicador, Entrada } from "../components/ui";
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
  pagada:    "exito",
  parcial:   "alerta",
  pendiente: "peligro",
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

  const nVencidas = clientes.reduce((s, c) => s + resumen[c].facturas.filter(f => f.vencida).length, 0);
  const TH = "monki-tag text-monki-k/50 font-medium px-4 py-2.5";

  return (
    <Modulo
      seccion="Reportes"
      titulo="Cobros por cliente"
      descripcion="Cuánto te debe cada cliente, ordenado de mayor a menor deuda."
      acciones={<Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Clientes" valor={clientes.length} icono={Users} delay={40}/>
          <Indicador etiqueta="Por cobrar" valor={fmtMoney(totalGlobalSaldo, moneda)} icono={Wallet} destacado delay={90} onClick={()=>setFiltro("pendientes")}/>
          <Indicador etiqueta="Facturas vencidas" valor={nVencidas} icono={AlertTriangle} alerta={nVencidas>0} delay={140} onClick={()=>setFiltro("vencidas")}/>
          <Indicador etiqueta="Al día" valor={Object.keys(resumen).filter(c=>resumen[c].totalSaldo<=0).length} detalle="Clientes sin saldo" delay={190} onClick={()=>setFiltro("pagadas")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [
        { key: "todos", label: "Todos" }, { key: "pendientes", label: "Pendientes" }, { key: "vencidas", label: "Vencidas" }, { key: "pagadas", label: "Pagadas" },
      ] }}
    >
      <BarraFiltros>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar cliente…"/>
        <label className="flex items-center gap-2 monki-tag text-monki-k/55">Desde <Entrada type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="!w-auto !py-1.5"/></label>
        <label className="flex items-center gap-2 monki-tag text-monki-k/55">Hasta <Entrada type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="!w-auto !py-1.5"/></label>
      </BarraFiltros>

      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-2">
        {clientes.length === 0 && (
          <Tarjeta className="h-full flex items-center justify-center"><Vacio icono={Users} titulo="Sin resultados" texto="Probá con otro filtro o rango de fechas."/></Tarjeta>
        )}
        {clientes.map((cliente, ci) => {
          const res    = resumen[cliente];
          const isOpen = expanded[cliente];
          const tieneVencidas = res.facturas.some(f => f.vencida);
          return (
            <div key={cliente} style={{ animationDelay: `${Math.min(ci,10)*35}ms` }}
              className={`animate-entrar border-2 rounded-[18px] bg-white overflow-hidden transition-all duration-300 ease-monki ${isOpen ? "border-monki-k shadow-[5px_5px_0_#111]" : "border-black/10 hover:border-black/25"}`}>
              <button type="button" onClick={() => toggle(cliente)} className="ui-boton w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-monki-k text-monki-y" : "bg-monki-y text-monki-k"}`}>
                  {isOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </span>
                <span className="font-extrabold text-monki-k flex-1 min-w-[140px] truncate">{cliente}</span>
                {tieneVencidas && <Estado tono="peligro">Vencida</Estado>}
                <span className="font-mono text-[11px] text-monki-k/45">{res.facturas.length} fact.</span>
                <span className="text-xs text-monki-k/55">Facturado <b className="text-monki-k">{fmtMoney(res.totalFacturado, moneda)}</b></span>
                <span className="text-xs text-monki-k/55">Cobrado <b className="text-monki-k">{fmtMoney(res.totalPagado, moneda)}</b></span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${res.totalSaldo > 0 ? "bg-red-100 text-red-700" : "bg-[#dcfce7] text-[#166534]"}`}>Saldo {fmtMoney(res.totalSaldo, moneda)}</span>
              </button>
              {isOpen && (
                <div className="animate-desplegar border-t-2 border-black/5 overflow-x-auto">
                  <table className="ui-tabla w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH+" text-left"}>Factura</th><th className={TH+" text-left"}>Fecha</th><th className={TH+" text-left"}>Vencimiento</th>
                        <th className={TH+" text-right"}>Total</th><th className={TH+" text-right"}>Pagado</th><th className={TH+" text-right"}>Saldo</th><th className={TH+" text-center"}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.facturas.map(f => (
                        <tr key={f.id} className={`border-t border-black/5 ${f.vencida ? "bg-red-50" : "hover:bg-monki-cream/60"}`}>
                          <td className="px-4 py-2 font-mono text-xs font-bold">{f.numero}</td>
                          <td className="px-4 py-2 text-monki-k/55">{fmtDate(f.fecha)}</td>
                          <td className={`px-4 py-2 ${f.vencida ? "text-red-600 font-bold" : "text-monki-k/55"}`}>{f.vence ? fmtDate(f.vence) : "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMoney(f.total, f.moneda || moneda)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-monki-k/60">{fmtMoney(f.pagado, f.moneda || moneda)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-black ${f.saldo > 0 ? "text-red-600" : ""}`}>{fmtMoney(f.saldo, f.moneda || moneda)}</td>
                          <td className="px-4 py-2 text-center"><Estado tono={ESTADO_BADGE[f.estado]}>{ESTADO_LABEL[f.estado]}</Estado></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-monki-k text-white font-black">
                        <td colSpan={3} className="px-4 py-2.5 monki-tag text-monki-y">Subtotal</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(res.totalFacturado, moneda)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(res.totalPagado, moneda)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-monki-y">{fmtMoney(res.totalSaldo, moneda)}</td>
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
    </Modulo>
  );
}
