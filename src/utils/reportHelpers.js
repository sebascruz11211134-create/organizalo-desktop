/**
 * reportHelpers.js — Imprimir y exportar Excel en Electron
 *
 * Usa window.electronAPI expuesto por preload.js.
 * Misma interfaz que reportPrint.js del móvil, adaptada para desktop.
 */

// ── CSS base compartido ───────────────────────────────────────────────────────
const CSS = `
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 20px; color: #111827; font-size: 13px; }
  h1 { color: #1a6b3c; font-size: 18px; margin-bottom: 4px; }
  .meta { color: #6B7280; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) { background: #f9fafb; }
  .total-row td { font-weight: 800; background: #f0fdf4; border-top: 2px solid #1a6b3c; color: #1a6b3c; }
  .danger { color: #dc2626; font-weight: 700; }
  .primary { color: #1a6b3c; font-weight: 700; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #9CA3AF; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-pend { background:#f3f4f6; color:#6B7280; }
  .badge-parc { background:#fef3c7; color:#d97706; }
  .badge-venc { background:#fee2e2; color:#dc2626; }
  .badge-sald { background:#d1fae5; color:#059669; }
`;

function baseHTML(titulo, negocio, cuerpo) {
  const fecha = new Date().toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <h1>${titulo}</h1>
    <p class="meta">${negocio} &nbsp;·&nbsp; ${fecha}</p>
    ${cuerpo}
    <div class="footer">Generado por Monki.AI · Costa Rica</div>
  </body></html>`;
}

function fmt(num, moneda = "CRC") {
  if (!num && num !== 0) return "—";
  const s = moneda === "USD" ? "$ " : "₡ ";
  const opts = { minimumFractionDigits: moneda === "USD" ? 2 : 0, maximumFractionDigits: moneda === "USD" ? 2 : 0 };
  return s + Number(num).toLocaleString("es-CR", opts);
}

function hoy() { return new Date().toISOString().slice(0, 10); }

function _mostrarToast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position:"fixed", bottom:"24px", left:"50%", transform:"translateX(-50%)",
    background:"#111827", color:"#fff", padding:"12px 20px", borderRadius:"12px",
    fontSize:"14px", fontFamily:"-apple-system,sans-serif", zIndex:"99999",
    boxShadow:"0 4px 20px rgba(0,0,0,0.3)", whiteSpace:"nowrap",
    transition:"opacity 0.4s", opacity:"1",
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 4000);
}

// ── Imprimir HTML (Electron o browser nativo) ─────────────────────────────────
export async function printHTML(html) {
  if (window.electronAPI?.print?.html) {
    return window.electronAPI.print.html(html);
  }
  // Fallback web: abrir ventana y disparar window.print()
  const win = window.open("", "_blank", "width=900,height=700");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ── Exportar Excel (Electron o SheetJS en browser) ───────────────────────────
export async function exportExcel(sheets, nombre) {
  if (window.electronAPI?.excel?.export) {
    return window.electronAPI.excel.export(sheets, nombre);
  }
  try {
    const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
    const wb   = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const data = [sheet.columnas, ...sheet.filas];
      const ws   = XLSX.utils.aoa_to_sheet(data);

      // Anchos de columna
      if (sheet.anchos) {
        ws["!cols"] = sheet.anchos.map(w => ({ wch: w }));
      } else {
        ws["!cols"] = sheet.columnas.map((h, ci) => {
          const vals = sheet.filas.map(r => String(r[ci] ?? "").length);
          return { wch: Math.min(40, Math.max(h.length, ...vals) + 2) };
        });
      }

      // Formato numérico
      sheet.filas.forEach((row, ri) => {
        row.forEach((val, ci) => {
          if (typeof val === "number") {
            const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
            if (ws[ref]) ws[ref].z = val % 1 !== 0 ? "#,##0.00" : "#,##0";
          }
        });
      });

      // Fila congelada (header siempre visible al bajar)
      ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

      // Auto-filtros en todas las columnas del header
      const lastCol = XLSX.utils.encode_col(sheet.columnas.length - 1);
      const lastRow = sheet.filas.length + 1;
      ws["!autofilter"] = { ref: `A1:${lastCol}${lastRow}` };

      XLSX.utils.book_append_sheet(wb, ws, sheet.nombre.slice(0, 31));
    }

    // Generar como ArrayBuffer para máxima compatibilidad (Safari PWA, etc.)
    const fn    = `${nombre || "reporte"}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob  = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    // En iOS (touch) usamos Web Share API que muestra "Abrir en Excel", "Guardar en Archivos", etc.
    // En macOS/desktop usamos link download directo → va a Descargas
    const esMovil = navigator.maxTouchPoints > 0 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (esMovil && navigator.share) {
      try {
        const file = new File([blob], fn, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: fn });
          return;
        }
      } catch (shareErr) {
        if (shareErr.name !== "AbortError") console.warn("Share falló:", shareErr);
        // Si share falla, caemos al link download
      }
    }

    // Intentar File System Access API (muestra diálogo "Guardar como" nativo)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fn,
          types: [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        _mostrarToast(`✅ Guardado: ${fn}`);
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // usuario canceló
        // Si falla (permisos, etc.) caemos al link download
      }
    }

    // Fallback: link download — va a la carpeta Descargas del sistema
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    _mostrarToast(`📥 Guardado en Descargas: ${fn}`);
  } catch (e) {
    console.error("Error exportando Excel:", e);
    alert("No se pudo exportar Excel.");
  }
}

