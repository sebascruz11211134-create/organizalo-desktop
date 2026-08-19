/**
 * OnboardingScreen — Wizard de 4 pasos para nuevos clientes
 * Aparece solo la primera vez que el usuario entra a la app.
 * Se salta al completar o al hacer clic en "Omitir".
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Building2, Package, Users, Receipt, ArrowRight, X } from "lucide-react";
import db from "../utils/db";
import { genId } from "../utils/fmt";

const STORAGE_KEY = "@finanzia/onboarding_completado";

export function onboardingCompletado() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}
function marcarCompletado() {
  localStorage.setItem(STORAGE_KEY, "1");
}

const PASOS = [
  { id: 1, icon: Building2, color: "emerald", titulo: "Tu empresa",        sub: "Configuremos los datos básicos de tu negocio" },
  { id: 2, icon: Package,   color: "blue",    titulo: "Primer producto",    sub: "Agregá el primer producto o servicio que vendés" },
  { id: 3, icon: Users,     color: "violet",  titulo: "Primer cliente",     sub: "Registrá tu primer cliente o proveedor" },
  { id: 4, icon: Receipt,   color: "amber",   titulo: "¡Listo para facturar!", sub: "Ya podés crear tu primera factura" },
];

// ── Step 1: Empresa ────────────────────────────────────────────────────────────
function StepEmpresa({ onNext }) {
  const [nombre,   setNombre]   = useState("");
  const [cedula,   setCedula]   = useState("");
  const [telefono, setTelefono] = useState("");

  const guardar = async () => {
    if (!nombre.trim()) return;
    const s = await db.getSettings();
    await db.setSettings({ ...s, nombreNegocio: nombre.trim(), cedula: cedula.trim(), telefono: telefono.trim() });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nombre del negocio *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Ferretería López S.A."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Cédula jurídica / física</label>
        <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="3-101-000000"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Teléfono</label>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="8888-8888"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
      </div>
      <button onClick={guardar} disabled={!nombre.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
        Continuar <ArrowRight size={15}/>
      </button>
    </div>
  );
}

// ── Step 2: Producto ──────────────────────────────────────────────────────────
function StepProducto({ onNext }) {
  const [nombre,  setNombre]  = useState("");
  const [precio,  setPrecio]  = useState("");
  const [unidad,  setUnidad]  = useState("unid");
  const [stock,   setStock]   = useState("");

  const guardar = async () => {
    if (!nombre.trim() || !precio) return;
    const productos = await db.getProductos();
    await db.setProductos([...productos, {
      id: genId(), nombre: nombre.trim(),
      precio: parseFloat(precio), unidad, stock: parseFloat(stock) || 0,
      pctIVA: 13, activo: true, creadoEn: new Date().toISOString(),
    }]);
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nombre del producto / servicio *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Servicio de instalación"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Precio (₡) *</label>
          <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Unidad</label>
          <select value={unidad} onChange={e => setUnidad(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {["unid","kg","lt","m","m²","hr","svc"].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Stock inicial (opcional)</label>
        <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
      </div>
      <button onClick={guardar} disabled={!nombre.trim() || !precio}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
        Continuar <ArrowRight size={15}/>
      </button>
    </div>
  );
}

// ── Step 3: Cliente ───────────────────────────────────────────────────────────
function StepCliente({ onNext }) {
  const [nombre, setNombre] = useState("");
  const [email,  setEmail]  = useState("");
  const [tel,    setTel]    = useState("");

  const guardar = async () => {
    if (!nombre.trim()) return;
    const contactos = await db.getContactos();
    await db.setContactos([...contactos, {
      id: genId(), nombre: nombre.trim(), email: email.trim(), telefono: tel.trim(),
      tipo: "cliente", codigoCliente: `CLI-${String(contactos.length + 1).padStart(4,"0")}`,
      creadoEn: new Date().toISOString(),
    }]);
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nombre del cliente *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Teléfono</label>
        <input value={tel} onChange={e => setTel(e.target.value)} placeholder="8888-8888"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/>
      </div>
      <button onClick={guardar} disabled={!nombre.trim()}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
        Continuar <ArrowRight size={15}/>
      </button>
    </div>
  );
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────
function StepListo({ onFactura, onDashboard }) {
  return (
    <div className="text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle size={40} className="text-emerald-600"/>
      </div>
      <div>
        <p className="text-slate-700 text-sm font-semibold">¡Estás listo para empezar!</p>
        <p className="text-slate-400 text-xs mt-1">Tu empresa, producto y cliente están configurados.</p>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <button onClick={onFactura}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
          <Receipt size={15}/> Crear primera factura
        </button>
        <button onClick={onDashboard}
          className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold text-sm transition-all">
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onDone }) {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);

  const terminar = (ruta = "/") => {
    marcarCompletado();
    if (onDone) onDone();
    navigate(ruta);
  };

  const paso_actual = PASOS[paso - 1];
  const Icon = paso_actual.icon;
  const colorMap = {
    emerald: { ring: "ring-emerald-400", bg: "bg-emerald-600", text: "text-emerald-600", light: "bg-emerald-50" },
    blue:    { ring: "ring-blue-400",    bg: "bg-blue-600",    text: "text-blue-600",    light: "bg-blue-50"    },
    violet:  { ring: "ring-violet-400",  bg: "bg-violet-600",  text: "text-violet-600",  light: "bg-violet-50"  },
    amber:   { ring: "ring-amber-400",   bg: "bg-amber-500",   text: "text-amber-600",   light: "bg-amber-50"   },
  };
  const c = colorMap[paso_actual.color];

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`${c.light} px-6 pt-6 pb-4 relative`}>
          <button onClick={() => terminar("/")}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16}/>
          </button>
          <div className={`w-12 h-12 rounded-2xl ${c.light} ring-2 ${c.ring} flex items-center justify-center mb-3`}>
            <Icon size={22} className={c.text}/>
          </div>
          <h2 className="text-lg font-black text-slate-900">{paso_actual.titulo}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{paso_actual.sub}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4">
            {PASOS.map(p => (
              <div key={p.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${p.id === paso ? `${c.bg} w-6` : p.id < paso ? "bg-slate-300 w-4" : "bg-slate-200 w-4"}`}/>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {paso === 1 && <StepEmpresa   onNext={() => setPaso(2)}/>}
          {paso === 2 && <StepProducto  onNext={() => setPaso(3)}/>}
          {paso === 3 && <StepCliente   onNext={() => setPaso(4)}/>}
          {paso === 4 && <StepListo onFactura={() => terminar("/facturacion")} onDashboard={() => terminar("/")}/>}
        </div>

        {/* Skip */}
        {paso < 4 && (
          <div className="px-6 pb-5 text-center">
            <button onClick={() => setPaso(p => p + 1)}
              className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">
              Omitir este paso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
