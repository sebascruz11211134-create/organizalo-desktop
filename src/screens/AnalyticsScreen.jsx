/**
 * AnalyticsScreen — Reportes visuales con gráficas
 * Ventas por mes · Top productos · Top clientes · Tendencia diaria
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { TrendingUp, Package, Users, FileSpreadsheet } from "lucide-react";
import db from "../utils/db";
import { fmtMoney, hoy } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function getMesKey(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}
function getMesLabel(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString("es-CR", { month: "short" });
}

const fmtK = (v) => {
  if (v >= 1_000_000) return `₡${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₡${(v / 1_000).toFixed(0)}K`;
  return `₡${v}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmtMoney(p.value, "CRC")}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsScreen() {
  const [facturas, setFacturas] = useState([]);
  const [compras,  setCompras]  = useState([]);
  const [periodo,  setPeriodo]  = useState("12"); // meses hacia atrás

  const cargar = useCallback(async () => {
    const [f, c] = await Promise.all([db.getFacturas(), db.getCompras()]);
    setFacturas(f || []);
    setCompras(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const { ventasPorMes, topProductos, topClientes, tendenciaDiaria, resumen } = useMemo(() => {
    const meses = parseInt(periodo);

    // ── Ventas por mes (barras) ───────────────────────────────────────────────
    const ventasPorMes = Array.from({ length: meses }, (_, i) => {
      const key = getMesKey(i - meses + 1);
      const lbl = getMesLabel(i - meses + 1);
      const ventas = facturas.filter(f => (f.fecha || "").startsWith(key))
        .reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
      const gastos = compras.filter(c => (c.fecha || "").startsWith(key))
        .reduce((s, c) => s + (c.total || c.montoBase || 0), 0);
      return { mes: lbl, Ventas: ventas, Gastos: gastos, Utilidad: Math.max(0, ventas - gastos) };
    });

    // ── Top productos (pie) ───────────────────────────────────────────────────
    const prodMap = {};
    facturas.forEach(f => {
      (f.lineas || f.items || []).forEach(l => {
        const nombre = l.nombre || l.descripcion || l.producto || "Otro";
        const cant = parseFloat(l.cantidad || 1);
        const precio = parseFloat(l.precio || l.precioUnit || l.precioUnitario || 0);
        prodMap[nombre] = (prodMap[nombre] || 0) + cant * precio;
      });
    });
    const topProductos = Object.entries(prodMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // ── Top clientes (barras horizontales) ────────────────────────────────────
    const clienteMap = {};
    facturas.forEach(f => {
      const nombre = f.clienteNombre ||
        (typeof f.cliente === "string" ? f.cliente : f.cliente?.nombre) || "Consumidor Final";
      if (nombre === "Consumidor Final") return;
      clienteMap[nombre] = (clienteMap[nombre] || 0) + (f.total || f.totalGeneral || 0);
    });
    const topClientes = Object.entries(clienteMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nombre, total]) => ({ nombre, total }));

    // ── Tendencia últimos 30 días (línea) ─────────────────────────────────────
    const tendenciaDiaria = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      const lbl = i % 5 === 0 ? d.toLocaleString("es-CR", { day: "numeric", month: "short" }) : "";
      const valor = facturas.filter(f => (f.fecha || "").startsWith(key))
        .reduce((s, f) => s + (f.total || f.totalGeneral || 0), 0);
      return { dia: lbl || key.slice(8), valor };
    });

    // ── Resumen total ────────────────────────────────────────────────────────
    const totalVentas = ventasPorMes.reduce((s, m) => s + m.Ventas, 0);
    const totalGastos = ventasPorMes.reduce((s, m) => s + m.Gastos, 0);
    const mejorMes = ventasPorMes.reduce((best, m) => m.Ventas > (best?.Ventas || 0) ? m : best, null);

    return { ventasPorMes, topProductos, topClientes, tendenciaDiaria, resumen: { totalVentas, totalGastos, mejorMes } };
  }, [facturas, compras, periodo]);

  const exportar = () => {
    exportExcel(
      ventasPorMes.map(m => ({ Mes: m.mes, Ventas: m.Ventas, Gastos: m.Gastos, Utilidad: m.Utilidad })),
      `analytics-ventas-${periodo}meses`
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <TrendingUp size={13} className="text-amber-400"/>
        <span className="text-white text-xs font-semibold">Análisis de negocio</span>
        <div className="w-px h-5 bg-slate-500 mx-1"/>
        <label className="text-slate-300 text-xs">Período:</label>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1.5">
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </select>
        <div className="flex-1"/>
        <button onClick={exportar}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-50">
        <div className="max-w-[1100px] mx-auto space-y-4">

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total ventas período", value: fmtMoney(resumen.totalVentas, "CRC"), color: "text-amber-700" },
              { label: "Total gastos período", value: fmtMoney(resumen.totalGastos, "CRC"), color: "text-red-600" },
              { label: "Mejor mes", value: resumen.mejorMes ? `${resumen.mejorMes.mes} · ${fmtMoney(resumen.mejorMes.Ventas, "CRC")}` : "—", color: "text-blue-700" },
            ].map((k, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className={`text-lg font-black mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* ── Ventas vs Gastos por mes ── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Ventas vs Gastos por mes</h3>
            <p className="text-[10px] text-slate-400 mb-4">Últimos {periodo} meses</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ventasPorMes} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: "#94a3b8" }} width={52}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }}/>
                <Bar dataKey="Ventas" fill="#10b981" radius={[3,3,0,0]}/>
                <Bar dataKey="Gastos" fill="#ef4444" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row: Pie productos + tendencia diaria ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top productos */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package size={13} className="text-amber-500"/>
                <h3 className="text-sm font-bold text-slate-800">Productos más vendidos</h3>
              </div>
              {topProductos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Sin datos de líneas en facturas</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={topProductos} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                      paddingAngle={2}>
                      {topProductos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v, "CRC")}/>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tendencia diaria */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Tendencia diaria</h3>
              <p className="text-[10px] text-slate-400 mb-4">Ventas últimos 30 días</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={tendenciaDiaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "#94a3b8" }}/>
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: "#94a3b8" }} width={48}/>
                  <Tooltip formatter={(v) => fmtMoney(v, "CRC")} labelFormatter={(l) => `Día ${l}`}/>
                  <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: "#10b981" }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Top clientes ── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={13} className="text-amber-500"/>
              <h3 className="text-sm font-bold text-slate-800">Top clientes por facturación</h3>
            </div>
            {topClientes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Sin clientes identificados (facturas a Consumidor Final no se cuentan)</p>
            ) : (
              <div className="space-y-3">
                {topClientes.map((c, i) => {
                  const max = topClientes[0].total;
                  const pct = max > 0 ? (c.total / max) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">#{i+1}</span>
                      <span className="text-xs font-semibold text-slate-700 w-36 truncate shrink-0">{c.nombre}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}/>
                      </div>
                      <span className="text-xs font-bold text-slate-600 shrink-0 w-28 text-right">
                        {fmtMoney(c.total, "CRC")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
