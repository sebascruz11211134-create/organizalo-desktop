import React, { useState, useEffect, useRef, useCallback } from "react";
import { Save, RefreshCw, Upload, Shield, Trash2, CheckCircle, AlertCircle, MessageCircle, Wifi, WifiOff, QrCode, Bell, Users, Plus, Copy, Eye, EyeOff, UserX, RefreshCcw } from "lucide-react";
import db from "../utils/db";
import { pushSync, pullSync } from "../utils/sync";
import { getToken, getUser } from "../utils/auth";

import { BACKEND } from "../utils/config";

export default function ConfiguracionScreen() {
  const [s,       setS]       = useState({ nombreNegocio: "", cedula: "", moneda: "CRC", correo: "", sinpe: "", direccion: "" });
  const [saved,   setSaved]   = useState(false);
  const [syncing, setSyncing] = useState("");

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const [waEstado,     setWaEstado]     = useState(null);   // null | "open" | "connecting" | "close"
  const [waQR,         setWaQR]         = useState(null);   // base64 string
  const [waLoading,    setWaLoading]    = useState(false);
  const [waMsg,        setWaMsg]        = useState(null);
  const [waMsgTest,    setWaMsgTest]    = useState("");
  const [waTelTest,    setWaTelTest]    = useState("");
  const [waSending,    setWaSending]    = useState(false);

  // ── Notificaciones ntfy ───────────────────────────────────────────────────
  const [ntfyConfig,    setNtfyConfig]   = useState(null);   // { topic, url } — topic personal
  const [ntfyLoading,   setNtfyLoading]  = useState(false);
  const [ntfyMsg,       setNtfyMsg]      = useState(null);   // { type, text }
  const [ntfyPrefs,     setNtfyPrefs]    = useState(null);   // { prefs: {tipo:bool}, tipos: [{id,label,icon}] }
  const [ntfySaving,    setNtfySaving]   = useState(false);

  // ── Certificado BCCR ──────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [certStatus,    setCertStatus]    = useState(null);  // null | { configured, cedula, nombre, subidoEn, atvConfigurado, atvUsuario }
  const [certLoading,   setCertLoading]   = useState(false);
  const [certMsg,       setCertMsg]       = useState(null);  // { type: "ok"|"err", text }
  const [certFile,      setCertFile]      = useState(null);
  const [certPass,      setCertPass]      = useState("");
  const [certCedula,    setCertCedula]    = useState("");
  const [certNombre,    setCertNombre]    = useState("");

  // ── Credenciales ATV (Hacienda) ───────────────────────────────────────────
  const [atvUsuario,    setAtvUsuario]    = useState("");
  const [atvPass,       setAtvPass]       = useState("");
  const [atvLoading,    setAtvLoading]    = useState(false);
  const [atvMsg,        setAtvMsg]        = useState(null);  // { type: "ok"|"err", text }

  // ── Gestión de usuarios de empresa ────────────────────────────────────────
  // getUser() es async — leer sync desde localStorage para evitar Promise
  const meUser = (() => {
    try { return JSON.parse(localStorage.getItem("@finanzia/authUser")); } catch { return null; }
  })();
  const esAdmin = meUser && ["admin", "superadmin"].includes(meUser.rol);
  const [equipo,       setEquipo]       = useState([]);
  const [equipoLoad,   setEquipoLoad]   = useState(false);
  const [showNuevoUsr, setShowNuevoUsr] = useState(false);
  const [nuevoNombre,  setNuevoNombre]  = useState("");
  const [nuevoUser,    setNuevoUser]    = useState("");
  const [nuevoPass,    setNuevoPass]    = useState("");
  const [nuevoRol,     setNuevoRol]     = useState("colaborador");
  const [usrMsg,       setUsrMsg]       = useState(null);
  const [usrLoading,   setUsrLoading]   = useState(false);
  const [credencial,   setCredencial]   = useState(null); // { nombre, username, password } — se muestra tras crear
  const [showPass,     setShowPass]     = useState(false);

  function genPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function cargarEquipo() {
    setEquipoLoad(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/auth/team`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setEquipo(data.members || []);
    } catch { setEquipo([]); }
    setEquipoLoad(false);
  }

  async function crearUsuario() {
    if (!nuevoNombre.trim() || !nuevoUser.trim() || !nuevoPass.trim()) {
      setUsrMsg({ type: "err", text: "Completá todos los campos." }); return;
    }
    setUsrLoading(true); setUsrMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nuevoNombre, username: nuevoUser, password: nuevoPass, rol: nuevoRol }),
      });
      const data = await res.json();
      if (!res.ok) { setUsrMsg({ type: "err", text: data.error || "Error al crear el usuario." }); return; }
      setCredencial({ nombre: nuevoNombre.trim(), username: data.user.username, password: nuevoPass });
      setNuevoNombre(""); setNuevoUser(""); setNuevoPass(""); setNuevoRol("colaborador");
      setShowNuevoUsr(false);
      cargarEquipo();
    } catch { setUsrMsg({ type: "err", text: "Error de conexión." }); }
    setUsrLoading(false);
  }

  async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/auth/delete-user/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      cargarEquipo();
    } catch {}
  }

  async function cambiarRol(id, rol) {
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/auth/update-user/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rol }),
      });
      cargarEquipo();
    } catch {}
  }

  useEffect(() => {
    db.getSettings().then((st) => setS((prev) => ({ ...prev, ...st })));
    cargarCertStatus();
    cargarWaEstado();
    cargarNtfyUserConfig();
    cargarNtfyPrefs();
    if (esAdmin) cargarEquipo();
  }, []);

  // ── WhatsApp helpers ──────────────────────────────────────────────────────
  async function cargarWaEstado() {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWaEstado(data.estado);
    } catch { setWaEstado("desconectado"); }
  }

  async function cargarQR() {
    setWaLoading(true); setWaMsg(null); setWaQR(null);
    const token = await getToken();
    const deadline = Date.now() + 60000; // polling hasta 60s

    const poll = async () => {
      try {
        const res  = await fetch(`${BACKEND}/api/whatsapp/qr`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.yaConectado || data.estado === "open") {
          setWaMsg({ type: "ok", text: "WhatsApp ya está conectado ✓" });
          setWaEstado("open");
          setWaLoading(false);
        } else if (data.qr?.base64) {
          setWaQR({ tipo: "base64", src: `data:image/png;base64,${data.qr.base64}` });
          setWaLoading(false);
        } else if (data.qr?.base64url) {
          setWaQR({ tipo: "url", src: data.qr.base64url });
          setWaLoading(false);
        } else if (data.conectando || data.estado === "connecting") {
          // Aún iniciando — reintentar en 3s
          if (Date.now() < deadline) {
            setTimeout(poll, 3000);
          } else {
            setWaMsg({ type: "err", text: "Tiempo agotado esperando el QR. Intentá de nuevo." });
            setWaLoading(false);
          }
        } else {
          setWaMsg({ type: "err", text: data.error || "No se pudo obtener el QR." });
          setWaLoading(false);
        }
      } catch (e) {
        setWaMsg({ type: "err", text: "No se pudo conectar al backend." });
        setWaLoading(false);
      }
    };

    poll();
  }

  async function reconectarWA() {
    setWaLoading(true); setWaQR(null); setWaMsg(null);
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/whatsapp/reconectar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setWaMsg({ type: "ok", text: "Instancia reiniciada. Cargando QR..." });
      setTimeout(cargarQR, 3000);
    } catch (e) {
      setWaMsg({ type: "err", text: e.message });
    } finally { setWaLoading(false); }
  }

  async function enviarMsgTest() {
    if (!waTelTest || !waMsgTest) return;
    setWaSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/whatsapp/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ numero: waTelTest, mensaje: waMsgTest })
      });
      const data = await res.json();
      setWaMsg(data.ok
        ? { type: "ok", text: "✓ Mensaje enviado correctamente" }
        : { type: "err", text: data.error || "Error al enviar" }
      );
    } catch (e) {
      setWaMsg({ type: "err", text: e.message });
    } finally { setWaSending(false); }
  }

  async function cargarCertStatus() {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/cert/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCertStatus(await res.json());
    } catch {}
  }

  async function subirCert() {
    if (!certFile) return setCertMsg({ type: "err", text: "Seleccioná un archivo .p12" });
    if (!certPass) return setCertMsg({ type: "err", text: "Ingresá la contraseña del certificado" });
    setCertLoading(true);
    setCertMsg(null);
    try {
      const token = await getToken();
      const form  = new FormData();
      form.append("cert",    certFile);
      form.append("password", certPass);
      form.append("cedula",   certCedula);
      form.append("nombre",   certNombre);
      const res = await fetch(`${BACKEND}/api/cert/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setCertMsg({ type: "ok", text: "Certificado guardado correctamente" });
        setCertFile(null); setCertPass(""); setCertCedula(""); setCertNombre("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        cargarCertStatus();
      } else {
        setCertMsg({ type: "err", text: data.error || "Error al guardar el certificado" });
      }
    } catch (e) {
      setCertMsg({ type: "err", text: e.message });
    } finally {
      setCertLoading(false);
    }
  }

  async function eliminarCert() {
    if (!confirm("¿Eliminar el certificado? Esta acción no se puede deshacer.")) return;
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/cert`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCertStatus(null);
      setCertMsg({ type: "ok", text: "Certificado eliminado" });
    } catch (e) {
      setCertMsg({ type: "err", text: e.message });
    }
  }

  async function subirATV() {
    if (!atvUsuario) return setAtvMsg({ type: "err", text: "Ingresá el usuario de ATV" });
    if (!atvPass)    return setAtvMsg({ type: "err", text: "Ingresá la contraseña de ATV" });
    if (!certStatus?.configured) return setAtvMsg({ type: "err", text: "Primero subí el certificado .p12" });
    setAtvLoading(true); setAtvMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/cert/atv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: atvUsuario, password: atvPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setAtvMsg({ type: "ok", text: "Credenciales ATV guardadas correctamente" });
        setAtvPass("");
        cargarCertStatus();
      } else {
        setAtvMsg({ type: "err", text: data.error || "Error al guardar credenciales ATV" });
      }
    } catch (e) {
      setAtvMsg({ type: "err", text: e.message });
    } finally {
      setAtvLoading(false);
    }
  }

  const guardar = async () => {
    await db.setSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePush = async () => {
    setSyncing("Subiendo datos al servidor…");
    await pushSync();
    setSyncing("✓ Datos subidos correctamente");
    setTimeout(() => setSyncing(""), 3000);
  };

  const handlePull = async () => {
    setSyncing("Descargando datos del servidor…");
    await pullSync();
    setSyncing("✓ Datos sincronizados");
    setTimeout(() => setSyncing(""), 3000);
  };

  const field = (label, key, type = "text", placeholder = "") => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input type={type} value={s[key] || ""} onChange={(e) => setS((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
    </div>
  );

  // ── ntfy helpers ─────────────────────────────────────────────────────────
  async function cargarNtfyUserConfig() {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/ntfy/user-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setNtfyConfig(await res.json());
    } catch {}
  }

  async function cargarNtfyPrefs() {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/ntfy/prefs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setNtfyPrefs(await res.json());
    } catch {}
  }

  async function guardarNtfyPrefs(nuevasPrefs) {
    setNtfySaving(true); setNtfyMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/ntfy/prefs`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefs: nuevasPrefs }),
      });
      if (res.ok) {
        setNtfyPrefs(p => ({ ...p, prefs: nuevasPrefs }));
        setNtfyMsg({ type: "ok", text: "Preferencias guardadas" });
        setTimeout(() => setNtfyMsg(null), 2500);
      }
    } catch {
      setNtfyMsg({ type: "err", text: "No se pudieron guardar las preferencias." });
    }
    setNtfySaving(false);
  }

  async function enviarNotifPrueba() {
    setNtfyLoading(true); setNtfyMsg(null);
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/ntfy/test-user`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNtfyMsg({ type: "ok", text: "¡Notificación enviada a tu topic personal! Revisá la app ntfy." });
    } catch {
      setNtfyMsg({ type: "err", text: "No se pudo enviar la prueba." });
    }
    setNtfyLoading(false);
  }

  function togglePref(tipo) {
    if (!ntfyPrefs) return;
    const nuevas = { ...ntfyPrefs.prefs, [tipo]: !ntfyPrefs.prefs[tipo] };
    guardarNtfyPrefs(nuevas);
  }

  return (
    <div className="p-6 max-w-2xl fade-in">
      {/* Negocio */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Datos del negocio</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Nombre del negocio", "nombreNegocio", "text", "Mi empresa S.A.")}
          {field("Cédula jurídica / física", "cedula", "text", "3-101-000000")}
          {field("Correo electrónico", "correo", "email", "info@minegocio.cr")}
          {field("SINPE Móvil", "sinpe", "text", "8XXX-XXXX")}
          <div className="col-span-2">
            {field("Dirección", "direccion", "text", "San José, Costa Rica")}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda principal</label>
          <div className="flex gap-3">
            {["CRC", "USD"].map((m) => (
              <button key={m} onClick={() => setS((p) => ({ ...p, moneda: m }))}
                className={`px-5 py-2 rounded-lg text-sm font-bold border-2 transition-colors
                  ${s.moneda === m ? "border-yellow-300 bg-green-50 text-green-800" : "border-gray-200 text-slate-500 hover:border-gray-300"}`}>
                {m === "CRC" ? "₡ Colones" : "$ Dólares"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={guardar}
          className={`mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${saved ? "bg-green-100 text-green-800" : "bg-yellow-700 text-white hover:bg-green-800"}`}>
          <Save size={15} />
          {saved ? "¡Guardado!" : "Guardar configuración"}
        </button>
      </div>

      {/* Certificado BCCR ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-yellow-700" />
          <h2 className="text-base font-bold text-slate-900">Facturación Electrónica</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Configurá el certificado BCCR (.p12) y las credenciales ATV de Hacienda para enviar y recibir
          facturas electrónicas. El certificado se guarda encriptado con AES-256-GCM y nunca se registra en texto plano.
        </p>

        {/* Estado actual */}
        {certStatus?.configured ? (
          <div className="mb-4 flex items-start justify-between bg-green-50 border border-yellow-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Certificado activo</p>
                <p className="text-xs text-yellow-700">
                  {certStatus.nombre || "—"} · Cédula {certStatus.cedula || "—"}
                </p>
                <p className="text-xs text-yellow-600">
                  Subido el {certStatus.subidoEn ? new Date(certStatus.subidoEn).toLocaleDateString("es-CR") : "—"}
                </p>
              </div>
            </div>
            <button onClick={eliminarCert}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle size={15} className="text-yellow-600 shrink-0" />
            <p className="text-xs text-yellow-700">No hay certificado configurado. Sin él no se puede enviar el Mensaje Receptor a Hacienda.</p>
          </div>
        )}

        {/* Mensaje de resultado */}
        {certMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${certMsg.type === "ok" ? "bg-green-50 border border-yellow-300 text-yellow-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {certMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {certMsg.text}
          </div>
        )}

        {/* Formulario subida */}
        <div className="grid grid-cols-2 gap-3">
          {/* Archivo .p12 */}
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Archivo .p12</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-4 text-center cursor-pointer hover:border-yellow-300 hover:bg-yellow-50 transition-colors">
              {certFile ? (
                <p className="text-sm text-yellow-700 font-medium">{certFile.name}</p>
              ) : (
                <p className="text-sm text-slate-400">Click para seleccionar un archivo <span className="font-mono">.p12</span></p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".p12,application/x-pkcs12" className="hidden"
              onChange={(e) => setCertFile(e.target.files[0] || null)} />
          </div>

          {/* Contraseña */}
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña del certificado</label>
            <input type="password" value={certPass} onChange={(e) => setCertPass(e.target.value)}
              placeholder="Contraseña del .p12"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          </div>

          {/* Cédula del receptor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula del receptor</label>
            <input type="text" value={certCedula} onChange={(e) => setCertCedula(e.target.value)}
              placeholder="3101000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          </div>

          {/* Nombre del receptor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del receptor</label>
            <input type="text" value={certNombre} onChange={(e) => setCertNombre(e.target.value)}
              placeholder="Mi Empresa S.A."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          </div>
        </div>

        <button onClick={subirCert} disabled={certLoading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-yellow-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
          <Upload size={14} />
          {certLoading ? "Guardando…" : certStatus?.configured ? "Reemplazar certificado" : "Guardar certificado"}
        </button>

        {/* ── Credenciales ATV (Hacienda) ───────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Credenciales ATV · Hacienda</p>
          <p className="text-xs text-slate-400 mb-4">
            Usuario y contraseña del sistema ATV (<span className="font-mono">atv.hacienda.go.cr</span>) para enviar facturas electrónicas.
            La contraseña se guarda encriptada — nunca en texto plano.
          </p>

          {/* Estado ATV */}
          {certStatus?.atvConfigurado ? (
            <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-yellow-300 rounded-lg">
              <CheckCircle size={14} className="text-yellow-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-800">ATV configurado</p>
                <p className="text-xs text-yellow-600">
                  Usuario: <span className="font-mono">{certStatus.atvUsuario}</span>
                  {certStatus.atvActualizadoEn && ` · Actualizado el ${new Date(certStatus.atvActualizadoEn).toLocaleDateString("es-CR")}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle size={14} className="text-yellow-600 shrink-0" />
              <p className="text-xs text-yellow-700">Sin credenciales ATV — necesarias para emitir facturas electrónicas.</p>
            </div>
          )}

          {/* Mensaje resultado ATV */}
          {atvMsg && (
            <div className={`mb-3 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
              ${atvMsg.type === "ok" ? "bg-green-50 border border-yellow-300 text-yellow-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {atvMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {atvMsg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario ATV</label>
              <input type="text" value={atvUsuario} onChange={e => setAtvUsuario(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña ATV</label>
              <input type="password" value={atvPass} onChange={e => setAtvPass(e.target.value)}
                placeholder="Contraseña del sistema ATV"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </div>
          </div>

          <button onClick={subirATV} disabled={atvLoading || !certStatus?.configured}
            title={!certStatus?.configured ? "Primero subí el certificado .p12" : ""}
            className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-yellow-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
            <Shield size={14} />
            {atvLoading ? "Guardando…" : certStatus?.atvConfigurado ? "Actualizar credenciales ATV" : "Guardar credenciales ATV"}
          </button>
        </div>
      </div>

      {/* WhatsApp ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-yellow-600" />
            <h2 className="text-base font-bold text-slate-900">WhatsApp Business</h2>
          </div>
          {/* Estado badge */}
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
            ${waEstado === "open" ? "bg-green-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
            {waEstado === "open" ? <Wifi size={11} /> : <WifiOff size={11} />}
            {waEstado === "open" ? "Conectado" : waEstado || "Sin estado"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Conectá un número de WhatsApp para enviar recordatorios de seguimiento automáticos a tus clientes.
          Los mensajes se envían a las 8am del día programado en el Calendario.
        </p>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={cargarWaEstado}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <RefreshCw size={13} /> Actualizar estado
          </button>
          <button onClick={cargarQR} disabled={waLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50">
            <QrCode size={13} /> {waLoading ? "Cargando…" : "Mostrar QR"}
          </button>
          <button onClick={reconectarWA} disabled={waLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-yellow-300 text-yellow-700 rounded-lg text-sm hover:bg-yellow-50 disabled:opacity-50">
            <RefreshCw size={13} /> Reconectar
          </button>
        </div>

        {/* Mensaje de estado */}
        {waMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${waMsg.type === "ok"   ? "bg-green-50 border border-yellow-300 text-yellow-700"
            : waMsg.type === "info" ? "bg-blue-50 border border-blue-200 text-blue-700"
            :                         "bg-red-50 border border-red-200 text-red-700"}`}>
            {waMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {waMsg.text}
          </div>
        )}

        {/* QR Code */}
        {waQR && (
          <div className="mb-5 flex flex-col items-center gap-3 p-5 border-2 border-dashed border-yellow-300 rounded-xl bg-green-50">
            <p className="text-sm font-semibold text-green-800">Abrí WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo</p>
            <img
              src={waQR.src}
              alt="QR WhatsApp"
              className="w-52 h-52 rounded-lg border-4 border-white shadow-md"
            />
            <p className="text-xs text-yellow-600">El QR expira en ~60 segundos. Si vence, presioná "Mostrar QR" de nuevo.</p>
            <button onClick={cargarQR} className="text-xs text-yellow-700 underline">Regenerar QR</button>
          </div>
        )}

        {/* Test de envío */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Probar envío</p>
          <div className="flex gap-2">
            <input
              value={waTelTest}
              onChange={e => setWaTelTest(e.target.value)}
              placeholder="64693392"
              className="w-32 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
            <input
              value={waMsgTest}
              onChange={e => setWaMsgTest(e.target.value)}
              placeholder="Mensaje de prueba..."
              className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
            <button onClick={enviarMsgTest} disabled={waSending || !waTelTest || !waMsgTest}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50">
              {waSending ? "…" : "Enviar"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">El número se formatea automáticamente con prefijo 506 (Costa Rica).</p>
        </div>
      </div>

      {/* Sync */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">Sincronización</h2>
        <p className="text-sm text-slate-500 mb-5">
          Los datos se sincronizan automáticamente cada 3 minutos entre el app móvil y el desktop.
          También podés forzar una sincronización manual.
        </p>

        {syncing && (
          <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin" /> {syncing}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handlePush}
            className="flex items-center gap-2 px-4 py-2.5 bg-yellow-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800">
            <RefreshCw size={14} /> Subir mis datos
          </button>
          <button onClick={handlePull}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
            <RefreshCw size={14} /> Descargar del servidor
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Backend: https://api.organizalo.ai
        </p>
      </div>

      {/* ── Notificaciones Push (ntfy) ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">Notificaciones Push</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Cada usuario tiene su propio canal privado en ntfy. Solo vos recibís tus notificaciones —
          nadie más en la empresa las ve. Configurá cuáles querés recibir.
        </p>

        {ntfyConfig && (
          <div className="space-y-4">
            {/* Topic personal */}
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <p className="text-xs font-bold text-violet-800 mb-2">Tu canal personal:</p>
              <ol className="text-xs text-violet-700 space-y-1 mb-3">
                <li>1. Instalá <strong>ntfy</strong> en tu teléfono (iOS o Android, gratis)</li>
                <li>2. Abrí la app → tocá "+" → pegá este topic:</li>
              </ol>
              <div className="flex gap-2">
                <input readOnly value={ntfyConfig.topic}
                  className="flex-1 px-2 py-1.5 border border-violet-200 rounded-lg text-xs font-mono text-violet-900 bg-white" />
                <button onClick={() => navigator.clipboard?.writeText(ntfyConfig.topic)}
                  className="px-3 py-1.5 border border-violet-200 rounded-lg text-xs text-violet-700 hover:bg-violet-100">
                  Copiar
                </button>
              </div>
            </div>

            {/* Preferencias por tipo */}
            {ntfyPrefs && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Qué querés recibir</p>
                <div className="space-y-1">
                  {ntfyPrefs.tipos.map(tipo => (
                    <button
                      key={tipo.id}
                      onClick={() => togglePref(tipo.id)}
                      disabled={ntfySaving}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left
                        ${ntfyPrefs.prefs[tipo.id]
                          ? "bg-violet-50 border-violet-200 text-violet-800"
                          : "bg-gray-50 border-gray-200 text-slate-400"}`}
                    >
                      <span className="text-base leading-none">{tipo.icon}</span>
                      <span className="flex-1 font-medium">{tipo.label}</span>
                      <span className={`w-8 h-4 rounded-full relative transition-colors shrink-0
                        ${ntfyPrefs.prefs[tipo.id] ? "bg-violet-500" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all
                          ${ntfyPrefs.prefs[tipo.id] ? "left-4" : "left-0.5"}`} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mensaje */}
            {ntfyMsg && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
                ${ntfyMsg.type === "ok" ? "bg-green-50 border border-yellow-300 text-yellow-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {ntfyMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {ntfyMsg.text}
              </div>
            )}

            {/* Botón de prueba */}
            <button onClick={enviarNotifPrueba} disabled={ntfyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              <Bell size={13} /> {ntfyLoading ? "Enviando…" : "Enviar notificación de prueba"}
            </button>
          </div>
        )}

        {!ntfyConfig && (
          <button onClick={cargarNtfyUserConfig}
            className="text-sm text-violet-600 hover:underline">
            Cargar configuración de notificaciones
          </button>
        )}
      </div>

      {/* ── Sección: Usuarios de la empresa (solo admin) ─────────────────── */}
      {esAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-slate-600" />
              <h3 className="font-semibold text-slate-800">Usuarios de tu empresa</h3>
            </div>
            <button
              onClick={() => { setShowNuevoUsr(true); setUsrMsg(null); setNuevoPass(genPassword()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded-lg hover:bg-yellow-700 transition-colors">
              <Plus size={13} /> Nuevo usuario
            </button>
          </div>

          {/* Credencial recién creada */}
          {credencial && (
            <div className="mb-4 border border-yellow-200 bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={15} className="text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-800">Usuario creado — guardá estas credenciales</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="bg-white rounded-lg border border-yellow-200 px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">Nombre</p>
                  <p className="font-medium text-slate-800">{credencial.nombre}</p>
                </div>
                <div className="bg-white rounded-lg border border-yellow-200 px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">Usuario</p>
                  <p className="font-mono font-medium text-slate-800">{credencial.username}</p>
                </div>
                <div className="col-span-2 bg-white rounded-lg border border-yellow-200 px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">Contraseña</p>
                  <p className="font-mono font-bold text-slate-800 tracking-wider">{credencial.password}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(`Usuario: ${credencial.username}\nContraseña: ${credencial.password}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-yellow-400 text-yellow-700 text-xs font-medium rounded-lg hover:bg-yellow-100 transition-colors">
                  <Copy size={12} /> Copiar credenciales
                </button>
                <button
                  onClick={() => {
                    const w = window.open("", "_blank");
                    w.document.write(`<pre style="font-family:monospace;font-size:16px;padding:24px">
Monki.AI — Credenciales de acceso

Nombre:     ${credencial.nombre}
Usuario:    ${credencial.username}
Contraseña: ${credencial.password}

Ingresá en: ${window.location.origin}
                    </pre>`);
                    w.print();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors">
                  🖨 Imprimir
                </button>
                <button onClick={() => setCredencial(null)}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
              </div>
            </div>
          )}

          {/* Tabla de equipo */}
          {equipoLoad ? (
            <p className="text-sm text-slate-400 text-center py-4">Cargando equipo…</p>
          ) : equipo.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No hay otros usuarios en tu empresa todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-gray-100">
                    <th className="pb-2 pr-4">Nombre</th>
                    <th className="pb-2 pr-4">Usuario</th>
                    <th className="pb-2 pr-4">Rol</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {equipo.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-800">{u.nombre}</td>
                      <td className="py-2 pr-4 font-mono text-slate-600 text-xs">{u.username || "—"}</td>
                      <td className="py-2 pr-4">
                        {u.id === meUser?.id ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.rol === "admin" ? "bg-purple-100 text-purple-700" :
                            u.rol === "contador" ? "bg-blue-100 text-blue-700" :
                            u.rol === "vendedor" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-slate-600"
                          }`}>{u.rol}</span>
                        ) : (
                          <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-300">
                            <option value="colaborador">colaborador</option>
                            <option value="vendedor">vendedor</option>
                            <option value="contador">contador</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.activo ? "bg-green-100 text-yellow-700" : "bg-red-100 text-red-600"
                        }`}>{u.activo ? "Activo" : "Inactivo"}</span>
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => eliminarUsuario(u.id, u.nombre)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <UserX size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={cargarEquipo} className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            <RefreshCcw size={11} /> Actualizar lista
          </button>

          {/* Modal: Nuevo usuario */}
          {showNuevoUsr && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-700 border-b border-slate-600">
                  <h4 className="text-sm font-bold text-white">Crear nuevo usuario</h4>
                  <button onClick={() => { setShowNuevoUsr(false); setUsrMsg(null); }} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre completo</label>
                    <input value={nuevoNombre} onChange={e => {
                        const n = e.target.value;
                        setNuevoNombre(n);
                        const parts = n.trim().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().split(/\s+/).filter(Boolean);
                        const auto = parts.length >= 2 ? `${parts[0]}.${parts[parts.length-1]}` : parts[0] || "";
                        setNuevoUser(auto.replace(/[^a-z0-9.]/g,""));
                      }}
                      placeholder="Ej: María González"
                      className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Usuario <span className="text-yellow-500 normal-case font-normal">· auto-generado</span>
                    </label>
                    <input value={nuevoUser} onChange={e => setNuevoUser(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))}
                      placeholder="Ej: maria.gonzalez"
                      className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={nuevoPass}
                          onChange={e => setNuevoPass(e.target.value)}
                          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 pr-8" />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <button type="button" onClick={() => setNuevoPass(genPassword())}
                        title="Generar contraseña"
                        className="px-2.5 border border-slate-200 rounded text-slate-500 hover:bg-slate-50 text-xs">
                        <RefreshCcw size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol</label>
                    <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value)}
                      className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400">
                      <option value="colaborador">Colaborador</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="contador">Contador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {usrMsg && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm
                      ${usrMsg.type === "ok" ? "bg-yellow-50 border border-yellow-200 text-yellow-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                      {usrMsg.type === "ok" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      {usrMsg.text}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowNuevoUsr(false); setUsrMsg(null); }}
                      className="flex-1 py-2 border border-slate-200 rounded text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button onClick={crearUsuario} disabled={usrLoading}
                      className="flex-1 py-2 bg-yellow-600 text-white rounded text-sm font-semibold hover:bg-yellow-700 disabled:opacity-50">
                      {usrLoading ? "Creando…" : "Crear usuario"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
