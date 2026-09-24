import React, { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Trash2, X } from "lucide-react";
import { Modulo, Boton, BotonIcono, Estado } from "../components/ui";
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
    <Modulo
      seccion="Contabilidad"
      titulo="Importar CSV del banco"
      descripcion="Cada movimiento se registra como recibo (ingreso) o compra (gasto)."
      acciones={filas.length>0 && <>
        <Boton variante="fantasma" onClick={()=>setFilas([])}>Descartar</Boton>
        <Boton icono={Upload} onClick={importar} cargando={guardando} disabled={guardando}>{guardando?"Importando…":`Importar ${filas.length} movimientos`}</Boton>
      </>}
    >
      {resultado && (
        <div className={`animate-desplegar mb-3 flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold ${resultado.ok?"bg-[#dcfce7] text-[#166534]":"bg-red-100 text-red-700"}`}>
          {resultado.ok ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {resultado.ok ? `Importados: ${resultado.ingresos} recibos (ingresos) y ${resultado.gastos} compras (gastos)` : `Error: ${resultado.error}`}
          <span className="ml-auto"><BotonIcono icono={X} titulo="Cerrar" onClick={()=>setResultado(null)}/></span>
        </div>
      )}

      {filas.length===0 ? (
        <div className={`flex-1 min-h-[300px] flex flex-col items-center justify-center gap-4 rounded-[18px] border-2 border-dashed px-6 text-center transition-all duration-300 ease-monki
          ${arrastrando?"border-monki-k bg-monki-y scale-[1.01]":"border-black/20 bg-white"}`}
          onDragOver={e=>{e.preventDefault();setArrastrando(true);}}
          onDragLeave={()=>setArrastrando(false)}
          onDrop={e=>{e.preventDefault();setArrastrando(false);cargarArchivo(e);}}>
          <span className="w-14 h-14 rounded-full bg-monki-y flex items-center justify-center shadow-[4px_4px_0_#111] animate-flotar"><Upload size={24}/></span>
          <div className="max-w-sm">
            <p className="font-extrabold text-monki-k mb-1">Arrastrá el CSV del banco aquí</p>
            <p className="text-sm text-monki-k/55">Exportá el estado de cuenta desde tu banco en CSV. Se importa como recibos o compras automáticamente.</p>
            <p className="font-mono text-[11px] text-monki-k/40 mt-3">Columnas: Fecha · Descripción · Monto — separado por coma, punto y coma o tabulación</p>
          </div>
          <label className="ui-boton inline-flex items-center gap-2 bg-monki-k text-monki-y px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600]">
            <Upload size={14}/> Elegir archivo
            <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarArchivo}/>
          </label>
        </div>
      ) : (
        <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="ui-tabla w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="monki-tag text-monki-k/50">
                  <th className="text-left px-4 py-3 font-medium border-b-2 border-black/10">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium border-b-2 border-black/10">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium border-b-2 border-black/10">Monto</th>
                  <th className="text-center px-4 py-3 font-medium border-b-2 border-black/10">Tipo (tocá para cambiar)</th>
                  <th className="w-10 border-b-2 border-black/10"/>
                </tr>
              </thead>
              <tbody>
                {filas.map((f,i)=>(
                  <tr key={i} className="border-b border-black/5 hover:bg-monki-cream/60 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-monki-k/55">{f.fecha}</td>
                    <td className="px-4 py-2">{f.descripcion}</td>
                    <td className={`px-4 py-2 text-right font-black tabular-nums ${f.monto>=0?"":"text-red-600"}`}>
                      {f.monto>=0?"+":""}{f.monto.toLocaleString("es-CR",{style:"currency",currency:"CRC"})}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={()=>toggleTipo(i)} className="ui-boton transition-transform hover:scale-105">
                        <Estado tono={f.tipo==="ingreso"?"exito":"peligro"}>{f.tipo==="ingreso"?"↑ Ingreso":"↓ Gasto"}</Estado>
                      </button>
                    </td>
                    <td className="px-2 py-1"><BotonIcono icono={Trash2} titulo="Quitar" tono="peligro" onClick={()=>eliminarFila(i)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="shrink-0 text-xs text-monki-k/45 px-4 py-2.5 border-t-2 border-black/10 bg-monki-cream/40">Revisá que cada tipo sea correcto y tocá “Importar”.</p>
        </div>
      )}
    </Modulo>
  );
}
