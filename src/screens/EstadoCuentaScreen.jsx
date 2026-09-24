/**
 * EstadoCuentaScreen — Estado de cuenta por cliente (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet, ChevronDown, Users, Wallet, CheckCircle } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Selector, Tarjeta, Vacio, Estado, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { printHTML, exportExcel, htmlEstadoCuenta, sheetsEstadoCuenta } from "../utils/reportHelpers";

const EST = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", tono: "exito" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", tono: "peligro" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", tono: "alerta" };
  return { label: "Pendiente", tono: "neutro" };
};

export default function EstadoCuentaScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [clientes, setClientes] = useState([]);
  const [cliente,  setCliente]  = useState("");
  const [expanded, setExpanded] = useState(null);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    const cxc = d.filter((x) => (x.tipo || "pagar") === "cobrar");
    setDebts(cxc);
    setSettings(s);
    const uniq = [...new Set(cxc.map((x) => x.nombre).filter(Boolean))].sort();
    setClientes(uniq);
    if (uniq.length) setCliente((prev) => prev || uniq[0]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = debts.filter((d) => d.nombre === cliente);
  const mon  = filtradas[0]?.moneda || settings.moneda || "CRC";
  const totB = filtradas.reduce((s, d) => s + (d.total || 0), 0);
  const totP = filtradas.reduce((s, d) => s + (d.pagado || 0), 0);

  const TH = "monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 text-left whitespace-nowrap";
  const saldoTotal = Math.max(0, totB - totP);

  return (
    <Modulo
      seccion="Reportes"
      titulo="Estado de cuenta"
      descripcion="Todas las cuentas de un cliente, con lo cobrado y lo que falta."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => printHTML(htmlEstadoCuenta(cliente, filtradas, settings))} disabled={!cliente}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => exportExcel(sheetsEstadoCuenta(cliente, filtradas, settings), `estado-${cliente}`)} disabled={!cliente}>Excel</Boton>
      </>}
      indicadores={filtradas.length > 0 && (
        <Indicadores>
          <Indicador etiqueta="Cuentas" valor={filtradas.length} detalle={cliente} icono={Users} delay={40}/>
          <Indicador etiqueta="Facturado" valor={fmtMoney(totB, mon)} delay={90}/>
          <Indicador etiqueta="Cobrado" valor={fmtMoney(totP, mon)} icono={CheckCircle} delay={140}/>
          <Indicador etiqueta="Saldo" valor={fmtMoney(saldoTotal, mon)} icono={Wallet} destacado={saldoTotal<=0} alerta={saldoTotal>0} delay={190}/>
        </Indicadores>
      )}
    >
      <BarraFiltros>
        <span className="monki-tag text-monki-k/55">Cliente</span>
        <Selector valor={cliente} onCambio={setCliente} className="min-w-[240px]"
          opciones={clientes.length ? clientes : [{ value: "", label: "Sin clientes con CXC" }]}/>
      </BarraFiltros>
      {filtradas.length === 0 ? (
        <Tarjeta className="flex-1 flex items-center justify-center">
          <Vacio icono={Users} titulo={clientes.length === 0 ? "No hay cuentas por cobrar" : "Elegí un cliente"} texto={clientes.length === 0 ? "Cuando factures a crédito, las cuentas aparecen acá." : "Seleccioná un cliente para ver su estado de cuenta."}/>
        </Tarjeta>
      ) : (
        <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="ui-tabla w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr>{["Referencia / notas","Total","Cobrado","Saldo","Vencimiento","Estado",""].map((t,i)=><th key={i} className={TH}>{t}</th>)}</tr>
              </thead>
              <tbody>
                {filtradas.map((d) => {
                  const saldo  = Math.max(0, d.total - (d.pagado || 0));
                  const estado = EST(d);
                  const isExp  = expanded === d.id;
                  const dMon   = d.moneda || settings.moneda || "CRC";
                  return (
                    <React.Fragment key={d.id}>
                      <tr className={`cursor-pointer border-b border-black/5 transition-colors ${isExp ? "bg-[#FFF4B8]" : "hover:bg-monki-cream/60"}`} onClick={() => setExpanded(isExp ? null : d.id)}>
                        <td className="px-4 py-2.5 font-semibold text-monki-k">{d.notas || "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtMoney(d.total, dMon)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-monki-k/60">{fmtMoney(d.pagado || 0, dMon)}</td>
                        <td className={`px-4 py-2.5 font-black tabular-nums ${saldo > 0 ? "text-red-600" : ""}`}>{fmtMoney(saldo, dMon)}</td>
                        <td className={`px-4 py-2.5 ${d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-bold" : "text-monki-k/55"}`}>{fmtDate(d.fechaVencimiento)}</td>
                        <td className="px-4 py-2.5"><Estado tono={estado.tono}>{estado.label}</Estado></td>
                        <td className="px-4 py-2.5"><ChevronDown size={15} className={`text-monki-k/40 transition-transform duration-300 ${isExp ? "rotate-180" : ""}`} /></td>
                      </tr>
                      {isExp && (
                        <tr className="animate-desplegar">
                          <td colSpan={7} className="bg-monki-cream/70 px-6 py-3">
                            <p className="monki-tag text-monki-k/55 mb-2">Pagos registrados</p>
                            {(d.pagos || []).length === 0 ? <p className="text-sm text-monki-k/40">Todavía no hay pagos.</p> : (
                              <div className="space-y-1.5">
                                {(d.pagos || []).map((p) => (
                                  <div key={p.id} className="flex flex-wrap items-center gap-3 bg-white rounded-xl px-3 py-2 text-sm">
                                    <span className="font-mono font-bold text-xs">{p.numero}</span>
                                    <span className="text-monki-k/55">{p.fecha}</span>
                                    <Estado>{p.metodo}</Estado>
                                    <b className="ml-auto">{fmtMoney(p.monto, dMon)}</b>
                                    {p.notas && <span className="text-monki-k/40 text-xs w-full">{p.notas}</span>}
                                  </div>
                                ))}
                              </div>
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
        </div>
      )}
    </Modulo>
  );
}
