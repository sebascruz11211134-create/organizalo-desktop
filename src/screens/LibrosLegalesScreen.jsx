/**
 * LibrosLegalesScreen — Libros contables requeridos por Hacienda CR
 * Tabs: Libro de Ventas | Libro de Compras | Libro Diario | Libro Mayor
 */
import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, Printer, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

const TABS = ["Libro de Ventas", "Libro de Compras", "Libro Diario", "Libro Mayor"];

// ── Helpers de período ─────────────────────────────────────────────────────────
function primerDia(mes) { return mes + "-01"; }
function ultimoDia(mes) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}
function mesActual() { return new Date().toISOString().slice(0, 7); }

// ── Imprimir tabla ─────────────────────────────────────────────────────────────
function imprimirTabla(titulo, cabeceras, filas, totales) {
  const rows = filas.map(f =>
    `<tr>${f.map(c => `<td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${c ?? ""}</td>`).join("")}</tr>`
  ).join("");
  const totRow = totales
    ? `<tr style="font-weight:bold;background:#f0fdf4">${totales.map(c => `<td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${c ?? ""}</td>`).join("")}</tr>`
    : "";
  const html = `<html><head><title>${titulo}</title><style>@page{margin:1cm}body{font-family:sans-serif}</style></head>
  <body><h2 style="margin-bottom:4px">${titulo}</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>${cabeceras.map(h=>`<th style="padding:6px 8px;background:#065f46;color:white;font-size:11px;text-align:left">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows}${totRow}</tbody>
  </table></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// ══════════════════════════════════════════════════════════════════════════════
