import React, { useState, useEffect, useCallback } from "react";
import { Upload, CheckCircle, XCircle, Minus, RefreshCw, Trash2 } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

// ── Importar CSV bancario ─────────────────────────────────────────────────────
function parseFechaCSV(s) {
  if (!s) return hoy();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return hoy();
}
function parsearCSVImport(texto) {
  const lineas = texto.split("\n").map(l=>l.trim()).filter(Boolean);
  const rows = [];
  for (let i=1; i<lineas.length; i++) {
    const cols = lineas[i].split(/[,;|\t]+/).map(c=>c.replace(/"/g,"").trim());
    if (cols.length<2) continue;
    const fecha = parseFechaCSV(cols[0]);
    const desc  = cols[1]||"";
    const numeros = cols.slice(2).map(c=>parseFloat(c.replace(/[^0-9.-]/g,""))).filter(n=>!isNaN(n)&&n!==0);
    const monto = numeros[0]||0;
    if (monto !== 0) rows.push({ fecha, descripcion:desc, monto, tipo: monto>=0?"ingreso":"gasto", ok:true });
  }
  return rows;
}

function TabImportarCSV() {
  const [filas,       setFilas]       = useState([]);
  const [guardando,   setGuardando]   = useState(false);
  const [resultado,   setResultado]   = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  const cargarArchivo = (e) => {
    const f = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setFilas(parsearCSVImport(ev.target.result)); setResultado(null); };
    r.readAsText(f,"UTF-8");
  };

  const toggleTipo = (i) => setFilas(p=>p.map((r,j)=>j===i?{...r,tipo:r.tipo==="ingreso"?"gasto":"ingreso"}:r));
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
      {filas.length===0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center gap-4 m-6 border-2 border-dashed rounded-2xl transition-colors ${arrastrando?"border-emerald-400 bg-emerald-50":"border-slate-200 bg-slate-50"}`}
          onDragOver={e=>{e.preventDefault();setArrastrando(true);}}
          onDragLeave={()=>setArrastrando(false)}
          onDrop={e=>{e.preventDefault();setArrastrando(false);cargarArchivo(e);}}>
          <Upload size={36} className="text-slate-300"/>
          <div className="text-center">
            <p className="font-semibold text-slate-500">Arrastrá el CSV del banco aquí</p>
            <p className="text-sm text-slate-400 mt-1">Columnas esperadas: Fecha · Descripción · Monto</p>
          </div>
          <label className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-emerald-700">
            <Upload size={14}/> Seleccionar archivo CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarArchivo}/>
          </label>
          {resultado && (
            <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${resultado.ok?"bg-emerald-100 text-green-800":"bg-red-100 text-red-700"}`}>
              {resultado.ok ? `✓ Importado: ${resultado.ingresos} ingresos, ${resultado.gastos} gastos` : `Error: ${resultado.error}`}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b text-xs">
            <span className="font-semibold text-slate-600">{filas.length} filas cargadas</span>
            <span className="text-slate-400">Verificá los tipos antes de importar</span>
            <button onClick={importar} disabled={guardando}
              className="ml-auto bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {guardando ? "Importando…" : "Importar todo"}
            </button>
            <button onClick={()=>setFilas([])} className="text-slate-400 hover:text-red-500 px-2 py-1.5 rounded hover:bg-red-50">Cancelar</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-center px-3 py-2">Tipo</th>
                  <th className="px-3 py-2"/>
                </tr>
              </thead>
              <tbody>
                {filas.map((f,i)=>(
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono">{f.fecha}</td>
                    <td className="px-3 py-1.5 max-w-xs truncate">{f.descripcion}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{Math.abs(f.monto).toLocaleString("es-CR",{minimumFractionDigits:2})}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={()=>toggleTipo(i)}
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${f.tipo==="ingreso"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-600"}`}>
                        {f.tipo==="ingreso"?"Ingreso":"Gasto"}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={()=>eliminarFila(i)} className="text-slate-300 hover:text-red-400">
                        <Trash2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Parsea CSV de banco (formato genérico: fecha, descripcion, monto, saldo)
function parsearCSV(texto) {
  const lineas = texto.split("\n").map(l=>l.trim()).filter(Boolean);
  const movs = [];
  for (let i=1; i<lineas.length; i++) {
    const cols = lineas[i].split(/[,;|\t]+/).map(c=>c.replace(/"/g,"").trim());
    if (cols.length<3) continue;
    const fecha  = cols[0];
    const desc   = cols[1] || cols[2] || "";
    // buscar columna con número (monto)
    const monto  = cols.slice(2).map(c=>parseFloat(c.replace(/[^0-9.-]/g,""))).find(n=>!isNaN(n)&&n!==0) || 0;
    if (fecha && monto!==0) movs.push({ fecha, descripcion:desc, monto, matchId:null });
  }
  return movs;
}

export default function ConciliacionScreen() {
  const [tab,        setTab]        = useState("conciliar"); // "conciliar" | "importar"
  const [recibos,    setRecibos]    = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [bancarios,  setBancarios]  = useState([]);
  const [matches,    setMatches]    = useState({}); // índice banco → id transacción local
  const [arrastrando,setArrastrando]= useState(false);

  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([db.getRecibos(), db.getCompras()]);
    setRecibos(r || []);
    setCompras(c || []);
  }, []);
  useEffect(()=>{ cargar(); },[cargar]);

  const cargarCSV = (e) => {
    const archivo = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const movs = parsearCSV(ev.target.result);
      setBancarios(movs);
      setMatches({});
    };
    reader.readAsText(archivo, "UTF-8");
  };

  // Auto-match por monto y fecha aproximada
  const autoMatch = () => {
    const locales = [
      ...recibos.map(r=>({...r,tipo:"ingreso",monto:r.monto||0})),
      ...compras.map(c=>({...c,tipo:"gasto",monto:-(c.total||0)})),
    ];
    const nuevos = {};
    bancarios.forEach((b,bi) => {
      if (matches[bi]) return;
      const match = locales.find(l =>
        Math.abs(l.monto - b.monto) < 1 &&
        !Object.values(nuevos).includes(l.id) &&
        !Object.values(matches).includes(l.id)
      );
      if (match) nuevos[bi] = match.id;
    });
    setMatches(p=>({...p,...nuevos}));
  };

  const matchCount   = Object.keys(matches).length;
  const noMatchCount = bancarios.length - matchCount;
  const localesNoMatch = [
    ...recibos.filter(r=>!Object.values(matches).includes(r.id)),
    ...compras.filter(c=>!Object.values(matches).includes(c.id)),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-4">
        <div className="flex gap-1">
          <button onClick={()=>setTab("conciliar")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab==="conciliar"?"bg-slate-700 text-white":"text-slate-500 hover:bg-slate-100"}`}>
            Conciliación
          </button>
          <button onClick={()=>setTab("importar")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab==="importar"?"bg-slate-700 text-white":"text-slate-500 hover:bg-slate-100"}`}>
            Importar CSV
          </button>
        </div>
        {tab==="conciliar" && bancarios.length>0 && (
          <>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{matchCount} conciliados</span>
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{noMatchCount} sin conciliar</span>
            <button onClick={autoMatch} className="flex items-center gap-1 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
              <RefreshCw size={11}/> Auto-conciliar
            </button>
          </>
        )}
        {tab==="conciliar" && (
          <label className="ml-auto flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 cursor-pointer">
            <Upload size={13}/> Cargar CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarCSV}/>
          </label>
        )}
      </div>
      {tab==="importar" && <TabImportarCSV />}

      {tab==="conciliar" && (bancarios.length===0 ? (
        /* Drop zone */
        <div className={`flex-1 flex flex-col items-center justify-center gap-4 m-6 border-2 border-dashed rounded-2xl transition-colors
          ${arrastrando?"border-emerald-400 bg-emerald-50":"border-slate-200 bg-slate-50"}`}
          onDragOver={e=>{e.preventDefault();setArrastrando(true);}}
          onDragLeave={()=>setArrastrando(false)}
          onDrop={e=>{e.preventDefault();setArrastrando(false);cargarCSV(e);}}>
          <Upload size={36} className="text-slate-300"/>
          <div className="text-center">
            <p className="font-semibold text-slate-500">Arrastrá el CSV del banco aquí</p>
            <p className="text-sm text-slate-400 mt-1">O usá el botón de arriba. Formatos: CSV, TXT separado por comas, punto y coma o tabulación.</p>
            <p className="text-xs text-slate-300 mt-2">Columnas esperadas: Fecha · Descripción · Monto (· Saldo)</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex gap-0">
          {/* Columna banco */}
          <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase">Movimientos bancarios ({bancarios.length})</p>
            </div>
            <div className="flex-1 overflow-auto">
              {bancarios.map((b,i)=>{
                const matchId = matches[i];
                const local = matchId ? [...recibos,...compras].find(x=>x.id===matchId) : null;
                return (
                  <div key={i} className={`px-4 py-2.5 border-b border-slate-100 flex items-center gap-3
                    ${matchId?"bg-emerald-50":"hover:bg-slate-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{b.descripcion}</p>
                      <p className="text-[10px] text-slate-400">{b.fecha}</p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${b.monto>=0?"text-emerald-700":"text-red-600"}`}>
                      {fmtMoney(Math.abs(b.monto),"CRC")}
                    </p>
                    {matchId
                      ? <div className="flex items-center gap-1 text-emerald-600"><CheckCircle size={14}/><span className="text-[10px]">{local?.concepto||local?.proveedor||"✓"}</span>
                          <button onClick={()=>setMatches(p=>{const n={...p};delete n[i];return n;})} className="ml-1 text-slate-300 hover:text-red-400"><XCircle size={11}/></button>
                        </div>
                      : <div className="flex items-center gap-1">
                          <Minus size={14} className="text-slate-300"/>
                          <select className="text-[10px] border border-slate-200 rounded px-1 py-0.5 max-w-[120px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            value="" onChange={e=>e.target.value&&setMatches(p=>({...p,[i]:e.target.value}))}>
                            <option value="">Asignar…</option>
                            {localesNoMatch.map(l=>(
                              <option key={l.id} value={l.id}>{l.concepto||l.proveedor||l.cliente||"—"} {fmtMoney(l.monto||l.total||0,"CRC")}</option>
                            ))}
                          </select>
                        </div>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna sistema */}
          <div className="w-72 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase">Sin conciliar en sistema ({localesNoMatch.length})</p>
            </div>
            <div className="flex-1 overflow-auto">
              {localesNoMatch.map(l=>(
                <div key={l.id} className="px-4 py-2.5 border-b border-slate-100 hover:bg-amber-50">
                  <p className="text-xs font-semibold text-slate-700 truncate">{l.concepto||l.proveedor||l.cliente||"—"}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-slate-400">{fmtDate(l.fecha||l.creadoEn)}</p>
                    <p className={`text-xs font-bold ${(l.monto||l.total||0)>=0?"text-emerald-700":"text-red-600"}`}>
                      {fmtMoney(Math.abs(l.monto||l.total||0),"CRC")}
                    </p>
                  </div>
                </div>
              ))}
              {localesNoMatch.length===0 && (
                <div className="flex flex-col items-center justify-center h-full text-green-500 gap-2 p-6">
                  <CheckCircle size={28}/>
                  <p className="text-xs font-semibold text-center">¡Todo conciliado!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
