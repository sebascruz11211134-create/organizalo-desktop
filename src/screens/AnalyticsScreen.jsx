/**
 * AnalyticsScreen — Reportes visuales con gráficas
 * Ventas por mes · Top productos · Top clientes · Tendencia diaria
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Trophy, FileSpreadsheet } from "lucide-react";
import { Modulo, Boton, Tarjeta, Indicadores, Indicador } from "../components/ui";
import db from "../utils/db";
import { fmtMoney, hoy, fechaLocal, mesLocal, mesDesplazado } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

// Paleta Monki: negro, amarillo y grises cálidos
const COLORS = ["#111111", "#FFD600", "#6b6b6b", "#FFE866", "#3a3a3a", "#C9A800", "#A3A3A3", "#F4F1E6"];

function getMesKey(offset = 0) {
  return mesDesplazado(mesLocal(), offset); // "2025-06"
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
    <div className="bg-white border-2 border-monki-k rounded-2xl shadow-[4px_4px_0_#111] px-4 py-3 text-xs">
      <p className="font-extrabold text-monki-k mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-monki-k/75">
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
      const key = fechaLocal(d);
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

  const EJE = { fontSize: 10, fill: "rgba(17,17,17,.45)", fontFamily: "JetBrains Mono, monospace" };
  return (
    <Modulo
      seccion="Reportes"
      titulo="Análisis de ventas"
      descripcion="Cómo se mueve tu negocio: ventas contra gastos, productos y clientes que más aportan."
      acciones={<Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Ventas del período" valor={fmtMoney(resumen.totalVentas, "CRC")} icono={TrendingUp} destacado delay={40}/>
          <Indicador etiqueta="Gastos del período" valor={fmtMoney(resumen.totalGastos, "CRC")} icono={TrendingDown} delay={90}/>
          <Indicador etiqueta="Utilidad" valor={fmtMoney(resumen.totalVentas - resumen.totalGastos, "CRC")} alerta={resumen.totalVentas - resumen.totalGastos < 0} delay={140}/>
          <Indicador etiqueta="Mejor mes" valor={resumen.mejorMes ? resumen.mejorMes.mes : "—"} detalle={resumen.mejorMes ? fmtMoney(resumen.mejorMes.Ventas, "CRC") : "Sin ventas"} icono={Trophy} delay={190}/>
        </Indicadores>
      }
      pestanas={{ activa: periodo, onCambiar: setPeriodo, items: [{ key: "3", label: "3 meses" }, { key: "6", label: "6 meses" }, { key: "12", label: "12 meses" }] }}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-3">
        <Tarjeta titulo="Ventas contra gastos por mes" acciones={<span className="font-mono text-[11px] text-monki-k/45">Últimos {periodo} meses</span>} cuerpo="px-3 pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ventasPorMes} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,.07)" vertical={false}/>
              <XAxis dataKey="mes" tick={EJE} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={fmtK} tick={EJE} width={52} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>} cursor={{ fill: "rgba(255,214,0,.18)" }}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="Ventas" fill="#111111" radius={[6,6,0,0]}/>
              <Bar dataKey="Gastos" fill="#FFD600" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Tarjeta>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Tarjeta titulo="Productos más vendidos" cuerpo="px-3 pb-4">
            {topProductos.length === 0 ? (
              <p className="text-sm text-monki-k/40 text-center py-10">Sin datos de líneas en facturas</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topProductos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={46} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {topProductos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(v, "CRC")}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </Tarjeta>
          <Tarjeta titulo="Tendencia diaria" acciones={<span className="font-mono text-[11px] text-monki-k/45">Últimos 30 días</span>} cuerpo="px-3 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={tendenciaDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,.07)" vertical={false}/>
                <XAxis dataKey="dia" tick={EJE} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={EJE} width={48} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v) => fmtMoney(v, "CRC")} labelFormatter={(l) => `Día ${l}`}/>
                <Line type="monotone" dataKey="valor" stroke="#111111" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#FFD600", stroke: "#111", strokeWidth: 2 }}/>
              </LineChart>
            </ResponsiveContainer>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Clientes que más compran" cuerpo="px-4 pb-4">
          {topClientes.length === 0 ? (
            <p className="text-sm text-monki-k/40 text-center py-8">Sin clientes identificados (las facturas a Consumidor Final no cuentan)</p>
          ) : (
            <div className="space-y-2.5">
              {topClientes.map((c, i) => {
                const max = topClientes[0].total;
                const pct = max > 0 ? (c.total / max) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? "bg-monki-y text-monki-k" : "bg-monki-cream text-monki-k/60"}`}>{i+1}</span>
                    <span className="text-sm font-bold text-monki-k w-40 truncate shrink-0">{c.nombre}</span>
                    <div className="flex-1 h-2.5 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-monki-k transition-all duration-700 ease-monki" style={{ width: `${pct}%` }}/>
                    </div>
                    <b className="text-sm shrink-0 w-32 text-right tabular-nums">{fmtMoney(c.total, "CRC")}</b>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>
      </div>
    </Modulo>
  );
}
