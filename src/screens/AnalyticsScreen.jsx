import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, BarChart2, Users, Package, DollarSign } from "lucide-react";
import db from "../utils/db";
import { fmtMoney } from "../utils/fmt";

function KPI({ label, value, sub, color, Icon, trend }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white"/>
        </div>
        {trend != null && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trend>=0?"text-green-600":"text-red-500"}`}>
            {trend>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ data, label, color="#059669" }) {
  const max = Math.max(...data.map(d=>d.v), 1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">{label}</h3>
      <div className="flex items-end gap-2 h-32">
        {data.map((d,i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-400">{fmtMoney(d.v,"CRC").replace("₡","")}</span>
            <div className="w-full rounded-t-md transition-all" style={{ height:`${(d.v/max)*100}%`, background:color, minHeight: d.v>0?"4px":"0" }}/>
            <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListTop({ items, label, valueKey="total", nameKey="nombre" }) {
  const max = Math.max(...items.map(x=>x[valueKey]||0),1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">{label}</h3>
      <div className="space-y-2.5">
        {items.slice(0,5).map((x,i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[60%]">{x[nameKey]||"Sin nombre"}</span>
              <span className="text-xs font-bold text-slate-800">{fmtMoney(x[valueKey]||0,"CRC")}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{width:`${((x[valueKey]||0)/max)*100}%`}}/>
            </div>
          </div>
        ))}
        {items.length===0 && <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>}
      </div>
    </div>
  );
}

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [periodo, setPeriodo] = useState("mes"); // "mes" | "trimestre" | "año"

  const cargar = useCallback(async () => {
    const [facturas, compras, recibos, productos, contactos] = await Promise.all([
      db.getFacturas(), db.getCompras(), db.getRecibos(), db.getProductos(), db.getContactos()
    ]);

    const ahora = new Date();
    const filtrarPor = (arr, campoFecha) => {
      return arr.filter(x => {
        const f = new Date(x[campoFecha]||x.fecha||x.creadoEn||0);
        if (periodo==="mes")      return f.getMonth()===ahora.getMonth() && f.getFullYear()===ahora.getFullYear();
        if (periodo==="trimestre"){
          const q = Math.floor(ahora.getMonth()/3);
          return Math.floor(f.getMonth()/3)===q && f.getFullYear()===ahora.getFullYear();
        }
        return f.getFullYear()===ahora.getFullYear();
      });
    };

    const factPer  = filtrarPor(facturas,"fecha");
    const compraPer= filtrarPor(compras,"fecha");
    const recibosPer=filtrarPor(recibos,"fecha");

    const ingresos  = factPer.reduce((s,f)=>s+(f.total||0),0);
    const gastos    = compraPer.reduce((s,c)=>s+(c.total||0),0);
    const cobrado   = recibosPer.reduce((s,r)=>s+(r.monto||0),0);
    const ivaCobrar = factPer.reduce((s,f)=>s+(f.totalIVA||0),0);
    const ivaCredito= compraPer.reduce((s,c)=>s+(c.montoIVA||0),0);

    // Por mes (últimos 6 meses)
    const meses = Array.from({length:6},(_,i)=>{
      const d = new Date(ahora.getFullYear(), ahora.getMonth()-5+i, 1);
      return { mes:d.getMonth(), año:d.getFullYear(), label:d.toLocaleString("es-CR",{month:"short"}) };
    });
    const ventasMes = meses.map(m=>({
      k:m.label,
      v:facturas.filter(f=>{const d=new Date(f.fecha||f.creadoEn||0);return d.getMonth()===m.mes&&d.getFullYear()===m.año;}).reduce((s,f)=>s+(f.total||0),0)
    }));

    // Top productos (por cantidad facturada)
    const prodMap = {};
    factPer.forEach(f=>(f.lineas||[]).forEach(l=>{
      if(!prodMap[l.descripcion]) prodMap[l.descripcion]={nombre:l.descripcion,total:0,unidades:0};
      prodMap[l.descripcion].total+=l.total||0;
      prodMap[l.descripcion].unidades+=parseFloat(l.cantidad)||1;
    }));
    const topProductos = Object.values(prodMap).sort((a,b)=>b.total-a.total).slice(0,5);

    // Top clientes
    const clientMap = {};
    factPer.forEach(f=>{
      const k=f.cliente?.nombre||"Consumidor Final";
      if(!clientMap[k]) clientMap[k]={nombre:k,total:0,facturas:0};
      clientMap[k].total+=f.total||0; clientMap[k].facturas++;
    });
    const topClientes = Object.values(clientMap).sort((a,b)=>b.total-a.total).slice(0,5);

    setData({ ingresos, gastos, cobrado, ivaCobrar, ivaCredito, ventasMes, topProductos, topClientes,
      numFacturas:factPer.length, margen:ingresos>0?((ingresos-gastos)/ingresos*100):0 });
  },[periodo]);

  useEffect(()=>{ cargar(); },[cargar]);

  if (!data) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Cargando análisis…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Selector de período */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase mr-2">Período:</span>
        {[["mes","Este mes"],["trimestre","Este trimestre"],["año","Este año"]].map(([k,l])=>(
          <button key={k} onClick={()=>setPeriodo(k)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${periodo===k?"bg-brand-500 text-white":"border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-5 gap-4">
          <KPI label="Ventas" value={fmtMoney(data.ingresos,"CRC")} sub={`${data.numFacturas} facturas`} Icon={TrendingUp} color="bg-green-500" trend={null}/>
          <KPI label="Gastos" value={fmtMoney(data.gastos,"CRC")} sub="compras registradas" Icon={TrendingDown} color="bg-red-500" trend={null}/>
          <KPI label="Margen bruto" value={`${data.margen.toFixed(1)}%`} sub="(Ventas - Compras) / Ventas" Icon={BarChart2} color="bg-blue-500" trend={null}/>
          <KPI label="IVA por declarar" value={fmtMoney(data.ivaCobrar-data.ivaCredito,"CRC")} sub={`D-104 estimado`} Icon={DollarSign} color="bg-amber-500" trend={null}/>
          <KPI label="Cobrado" value={fmtMoney(data.cobrado,"CRC")} sub="recibos del período" Icon={TrendingUp} color="bg-brand-500" trend={null}/>
        </div>

        {/* Gráfico de ventas */}
        <BarChart data={data.ventasMes} label="Ventas mensuales (últimos 6 meses)"/>

        {/* Top productos y clientes */}
        <div className="grid grid-cols-2 gap-4">
          <ListTop items={data.topProductos} label="Top productos / servicios" valueKey="total" nameKey="nombre"/>
          <ListTop items={data.topClientes} label="Top clientes" valueKey="total" nameKey="nombre"/>
        </div>
      </div>
    </div>
  );
}