// ── HTML por tipo de reporte ──────────────────────────────────────────────────

export function htmlEstadoCuenta(cliente, debts, settings) {
  const negocio = settings.nombreNegocio || "Mi negocio";
  const rows = debts.map((d) => {
    const mon = d.moneda || settings.moneda || "CRC";
    const saldo = Math.max(0, d.total - (d.pagado || 0));
    const est = saldo <= 0 ? "Saldada" : (d.fechaVencimiento && d.fechaVencimiento < hoy()) ? "Vencida" : (d.pagado || 0) > 0 ? "Parcial" : "Pendiente";
    const cls = { Saldada:"sald", Vencida:"venc", Parcial:"parc", Pendiente:"pend" }[est];
    return `<tr>
      <td>${d.notas || "—"}</td><td>${mon}</td><td>${fmt(d.total,mon)}</td>
      <td class="primary">${fmt(d.pagado||0,mon)}</td>
      <td class="${saldo>0?"danger":"primary"}">${fmt(saldo,mon)}</td>
      <td>${d.fechaVencimiento||"—"}</td>
      <td><span class="badge badge-${cls}">${est}</span></td>
    </tr>` +
    (d.pagos||[]).map((p) => `<tr style="background:#f0fdf4">
      <td style="padding-left:20px;font-size:10px">✓ ${p.numero}</td><td>${mon}</td>
      <td colspan="3" style="color:#059669;font-size:11px">${p.fecha} · ${p.metodo}${p.notas?" · "+p.notas:""}</td>
      <td colspan="2" style="color:#059669;font-weight:700">${fmt(p.monto,mon)}</td>
    </tr>`).join("");
  }).join("");
  return baseHTML(`Estado de cuenta — ${cliente}`, negocio, `
    <table>
      <thead><tr><th>Referencia</th><th>Mon.</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Vencimiento</th><th>Estado</th></tr></thead>
      <tbody>${rows||"<tr><td colspan='7' style='text-align:center;color:#9CA3AF'>Sin cuentas</td></tr>"}</tbody>
    </table>`);
}

export function htmlNotasCredito(notas, settings) {
  const negocio = settings.nombreNegocio || "Mi negocio";
  const rows = notas.map((n) => `<tr>
    <td>${n.numero}</td><td>${n.fecha}</td><td>${n.cliente}</td>
    <td>${n.facturaRef||"—"}</td><td>${n.motivo}</td><td>${n.moneda}</td>
    <td class="danger">${fmt(n.monto,n.moneda)}</td><td>${n.notas||"—"}</td>
  </tr>`).join("");
  const totCRC = notas.filter(n=>n.moneda==="CRC").reduce((s,n)=>s+(n.monto||0),0);
  const totUSD = notas.filter(n=>n.moneda==="USD").reduce((s,n)=>s+(n.monto||0),0);
  return baseHTML("Notas de crédito", negocio, `
    <table>
      <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Factura ref.</th><th>Motivo</th><th>Mon.</th><th>Monto</th><th>Obs.</th></tr></thead>
      <tbody>${rows||"<tr><td colspan='8' style='text-align:center;color:#9CA3AF'>Sin notas</td></tr>"}</tbody>
      <tfoot><tr class="total-row"><td colspan="6">TOTAL</td>
        <td>${totCRC>0?fmt(totCRC,"CRC"):""}${totCRC>0&&totUSD>0?" / ":""}${totUSD>0?fmt(totUSD,"USD"):""}</td><td></td>
      </tr></tfoot>
    </table>`);
}

