/**
 * ReporteRecibosScreen — Reporte de recibos por mes (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Printer, FileSpreadsheet, Receipt, Wallet } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Selector, Tabla, Vacio, Estado, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate, mesLabel } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteRecibos, sheetsReporteRecibos } from "../utils/reportHelpers";

function ymHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const METODOS = ["Todos", "Efectivo", "SINPE Móvil", "Transferencia", "Tarjeta", "Cheque", "Otro"];

export default function ReporteRecibosScreen() {
  const [recibos,  setRecibos]  = useState([]);
  const [settings, setSettings] = useState({});
  const [mes,      setMes]      = useState(ymHoy());
  const [metodo,   setMetodo]   = useState("Todos");

  const cargar = useCallback(async () => {
    const [r, s] = await Promise.all([db.getRecibos(), db.getSettings()]);
    setRecibos(r);
    setSettings(s);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = recibos.filter((r) => {
    if (!r.fecha?.startsWith(mes)) return false;
    if (metodo !== "Todos" && r.metodo !== metodo) return false;
    return true;
  }).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const tots = {};
  visibles.forEach((r) => { tots[r.moneda] = (tots[r.moneda] || 0) + (r.monto || 0); });
  const etiq = mesLabel(mes);

  const columnas = [
    { key: "numero", titulo: "N.°", render: r => <span className="font-mono text-xs font-bold">{r.numero}</span> },
    { key: "tipo", titulo: "Tipo", render: r => <span className="text-monki-k/55 text-xs">{r.tipo || "Caja"}</span> },
    { key: "fecha", titulo: "Fecha", render: r => fmtDate(r.fecha) },
    { key: "cliente", titulo: "Cliente", render: r => <b className="text-monki-k">{r.cliente}</b> },
    { key: "metodo", titulo: "Método", render: r => <Estado>{r.metodo}</Estado> },
    { key: "moneda", titulo: "Moneda", render: r => <span className="font-mono text-xs text-monki-k/55">{r.moneda}</span> },
    { key: "monto", titulo: "Monto", alinear: "right", render: r => <b>{fmtMoney(r.monto, r.moneda)}</b> },
    { key: "concepto", titulo: "Concepto", render: r => <span className="text-monki-k/50 text-xs">{r.concepto || r.notas || "—"}</span> },
  ];
  const monedas = Object.entries(tots);

  return (
    <Modulo
      seccion="Reportes"
      titulo="Reporte de recibos"
      descripcion="Todo lo cobrado en el mes, por método de pago."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => printHTML(htmlReporteRecibos(visibles, etiq, settings))}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => exportExcel(sheetsReporteRecibos(visibles), `recibos-${mes}`)}>Excel</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Recibos" valor={visibles.length} detalle={etiq} icono={Receipt} delay={40}/>
          {monedas.length === 0
            ? <Indicador etiqueta="Cobrado" valor={fmtMoney(0, settings.moneda || "CRC")} detalle="Sin ingresos este mes" icono={Wallet} destacado delay={90}/>
            : monedas.slice(0,3).map(([m, t], i) => <Indicador key={m} etiqueta={`Cobrado ${m}`} valor={fmtMoney(t, m)} icono={Wallet} destacado={i===0} delay={90+i*50}/>)}
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} recibo${visibles.length !== 1 ? "s" : ""}`}>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={() => setMes(prevMes(mes))}/>
          <span className="text-sm font-bold min-w-[130px] text-center capitalize">{etiq}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={() => setMes(nextMes(mes))}/>
        </div>
        <Selector valor={metodo} onCambio={setMetodo} opciones={METODOS}/>
      </BarraFiltros>
      <Tabla columnas={columnas} filas={visibles}
        vacio={<Vacio icono={Receipt} titulo={`Sin recibos en ${etiq}`} texto="Cambiá de mes o de método de pago."/>}/>
    </Modulo>
  );
}
