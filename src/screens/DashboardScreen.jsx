/**
 * DashboardScreen — Visión financiera completa
 * KPIs · Gráfico ingresos vs gastos · Facturas recientes · Top clientes · IA Insights
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Receipt, AlertTriangle, ChevronRight, Users,
  ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw,
  BarChart2, FileText, Package, Wallet, Bell,
} from "lucide-react";
import db from "../utils/db";
import { fmtMoney, hoy } from "../utils/fmt";

const BACKEND = "https://organizalo-backend-production.up.railway.app";

// ── Utilidades de fecha ────────────────────────────────────────────────────────
function getMesLabel(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString("es-CR", { month: "short" });
}
function getMesKey(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7); // "2025-06"
}

// ── Gráfico SVG de líneas ──────────────────────────────────────────────────────
function LineAreaChart({ series, height = 140 }) {
  // series: [{ label, value, value2? }]  value=ingresos, value2=gastos
  if (!series || series.length < 2) return (
    <div className="flex items-center justify-center h-32 text-xs text-slate-300">Sin datos suficientes</div>
  );

  const W = 560, H = height;
  const pad = { l: 48, r: 12, t: 12, b: 28 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const maxVal = Math.max(...series.flatMap(d => [d.value, d.value2 || 0]), 1);

  const toX = i => pad.l + (i / (series.length - 1)) * pw;
  const toY = v => pad.t + ph - (v / maxVal) * ph;

  const linePoints = series.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
  const areaPath =
    `M ${toX(0)},${pad.t + ph} ` +
    series.map((d, i) => `L ${toX(i)},${toY(d.value)}`).join(" ") +
    ` L ${toX(series.length - 1)},${pad.t + ph} Z`;

  const line2Points = series.map((d, i) => `${toX(i)},${toY(d.value2 || 0)}`).join(" ");
  const area2Path =
    `M ${toX(0)},${pad.t + ph} ` +
    series.map((d, i) => `L ${toX(i)},${toY(d.value2 || 0)}`).join(" ") +
    ` L ${toX(series.length - 1)},${pad.t + ph} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [0, 0.5, 1].map(f => ({
    y: pad.t + ph - f * ph,
    label: fmtMoney(maxVal * f, "CRC", true),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} y1={t.y} x2={W - pad.r} y2={t.y}
            stroke="#f1f5f9" strokeWidth="1" />
          <text x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{t.label}</text>
        </g>
      ))}

      {/* Gastos area+line */}
      <path d={area2Path} fill="url(#gradOut)" />
      <polyline points={line2Points} fill="none" stroke="#ef4444" strokeWidth="1.5"
        strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Ingresos area+line */}
      <path d={areaPath} fill="url(#gradIn)" />
      <polyline points={linePoints} fill="none" stroke="#059669" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots ingresos */}
      {series.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.value)} r="3.5"
          fill="white" stroke="#059669" strokeWidth="2" />
      ))}

      {/* X labels */}
      {series.map((d, i) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, trend, trendUp, onClick, alert, color = "slate" }) {
  const colors = {
    green:  { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-500", val: "text-emerald-700" },
    red:    { bg: "bg-red-50",     border: "border-red-100",     icon: "text-red-400",     val: "text-red-700"     },
    blue:   { bg: "bg-blue-50",    border: "border-blue-100",    icon: "text-blue-500",    val: "text-slate-900"   },
    slate:  { bg: "bg-white",      border: "border-slate-200",   icon: "text-slate-400",   val: "text-slate-900"   },
  };
  const c = alert ? colors.red : colors[color];

  return (
    <button onClick={onClick}
      className={`group flex flex-col gap-2.5 p-4 ${c.bg} border ${c.border} rounded-xl text-left
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={`p-1.5 rounded-lg bg-white shadow-sm`}>
          <Icon size={12} className={c.icon} />
        </div>
      </div>
      <p className={`text-xl font-bold tracking-tight leading-none ${c.val}`}>{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400">{sub}</p>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold
            ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
            {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Badge estado factura ───────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const map = {
    pendiente: "bg-amber-100 text-amber-700",
    pagada:    "bg-green-100 text-green-700",
    vencida:   "bg-red-100 text-red-700",
    enviada:   "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${map[estado] || "bg-slate-100 text-slate-500"}`}>
      {estado || "—"}
    </span>
  );
}

// ── Insight IA compacto ────────────────────────────────────────────────────────
function InsightCard({ stats, facturas, debts }) {
  const insight = useMemo(() => {
    const hd  = hoy();
    const mes = hd.slice(0, 7);
    const prev = (() => { const d = new Date(mes + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

    const factMes = facturas.filter(f => (f.fecha || f.fechaEmision || "").startsWith(mes));
    const factAnt = facturas.filter(f => (f.fecha || f.fechaEmision || "").startsWith(prev));
    const totMes  = factMes.reduce((s, f) => s + (f.totalGeneral || f.total || 0), 0);
    const totAnt  = factAnt.reduce((s, f) => s + (f.totalGeneral || f.total || 0), 0);
    const venc    = debts.filter(d => d.tipo === "cobrar" && (d.saldo || d.total) > 0 && d.fechaVencimiento && d.fechaVencimiento < hd);

    if (venc.length > 0) {
      const tv = venc.reduce((s, d) => s + (d.saldo || d.total || 0), 0);
      return { icon: "⚠️", color: "bg-red-50 border-red-100 text-red-800", texto: `${venc.length} cobro${venc.length > 1 ? "s" : ""} vencido${venc.length > 1 ? "s" : ""} por ${fmtMoney(tv, "CRC")}` };
    }
    if (totAnt > 0) {
      const pct = ((totMes - totAnt) / totAnt * 100).toFixed(0);
      const sube = parseInt(pct) >= 0;
      return { icon: sube ? "📈" : "📉", color: sube ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-amber-50 border-amber-100 text-amber-800", texto: `Ventas ${sube ? "+" : ""}${pct}% vs mes anterior` };
    }
    return { icon: "✅", color: "bg-slate-50 border-slate-200 text-slate-600", texto: "Todo en orden. Seguí registrando." };
  }, [stats.facturasMes]);

  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${insight.color}`}>
      <span className="text-lg shrink-0">{insight.icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-60">IA · Insight</p>
        <p className="text-xs font-medium leading-snug">{insight.texto}</p>
      </div>
      <Sparkles size={13} className="ml-auto shrink-0 opacity-40" />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigate = useNavigate();

  const [loading,       setLoading]       = useState(true);
  const [recibos,       setRecibos]       = useState([]);
  const [compras,       setCompras]       = useState([]);
  const [facturas,      setFacturas]      = useState([]);
  const [debts,         setDebts]         = useState([]);
  const [settings,      setSettings]      = useState({});

  useEffect(() => {
    (async () => {
      const [r, c, f, d, s] = await Promise.all([
        db.getRecibos(), db.getCompras(), db.getFacturas(), db.getDebts(), db.getSettings(),
      ]);
      setRecibos(r);
      setCompras(c);
      setFacturas(f);
      setDebts(d);
      setSettings(s || {});
      setLoading(false);
    })();
  }, []);

  // ── Cálculos memoizados ────────────────────────────────────────────────────
  const { kpis, chartData, recentFacturas, topClientes, statsForIA } = useMemo(() => {
    const hd  = hoy();
    const mes = hd.slice(0, 7);
    const prev = (() => { const d = new Date(mes + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

    // KPIs
    const ingresosMes = recibos.filter(r => (r.fecha || "").startsWith(mes)).reduce((s, r) => s + (r.monto || 0), 0);
    const ingresosPrev = recibos.filter(r => (r.fecha || "").startsWith(prev)).reduce((s, r) => s + (r.monto || 0), 0);
    const gastosMes   = compras.filter(c => (c.fecha || "").startsWith(mes)).reduce((s, c) => s + (c.total || c.montoBase || 0), 0);
    const gastosPrev  = compras.filter(c => (c.fecha || "").startsWith(prev)).reduce((s, c) => s + (c.total || c.montoBase || 0), 0);

    const cxc = debts.filter(d => (d.tipo || "pagar") === "cobrar");
    const cxp = debts.filter(d => (d.tipo || "pagar") === "pagar");
    const totalCXC = cxc.reduce((s, d) => s + Math.max(0, (d.saldo || d.total || 0) - (d.pagado || 0)), 0);
    const totalCXP = cxp.reduce((s, d) => s + Math.max(0, (d.saldo || d.total || 0) - (d.pagado || 0)), 0);
    const vencidas  = cxc.filter(d => d.fechaVencimiento && d.fechaVencimiento < hd && (d.saldo || d.total || 0) > 0).length;

    const utilidad  = ingresosMes - gastosMes;
    const ingTrend  = ingresosPrev > 0 ? `${((ingresosMes - ingresosPrev) / ingresosPrev * 100).toFixed(0)}%` : null;
    const gasTrend  = gastosPrev  > 0 ? `${((gastosMes   - gastosPrev)  / gastosPrev  * 100).toFixed(0)}%` : null;

    const kpis = { ingresosMes, gastosMes, totalCXC, utilidad, ingTrend, gasTrend, ingresosPrev, gastosPrev, vencidas };

    // Chart: últimos 6 meses
    const chartData = Array.from({ length: 6 }, (_, i) => {
      const key = getMesKey(i - 5);
      const lbl = getMesLabel(i - 5);
      const ing = recibos.filter(r => (r.fecha || "").startsWith(key)).reduce((s, r) => s + (r.monto || 0), 0);
      const gas = compras.filter(c => (c.fecha || "").startsWith(key)).reduce((s, c) => s + (c.total || c.montoBase || 0), 0);
      return { label: lbl, value: ing, value2: gas };
    });

    // Facturas recientes (últimas 5)
    const recentFacturas = [...facturas]
      .sort((a, b) => (b.fecha || b.fechaEmision || "").localeCompare(a.fecha || a.fechaEmision || ""))
      .slice(0, 5);

    // Top 5 clientes por CXC pendiente
    const clienteMap = {};
    cxc.forEach(d => {
      const nombre = d.clienteNombre || d.nombre || "Sin nombre";
      clienteMap[nombre] = (clienteMap[nombre] || 0) + Math.max(0, (d.saldo || d.total || 0) - (d.pagado || 0));
    });
    // También de facturas
    facturas.forEach(f => {
      const nombre = f.clienteNombre || f.cliente || "Sin nombre";
      if (!clienteMap[nombre]) {
        const total = f.totalGeneral || f.total || 0;
        if (total > 0) clienteMap[nombre] = (clienteMap[nombre] || 0) + total;
      }
    });
    const topClientes = Object.entries(clienteMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, total]) => ({ nombre, total }));

    const statsForIA = { facturasMes: facturas.filter(f => (f.fecha || f.fechaEmision || "").startsWith(mes)).length, vencidas, totalCXC, totalCXP };

    return { kpis, chartData, recentFacturas, topClientes, statsForIA };
  }, [recibos, compras, facturas, debts]);

  const negocio = settings?.nombreNegocio || "Mi negocio";
  const fecha   = new Date().toLocaleDateString("es-CR", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw size={14} className="animate-spin" /> Cargando dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      <div className="p-6 max-w-[1100px] mx-auto w-full">

        {/* ── Header ── */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Bienvenido, {negocio}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{fecha}</p>
          </div>
          <button onClick={() => navigate("/facturacion")}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold
                       px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all">
            <Receipt size={12} /> Nueva factura
          </button>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Ingresos este mes"
            value={fmtMoney(kpis.ingresosMes, "CRC")}
            sub="Recibos registrados"
            icon={TrendingUp}
            color="green"
            trend={kpis.ingTrend}
            trendUp={parseFloat(kpis.ingTrend) >= 0}
            onClick={() => navigate("/recibos")}
          />
          <KpiCard
            label="Por cobrar (CXC)"
            value={fmtMoney(kpis.totalCXC, "CRC")}
            sub={kpis.vencidas > 0 ? `${kpis.vencidas} vencida${kpis.vencidas > 1 ? "s" : ""}` : "Al día"}
            icon={DollarSign}
            color={kpis.vencidas > 0 ? "slate" : "slate"}
            alert={kpis.vencidas > 0}
            onClick={() => navigate("/cxc")}
          />
          <KpiCard
            label="Gastos este mes"
            value={fmtMoney(kpis.gastosMes, "CRC")}
            sub="Compras y gastos"
            icon={TrendingDown}
            color="slate"
            trend={kpis.gasTrend}
            trendUp={false}
            onClick={() => navigate("/compras")}
          />
          <KpiCard
            label="Utilidad estimada"
            value={fmtMoney(Math.abs(kpis.utilidad), "CRC")}
            sub={kpis.utilidad >= 0 ? "Ingresos − Gastos" : "Déficit este mes"}
            icon={BarChart2}
            color={kpis.utilidad >= 0 ? "green" : "red"}
            alert={kpis.utilidad < 0}
            onClick={() => navigate("/analytics")}
          />
        </div>

        {/* ── Insight IA ── */}
        <div className="mb-5">
          <InsightCard stats={statsForIA} facturas={facturas} debts={debts} />
        </div>

        {/* ── Cuerpo principal: 2 columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Columna izquierda (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Gráfico ingresos vs gastos */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ingresos vs Gastos</h3>
                  <p className="text-[10px] text-slate-400">Últimos 6 meses</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                    <span className="w-4 h-0.5 bg-emerald-500 rounded inline-block"/> Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400">
                    <span className="w-4 h-0.5 bg-red-400 rounded inline-block border-dashed"/> Gastos
                  </span>
                </div>
              </div>
              <LineAreaChart series={chartData} height={140} />
            </div>

            {/* Facturas recientes */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Facturas recientes</h3>
                <button onClick={() => navigate("/facturas-historial")}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold">
                  Ver todas <ChevronRight size={12} />
                </button>
              </div>
              {recentFacturas.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400">
                  Aún no hay facturas emitidas.<br />
                  <button onClick={() => navigate("/facturacion")} className="text-emerald-600 font-semibold mt-1">Crear primera factura →</button>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                      <th className="text-left px-5 py-2.5">N°</th>
                      <th className="text-left px-3 py-2.5">Cliente</th>
                      <th className="text-left px-3 py-2.5">Fecha</th>
                      <th className="text-right px-3 py-2.5">Total</th>
                      <th className="text-center px-4 py-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentFacturas.map((f, i) => (
                      <tr key={f.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-[10px] text-slate-500">
                          {f.numFactura || f.consecutivo || `#${String(i + 1).padStart(4, "0")}`}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700 truncate max-w-[140px]">
                          {f.clienteNombre || f.cliente || "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-400">
                          {(f.fecha || f.fechaEmision || "").slice(0, 10)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800">
                          {fmtMoney(f.totalGeneral || f.total || 0, f.moneda || "CRC")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <EstadoBadge estado={f.estado || "enviada"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Columna derecha (1/3) */}
          <div className="flex flex-col gap-4">

            {/* Top Clientes */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Top clientes</h3>
                <button onClick={() => navigate("/contactos")}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold">
                  Ver todos <ChevronRight size={12} />
                </button>
              </div>
              {topClientes.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  Sin datos de clientes aún.
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {topClientes.map((c, i) => {
                    const maxVal = topClientes[0].total;
                    const pct = maxVal > 0 ? (c.total / maxVal) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-700 truncate max-w-[120px]" title={c.nombre}>
                            {c.nombre}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0 ml-1">
                            {fmtMoney(c.total, "CRC", true)}
                          </span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accesos rápidos compactos */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Acceso rápido</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { label: "Recibos de caja",     icon: FileText,      path: "/recibos"           },
                  { label: "Control de caja",     icon: Wallet,        path: "/caja"              },
                  { label: "Inventario",           icon: Package,       path: "/inventario"        },
                  { label: "Recordatorios cobro", icon: Bell,          path: "/recordatorios"     },
                  { label: "Cobros vencidos",      icon: AlertTriangle, path: "/reporte-vencidos"  },
                  { label: "Asistente IA",         icon: Sparkles,      path: "/asistente"         },
                ].map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.path} onClick={() => navigate(a.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left group">
                      <Icon size={12} className="text-slate-400 shrink-0" />
                      <span className="flex-1 text-[11px] font-medium text-slate-600">{a.label}</span>
                      <ChevronRight size={11} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Spacer bottom */}
        <div className="h-6" />
      </div>
    </div>
  );
}

// ── Helper: formato de dinero abreviado ───────────────────────────────────────
// (override local de fmtMoney para etiquetas del eje Y)
// eslint-disable-next-line no-unused-vars
function fmtShort(n) {
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₡${(n / 1_000).toFixed(0)}K`;
  return `₡${n.toFixed(0)}`;
}