export function htmlReporteCXC(cuentasCRC, cuentasUSD, settings) {
  const negocio = settings.nombreNegocio || "Mi negocio";
  const tabla = (cuentas, mon) => {
    const rows = cuentas.map((d) => {
      const saldo = Math.max(0, d.total-(d.pagado||0));
      const venc  = d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0;
      const est   = saldo<=0?"Saldada":venc?"Vencida":(d.pagado||0)>0?"Parcial":"Pendiente";
      const cls   = {Saldada:"sald",Vencida:"venc",Parcial:"parc",Pendiente:"pend"}[est];
      return `<tr><td>${d.nombre}</td><td>${d.notas||"—"}</td>
        <td>${fmt(d.total,mon)}</td><td class="primary">${fmt(d.pagado||0,mon)}</td>
        <td class="${saldo>0?"danger":"primary"}">${fmt(saldo,mon)}</td>
        <td>${d.fechaVencimiento||"—"}</td>
        <td><span class="badge badge-${cls}">${est}</span></td></tr>`;
    }).join("");
    const totB = cuentas.reduce((s,d)=>s+(d.total||0),0);
    const totP = cuentas.reduce((s,d)=>s+(d.pagado||0),0);
    return `<table><thead><tr><th>Cliente</th><th>Ref.</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Vencimiento</th><th>Estado</th></tr></thead>
      <tbody>${rows||"<tr><td colspan='7' style='text-align:center;color:#9CA3AF'>Sin cuentas</td></tr>"}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">TOTAL ${mon}</td><td>${fmt(totB,mon)}</td><td>${fmt(totP,mon)}</td><td>${fmt(totB-totP,mon)}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  };
  return baseHTML("Reporte de Cuentas por Cobrar (CXC)", negocio,
    `<h3 style="color:#1a6b3c;margin-top:16px">COLONES (₡)</h3>${tabla(cuentasCRC,"CRC")}
     <h3 style="color:#1a6b3c;margin-top:24px">DÓLARES ($)</h3>${tabla(cuentasUSD,"USD")}`);
}

export function htmlReporteRecibos(visibles, mesLabel, settings) {
  const negocio = settings.nombreNegocio || "Mi negocio";
  const rows = visibles.map((r) => `<tr>
    <td>${r.numero}</td><td>${r.tipo||"Caja"}</td><td>${r.fecha}</td>
    <td>${r.cliente}</td><td>${r.metodo}</td><td>${r.moneda}</td>
    <td class="primary">${fmt(r.monto,r.moneda)}</td><td>${r.concepto||r.notas||"—"}</td>
  </tr>`).join("");
  const tots = {};
  visibles.forEach((r) => { tots[r.moneda]=(tots[r.moneda]||0)+r.monto; });
  const totRow = Object.entries(tots).map(([m,t])=>`${m}: ${fmt(t,m)}`).join(" / ");
  return baseHTML(`Reporte de recibos — ${mesLabel}`, negocio, `
    <table>
      <thead><tr><th>N°</th><th>Tipo</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Mon.</th><th>Monto</th><th>Concepto</th></tr></thead>
      <tbody>${rows||"<tr><td colspan='8' style='text-align:center;color:#9CA3AF'>Sin recibos</td></tr>"}</tbody>
      <tfoot><tr class="total-row"><td colspan="6">TOTAL PERÍODO</td><td colspan="2">${totRow||"—"}</td></tr></tfoot>
    </table>`);
}

export function htmlReporteVencidos(grupos, settings) {
  const negocio = settings.nombreNegocio || "Mi negocio";
  const secs = grupos.filter(g=>g.cuentas.length>0).map((g) => {
    const rows = g.cuentas.map((d) => {
      const mon   = d.moneda || settings.moneda || "CRC";
      const saldo = Math.max(0, d.total-(d.pagado||0));
      const dias  = Math.max(0,Math.floor((new Date()-new Date(d.fechaVencimiento))/86400000));
      return `<tr><td>${d.nombre}</td><td class="danger">${fmt(saldo,mon)}</td><td>${mon}</td>
        <td>${fmt(d.total,mon)}</td><td class="primary">${fmt(d.pagado||0,mon)}</td>
        <td>${d.fechaVencimiento}</td><td class="danger">${dias}</td></tr>`;
    }).join("");
    return `<h3 style="color:#dc2626;margin-top:16px">${g.label} — ${g.cuentas.length} cuenta${g.cuentas.length!==1?"s":""}</h3>
      <table><thead><tr><th>Cliente</th><th>Saldo</th><th>Mon.</th><th>Total</th><th>Cobrado</th><th>Vencimiento</th><th>Días</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }).join("");
  return baseHTML("Reporte de cobros vencidos", negocio, secs||"<p style='color:#9CA3AF'>Sin cobros vencidos.</p>");
}

