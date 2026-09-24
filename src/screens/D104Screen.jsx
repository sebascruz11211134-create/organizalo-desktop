/**
 * D104Screen — Declaración de IVA mensual (Formulario D-104, Hacienda Costa Rica)
 *
 * Auto-calcula desde las facturas del período:
 *   - IVA devengado por tarifa (0%, 1%, 2%, 4%, 8%, 13%)
 *   - Crédito fiscal (IVA pagado en compras del período)
 *   - Saldo a pagar o a favor
 */
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, CheckCircle, Info, FileText, Receipt, ShoppingCart } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tarjeta, Indicadores, Indicador } from "../components/ui";
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

  const TH = "monki-tag text-monki-k/50 font-medium px-4 py-2.5 border-b-2 border-black/10";
  const TD = "px-4 py-2.5 border-b border-black/5";

  return (
    <Modulo
      seccion="Impuestos"
      titulo="Declaración D-104"
      descripcion="IVA del mes calculado desde tus facturas y compras, listo para pasar a Hacienda."
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={()=>setMes(prevMes(mes))}/>
          <span className="text-sm font-bold min-w-[140px] text-center capitalize">{etiqs}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={()=>setMes(nextMes(mes))}/>
        </div>
        <Boton variante="secundario" icono={Printer} onClick={imprimir}>Imprimir / PDF</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Facturas emitidas" valor={facMes.length} icono={FileText} delay={40}/>
          <Indicador etiqueta="IVA devengado" valor={fmtMoney(totalIvaDev,"CRC")} detalle="Por ventas" icono={Receipt} delay={90}/>
          <Indicador etiqueta="Crédito fiscal" valor={fmtMoney(creditoFiscal,"CRC")} detalle="Por compras" icono={ShoppingCart} delay={140}/>
          <Indicador etiqueta={saldo>0 ? "A pagar" : "A favor"} valor={fmtMoney(Math.abs(saldo),"CRC")} destacado={saldo<=0} alerta={saldo>0} delay={190}/>
        </Indicadores>
      }
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-3 max-w-5xl">
        <div className="flex items-start gap-3 bg-monki-y/40 border-2 border-monki-y rounded-2xl px-4 py-3 text-sm text-monki-k">
          <Info size={16} className="shrink-0 mt-0.5"/>
          <span>Se calcula solo con tus facturas y compras del mes. Revisá los montos antes de declarar en <b>Hacienda ATV → D-104</b>.</span>
        </div>

        <Tarjeta titulo="IVA devengado por tarifa" acciones={<span className="font-mono text-[11px] text-monki-k/45">{facMes.length} facturas</span>} className="overflow-hidden">
          <table className="ui-tabla w-full text-sm">
            <thead><tr><th className={TH+" text-left"}>Tarifa</th><th className={TH+" text-right"}>Base imponible</th><th className={TH+" text-right"}>IVA devengado</th></tr></thead>
            <tbody>
              {Object.entries(ivaVentasMap).length === 0 && ivaDirecto === 0 ? (
                <tr><td colSpan={3} className="text-center py-10 text-monki-k/40">Sin facturas en {etiqs}</td></tr>
              ) : (
                <>
                  {Object.entries(ivaVentasMap).map(([pct,v]) => (
                    <tr key={pct} className="hover:bg-monki-cream/60 transition-colors">
                      <td className={TD}><span className="font-mono text-xs bg-monki-cream px-2 py-0.5 rounded-md">{pct}%</span></td>
                      <td className={TD+" text-right tabular-nums"}>{fmtMoney(v.base,"CRC")}</td>
                      <td className={TD+" text-right font-bold tabular-nums"}>{fmtMoney(v.iva,"CRC")}</td>
                    </tr>
                  ))}
                  {ivaDirecto > 0 && (
                    <tr><td className={TD+" text-monki-k/55 italic"}>Facturas sin desglose de líneas</td><td className={TD+" text-right text-monki-k/35"}>—</td><td className={TD+" text-right font-bold"}>{fmtMoney(ivaDirecto,"CRC")}</td></tr>
                  )}
                  <tr className="bg-monki-k text-white font-black">
                    <td className="px-4 py-3 monki-tag text-monki-y">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totalBaseVentas,"CRC")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-monki-y">{fmtMoney(totalIvaDev,"CRC")}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </Tarjeta>

        <Tarjeta titulo="Crédito fiscal de compras" acciones={<span className="font-mono text-[11px] text-monki-k/45">{compMes.length} compras</span>} className="overflow-hidden">
          <table className="ui-tabla w-full text-sm">
            <thead><tr><th className={TH+" text-left"}>Proveedor</th><th className={TH+" text-left"}>Fecha</th><th className={TH+" text-right"}>Subtotal</th><th className={TH+" text-right"}>IVA pagado</th></tr></thead>
            <tbody>
              {compMes.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-monki-k/40">Sin compras registradas en {etiqs}</td></tr>
              ) : compMes.map(c=>(
                <tr key={c.id} className="hover:bg-monki-cream/60 transition-colors">
                  <td className={TD+" font-bold text-monki-k"}>{c.proveedor||c.nombre||"—"}</td>
                  <td className={TD+" text-monki-k/55"}>{fmtDate(c.fecha)}</td>
                  <td className={TD+" text-right tabular-nums"}>{fmtMoney(parseFloat(c.subtotal||0),"CRC")}</td>
                  <td className={TD+" text-right font-bold tabular-nums"}>{fmtMoney(parseFloat(c.montoImpuesto||c.ivaTotal||0),"CRC")}</td>
                </tr>
              ))}
              {compMes.length>0 && (
                <tr className="bg-monki-y font-black">
                  <td colSpan={3} className="px-4 py-3 monki-tag">Total crédito fiscal</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(creditoFiscal,"CRC")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Tarjeta>

        <div className={`animate-entrar rounded-[18px] p-5 border-2 flex items-center gap-4 ${saldo>0 ? "border-red-600 bg-red-600 text-white" : "border-monki-k bg-monki-k text-white shadow-[6px_6px_0_#FFD600]"}`}>
          <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${saldo>0?"bg-white text-red-600":"bg-monki-y text-monki-k"}`}>
            {saldo > 0 ? <AlertTriangle size={22}/> : <CheckCircle size={22}/>}
          </span>
          <div>
            <p className={`text-[22px] font-black tracking-[-0.03em] ${saldo>0?"":"text-monki-y"}`}>
              {saldo > 0
                ? `Impuesto a pagar: ${fmtMoney(saldo,"CRC")}`
                : saldo < 0
                  ? `Saldo a favor: ${fmtMoney(Math.abs(saldo),"CRC")}`
                  : "Sin impuesto a pagar este período"}
            </p>
            <p className="text-sm text-white/70 mt-0.5">
              IVA devengado ({fmtMoney(totalIvaDev,"CRC")}) − crédito fiscal ({fmtMoney(creditoFiscal,"CRC")})
            </p>
          </div>
        </div>
      </div>
    </Modulo>
  );
}
