import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users, Briefcase, Trash2, Loader2 } from "lucide-react";
import db from "../utils/db";
import { genId } from "../utils/fmt";
import { generarCodigoCliente } from "../utils/clienteUtils";

function ContactoModal({ contacto, onClose, onSave }) {
  const [nombre,        setNombre]        = useState(contacto?.nombre        || "");
  const [cedula,        setCedula]        = useState(contacto?.cedula        || "");
  const [tipoCedula,    setTipoCedula]    = useState(contacto?.tipoCedula    || "01");
  const [tipo,          setTipo]          = useState(contacto?.tipo          || "cliente");
  const [email,         setEmail]         = useState(contacto?.email         || "");
  const [tel,           setTel]           = useState(contacto?.tel           || "");
  const [notas,         setNotas]         = useState(contacto?.notas         || "");
  const [codigoCli,     setCodigoCli]     = useState(contacto?.codigoCliente || "");
  const [diasCredito,   setDiasCredito]   = useState(contacto?.dias_credito  ?? "");
  const [buscando,      setBuscando]      = useState(false);
  const [cedulaError,   setCedulaError]   = useState("");
  const [situacion,     setSituacion]     = useState(null); // { moroso, omiso, estado }

  // Buscar en API pública de Hacienda CR
  const buscarEnHacienda = async () => {
    const num = cedula.trim().replace(/\D/g, "");
    if (!num) return;
    setCedulaError("");
    setSituacion(null);
    setBuscando(true);
    try {
      const res  = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${num}`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data?.nombre) {
        const tCed = data.tipoIdentificacion || (num.length === 9 ? "01" : num.length === 10 ? "02" : "03");
        setNombre(data.nombre);
        setTipoCedula(tCed);
        const sit = data.situacion || {};
        setSituacion({
          moroso: sit.moroso ?? false,
          omiso:  sit.omiso  ?? false,
        });
      } else {
        setCedulaError("No encontrado en Hacienda");
      }
    } catch {
      setCedulaError("Sin conexión a Hacienda");
    } finally {
      setBuscando(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) return;
    const todos = await db.getContactos();
    const codigo = codigoCli.trim() || (contacto ? contacto.codigoCliente : generarCodigoCliente(todos));
    const dias = diasCredito === "" ? 0 : parseInt(diasCredito) || 0;
    const esNuevo = !contacto;
    const newId = genId();
    const upd = contacto
      ? todos.map((c) => c.id === contacto.id ? { ...c, nombre, cedula, tipoCedula, tipo, email, tel, notas, codigoCliente: codigo, dias_credito: dias } : c)
      : [{ id: newId, nombre, cedula, tipoCedula, tipo, email, tel, notas, codigoCliente: codigo, dias_credito: dias, creadoEn: new Date().toISOString() }, ...todos];
    await db.setContactos(upd);

    // Si es nuevo contacto de tipo cliente/ambos → agregar al CRM como prospecto
    if (esNuevo && (tipo === "cliente" || tipo === "ambos")) {
      const contactosCRM = await db.getContactos();
      const yaExiste = contactosCRM.find(c => c.id === newId);
      if (yaExiste && !yaExiste.etapaCRM) {
        await db.setContactos(contactosCRM.map(c =>
          c.id === newId ? { ...c, etapaCRM: "prospecto", notas: notas, crmCreadoEn: new Date().toISOString() } : c
        ));
      }
    }

    onSave(); onClose();
  };

  const TIPO_CED_LABEL = { "01": "Física", "02": "Jurídica", "03": "DIMEX", "04": "NITE" };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-5">{contacto ? "Editar contacto" : "Nuevo contacto"}</h3>
        <div className="space-y-4">

          {/* Cédula + lookup Hacienda */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula / RUC</label>
            <div className="flex gap-2">
              <div className="flex flex-1">
                <input
                  value={cedula}
                  onChange={(e) => { setCedula(e.target.value); setCedulaError(""); setSituacion(null); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarEnHacienda()}
                  placeholder="Número de cédula"
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 border-r-0"
                />
                <button
                  type="button"
                  onClick={buscarEnHacienda}
                  disabled={buscando || !cedula.trim()}
                  title="Consultar Hacienda CR"
                  className="flex items-center justify-center px-3 border border-gray-300 rounded-r-lg bg-slate-50 hover:bg-green-50 hover:border-green-400 hover:text-green-700 text-slate-500 transition-colors disabled:opacity-40"
                >
                  {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>
              <select
                value={tipoCedula}
                onChange={(e) => setTipoCedula(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2.5 text-xs text-slate-600 focus:outline-none"
              >
                <option value="01">01 – Física</option>
                <option value="02">02 – Jurídica</option>
                <option value="03">03 – DIMEX</option>
                <option value="04">04 – NITE</option>
              </select>
            </div>
            {cedulaError && <p className="mt-1 text-xs text-red-500">{cedulaError}</p>}
            {situacion && (
              <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
                ${situacion.moroso === "SI" || situacion.omiso === "SI"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-green-50 text-green-700 border-green-200"}`}>
                <span>{situacion.moroso === "SI" || situacion.omiso === "SI" ? "⚠️" : "✓"}</span>
                <span>
                  {situacion.moroso === "SI" && situacion.omiso === "SI" ? "Moroso + Omiso" :
                   situacion.moroso === "SI" ? "Moroso" :
                   situacion.omiso  === "SI" ? "Omiso" :
                   "Al día · Hacienda"}
                </span>
              </div>
            )}
            {buscando && (
              <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Consultando Hacienda…
              </p>
            )}
          </div>

          {/* Nombre + Código */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="w-28">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código</label>
              <input value={codigoCli} onChange={(e) => setCodigoCli(e.target.value.toUpperCase())}
                placeholder="CLI-0001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {/* Tipo contacto */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
              <option value="cliente">Cliente</option>
              <option value="proveedor">Proveedor</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
            <input value={tel} onChange={(e) => setTel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none" />
            </div>
            <div className="w-32">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {tipo === "proveedor" ? "Días pago" : "Días crédito"}
              </label>
              <div className="relative">
                <input
                  type="number" min="0" max="365"
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  placeholder="0 = contado"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">días</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {tipo === "proveedor" ? "Plazo para pagarle" : "Plazo que le das"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 py-2.5 bg-green-700 rounded-lg text-sm font-semibold text-white hover:bg-green-800">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function ContactosScreen() {
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  const [filtro,    setFiltro]    = useState("todos");
  const [modal,     setModal]     = useState(null);

  const cargar = useCallback(async () => {
    const c = await db.getContactos();
    setContactos(c);
  }, []);

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar el contacto "${c.nombre}"?`)) return;
    const todos = await db.getContactos();
    await db.setContactos(todos.filter((x) => x.id !== c.id));
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const busqL = busq.trim().toLowerCase();
  const visibles = contactos.filter((c) => {
    const match = !busqL ||
      c.nombre?.toLowerCase().includes(busqL) ||
      c.cedula?.includes(busqL) ||
      c.codigoCliente?.toLowerCase().includes(busqL);
    const tipo  = filtro === "todos" || c.tipo === filtro || (filtro !== "ambos" && c.tipo === "ambos");
    return match && tipo;
  });

  const TIPO_CLS = { cliente: "bg-blue-100 text-blue-700", proveedor: "bg-amber-100 text-amber-700", ambos: "bg-violet-100 text-violet-700" };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar contacto, cédula…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm">
          <option value="todos">Todos</option>
          <option value="cliente">Clientes</option>
          <option value="proveedor">Proveedores</option>
        </select>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
          <Plus size={15} /> Nuevo contacto
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead><tr><th>Código</th><th>Nombre</th><th>Cédula / RUC</th><th>Tipo</th><th>Crédito</th><th>Email</th><th>Teléfono</th><th>Notas</th><th></th></tr></thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-slate-400">Sin contactos</td></tr>
            ) : visibles.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.codigoCliente
                    ? <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">{c.codigoCliente}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="font-semibold">{c.nombre}</td>
                <td className="font-mono text-sm text-slate-500">{c.cedula || "—"}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TIPO_CLS[c.tipo] || "bg-gray-100 text-slate-600"}`}>{c.tipo}</span></td>
                <td>
                  {c.dias_credito > 0
                    ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{c.dias_credito}d</span>
                    : <span className="text-xs text-slate-400">contado</span>}
                </td>
                <td className="text-slate-500">{c.email || "—"}</td>
                <td className="text-slate-500">{c.tel || "—"}</td>
                <td className="text-slate-400 text-xs">{c.notas || "—"}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModal(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => eliminar(c)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ContactoModal contacto={modal.id ? modal : null} onClose={() => setModal(null)} onSave={cargar} />}
    </div>
  );
}
