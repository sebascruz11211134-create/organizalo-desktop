import React, { useState, useEffect, useCallback } from "react";
import { Upload, CheckCircle, XCircle, Minus, RefreshCw, Trash2, Landmark, Link2, Unlink } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio, Estado, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, fmtDate, genId, hoy } from "../utils/fmt";

// ── Zona para soltar el CSV del banco ────────────────────────────────────────
function ZonaCSV({ arrastrando, setArrastrando, onArchivo, texto }) {
  return (
    <div className={`flex-1 min-h-[260px] flex flex-col items-center justify-center gap-4 rounded-[18px] border-2 border-dashed px-6 text-center transition-all duration-300 ease-monki
      ${arrastrando ? "border-monki-k bg-monki-y scale-[1.01]" : "border-black/20 bg-white"}`}
      onDragOver={e=>{e.preventDefault();setArrastrando(true);}}
      onDragLeave={()=>setArrastrando(false)}
      onDrop={e=>{e.preventDefault();setArrastrando(false);onArchivo(e);}}>
      <span className="w-14 h-14 rounded-full bg-monki-y flex items-center justify-center shadow-[4px_4px_0_#111] animate-flotar"><Upload size={24}/></span>
      <div>
        <p className="font-extrabold text-monki-k">Arrastrá el CSV del banco aquí</p>
        <p className="text-sm text-monki-k/55 mt-1">{texto}</p>
        <p className="font-mono text-[11px] text-monki-k/40 mt-2">Columnas: Fecha · Descripción · Monto (· Saldo)</p>
      </div>
      <label className="ui-boton inline-flex items-center gap-2 bg-monki-k text-monki-y px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600]">
        <Upload size={14}/> Elegir archivo CSV
        <input type="file" accept=".csv,.txt" className="hidden" onChange={onArchivo}/>
      </label>
    </div>
  );
}

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

  if (filas.length===0) {
    return (
      <div className="flex-1 flex flex-col gap-3">
        <ZonaCSV arrastrando={arrastrando} setArrastrando={setArrastrando} onArchivo={cargarArchivo}
          texto="Cada fila se registra como ingreso (recibo) o gasto (compra)."/>
        {resultado && (
          <div className={`animate-desplegar px-4 py-2.5 rounded-full text-sm font-bold ${resultado.ok?"bg-[#dcfce7] text-[#166534]":"bg-red-100 text-red-700"}`}>
            {resultado.ok ? `Importado: ${resultado.ingresos} ingresos y ${resultado.gastos} gastos` : `Error: ${resultado.error}`}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b-2 border-black/10">
        <b className="text-monki-k">{filas.length} filas cargadas</b>
        <span className="text-sm text-monki-k/50">Tocá el tipo para cambiarlo antes de importar.</span>
        <div className="flex-1"/>
        <Boton variante="fantasma" tamano="sm" onClick={()=>setFilas([])}>Cancelar</Boton>
        <Boton tamano="sm" icono={Upload} onClick={importar} cargando={guardando} disabled={guardando}>{guardando ? "Importando…" : "Importar todo"}</Boton>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="ui-tabla w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="monki-tag text-monki-k/50">
              <th className="text-left px-4 py-2.5 font-medium border-b-2 border-black/10">Fecha</th>
              <th className="text-left px-4 py-2.5 font-medium border-b-2 border-black/10">Descripción</th>
              <th className="text-right px-4 py-2.5 font-medium border-b-2 border-black/10">Monto</th>
              <th className="text-center px-4 py-2.5 font-medium border-b-2 border-black/10">Tipo</th>
              <th className="border-b-2 border-black/10"/>
            </tr>
          </thead>
          <tbody>
            {filas.map((f,i)=>(
              <tr key={i} className="border-b border-black/5 hover:bg-monki-cream/60 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{f.fecha}</td>
                <td className="px-4 py-2 max-w-xs truncate">{f.descripcion}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums">{Math.abs(f.monto).toLocaleString("es-CR",{minimumFractionDigits:2})}</td>
                <td className="px-4 py-2 text-center">
                  <button type="button" onClick={()=>toggleTipo(i)} className="ui-boton transition-transform hover:scale-105">
                    <Estado tono={f.tipo==="ingreso"?"exito":"peligro"}>{f.tipo==="ingreso"?"Ingreso":"Gasto"}</Estado>
                  </button>
                </td>
                <td className="px-2 py-1 text-right"><BotonIcono icono={Trash2} titulo="Quitar" tono="peligro" onClick={()=>eliminarFila(i)}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <Modulo
      seccion="Contabilidad"
      titulo="Conciliación bancaria"
      descripcion="Compará el estado de cuenta del banco con lo registrado en el sistema."
      acciones={tab==="conciliar" && <>
        {bancarios.length>0 && <Boton variante="secundario" icono={RefreshCw} onClick={autoMatch}>Auto-conciliar</Boton>}
        <label className="ui-boton inline-flex items-center gap-2 bg-monki-k text-monki-y px-5 py-2.5 rounded-full text-[13px] font-bold cursor-pointer transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600]">
          <Upload size={15}/> Cargar CSV
          <input type="file" accept=".csv,.txt" className="hidden" onChange={cargarCSV}/>
        </label>
      </>}
      indicadores={tab==="conciliar" && bancarios.length>0 && (
        <Indicadores>
          <Indicador etiqueta="Del banco" valor={bancarios.length} detalle="Movimientos cargados" icono={Landmark} delay={40}/>
          <Indicador etiqueta="Conciliados" valor={matchCount} icono={Link2} destacado delay={90}/>
          <Indicador etiqueta="Sin conciliar" valor={noMatchCount} detalle="En el banco" icono={Unlink} alerta={noMatchCount>0} delay={140}/>
          <Indicador etiqueta="Pendientes en sistema" valor={localesNoMatch.length} delay={190}/>
        </Indicadores>
      )}
      pestanas={{ activa: tab, onCambiar: setTab, items: [{key:"conciliar",label:"Conciliación"},{key:"importar",label:"Importar CSV"}] }}
    >
      {tab==="importar" && <TabImportarCSV />}

      {tab==="conciliar" && (bancarios.length===0 ? (
        <ZonaCSV arrastrando={arrastrando} setArrastrando={setArrastrando} onArchivo={cargarCSV}
          texto="O usá el botón de arriba. Acepta CSV o TXT separado por comas, punto y coma o tabulación."/>
      ) : (
        <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
          <Tarjeta titulo={`Movimientos del banco (${bancarios.length})`} className="flex-1 min-h-[300px] lg:min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              {bancarios.map((b,i)=>{
                const matchId = matches[i];
                const local = matchId ? [...recibos,...compras].find(x=>x.id===matchId) : null;
                return (
                  <div key={i} className={`px-4 py-2.5 border-t border-black/5 flex flex-wrap items-center gap-3 transition-colors ${matchId?"bg-[#FFF4B8]":"hover:bg-monki-cream/60"}`}>
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-sm font-bold text-monki-k truncate">{b.descripcion}</p>
                      <p className="font-mono text-[10px] text-monki-k/45">{b.fecha}</p>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${b.monto>=0?"text-monki-k":"text-red-600"}`}>{b.monto<0?"−":""}{fmtMoney(Math.abs(b.monto),"CRC")}</p>
                    {matchId
                      ? <div className="flex items-center gap-1.5">
                          <Estado tono="exito">{local?.concepto||local?.proveedor||"Conciliado"}</Estado>
                          <BotonIcono icono={XCircle} titulo="Deshacer" tono="peligro" onClick={()=>setMatches(p=>{const n={...p};delete n[i];return n;})}/>
                        </div>
                      : <div className="flex items-center gap-1">
                          <Minus size={14} className="text-monki-k/25"/>
                          <select className="text-xs bg-white border-2 border-black/10 rounded-full px-2.5 py-1 max-w-[170px] cursor-pointer"
                            value="" onChange={e=>e.target.value&&setMatches(p=>({...p,[i]:e.target.value}))}>
                            <option value="">Asignar…</option>
                            {localesNoMatch.map(l=>(
                              <option key={l.id} value={l.id}>{l.concepto||l.proveedor||l.cliente||"—"} {fmtMoney(l.monto||l.total||0,"CRC")}</option>
                            ))}
                          </select>
                        </div>}
                  </div>
                );
              })}
            </div>
          </Tarjeta>

          <Tarjeta titulo={`Sin conciliar en el sistema (${localesNoMatch.length})`} className="w-full lg:w-80 shrink-0 min-h-[240px] lg:min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              {localesNoMatch.map(l=>(
                <div key={l.id} className="px-4 py-2.5 border-t border-black/5 hover:bg-monki-cream/60 transition-colors">
                  <p className="text-sm font-bold text-monki-k truncate">{l.concepto||l.proveedor||l.cliente||"—"}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="font-mono text-[10px] text-monki-k/45">{fmtDate(l.fecha||l.creadoEn)}</p>
                    <p className={`text-sm font-bold ${(l.monto||l.total||0)>=0?"text-monki-k":"text-red-600"}`}>{fmtMoney(Math.abs(l.monto||l.total||0),"CRC")}</p>
                  </div>
                </div>
              ))}
              {localesNoMatch.length===0 && <Vacio icono={CheckCircle} titulo="¡Todo conciliado!"/>}
            </div>
          </Tarjeta>
        </div>
      ))}
    </Modulo>
  );
}
