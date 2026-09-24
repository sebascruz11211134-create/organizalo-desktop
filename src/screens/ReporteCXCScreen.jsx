/**
 * ReporteCXCScreen — Reporte completo de Cuentas por Cobrar (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet, Wallet, AlertTriangle } from "lucide-react";
import { Modulo, Boton, Tabla as TablaKit, Estado, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate, hoy } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteCXC, sheetsReporteCXC } from "../utils/reportHelpers";

const EST = (d) => {
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", tono: "exito" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", tono: "peligro" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", tono: "alerta" };
  return { label: "Pendiente", tono: "neutro" };
};

function Tabla({ cuentas, moneda }) {
  const totB = cuentas.reduce((s, d) => s + (d.total || 0), 0);
  const totP = cuentas.reduce((s, d) => s + (d.pagado || 0), 0);
  const saldo = d => Math.max(0, d.total - (d.pagado || 0));
  const columnas = [
    { key: "nombre", titulo: "Cliente", render: d => <b className="text-monki-k">{d.nombre}</b> },
    { key: "ref", titulo: "Referencia", render: d => <span className="text-monki-k/50 text-xs">{d.notas || "—"}</span> },
    { key: "total", titulo: "Total", alinear: "right", render: d => fmtMoney(d.total, moneda) },
    { key: "cobrado", titulo: "Cobrado", alinear: "right", render: d => <span className="text-monki-k/60">{fmtMoney(d.pagado || 0, moneda)}</span> },
    { key: "saldo", titulo: "Saldo", alinear: "right", render: d => <b className={saldo(d) > 0 ? "text-red-600" : ""}>{fmtMoney(saldo(d), moneda)}</b> },
    { key: "vence", titulo: "Vencimiento", render: d => <span className={d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo(d) > 0 ? "text-red-600 font-bold" : "text-monki-k/55"}>{fmtDate(d.fechaVencimiento)}</span> },
    { key: "estado", titulo: "Estado", render: d => { const e = EST(d); return <Estado tono={e.tono}>{e.label}</Estado>; } },
  ];
  return (
    <TablaKit columnas={columnas} filas={cuentas} className="!flex-none"
      vacio={<p className="text-center py-8 text-monki-k/40 text-sm">Sin cuentas en {moneda}</p>}
      pie={cuentas.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
          <span className="monki-tag text-monki-k/55 mr-auto">Total {moneda}</span>
          <span>Facturado <b>{fmtMoney(totB, moneda)}</b></span>
          <span>Cobrado <b>{fmtMoney(totP, moneda)}</b></span>
          <span className="text-red-600">Saldo <b>{fmtMoney(Math.max(0, totB - totP), moneda)}</b></span>
        </div>
      )}/>
  );
}

export default function ReporteCXCScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [filtro,   setFiltro]   = useState("todos");

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "cobrar"));
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarFiltro = (lista) => {
    if (filtro === "pendientes") return lista.filter((d) => Math.max(0, d.total - (d.pagado || 0)) > 0);
    if (filtro === "vencidas")   return lista.filter((d) => d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0);
    if (filtro === "saldadas")   return lista.filter((d) => Math.max(0, d.total - (d.pagado || 0)) <= 0);
    return lista;
  };

  const crc = aplicarFiltro(debts.filter((d) => (d.moneda || "CRC") === "CRC"));
  const usd = aplicarFiltro(debts.filter((d) => d.moneda === "USD"));

  const salCRC = crc.reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const salUSD = usd.reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);

  const vencidas = [...crc, ...usd].filter(d => d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0).length;

  return (
    <Modulo
      seccion="Reportes"
      titulo="Reporte CXC"
      descripcion="Todas las cuentas por cobrar, en colones y en dólares."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => printHTML(htmlReporteCXC(crc, usd, settings))}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => exportExcel(sheetsReporteCXC(crc, usd), "reporte-cxc")}>Excel</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Cuentas" valor={crc.length + usd.length} delay={40}/>
          <Indicador etiqueta="Saldo CRC" valor={fmtMoney(salCRC, "CRC")} icono={Wallet} destacado delay={90}/>
          <Indicador etiqueta="Saldo USD" valor={fmtMoney(salUSD, "USD")} icono={Wallet} delay={140}/>
          <Indicador etiqueta="Vencidas" valor={vencidas} icono={AlertTriangle} alerta={vencidas>0} delay={190} onClick={() => setFiltro("vencidas")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [
        { key: "todos", label: "Todos" }, { key: "pendientes", label: "Pendientes" }, { key: "vencidas", label: "Vencidas" }, { key: "saldadas", label: "Saldadas" },
      ] }}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-2">
        <p className="monki-tag text-monki-k/55">Colones (₡)</p>
        <Tabla cuentas={crc} moneda="CRC" />
        <p className="monki-tag text-monki-k/55 pt-3">Dólares ($)</p>
        <Tabla cuentas={usd} moneda="USD" />
      </div>
    </Modulo>
  );
}