// ── Sheets Excel por tipo ─────────────────────────────────────────────────────

export function sheetsEstadoCuenta(cliente, debts, settings) {
  const cols = ["Referencia","Moneda","Total","Cobrado","Saldo","Vencimiento","Estado","N° Recibo","Fecha RC","Método","Monto RC"];
  const filas = [];
  debts.forEach((d) => {
    const mon = d.moneda||settings.moneda||"CRC";
    const saldo = Math.max(0,d.total-(d.pagado||0));
    filas.push([d.notas||"—",mon,d.total,d.pagado||0,saldo,d.fechaVencimiento||"—",
      saldo<=0?"Saldada":(d.fechaVencimiento&&d.fechaVencimiento<hoy())?"Vencida":(d.pagado||0)>0?"Parcial":"Pendiente","","","",""]);
    (d.pagos||[]).forEach((p)=>filas.push(["  → "+(d.notas||"—"),mon,"","","","","",p.numero,p.fecha,p.metodo,p.monto]));
  });
  return [{ nombre: cliente.slice(0,31), columnas: cols, filas }];
}

export function sheetsNotasCredito(notas) {
  return [{ nombre:"Notas de Crédito",
    columnas:["N°","Fecha","Cliente","Factura Ref.","Motivo","Moneda","Monto","Obs."],
    filas: notas.map((n)=>[n.numero,n.fecha,n.cliente,n.facturaRef||"—",n.motivo,n.moneda,n.monto,n.notas||"—"]) }];
}

