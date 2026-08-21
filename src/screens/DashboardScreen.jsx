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

import { BACKEND } from "../utils/config.js";

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

// ── Gráfico de barras 28 días ─────────────────────────────────────────────────
function BarChart28({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-px h-28 w-full">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
            <div
              className={`w-full rounded-t transition-all duration-300 ${isToday ? "bg-yellow-500" : "bg-yellow-200 group-hover:bg-yellow-400"}`}
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            {d.label && (
              <span className="text-[7px] text-slate-400 truncate w-full text-center leading-none mt-0.5">{d.label}</span>
            )}
            {d.value > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {fmtMoney(d.value, "CRC", true)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, trend, trendUp, onClick, alert, color = "slate" }) {
  const colors = {
    green:  { bg: "bg-yellow-50", border: "border-yellow-100", icon: "text-yellow-500", val: "text-yellow-700" },
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
            ${trendUp ? "text-yellow-600" : "text-red-500"}`}>
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
    pendiente: "bg-yellow-100 text-yellow-700",
    pagada:    "bg-green-100 text-yellow-700",
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
      return { icon: sube ? "📈" : "📉", color: sube ? "bg-yellow-50 border-yellow-100 text-yellow-800" : "bg-yellow-50 border-yellow-100 text-yellow-800", texto: `Ventas ${sube ? "+" : ""}${pct}% vs mes anterior` };
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

// ── Panel de alertas centralizadas ────────────────────────────────────────────
function AlertasPanel({ debts, productos, contactos, navigate }) {
  const hd = hoy();

  const cxcVencidas = debts.filter(d =>
    (d.tipo || "pagar") === "cobrar" &&
    d.fechaVencimiento && d.fechaVencimiento < hd &&
    Math.max(0, d.total - (d.pagado || 0)) > 0
  );

  const stockBajo = productos.filter(p =>
    p.activo !== false && (p.stockMin || p.stock_minimo || 0) > 0 &&
    (p.stock || 0) <= (p.stockMin || p.stock_minimo || 0)
  );

  const clientesInactivos = contactos.filter(c =>
    c.etapaCRM === "inactivo" || c.tipo === "cliente"
  ).filter(c => c.etapaCRM === "inactivo");

  const alertas = [
    ...cxcVencidas.map(d => ({
      tipo: "cxc",
      icono: "⚠️",
      color: "border-red-200 bg-red-50 text-red-700",
      mensaje: `CXC vencida — ${d.nombre}: ${fmtMoney(Math.max(0, d.total - (d.pagado || 0)), d.moneda || "CRC")}`,
      ruta: "/cxc",
    })),
    ...stockBajo.map(p => ({
      tipo: "stock",
      icono: "📦",
      color: "border-yellow-200 bg-yellow-50 text-yellow-700",
      mensaje: `Stock bajo — ${p.nombre}: ${p.stock ?? 0} ${p.unidad || "unid"} (mín. ${p.stockMin || p.stock_minimo || 0})`,
      ruta: "/inventario",
    })),
    ...clientesInactivos.slice(0, 3).map(c => ({
      tipo: "cliente",
      icono: "😴",
      color: "border-slate-200 bg-slate-50 text-slate-600",
      mensaje: `Cliente inactivo — ${c.nombre}`,
      ruta: "/crm",
    })),
  ];

  if (alertas.length === 0) return null;

  return (
    <div className="mb-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <h3 className="text-sm font-bold text-slate-800">Alertas</h3>
          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
            {alertas.length}
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2 max-h-48 overflow-auto">
        {alertas.map((a, i) => (
          <button key={i} onClick={() => navigate(a.ruta)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left hover:opacity-80 transition-opacity ${a.color}`}>
            <span className="text-base shrink-0">{a.icono}</span>
            <span className="text-xs font-medium flex-1 truncate">{a.mensaje}</span>
            <ChevronRight size={12} className="shrink-0 opacity-50" />
          </button>
        ))}
      </div>
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
  const [productos,     setProductos]     = useState([]);
  const [contactos,     setContactos]     = useState([]);

  useEffect(() => {
    (async () => {
      const [r, c, f, d, s, p, ct] = await Promise.all([
        db.getRecibos(), db.getCompras(), db.getFacturas(), db.getDebts(), db.getSettings(),
        db.getProductos(), db.getContactos(),
      ]);
      setRecibos(r);
      setCompras(c);
      setFacturas(f);
      setDebts(d);
      setSettings(s || {});
      setProductos(p || []);
      setContactos(ct || []);
      setLoading(false);
    })();
  }, []);

  // ── Cálculos memoizados ────────────────────────────────────────────────────
  const { kpis, chartData, recentFacturas, topClientes, statsForIA, proxVencer } = useMemo(() => {
    const hd  = hoy();
    const mes = hd.slice(0, 7);
    const prev = (() => { const d = new Date(mes + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

    // KPIs — ventas reales desde facturas
    const ventasHoy = facturas.filter(f => (f.fecha || "").startsWith(hd)).reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
    const ventasMes = facturas.filter(f => (f.fecha || "").startsWith(mes)).reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
    const ventasPrev = facturas.filter(f => (f.fecha || "").startsWith(prev)).reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
    const gastosMes  = compras.filter(c => (c.fecha || "").startsWith(mes)).reduce((s, c) => s + (c.total || c.montoBase || 0), 0);
    const gastosPrev = compras.filter(c => (c.fecha || "").startsWith(prev)).reduce((s, c) => s + (c.total || c.montoBase || 0), 0);

    const cxc = debts.filter(d => (d.tipo || "pagar") === "cobrar");
    const cxp = debts.filter(d => (d.tipo || "pagar") === "pagar");
    const totalCXC = cxc.reduce((s, d) => s + Math.max(0, (d.total || 0) - (d.pagado || 0)), 0);
    const totalCXP = cxp.reduce((s, d) => s + Math.max(0, (d.total || 0) - (d.pagado || 0)), 0);
    const vencidas  = cxc.filter(d => d.fechaVencimiento && d.fechaVencimiento < hd && (d.total || 0) > (d.pagado || 0)).length;

    const utilidad   = ventasMes - gastosMes;
    const ventTrend  = ventasPrev > 0 ? `${((ventasMes - ventasPrev) / ventasPrev * 100).toFixed(0)}%` : null;
    const gasTrend   = gastosPrev > 0 ? `${((gastosMes - gastosPrev) / gastosPrev * 100).toFixed(0)}%` : null;

    const kpis = { ventasHoy, ventasMes, gastosMes, totalCXC, utilidad, ventTrend, gasTrend, vencidas };

    // Chart: últimas 4 semanas día a día (28 días)
    const chartData = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (27 - i));
      const key = d.toISOString().slice(0, 10);
      const lbl = i % 7 === 0 ? d.toLocaleString("es-CR", { month: "short", day: "numeric" }) : "";
      const val = facturas.filter(f => (f.fecha || "").startsWith(key)).reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
      return { label: lbl, value: val };
    });

    // Próximas a vencer (7 días)
    const en7 = new Date(); en7.setDate(en7.getDate() + 7);
    const en7str = en7.toISOString().slice(0, 10);
    const proxVencer = cxc
      .filter(d => d.fechaVencimiento && d.fechaVencimiento >= hd && d.fechaVencimiento <= en7str && (d.total || 0) > (d.pagado || 0))
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .slice(0, 5);

    // Facturas recientes (últimas 5)
    const recentFacturas = [...facturas]
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
      .slice(0, 5);

    // Top 5 clientes por facturación
    const clienteMap = {};
    facturas.forEach(f => {
      const nombre = f.clienteNombre || (typeof f.cliente === "string" ? f.cliente : f.cliente?.nombre) || "Sin nombre";
      if (nombre === "Consumidor Final") return;
      clienteMap[nombre] = (clienteMap[nombre] || 0) + (f.total || f.totalGeneral || 0);
    });
    const topClientes = Object.entries(clienteMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nombre, total]) => ({ nombre, total }));

    const statsForIA = { facturasMes: facturas.filter(f => (f.fecha || "").startsWith(mes)).length, vencidas, totalCXC, totalCXP };

    return { kpis, chartData, recentFacturas, topClientes, statsForIA, proxVencer };
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
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold
                       px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all">
            <Receipt size={12} /> Nueva factura
          </button>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 kpi-grid">
          <KpiCard
            label="Ventas hoy"
            value={fmtMoney(kpis.ventasHoy, "CRC")}
            sub={new Date().toLocaleDateString("es-CR", { weekday: "short", day: "numeric" })}
            icon={Receipt}
            color={kpis.ventasHoy > 0 ? "green" : "slate"}
            onClick={() => navigate("/facturas-historial")}
          />
          <KpiCard
            label="Ventas del mes"
            value={fmtMoney(kpis.ventasMes, "CRC")}
            sub="Facturación total"
            icon={TrendingUp}
            color="green"
            trend={kpis.ventTrend}
            trendUp={parseFloat(kpis.ventTrend) >= 0}
            onClick={() => navigate("/analytics")}
          />
          <KpiCard
            label="Por cobrar (CXC)"
            value={fmtMoney(kpis.totalCXC, "CRC")}
            sub={kpis.vencidas > 0 ? `⚠️ ${kpis.vencidas} vencida${kpis.vencidas > 1 ? "s" : ""}` : "Al día"}
            icon={DollarSign}
            alert={kpis.vencidas > 0}
            onClick={() => navigate("/cxc")}
          />
          <KpiCard
            label="Gastos del mes"
            value={fmtMoney(kpis.gastosMes, "CRC")}
            sub="Compras registradas"
            icon={TrendingDown}
            color="slate"
            trend={kpis.gasTrend}
            trendUp={false}
            onClick={() => navigate("/compras")}
          />
          <KpiCard
            label="Utilidad estimada"
            value={fmtMoney(Math.abs(kpis.utilidad), "CRC")}
            sub={kpis.utilidad >= 0 ? "Ventas − Gastos" : "⚠️ Déficit"}
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

        {/* ── Panel de alertas centralizadas ── */}
        <AlertasPanel
          debts={debts} productos={productos} contactos={contactos}
          navigate={navigate}
        />

        {/* ── Cuerpo principal: 2 columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Columna izquierda (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Gráfico ventas últimos 28 días */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ventas diarias</h3>
                  <p className="text-[10px] text-slate-400">Últimos 28 días</p>
                </div>
                <button onClick={() => navigate("/analytics")}
                  className="text-[10px] text-yellow-600 font-semibold hover:underline flex items-center gap-1">
                  Ver análisis completo <ChevronRight size={10}/>
                </button>
              </div>
              <BarChart28 data={chartData} />
            </div>

            {/* Facturas recientes */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Facturas recientes</h3>
                <button onClick={() => navigate("/facturas-historial")}
                  className="flex items-center gap-1 text-[11px] text-yellow-600 hover:text-yellow-700 font-semibold">
                  Ver todas <ChevronRight size={12} />
                </button>
              </div>
              {recentFacturas.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400">
                  Aún no hay facturas emitidas.<br />
                  <button onClick={() => navigate("/facturacion")} className="text-yellow-600 font-semibold mt-1">Crear primera factura →</button>
                </div>
              ) : (
                <>
                  {/* Tabla — visible en md+ */}
                  <div className="hidden md:block">
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
                  </div>
                  {/* Cards — visible solo en móvil (< md) */}
                  <div className="md:hidden divide-y divide-slate-50">
                    {recentFacturas.map((f, i) => {
                      const nombre = f.clienteNombre || f.cliente || "—";
                      const initials = typeof nombre === "string"
                        ? nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                        : "?";
                      return (
                        <div key={f.id || i} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-9 h-9 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-center shrink-0 text-[11px] font-bold text-yellow-700">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800 truncate">{nombre}</p>
                            <p className="text-[10px] text-slate-400">
                              {(f.fecha || f.fechaEmision || "").slice(0, 10)} · {f.numFactura || f.consecutivo || `#${String(i + 1).padStart(4, "0")}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[12px] font-bold text-slate-800">{fmtMoney(f.totalGeneral || f.total || 0, f.moneda || "CRC")}</p>
                            <EstadoBadge estado={f.estado || "enviada"} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Columna derecha (1/3) */}
          <div className="flex flex-col gap-4">

            {/* Próximos vencimientos */}
            {proxVencer.length > 0 && (
              <div className="bg-white border border-yellow-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-100 bg-yellow-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-yellow-500"/>
                    <h3 className="text-xs font-bold text-yellow-800">Vencen en 7 días</h3>
                  </div>
                  <button onClick={() => navigate("/cxc")}
                    className="text-[10px] text-yellow-600 font-semibold hover:underline">Ver CXC</button>
                </div>
                <div className="divide-y divide-slate-50">
                  {proxVencer.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{d.nombre}</p>
                        <p className="text-[10px] text-slate-400">{d.fechaVencimiento}</p>
                      </div>
                      <span className="text-xs font-bold text-yellow-700 shrink-0 ml-2">
                        {fmtMoney(Math.max(0, (d.total||0)-(d.pagado||0)), d.moneda||"CRC")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Clientes */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Top clientes</h3>
                <button onClick={() => navigate("/contactos")}
                  className="flex items-center gap-1 text-[11px] text-yellow-600 hover:text-yellow-700 font-semibold">
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
                          <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
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
