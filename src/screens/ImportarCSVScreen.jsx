import React, { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import db from "../utils/db";
import { genId, hoy } from "../utils/fmt";

// Intenta parsear fecha en varios formatos
function parseFecha(s) {
  if (!s) return hoy();
  // DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return hoy();
}

function parsearCSV(texto) {
  const lineas = texto.split("\n").map(l=>l.trim()).filter(Boolean);
  const rows = [];
  for (let i=1; i<lineas.length; i++) {
    const cols = lineas[i].split(/[,;|\t]+/).map(c=>c.replace(/"/g,"").trim());
    if (cols.length<2) continue;
    const fecha = parseFecha(cols[0]);
    const desc  = cols[1]||"";
    const numeros = cols.slice(2).map(c=>parseFloat(c.replace(/[^0-9.-]/g,""))).filter(n=>!isNaN(n)&&n!==0);
    const monto = numeros[0]||0;
    rows.push({ fecha, descripcion:desc, monto, tipo: monto>=0?"ingreso":"gasto", ok:true });
  }
  return rows;
}

export default function ImportarCSVScreen() {
  const [filas,      setFilas]      = useState([]);
  const [guardando,  setGuardando]  = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [arrastrando,setArrastrando]= useState(false);
  const [mapeo,      setMapeo]      = useState({ tipo:"auto" }); // cómo interpretar el CSV

  const cargarArchivo = (e) => {
    const f = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const rows = parsearCSV(ev.target.result);
      setFilas(rows);
      setResultado(null);
    };
    r.readAsText(f,"UTF-8");
  };

  const toggleTipo = (i) => {
    setFilas(p=>p.map((r,j)=>j===i?{...r,tipo:r.tipo==="ingreso"?"gasto":"ingreso"}:r));
  };

  const eliminarFila = (i) => setFilas(p=>p.filter((_,j)=>j!==i));

  const importar = async () => {
    setGuardando(true);
    try {
      const ingresos = filas.filter(f=>f.tipo==="ingreso").map(f=>({ id:genId(), concepto:f.descripcion, monto:Math.abs(f.monto), fecha:f.fecha, metodo:"Transferencia", creadoEn:new Date().toISOString() }));
      const gastos   = filas.filter(f=>f.tipo==="gasto").map(f=>({ id:genId(), proveedor:f.descripcion, numFactura:"CSV", fecha:f.fecha, fechaVence:"", categoria:"Otro", medio:"Transferencia", estado:"pagada", montoBase:Math.abs(f.monto), pctIVA:0, montoIVA:0, total:Math.abs(f.monto), notas:"Importado desde CSV banco", creadoEn:new Date().toISOString() }));

      const [recibosAct, comprasAct] = await Promise.all([db.getRecibos(), db.getCompras()]);
      await Promise.all([
        db.setRecibos([...recibosAct, ...ingresos]),
        db.setCompras([...comprasAct, ...gastos]),
      ]);
      setResultado({ ingresos:ingresos.length, gastos:gastos.length, ok:true });
      setFilas([]);
    } catch(e) {
      setResultado({ error:e.message, ok:false });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <h2 className="font-bold text-slate-700 text-sm flex-1">Importar estado de cuenta bancario (CSV)</h2>
        {filas.length>0 && (
          <>
            <span className="text-xs text-slate-500">{filas.length} movimientos</span>
            <button onClick={importar} disabled={guardando}
              className="flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-60">
              {guardando?"Importando…":"Importar todo"}
            </button>
          </>
        )}
      </div>

      {resultado && (
        <div className={`mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
          ${resultado.ok?"bg-green-50 border border-green-200 text-green-700":"bg-red-50 border border-red-200 text-red-700"}`}>
          {resultado.ok ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {resultado.ok
            ? `✓ Importados: ${resultado.ingresos} recibos (ingresos) y ${resultado.gastos} compras (gastos)`
            : `Error: ${resultado.error}`}
          <button onClick={()=>setResultado(null)} className="ml-auto text-xs underline">Cerrar</button>
        </div>
      )}

      {filas.length===0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center gap-4 m-6 border-2 border-dashed rounded-2xl transition-colors
          ${arrastrando?"border-brand-400 bg-brand-50":"border-slate-200 bg-slate-50"}`}
          onDragOver={e=>{e.preventDefault();setArrastrando(true);}}
          onDragLeave={()=>setArrastrando(false)}
          onDrop={e=>{e.preventDefault();setArrastrando(false);cargarArchivo(e);}}>
          <Upload size={36} className="text-slate-300"/>
          <div className="text-center max-w-sm">
            <p className="font-semibold text-slate-500 mb-1">Arrastrá tu CSV del banco aquí</p>
            <p className="text-sm text-slate-400">Exportá el estado de cuenta desde tu banco en formato CSV y arrástralo aquí. Se importarán como recibos (ingresos) o compras (gastos) automáticamente.</p>
            <p className="text-xs text-slate-300 mt-3">Columnas esperadas: Fecha · Descripción · Monto<br/>Separador: coma, punto y coma o tabulación</p>
            <label className="mt-4 inline-flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600 cursor-pointer">
              <Upload size={14}/> Seleccionar archivo
              <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarArchivo}/>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-500 uppercase">
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Descripción</th>
                  <th className="text-right px-4 py-2.5">Monto</th>
                  <th className="text-center px-4 py-2.5">Tipo (clic para cambiar)</th>
                  <th className="w-10"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f,i)=>(
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">{f.fecha}</td>
                    <td className="px-4 py-2 text-xs">{f.descripcion}</td>
                    <td className={`px-4 py-2 text-right font-bold text-sm ${f.monto>=0?"text-green-700":"text-red-600"}`}>
                      {f.monto>=0?"+":""}{f.monto.toLocaleString("es-CR",{style:"currency",currency:"CRC"})}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={()=>toggleTipo(i)}
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer transition-colors
                          ${f.tipo==="ingreso"?"bg-green-100 text-green-700 hover:bg-green-200":"bg-red-100 text-red-600 hover:bg-red-200"}`}>
                        {f.tipo==="ingreso"?"↑ Ingreso":"↓ Gasto"}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={()=>eliminarFila(i)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400">
                        <Trash2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">Revisá que el tipo sea correcto (ingreso/gasto) y hacé clic en "Importar todo"</p>
        </div>
      )}
    </div>
  );
}
