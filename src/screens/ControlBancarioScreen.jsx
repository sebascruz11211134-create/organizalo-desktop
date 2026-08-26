import { useState, useEffect, useCallback } from "react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";

const hoy = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = (n, mon = "CRC") => {
  if (!n && n !== 0) return "—";
  return (mon === "USD" ? "$ " : "₡ ") + Number(n).toLocaleString("es-CR", {
    minimumFractionDigits: mon === "USD" ? 2 : 0,
    maximumFractionDigits: mon === "USD" ? 2 : 0,
  });
};

const TIPOS_DEBITO = ["Débito bancario", "Transferencia saliente", "Comisión bancaria", "Cheque emitido", "Pago servicios", "Otro"];
const TIPOS_CREDITO = ["Depósito efectivo", "Depósito cheque", "Transferencia entrante", "SINPE recibido", "Nota crédito banco", "Otro"];

// ── Modal Cuentas ─────────────────────────────────────────────────────────────
function ModalCuenta({ cuenta, onSave, onClose }) {
  const [f, setF] = useState(cuenta || {
    nombre: "", numeroCuenta: "", banco: "", moneda: "CRC", saldoInicial: 0, activa: true,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-slate-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h2 className="font-bold text-lg">{cuenta ? "Editar cuenta" : "Nueva cuenta bancaria"}</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Nombre de la cuenta</label>
            <input value={f.nombre} onChange={e => set("nombre", e.target.value)}
              placeholder="Ej. Corriente Nacional CRC"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Número de cuenta</label>
            <input value={f.numeroCuenta} onChange={e => set("numeroCuenta", e.target.value)}
              placeholder="100-01-164-000481-8"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Banco</label>
              <input value={f.banco} onChange={e => set("banco", e.target.value)}
                placeholder="Banco Nacional"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Moneda</label>
              <select value={f.moneda} onChange={e => set("moneda", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="CRC">₡ Colones</option>
                <option value="USD">$ Dólares</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Saldo inicial</label>
            <input type="number" value={f.saldoInicial} onChange={e => set("saldoInicial", parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.activa} onChange={e => set("activa", e.target.checked)} className="rounded" />
            Cuenta activa
          </label>
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={() => { if (!f.nombre) return; onSave(f); }}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nota de Débito ──────────────────────────────────────────────────────
function ModalDebito({ nota, cuentas, usuarioActivo, onSave, onClose }) {
  const [f, setF] = useState(nota || {
    numero: "ND-" + Date.now().toString().slice(-6),
    fecha: hoy(), numeroBanco: "", tipo: "Débito bancario",
    numeroCheque: "", monto: 0, tipoCambioDolar: 0, tipoCambioMoneda3: 0,
    giradoPor: "", banco: "", descripcion: "", descripcion2: "", descripcion3: "",
    hechoPor: usuarioActivo || "", revisadoPor: "", autorizadoPor: "", fechaAutorizacion: "",
    numeroAsiento: "", asientoAnulacion: "",
    conciliable: true, contabilizado: false, anulado: false,
    cuentaId: cuentas[0]?.id || "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cuenta = cuentas.find(c => c.id === f.cuentaId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4">
        <div className="bg-slate-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg">Nota de Débito</h2>
            {cuenta && <p className="text-slate-300 text-xs mt-0.5">{cuenta.numeroCuenta} — {cuenta.banco?.toUpperCase()}</p>}
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Cuenta + Número + Fecha */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="text-xs font-semibold text-slate-500 uppercase">Cuenta</label>
              <select value={f.cuentaId} onChange={e => set("cuentaId", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.numeroCuenta} — {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">N° Nota de Débito</label>
              <input value={f.numero} onChange={e => set("numero", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">N° Según Banco</label>
              <input value={f.numeroBanco} onChange={e => set("numeroBanco", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Fecha de Emisión</label>
              <input type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          {/* Tipo + Cheque */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Tipo</label>
              <select value={f.tipo} onChange={e => set("tipo", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {TIPOS_DEBITO.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">N° Cheque</label>
              <input value={f.numeroCheque} onChange={e => set("numeroCheque", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          {/* Monto + Tipo cambio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Monto ({cuenta?.moneda || "CRC"})</label>
              <input type="number" value={f.monto} onChange={e => set("monto", parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">T.C. Dólar</label>
              <input type="number" value={f.tipoCambioDolar} onChange={e => set("tipoCambioDolar", parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">T.C. Moneda 3</label>
              <input type="number" value={f.tipoCambioMoneda3} onChange={e => set("tipoCambioMoneda3", parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          {/* Girado por + Banco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Girado Por</label>
              <input value={f.giradoPor} onChange={e => set("giradoPor", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Banco Destino</label>
              <input value={f.banco} onChange={e => set("banco", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          {/* Descripción */}
          {["descripcion", "descripcion2", "descripcion3"].map((k, i) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-500 uppercase">{i === 0 ? "Descripción" : ""}</label>
              <input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={i === 0 ? "Concepto del débito..." : ""}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          ))}
          {/* Flujo de aprobación */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Flujo de aprobación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Hecho por</label>
                <input value={f.hechoPor} onChange={e => set("hechoPor", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Revisado por</label>
                <input value={f.revisadoPor} onChange={e => set("revisadoPor", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Autorizado por</label>
                <input value={f.autorizadoPor} onChange={e => set("autorizadoPor", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Fecha autorización</label>
                <input type="date" value={f.fechaAutorizacion} onChange={e => set("fechaAutorizacion", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500">N° Asiento</label>
                <input value={f.numeroAsiento} onChange={e => set("numeroAsiento", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Asiento Anulación</label>
                <input value={f.asientoAnulacion} onChange={e => set("asientoAnulacion", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex gap-6 mt-3">
              {[["conciliable","Conciliable"],["contabilizado","Contabilizado"],["anulado","Anulado"]].map(([k,l]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={f[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={() => { if (!f.monto || !f.cuentaId) return; onSave(f); }}
            className="px-5 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800">
            Guardar Nota de Débito
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nota de Crédito ─────────────────────────────────────────────────────
function ModalCredito({ nota, cuentas, usuarioActivo, onSave, onClose }) {
  const [f, setF] = useState(nota || {
    numero: "NC-" + Date.now().toString().slice(-6),
    fecha: hoy(), numeroBanco: "", tipo: "Depósito efectivo",
    montoEfectivo: 0, totalCheques: 0,
    tipoCambioDolar: 0, tipoCambioMoneda3: 0,
    depositante: "", observaciones: "",
    cheques: [],
    hechoPor: usuarioActivo || "", revisadoPor: "", autorizadoPor: "", fechaAutorizacion: "",
    numeroAsiento: "", asientoAnulacion: "",
    conciliable: true, contabilizado: false, anulado: false,
    cuentaId: cuentas[0]?.id || "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cuenta = cuentas.find(c => c.id === f.cuentaId);
  const montoTotal = (f.montoEfectivo || 0) + (f.totalCheques || 0);

  const addCheque = () => setF(p => ({ ...p, cheques: [...(p.cheques||[]), { numero: "", monto: 0, banco: "" }] }));
  const setCheque = (i, k, v) => setF(p => {
    const ch = [...(p.cheques||[])]; ch[i] = { ...ch[i], [k]: v };
    const totCh = ch.reduce((s, c) => s + (parseFloat(c.monto)||0), 0);
    return { ...p, cheques: ch, totalCheques: totCh };
  });
  const delCheque = (i) => setF(p => {
    const ch = p.cheques.filter((_,j)=>j!==i);
    return { ...p, cheques: ch, totalCheques: ch.reduce((s,c)=>s+(parseFloat(c.monto)||0),0) };
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4">
        <div className="bg-emerald-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg">Nota de Crédito</h2>
            {cuenta && <p className="text-emerald-200 text-xs mt-0.5">{cuenta.numeroCuenta} — {cuenta.banco?.toUpperCase()}</p>}
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Cuenta</label>
            <select value={f.cuentaId} onChange={e => set("cuentaId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.numeroCuenta} — {c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">N° Nota de Crédito</label>
              <input value={f.numero} onChange={e => set("numero", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">N° Según Banco</label>
              <input value={f.numeroBanco} onChange={e => set("numeroBanco", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Fecha de Emisión</label>
              <input type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Tipo</label>
            <select value={f.tipo} onChange={e => set("tipo", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {TIPOS_CREDITO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {/* Montos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Monto Efectivo ({cuenta?.moneda || "CRC"})</label>
              <input type="number" value={f.montoEfectivo} onChange={e => set("montoEfectivo", parseFloat(e.target.value)||0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Total Cheques</label>
              <input type="number" value={f.totalCheques} readOnly
                className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 mt-1 text-sm text-slate-500" />
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-emerald-700">Monto Total</span>
            <span className="text-lg font-bold text-emerald-700">{fmt(montoTotal, cuenta?.moneda)}</span>
          </div>
          {/* Tipo cambio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">T.C. Dólar</label>
              <input type="number" value={f.tipoCambioDolar} onChange={e => set("tipoCambioDolar", parseFloat(e.target.value)||0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">T.C. Moneda 3</label>
              <input type="number" value={f.tipoCambioMoneda3} onChange={e => set("tipoCambioMoneda3", parseFloat(e.target.value)||0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          {/* Depositante */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Depositante</label>
            <input value={f.depositante} onChange={e => set("depositante", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Observaciones</label>
            <textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          {/* Detalle cheques */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">Detalle de Cheques Depositados</span>
              <button onClick={addCheque} className="text-xs text-emerald-600 hover:underline font-semibold">+ Agregar cheque</button>
            </div>
            {(f.cheques||[]).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sin cheques</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-100 text-slate-500">
                  <th className="px-3 py-2 text-left">Número</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-left">Banco</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr></thead>
                <tbody>{(f.cheques||[]).map((ch, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1"><input value={ch.numero} onChange={e => setCheque(i,"numero",e.target.value)}
                      className="w-full border-0 text-xs px-1 focus:outline-none" /></td>
                    <td className="px-2 py-1"><input type="number" value={ch.monto} onChange={e => setCheque(i,"monto",e.target.value)}
                      className="w-full border-0 text-xs px-1 text-right focus:outline-none" /></td>
                    <td className="px-2 py-1"><input value={ch.banco} onChange={e => setCheque(i,"banco",e.target.value)}
                      className="w-full border-0 text-xs px-1 focus:outline-none" /></td>
                    <td className="px-2 py-1 text-center"><button onClick={() => delCheque(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          {/* Flujo aprobación */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Flujo de aprobación</p>
            <div className="grid grid-cols-2 gap-3">
              {[["hechoPor","Hecho por"],["revisadoPor","Revisado por"],["autorizadoPor","Autorizado por"],["fechaAutorizacion","Fecha autorización"]].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500">{l}</label>
                  <input type={k==="fechaAutorizacion"?"date":"text"} value={f[k]} onChange={e => set(k, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
              {[["numeroAsiento","N° Asiento"],["asientoAnulacion","Asiento Anulación"]].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500">{l}</label>
                  <input value={f[k]} onChange={e => set(k, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-6 mt-3">
              {[["conciliable","Conciliable"],["contabilizado","Contabilizado"],["anulado","Anulado"]].map(([k,l]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={f[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={() => { if (!f.cuentaId) return; onSave({ ...f, montoTotal }); }}
            className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800">
            Guardar Nota de Crédito
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ControlBancarioScreen() {
  const [tab, setTab] = useState("cuentas");
  const [cuentas, setCuentas] = useState([]);
  const [debitos, setDebitos] = useState([]);
  const [creditos, setCreditos] = useState([]);
  const [usuario, setUsuario] = useState("");
  const [modal, setModal] = useState(null); // { tipo, data }
  const [buscar, setBuscar] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");

  const cargar = useCallback(async () => {
    const [c, d, cr, u] = await Promise.all([
      db.getCuentasBancarias(),
      db.getNotasDebitoBanco(),
      db.getNotasCreditoBanco(),
      db.getUsuarioActivo(),
    ]);
    setCuentas(c || []);
    setDebitos(d || []);
    setCreditos(cr || []);
    setUsuario(u?.nombre || u?.username || "");
  }, []);

  useSyncRefresh(cargar);
  useEffect(() => { cargar(); }, [cargar]);

  // Saldo calculado por cuenta
  const saldoCuenta = (cuentaId) => {
    const c = cuentas.find(x => x.id === cuentaId);
    if (!c) return 0;
    const entradas = creditos.filter(n => n.cuentaId === cuentaId && !n.anulado).reduce((s,n)=>s+(n.montoTotal||0),0);
    const salidas  = debitos.filter(n => n.cuentaId === cuentaId && !n.anulado).reduce((s,n)=>s+(n.monto||0),0);
    return (c.saldoInicial || 0) + entradas - salidas;
  };

  // CRUD Cuentas
  const guardarCuenta = async (f) => {
    const lista = [...cuentas];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setCuentasBancarias(lista);
    setModal(null); cargar();
  };
  const eliminarCuenta = async (id) => {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    await db.setCuentasBancarias(cuentas.filter(x=>x.id!==id));
    cargar();
  };

  // CRUD Débitos
  const guardarDebito = async (f) => {
    const lista = [...debitos];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setNotasDebitoBanco(lista);
    setModal(null); cargar();
  };
  const eliminarDebito = async (id) => {
    if (!confirm("¿Anular este débito?")) return;
    const lista = debitos.map(x => x.id===id ? {...x, anulado:true} : x);
    await db.setNotasDebitoBanco(lista);
    cargar();
  };

  // CRUD Créditos
  const guardarCredito = async (f) => {
    const lista = [...creditos];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setNotasCreditoBanco(lista);
    setModal(null); cargar();
  };
  const eliminarCredito = async (id) => {
    if (!confirm("¿Anular esta nota de crédito?")) return;
    const lista = creditos.map(x => x.id===id ? {...x, anulado:true} : x);
    await db.setNotasCreditoBanco(lista);
    cargar();
  };

  const cuentasActivas = cuentas.filter(c => c.activa !== false);

  const filtrar = (lista) => lista.filter(n => {
    const cuentaOk = filtroCuenta === "todas" || n.cuentaId === filtroCuenta;
    const busOk = !buscar || JSON.stringify(n).toLowerCase().includes(buscar.toLowerCase());
    return cuentaOk && busOk;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Control Bancario</h1>
          <p className="text-xs text-slate-500 mt-0.5">Cuentas · Notas de Débito · Notas de Crédito</p>
        </div>
        <div className="flex gap-2">
          {tab === "cuentas" && (
            <button onClick={() => setModal({ tipo:"cuenta", data:null })}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
              + Nueva cuenta
            </button>
          )}
          {tab === "debitos" && (
            <button onClick={() => setModal({ tipo:"debito", data:null })} disabled={cuentasActivas.length===0}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
              + Nota de Débito
            </button>
          )}
          {tab === "creditos" && (
            <button onClick={() => setModal({ tipo:"credito", data:null })} disabled={cuentasActivas.length===0}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-40">
              + Nota de Crédito
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {[["cuentas","🏦 Cuentas"],["debitos","📤 Notas de Débito"],["creditos","📥 Notas de Crédito"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros (para débitos y créditos) */}
      {tab !== "cuentas" && (
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex gap-3">
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
          <select value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="todas">Todas las cuentas</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        {/* ── TAB CUENTAS ── */}
        {tab === "cuentas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentas.length === 0 && (
              <div className="col-span-3 text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">🏦</p>
                <p className="font-semibold">Sin cuentas bancarias</p>
                <p className="text-sm">Agrega tu primera cuenta para empezar</p>
              </div>
            )}
            {cuentas.map(c => {
              const saldo = saldoCuenta(c.id);
              const negativo = saldo < 0;
              return (
                <div key={c.id} className={`bg-white rounded-xl shadow-sm border ${c.activa===false ? "opacity-60 border-slate-100" : "border-slate-200"} p-5`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-slate-800">{c.nombre}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{c.numeroCuenta}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.moneda==="USD" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {c.moneda}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">{c.banco}</p>
                  <p className={`text-2xl font-bold ${negativo ? "text-red-600" : "text-slate-800"}`}>
                    {fmt(saldo, c.moneda)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Saldo inicial: {fmt(c.saldoInicial, c.moneda)}</p>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setModal({ tipo:"cuenta", data:c })}
                      className="flex-1 text-xs py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50">Editar</button>
                    <button onClick={() => eliminarCuenta(c.id)}
                      className="flex-1 text-xs py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB DÉBITOS ── */}
        {tab === "debitos" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {filtrar(debitos).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">📤</p>
                <p className="font-semibold">Sin notas de débito</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["N° Nota","Cuenta","Fecha","Tipo","Girado Por","Monto","Estado",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrar(debitos).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n => {
                    const c = cuentas.find(x=>x.id===n.cuentaId);
                    return (
                      <tr key={n.id} className={`hover:bg-slate-50 ${n.anulado ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{n.numero}</td>
                        <td className="px-4 py-3 text-slate-700">{c?.nombre || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{n.fecha}</td>
                        <td className="px-4 py-3 text-slate-600">{n.tipo}</td>
                        <td className="px-4 py-3 text-slate-600">{n.giradoPor || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-red-600">{fmt(n.monto, c?.moneda)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {n.anulado && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Anulado</span>}
                            {n.conciliable && !n.anulado && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Conciliable</span>}
                            {n.contabilizado && <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Contabilizado</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => setModal({ tipo:"debito", data:n })} className="text-xs text-blue-600 hover:underline">Editar</button>
                            {!n.anulado && <button onClick={() => eliminarDebito(n.id)} className="text-xs text-red-400 hover:underline">Anular</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB CRÉDITOS ── */}
        {tab === "creditos" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {filtrar(creditos).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">📥</p>
                <p className="font-semibold">Sin notas de crédito</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["N° Nota","Cuenta","Fecha","Tipo","Depositante","Monto Total","Estado",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrar(creditos).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n => {
                    const c = cuentas.find(x=>x.id===n.cuentaId);
                    return (
                      <tr key={n.id} className={`hover:bg-slate-50 ${n.anulado ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{n.numero}</td>
                        <td className="px-4 py-3 text-slate-700">{c?.nombre || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{n.fecha}</td>
                        <td className="px-4 py-3 text-slate-600">{n.tipo}</td>
                        <td className="px-4 py-3 text-slate-600">{n.depositante || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">{fmt(n.montoTotal, c?.moneda)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {n.anulado && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Anulado</span>}
                            {n.conciliable && !n.anulado && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Conciliable</span>}
                            {n.contabilizado && <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Contabilizado</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => setModal({ tipo:"credito", data:n })} className="text-xs text-blue-600 hover:underline">Editar</button>
                            {!n.anulado && <button onClick={() => eliminarCredito(n.id)} className="text-xs text-red-400 hover:underline">Anular</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {modal?.tipo === "cuenta" && (
        <ModalCuenta cuenta={modal.data} onSave={guardarCuenta} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "debito" && (
        <ModalDebito nota={modal.data} cuentas={cuentasActivas} usuarioActivo={usuario}
          onSave={guardarDebito} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "credito" && (
        <ModalCredito nota={modal.data} cuentas={cuentasActivas} usuarioActivo={usuario}
          onSave={guardarCredito} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
