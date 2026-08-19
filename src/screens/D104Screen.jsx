/**
 * D104Screen — Declaración de IVA mensual (Formulario D-104, Hacienda Costa Rica)
 *
 * Auto-calcula desde las facturas del período:
 *   - IVA devengado por tarifa (0%, 1%, 2%, 4%, 8%, 13%)
 *   - Crédito fiscal (IVA pagado en compras del período)
 *   - Saldo a pagar o a favor
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, CheckCircle, Info } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

// ── Tasas IVA ────────────────────────────────────────────────────────────────
const TARIFAS = [
  { codigo: "08", pct: 13, label: "Tarifa general (13%)" },
  { codigo: "07", pct:  8, label: "Tarifa reducida (8%)" },
  { codigo: "06", pct:  4, label: "Canasta básica diferenciada (4%)" },
  { codigo: "04", pct:  4, label: "Tarifa 4% (bienes)" },
  { codigo: "03", pct:  2, label: "Tarifa 2%" },
  { codigo: "02", pct:  1, label: "Tarifa 1%" },
  { codigo: "01", pct:  0, label: "Exento (0%)" },
  { codigo: "05", pct:  0, label: "No sujeto" },
];

const IVA_PCT = { "01":0,"02":1,"03":2,"04":4,"05":0,"06":4,"07":8,"08":13 };

// ── Month helpers ─────────────────────────────────────────────────────────────
function ymHoy() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function prevMes(ym) { const [y,m]=ym.split("-").map(Number); const d=new Date(y,m-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function nextMes(ym) { const [y,m]=ym.split("-").map(Number); const d=new Date(y,m,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function mesLabel(ym) { const [y,m]=ym.split("-").map(Number); return new Date(y,m-1,1).toLocaleDateString("es-CR",{month:"long",year:"numeric"}); }

// ── Calcular IVA de las líneas de una factura ─────────────────────────────────
function sumarIvaFacturas(facturas) {
  // Por tarifa: { pct → { base, iva } }
  const map = {};
  for (const f of facturas) {
    if (!f.lineas?.length) continue;
    for (const l of f.lineas) {
      const pct  = IVA_PCT[l.codigoIva || "08"] ?? 13;
      const base = parseFloat(l.subtotal || l.precioUnit * l.cantidad || 0);
      const iva  = Math.round(base * pct / 100);
      if (!map[pct]) map[pct] = { base: 0, iva: 0 };
      map[pct].base += base;
      map[pct].iva  += iva;
    }
  }
  return map;
}

// Alternativa si no hay líneas: usar montoImpuesto guardado en la factura
function ivaDeFactura(f) {
  if (f.lineas?.length) return null; // se procesa con sumarIvaFacturas
  return parseFloat(f.montoImpuesto || f.ivaTotal || 0);
}

export default function D104Screen() {
  const [mes,      setMes]      = useState(ymHoy());
  const [facturas, setFacturas] = useState([]);
  const [compras,  setCompras]  = useState([]);
  const [settings, setSettings] = useState({});

  const cargar = useCallback(async () => {
    const [f, c, s] = await Promise.all([db.getFacturas(), db.getCompras(), db.getSettings()]);
    setFacturas(f);
    setCompras(c);
    setSettings(s);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  // Filtrar por mes
  const facMes  = facturas.filter(f => (f.fecha || f.fechaEmision || "").startsWith(mes));
  const compMes = compras.filter(c  => (c.fecha || "").startsWith(mes));

  // IVA devengado (ventas)
  const ivaVentasMap = sumarIvaFacturas(facMes);

  // También sumar iva directo si no tienen líneas
  const ivaDirecto = facMes.reduce((s,f) => {
    const iva = ivaDeFactura(f);
    if (iva === null) return s;
    return s + iva;
  }, 0);

  // Total IVA devengado
  const totalIvaDev = Object.values(ivaVentasMap).reduce((s,v)=>s+v.iva,0) + ivaDirecto;

  // Base imponible ventas
  const totalBaseVentas = Object.values(ivaVentasMap).reduce((s,v)=>s+v.base,0)
    + facMes.filter(f=>!f.lineas?.length).reduce((s,f)=>s+parseFloat(f.subtotal||f.montoVenta||0),0);

  // Crédito fiscal (IVA pagado en compras)
  const creditoFiscal = compMes.reduce((s,c)=>s+parseFloat(c.montoImpuesto||c.ivaTotal||0),0);

  // Saldo
  const saldo = totalIvaDev - creditoFiscal;

  const etiqs = mesLabel(mes);

  const imprimir = () => {
    const html = `
      <html><head><meta charset="utf-8">
      <style>body{font-family:sans-serif;padding:30px;font-size:13px}
      h1{font-size:18px}table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{border:1px solid #ccc;padding:8px 12px}th{background:#f1f5f9}
      .total{font-weight:bold;background:#f8fafc}.saldo{font-size:16px;font-weight:bold;margin-top:20px;padding:12px;border:2px solid ${saldo>0?"#dc2626":"#16a34a"};border-radius:8px;color:${saldo>0?"#dc2626":"#16a34a"}}
      </style></head><body>
      <h1>Declaración D-104 — ${settings.nombreNegocio||"Mi negocio"}</h1>
      <p>Período: <strong>${etiqs}</strong> &nbsp;·&nbsp; Generado: ${new Date().toLocaleDateString("es-CR")}</p>
      <h3>IVA Devengado (Ventas)</h3>
      <table><tr><th>Tarifa</th><th>Base imponible</th><th>IVA devengado</th></tr>
      ${Object.entries(ivaVentasMap).map(([pct,v])=>`<tr><td>${pct}%</td><td>₡${v.base.toLocaleString("es-CR")}</td><td>₡${v.iva.toLocaleString("es-CR")}</td></tr>`).join("")}
      ${ivaDirecto>0?`<tr><td>Facturas sin desglose</td><td>—</td><td>₡${ivaDirecto.toLocaleString("es-CR")}</td></tr>`:""}
      <tr class="total"><td colspan="2">Total IVA devengado</td><td>₡${totalIvaDev.toLocaleString("es-CR")}</td></tr>
      </table>
      <h3>Crédito Fiscal (Compras)</h3>
      <table><tr><th>Compras del período</th><th>IVA pagado (crédito fiscal)</th></tr>
      <tr><td>${compMes.length} facturas de proveedor</td><td>₡${creditoFiscal.toLocaleString("es-CR")}</td></tr>
      </table>
      <div class="saldo">${saldo>0?`Impuesto a pagar: ₡${saldo.toLocaleString("es-CR")}`:`Saldo a favor: ₡${Math.abs(saldo).toLocaleString("es-CR")}`}</div>
      </body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Declaración D-104 — IVA</h1>
            <p className="text-sm text-slate-500 mt-0.5">Resumen automático para declarar ante Hacienda</p>
          </div>
          {/* Navegador de mes */}
          <div className="flex items-center gap-2">
            <button onClick={()=>setMes(prevMes(mes))} className="p-2 rounded-lg hover:bg-gray-100 border border-slate-200">
              <ChevronLeft size={15} className="text-slate-600"/>
            </button>
            <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center capitalize">{etiqs}</span>
            <button onClick={()=>setMes(nextMes(mes))} className="p-2 rounded-lg hover:bg-gray-100 border border-slate-200">
              <ChevronRight size={15} className="text-slate-600"/>
            </button>
            <button onClick={imprimir}
              className="ml-4 flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
              <Printer size={14}/> Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-4xl">
        {/* Info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <Info size={16} className="shrink-0 mt-0.5"/>
          <span>Los datos se calculan automáticamente desde tus facturas y compras del período. Verificá los montos antes de declarar en <strong>Hacienda ATV → D-104</strong>.</span>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Facturas emitidas",     facMes.length,                ""],
            ["IVA devengado (ventas)", fmtMoney(totalIvaDev,"CRC"), "text-slate-900 font-black"],
            ["Crédito fiscal (compras)", fmtMoney(creditoFiscal,"CRC"), "text-emerald-700"],
          ].map(([lbl,val,cls])=>(
            <div key={lbl} className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">{lbl}</p>
              <p className={`text-xl font-bold mt-1 ${cls}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* IVA por tarifa */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">IVA devengado — desglose por tarifa</h3>
            <p className="text-xs text-slate-400 mt-0.5">{facMes.length} facturas emitidas en {etiqs}</p>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Tarifa</th>
                <th className="text-right">Base imponible</th>
                <th className="text-right">IVA devengado</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ivaVentasMap).length === 0 && ivaDirecto === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-slate-400">Sin facturas en {etiqs}</td></tr>
              ) : (
                <>
                  {Object.entries(ivaVentasMap).map(([pct,v]) => (
                    <tr key={pct}>
                      <td className="text-slate-700">Tarifa {pct}%</td>
                      <td className="text-right">{fmtMoney(v.base,"CRC")}</td>
                      <td className="text-right font-semibold">{fmtMoney(v.iva,"CRC")}</td>
                    </tr>
                  ))}
                  {ivaDirecto > 0 && (
                    <tr>
                      <td className="text-slate-500 italic">Facturas sin desglose de líneas</td>
                      <td className="text-right text-slate-400">—</td>
                      <td className="text-right font-semibold">{fmtMoney(ivaDirecto,"CRC")}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td>Total base imponible</td>
                    <td className="text-right">{fmtMoney(totalBaseVentas,"CRC")}</td>
                    <td className="text-right text-slate-900">{fmtMoney(totalIvaDev,"CRC")}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Crédito fiscal */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Crédito fiscal — compras del período</h3>
            <p className="text-xs text-slate-400 mt-0.5">{compMes.length} facturas de proveedor en {etiqs}</p>
          </div>
          <table className="table-base">
            <thead>
              <tr><th>Proveedor</th><th>Fecha</th><th className="text-right">Subtotal</th><th className="text-right">IVA pagado</th></tr>
            </thead>
            <tbody>
              {compMes.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Sin compras registradas en {etiqs}</td></tr>
              ) : compMes.map(c=>(
                <tr key={c.id}>
                  <td className="font-semibold text-slate-900">{c.proveedor||c.nombre||"—"}</td>
                  <td className="text-slate-500">{fmtDate(c.fecha)}</td>
                  <td className="text-right">{fmtMoney(parseFloat(c.subtotal||0),"CRC")}</td>
                  <td className="text-right font-semibold text-emerald-700">{fmtMoney(parseFloat(c.montoImpuesto||c.ivaTotal||0),"CRC")}</td>
                </tr>
              ))}
              {compMes.length>0 && (
                <tr className="bg-green-50 font-bold border-t-2 border-emerald-300">
                  <td colSpan={3} className="text-green-800">Total crédito fiscal</td>
                  <td className="text-right text-green-800">{fmtMoney(creditoFiscal,"CRC")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Resultado D-104 */}
        <div className={`rounded-xl p-6 border-2 ${saldo>0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-green-50"}`}>
          <div className="flex items-center gap-3">
            {saldo > 0
              ? <AlertTriangle size={24} className="text-red-600 shrink-0"/>
              : <CheckCircle size={24} className="text-emerald-600 shrink-0"/>}
            <div>
              <p className={`text-lg font-black ${saldo>0?"text-red-700":"text-emerald-700"}`}>
                {saldo > 0
                  ? `Impuesto a pagar: ${fmtMoney(saldo,"CRC")}`
                  : saldo < 0
                    ? `Saldo a favor: ${fmtMoney(Math.abs(saldo),"CRC")}`
                    : "Sin impuesto a pagar este período"}
              </p>
              <p className={`text-sm mt-0.5 ${saldo>0?"text-red-600":"text-emerald-600"}`}>
                IVA devengado ({fmtMoney(totalIvaDev,"CRC")}) − Crédito fiscal ({fmtMoney(creditoFiscal,"CRC")})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