// Libro de Ventas
// ══════════════════════════════════════════════════════════════════════════════
function LibroVentas({ mes, settings }) {
  const [facturas, setFacturas] = useState([]);
  useEffect(() => {
    db.getFacturas().then(all => {
      const desde = primerDia(mes), hasta = ultimoDia(mes);
      setFacturas(all
        .filter(f => { const d = (f.fecha || f.creadoEn || "").slice(0,10); return d >= desde && d <= hasta; })
        .sort((a,b) => (a.fecha||a.creadoEn||"").localeCompare(b.fecha||b.creadoEn||""))
      );
    });
  }, [mes]);

  const totalGravado = facturas.reduce((s,f) => s + (parseFloat(f.subtotal||f.total||0)), 0);
  const totalIVA     = facturas.reduce((s,f) => s + (parseFloat(f.iva||f.impuesto||0)), 0);
  const totalNeto    = facturas.reduce((s,f) => s + (parseFloat(f.total||0)), 0);

  const exportar = () => {
    const rows = facturas.map((f,i) => ({
      "#": i+1, Fecha: fmtDate(f.fecha||f.creadoEn), "N° Factura": f.numero||"",
      Cliente: f.clienteNombre||f.cliente?.nombre||"",
      Cédula: f.clienteCedula||f.cliente?.cedula||"",
      Gravado: parseFloat(f.subtotal||f.total||0).toFixed(2),
      IVA: parseFloat(f.iva||f.impuesto||0).toFixed(2),
      Total: parseFloat(f.total||0).toFixed(2),
    }));
    exportExcel(rows, `libro-ventas-${mes}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => imprimirTabla(`Libro de Ventas — ${mes}`,
          ["#","Fecha","N° Factura","Cliente","Cédula","Gravado","IVA","Total"],
          facturas.map((f,i) => [i+1, fmtDate(f.fecha||f.creadoEn), f.numero||"",
            f.clienteNombre||f.cliente?.nombre||"", f.clienteCedula||f.cliente?.cedula||"",
            fmtMoney(f.subtotal||f.total||0,settings), fmtMoney(f.iva||f.impuesto||0,settings), fmtMoney(f.total||0,settings)]),
          ["","","","","","TOTALES →", fmtMoney(totalIVA,settings), fmtMoney(totalNeto,settings)]
        )} className="flex items-center gap-1.5 bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Printer size={13}/> Imprimir
        </button>
        <button onClick={exportar} className="flex items-center gap-1.5 bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead><tr>
            <th>#</th><th>Fecha</th><th>N° Factura</th><th>Cliente</th><th>Cédula</th>
            <th className="text-right">Gravado</th><th className="text-right">IVA</th><th className="text-right">Total</th>
          </tr></thead>
          <tbody>
            {facturas.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">Sin facturas en este período</td></tr>}
            {facturas.map((f,i) => (
              <tr key={f.id}>
                <td className="text-slate-500">{i+1}</td>
                <td>{fmtDate(f.fecha||f.creadoEn)}</td>
                <td className="font-mono text-xs">{f.numero||"—"}</td>
                <td>{f.clienteNombre||f.cliente?.nombre||"—"}</td>
                <td className="text-slate-500 text-xs">{f.clienteCedula||f.cliente?.cedula||"—"}</td>
                <td className="text-right">{fmtMoney(f.subtotal||f.total||0,settings)}</td>
                <td className="text-right text-amber-600">{fmtMoney(f.iva||f.impuesto||0,settings)}</td>
                <td className="text-right font-semibold">{fmtMoney(f.total||0,settings)}</td>
              </tr>
            ))}
          </tbody>
          {facturas.length > 0 && (
            <tfoot><tr className="bg-amber-50 font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right text-xs text-slate-500">TOTALES</td>
              <td className="px-4 py-2 text-right">{fmtMoney(totalGravado,settings)}</td>
              <td className="px-4 py-2 text-right text-amber-600">{fmtMoney(totalIVA,settings)}</td>
              <td className="px-4 py-2 text-right">{fmtMoney(totalNeto,settings)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Libro de Compras
// ══════════════════════════════════════════════════════════════════════════════
function LibroCompras({ mes, settings }) {
  const [compras, setCompras] = useState([]);
  useEffect(() => {
    db.getCompras().then(all => {
      const desde = primerDia(mes), hasta = ultimoDia(mes);
      setCompras(all
        .filter(c => { const d = (c.fecha||c.creadoEn||"").slice(0,10); return d >= desde && d <= hasta; })
        .sort((a,b) => (a.fecha||a.creadoEn||"").localeCompare(b.fecha||b.creadoEn||""))
      );
    });
  }, [mes]);

  const totalGravado  = compras.reduce((s,c) => s + (parseFloat(c.subtotal||c.total||0)), 0);
  const totalIVAcred  = compras.reduce((s,c) => s + (parseFloat(c.ivaCreditoFiscal||c.iva||0)), 0);
  const totalNeto     = compras.reduce((s,c) => s + (parseFloat(c.total||0)), 0);

  const exportar = () => {
    const rows = compras.map((c,i) => ({
      "#": i+1, Fecha: fmtDate(c.fecha||c.creadoEn), "N° Factura": c.numeroFactura||c.numero||"",
      Proveedor: c.proveedor||"", Cédula: c.cedulaProveedor||"",
      Gravado: parseFloat(c.subtotal||c.total||0).toFixed(2),
      "IVA Crédito": parseFloat(c.ivaCreditoFiscal||c.iva||0).toFixed(2),
      Total: parseFloat(c.total||0).toFixed(2),
    }));
    exportExcel(rows, `libro-compras-${mes}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => imprimirTabla(`Libro de Compras — ${mes}`,
          ["#","Fecha","N° Factura","Proveedor","Cédula","Gravado","IVA Crédito","Total"],
          compras.map((c,i) => [i+1, fmtDate(c.fecha||c.creadoEn), c.numeroFactura||c.numero||"",
            c.proveedor||"", c.cedulaProveedor||"",
            fmtMoney(c.subtotal||c.total||0,settings), fmtMoney(c.ivaCreditoFiscal||c.iva||0,settings), fmtMoney(c.total||0,settings)]),
          ["","","","","","TOTALES →", fmtMoney(totalIVAcred,settings), fmtMoney(totalNeto,settings)]
        )} className="flex items-center gap-1.5 bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Printer size={13}/> Imprimir
        </button>
        <button onClick={exportar} className="flex items-center gap-1.5 bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead><tr>
            <th>#</th><th>Fecha</th><th>N° Factura</th><th>Proveedor</th><th>Cédula</th>
            <th className="text-right">Gravado</th><th className="text-right">IVA Crédito</th><th className="text-right">Total</th>
          </tr></thead>
          <tbody>
            {compras.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">Sin compras en este período</td></tr>}
            {compras.map((c,i) => (
              <tr key={c.id}>
                <td className="text-slate-500">{i+1}</td>
                <td>{fmtDate(c.fecha||c.creadoEn)}</td>
                <td className="font-mono text-xs">{c.numeroFactura||c.numero||"—"}</td>
                <td>{c.proveedor||"—"}</td>
                <td className="text-slate-500 text-xs">{c.cedulaProveedor||"—"}</td>
                <td className="text-right">{fmtMoney(c.subtotal||c.total||0,settings)}</td>
                <td className="text-right text-amber-600">{fmtMoney(c.ivaCreditoFiscal||c.iva||0,settings)}</td>
                <td className="text-right font-semibold">{fmtMoney(c.total||0,settings)}</td>
              </tr>
            ))}
          </tbody>
          {compras.length > 0 && (
            <tfoot><tr className="bg-amber-50 font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right text-xs text-slate-500">TOTALES</td>
              <td className="px-4 py-2 text-right">{fmtMoney(totalGravado,settings)}</td>
              <td className="px-4 py-2 text-right text-amber-600">{fmtMoney(totalIVAcred,settings)}</td>
              <td className="px-4 py-2 text-right">{fmtMoney(totalNeto,settings)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Libro Diario
// ══════════════════════════════════════════════════════════════════════════════
function LibroDiario({ mes, settings }) {
  const [asientos, setAsientos] = useState([]);
  useEffect(() => {
    db.getAsientos().then(all => {
      const desde = primerDia(mes), hasta = ultimoDia(mes);
      setAsientos(all
        .filter(a => (a.fecha||"").slice(0,10) >= desde && (a.fecha||"").slice(0,10) <= hasta)
        .sort((a,b) => a.fecha.localeCompare(b.fecha))
      );
    });
  }, [mes]);

  const totalDebe  = asientos.reduce((s,a) => s + (a.totalDebe||0), 0);
  const totalHaber = asientos.reduce((s,a) => s + (a.totalHaber||0), 0);

  const exportar = () => {
    const rows = asientos.flatMap(a =>
      (a.lineas||[]).map(l => ({
        Fecha: fmtDate(a.fecha), "N° Asiento": a.numero||"",
        Descripción: a.descripcion||"",
        Cuenta: `${l.cuentaCodigo} — ${l.cuentaNombre}`,
        Debe: l.debe > 0 ? l.debe.toFixed(2) : "",
        Haber: l.haber > 0 ? l.haber.toFixed(2) : "",
      }))
    );
    exportExcel(rows, `libro-diario-${mes}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => {
          const filas = asientos.flatMap(a =>
            (a.lineas||[]).map(l => [fmtDate(a.fecha), a.numero||"", a.descripcion||"",
              `${l.cuentaCodigo} — ${l.cuentaNombre}`,
              l.debe > 0 ? fmtMoney(l.debe,settings) : "",
              l.haber > 0 ? fmtMoney(l.haber,settings) : ""])
          );
          imprimirTabla(`Libro Diario — ${mes}`,
            ["Fecha","N° Asiento","Descripción","Cuenta","Debe","Haber"], filas,
            ["","","","TOTALES →", fmtMoney(totalDebe,settings), fmtMoney(totalHaber,settings)]);
        }} className="flex items-center gap-1.5 bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Printer size={13}/> Imprimir
        </button>
        <button onClick={exportar} className="flex items-center gap-1.5 bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead><tr>
            <th>Fecha</th><th>N° Asiento</th><th>Descripción</th><th>Cuenta</th>
            <th className="text-right">Debe</th><th className="text-right">Haber</th>
          </tr></thead>
          <tbody>
            {asientos.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">Sin asientos en este período</td></tr>}
            {asientos.map(a => (
              (a.lineas||[]).map((l,i) => (
                <tr key={`${a.id}-${i}`} className={i===0?"border-t-2 border-slate-200":""}>
                  {i===0 ? <><td>{fmtDate(a.fecha)}</td><td className="font-mono text-xs">{a.numero}</td><td className="text-slate-600 max-w-[200px] truncate">{a.descripcion}</td></> : <><td/><td/><td/></>}
                  <td className="text-slate-600">{l.cuentaCodigo} — {l.cuentaNombre}</td>
                  <td className="text-right text-blue-700">{l.debe>0 ? fmtMoney(l.debe,settings) : ""}</td>
                  <td className="text-right text-rose-700">{l.haber>0 ? fmtMoney(l.haber,settings) : ""}</td>
                </tr>
              ))
            ))}
          </tbody>
          {asientos.length > 0 && (
            <tfoot><tr className="bg-amber-50 font-semibold">
              <td colSpan={4} className="px-4 py-2 text-right text-xs text-slate-500">TOTALES</td>
              <td className="px-4 py-2 text-right text-blue-700">{fmtMoney(totalDebe,settings)}</td>
              <td className="px-4 py-2 text-right text-rose-700">{fmtMoney(totalHaber,settings)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Libro Mayor
// ══════════════════════════════════════════════════════════════════════════════
function LibroMayor({ mes, settings }) {
  const [cuentas, setCuentas] = useState([]);
  useEffect(() => {
    Promise.all([db.getAsientos(), db.getCuentasContables()]).then(([asientos, catRaw]) => {
      const desde = primerDia(mes), hasta = ultimoDia(mes);
      const del_periodo = asientos.filter(a => {
        const d = (a.fecha||"").slice(0,10);
        return d >= desde && d <= hasta;
      });

      // Acumular por cuenta
      const mapaMap = {};
      del_periodo.forEach(a => {
        (a.lineas||[]).forEach(l => {
          const key = l.cuentaCodigo || l.cuentaNombre;
          if (!mapaMap[key]) mapaMap[key] = { codigo: l.cuentaCodigo, nombre: l.cuentaNombre, debe: 0, haber: 0 };
          mapaMap[key].debe  += l.debe  || 0;
          mapaMap[key].haber += l.haber || 0;
        });
      });

      const lista = Object.values(mapaMap)
        .map(c => ({ ...c, saldo: c.debe - c.haber }))
        .sort((a,b) => (a.codigo||"").localeCompare(b.codigo||""));

      setCuentas(lista);
    });
  }, [mes]);

  const exportar = () => {
    const rows = cuentas.map(c => ({
      Código: c.codigo||"", Cuenta: c.nombre||"",
      Debe: c.debe.toFixed(2), Haber: c.haber.toFixed(2), Saldo: c.saldo.toFixed(2),
    }));
    exportExcel(rows, `libro-mayor-${mes}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => imprimirTabla(`Libro Mayor — ${mes}`,
          ["Código","Cuenta","Debe","Haber","Saldo"],
          cuentas.map(c => [c.codigo||"", c.nombre||"",
            fmtMoney(c.debe,settings), fmtMoney(c.haber,settings),
            fmtMoney(Math.abs(c.saldo),settings) + (c.saldo>=0?" D":" H")]),
          ["","","TOTALES →",
            fmtMoney(cuentas.reduce((s,c)=>s+c.debe,0),settings),
            fmtMoney(cuentas.reduce((s,c)=>s+c.haber,0),settings), ""]
        )} className="flex items-center gap-1.5 bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <Printer size={13}/> Imprimir
        </button>
        <button onClick={exportar} className="flex items-center gap-1.5 bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead><tr>
            <th>Código</th><th>Cuenta</th>
            <th className="text-right">Debe</th><th className="text-right">Haber</th><th className="text-right">Saldo</th>
          </tr></thead>
          <tbody>
            {cuentas.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">Sin movimientos en este período</td></tr>}
            {cuentas.map((c,i) => (
              <tr key={i}>
                <td className="font-mono text-xs">{c.codigo||"—"}</td>
                <td className="font-medium">{c.nombre}</td>
                <td className="text-right text-blue-700">{fmtMoney(c.debe,settings)}</td>
                <td className="text-right text-rose-700">{fmtMoney(c.haber,settings)}</td>
                <td className={`text-right font-semibold ${c.saldo>=0?"text-slate-800":"text-red-600"}`}>
                  {fmtMoney(Math.abs(c.saldo),settings)} {c.saldo>=0?"D":"H"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Pantalla principal
// ══════════════════════════════════════════════════════════════════════════════
export default function LibrosLegalesScreen() {
  const [tab, setTab]         = useState(0);
  const [mes, setMes]         = useState(mesActual());
  const [settings, setSettings] = useState({});

  useSyncRefresh();
  useEffect(() => { db.getSettings().then(setSettings); }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <BookOpen size={14} className="text-amber-400"/>
        <span className="text-white text-xs font-semibold">Libros Legales</span>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        <label className="text-slate-300 text-xs">Período:</label>
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1 focus:outline-none"/>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-1">
        {TABS.map((t,i) => (
          <button key={i} onClick={()=>setTab(i)}
            className={`px-4 py-2 text-xs font-semibold rounded-t transition-colors
              ${tab===i ? "bg-amber-700 text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-4 bg-white">
        {tab === 0 && <LibroVentas  mes={mes} settings={settings}/>}
        {tab === 1 && <LibroCompras mes={mes} settings={settings}/>}
        {tab === 2 && <LibroDiario  mes={mes} settings={settings}/>}
        {tab === 3 && <LibroMayor   mes={mes} settings={settings}/>}
      </div>
    </div>
  );
}