export function sheetsReporteCXC(cuentasCRC, cuentasUSD) {
  const cols = [
    "Cliente","Referencia","Fecha Emisión","Fecha Vencimiento",
    "Total","Cobrado","Saldo Pendiente",
    "Días Vencido","Tramo","Estado",
  ];
  const anchos = [30,20,14,16,14,14,16,12,14,12];
  const mkF = (cuentas) => {
    const hoyStr = hoy();
    // Agrupar por cliente, ordenar vencidas primero dentro de cada cliente
    const grupos = {};
    cuentas.forEach(d => {
      const key = (d.nombre || "Sin nombre").trim();
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(d);
    });
    // Ordenar clientes: primero los que tienen facturas vencidas, luego por nombre
    const clientesOrdenados = Object.keys(grupos).sort((a, b) => {
      const tieneVencA = grupos[a].some(d => { const s=Math.max(0,d.total-(d.pagado||0)); return s>0&&d.fechaVencimiento&&d.fechaVencimiento<hoyStr; });
      const tieneVencB = grupos[b].some(d => { const s=Math.max(0,d.total-(d.pagado||0)); return s>0&&d.fechaVencimiento&&d.fechaVencimiento<hoyStr; });
      if (tieneVencA !== tieneVencB) return tieneVencB ? 1 : -1;
      return a.localeCompare(b, "es");
    });

    const filas = [];
    let gtTotal = 0, gtCobrado = 0, gtSaldo = 0;

    clientesOrdenados.forEach(cliente => {
      const items = grupos[cliente].sort((a, b) => {
        const dA = a.fechaVencimiento ? Math.max(0, Math.floor((Date.now()-new Date(a.fechaVencimiento))/86400000)) : 0;
        const dB = b.fechaVencimiento ? Math.max(0, Math.floor((Date.now()-new Date(b.fechaVencimiento))/86400000)) : 0;
        return dB - dA;
      });
      let subTotal = 0, subCobrado = 0, subSaldo = 0;
      items.forEach(d => {
        const saldo  = Math.max(0, d.total-(d.pagado||0));
        const diasV  = d.fechaVencimiento&&saldo>0 ? Math.max(0,Math.floor((Date.now()-new Date(d.fechaVencimiento))/86400000)) : 0;
        const estado = saldo<=0?"Saldada":(d.fechaVencimiento&&d.fechaVencimiento<hoyStr&&saldo>0)?"Vencida":(d.pagado||0)>0?"Parcial":"Pendiente";
        const tramo  = d.bucket||(diasV>120?"Más de 120 días":diasV>90?"91-120 días":diasV>60?"61-90 días":diasV>30?"31-60 días":diasV>0?"0-30 días":"Al día");
        filas.push(["", d.notas||"—", d.fecha||"—", d.fechaVencimiento||"—",
                    d.total, d.pagado||0, saldo, diasV||"", tramo, estado]);
        subTotal += d.total; subCobrado += (d.pagado||0); subSaldo += saldo;
      });
      // Fila de subtotal del cliente (va al inicio del grupo visualmente — la ponemos al final)
      filas.splice(filas.length - items.length, 0,
        [`▸ ${cliente}`, `${items.length} factura${items.length!==1?"s":""}`, "", "", subTotal, subCobrado, subSaldo, "", "", ""]
      );
      filas.push(["", "", "", "", "", "", "", "", "", ""]);  // fila vacía separadora
      gtTotal += subTotal; gtCobrado += subCobrado; gtSaldo += subSaldo;
    });

    filas.push(["TOTAL GENERAL","","","", gtTotal, gtCobrado, gtSaldo, "", "", ""]);
    return { filas, anchos };
  };
  const crc = mkF(cuentasCRC);
  const usd = mkF(cuentasUSD);

  // Hoja de Resumen por tramo de antigüedad
  const tramos = ["Al día","0-30 días","31-60 días","61-90 días","91-120 días","Más de 120 días"];
  const hoyStr2 = hoy();
  const agrupar = (cuentas) => {
    const map = {};
    tramos.forEach(t => { map[t] = { count: 0, saldo: 0, total: 0 }; });
    cuentas.forEach(d => {
      const saldo  = Math.max(0, d.total - (d.pagado || 0));
      const diasV  = d.fechaVencimiento && saldo > 0
        ? Math.max(0, Math.floor((Date.now() - new Date(d.fechaVencimiento)) / 86400000)) : 0;
      const tramo  = d.bucket || (diasV > 120 ? "Más de 120 días" : diasV > 90 ? "91-120 días" : diasV > 60 ? "61-90 días" : diasV > 30 ? "31-60 días" : diasV > 0 ? "0-30 días" : "Al día");
      if (map[tramo]) { map[tramo].count++; map[tramo].saldo += saldo; map[tramo].total += d.total; }
    });
    return map;
  };
  const resCRC = agrupar(cuentasCRC);
  const resUSD = agrupar(cuentasUSD);
  const resFilas = tramos.map(t => [
    t,
    resCRC[t].count, resCRC[t].total, resCRC[t].saldo,
    resUSD[t].count, resUSD[t].total, resUSD[t].saldo,
  ]);
  const totCRCSaldo = cuentasCRC.reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);
  const totUSDSaldo = cuentasUSD.reduce((s,d)=>s+Math.max(0,d.total-(d.pagado||0)),0);
  resFilas.push(["TOTAL",
    cuentasCRC.length, cuentasCRC.reduce((s,d)=>s+d.total,0), totCRCSaldo,
    cuentasUSD.length, cuentasUSD.reduce((s,d)=>s+d.total,0), totUSDSaldo,
  ]);

  return [
    { nombre:"Resumen",          columnas:["Tramo","# Fact ₡","Total ₡","Saldo ₡","# Fact $","Total $","Saldo $"], filas:resFilas, anchos:[18,10,16,16,10,16,16] },
    { nombre:"CXC Colones (₡)", columnas:cols, filas:crc.filas, anchos:crc.anchos },
    { nombre:"CXC Dólares ($)",  columnas:cols, filas:usd.filas, anchos:usd.anchos },
  ];
}

export function sheetsReporteRecibos(visibles) {
  return [{ nombre:"Recibos",
    columnas:["N°","Tipo","Fecha","Cliente","Método","Moneda","Monto","Concepto"],
    filas: visibles.map((r)=>[r.numero,r.tipo||"Caja",r.fecha,r.cliente,r.metodo,r.moneda,r.monto,r.concepto||r.notas||"—"]) }];
}

export function sheetsReporteVencidos(grupos, settings) {
  const cols = ["Grupo","Cliente","Saldo","Moneda","Total","Cobrado","Vencimiento","Días Vencido"];
  const filas = [];
  grupos.forEach((g)=>g.cuentas.forEach((d)=>{
    const mon=d.moneda||settings.moneda||"CRC";
    const saldo=Math.max(0,d.total-(d.pagado||0));
    const dias=Math.max(0,Math.floor((new Date()-new Date(d.fechaVencimiento))/86400000));
    filas.push([g.label,d.nombre,saldo,mon,d.total,d.pagado||0,d.fechaVencimiento,dias]);
  }));
  return [{ nombre:"Cobros Vencidos",columnas:cols,filas }];
}
