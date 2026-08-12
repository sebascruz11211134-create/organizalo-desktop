import React, { useState, useEffect, useCallback } from "react";
import { Upload, CheckCircle, XCircle, Minus, RefreshCw } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, fmtDate } from "../utils/fmt";

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
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <h2 className="font-bold text-slate-700 text-sm">Conciliación bancaria</h2>
        {bancarios.length>0 && (
          <>
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{matchCount} conciliados</span>
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{noMatchCount} sin conciliar</span>
            <button onClick={autoMatch} className="flex items-center gap-1 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 ml-2">
              <RefreshCw size={11}/> Auto-conciliar
            </button>
          </>
        )}
        <label className="ml-auto flex items-center gap-2 bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600 cursor-pointer">
          <Upload size={13}/> Cargar estado de cuenta (CSV)
          <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarCSV}/>
        </label>
      </div>

      {bancarios.length===0 ? (
        /* Drop zone */
        <div className={`flex-1 flex flex-col items-center justify-center gap-4 m-6 border-2 border-dashed rounded-2xl transition-colors
          ${arrastrando?"border-brand-400 bg-brand-50":"border-slate-200 bg-slate-50"}`}
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
                    ${matchId?"bg-green-50":"hover:bg-slate-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{b.descripcion}</p>
                      <p className="text-[10px] text-slate-400">{b.fecha}</p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${b.monto>=0?"text-green-700":"text-red-600"}`}>
                      {fmtMoney(Math.abs(b.monto),"CRC")}
                    </p>
                    {matchId
                      ? <div className="flex items-center gap-1 text-green-600"><CheckCircle size={14}/><span className="text-[10px]">{local?.concepto||local?.proveedor||"✓"}</span>
                          <button onClick={()=>setMatches(p=>{const n={...p};delete n[i];return n;})} className="ml-1 text-slate-300 hover:text-red-400"><XCircle size={11}/></button>
                        </div>
                      : <div className="flex items-center gap-1">
                          <Minus size={14} className="text-slate-300"/>
                          <select className="text-[10px] border border-slate-200 rounded px-1 py-0.5 max-w-[120px] focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                    <p className={`text-xs font-bold ${(l.monto||l.total||0)>=0?"text-green-700":"text-red-600"}`}>
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
      )}
    </div>
  );
}
