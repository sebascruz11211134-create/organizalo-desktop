import React, { useState, useEffect, useRef, useCallback } from "react";
import { Save, RefreshCw, Upload, Shield, Trash2, CheckCircle, AlertCircle, MessageCircle, Wifi, WifiOff, QrCode, Bell } from "lucide-react";
import db from "../utils/db";
import { pushSync, pullSync } from "../utils/sync";
import { getToken } from "../utils/auth";

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
  const [waTelTest,    setWaTelTest]    = useState("64693392");
  const [waSending,    setWaSending]    = useState(false);

  // ── Notificaciones ntfy ───────────────────────────────────────────────────
  const [ntfyConfig,    setNtfyConfig]   = useState(null);   // { topic, url, instrucciones }
  const [ntfyLoading,   setNtfyLoading]  = useState(false);
  const [ntfyMsg,       setNtfyMsg]      = useState(null);   // { type, text }

  // ── Certificado BCCR ──────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [certStatus,    setCertStatus]    = useState(null);  // null | { configured, cedula, nombre, subidoEn }
  const [certLoading,   setCertLoading]   = useState(false);
  const [certMsg,       setCertMsg]       = useState(null);  // { type: "ok"|"err", text }
  const [certFile,      setCertFile]      = useState(null);
  const [certPass,      setCertPass]      = useState("");
  const [certCedula,    setCertCedula]    = useState("");
  const [certNombre,    setCertNombre]    = useState("");

  useEffect(() => {
    db.getSettings().then((st) => setS((prev) => ({ ...prev, ...st })));
    cargarCertStatus();
    cargarWaEstado();
    cargarNtfyConfig();
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
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );

  // ── ntfy helpers ─────────────────────────────────────────────────────────
  async function cargarNtfyConfig() {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/ntfy/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setNtfyConfig(await res.json());
    } catch {}
  }

  async function enviarNotifPrueba() {
    setNtfyLoading(true); setNtfyMsg(null);
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/ntfy/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNtfyMsg({ type: "ok", text: "¡Notificación de prueba enviada! Revisá la app ntfy." });
    } catch {
      setNtfyMsg({ type: "err", text: "No se pudo enviar la prueba." });
    }
    setNtfyLoading(false);
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
                  ${s.moneda === m ? "border-green-700 bg-green-50 text-green-800" : "border-gray-200 text-slate-500 hover:border-gray-300"}`}>
                {m === "CRC" ? "₡ Colones" : "$ Dólares"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={guardar}
          className={`mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${saved ? "bg-green-100 text-green-800" : "bg-green-700 text-white hover:bg-green-800"}`}>
          <Save size={15} />
          {saved ? "¡Guardado!" : "Guardar configuración"}
        </button>
      </div>

      {/* Certificado BCCR ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-green-700" />
          <h2 className="text-base font-bold text-slate-900">Certificado BCCR (.p12)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Necesario para firmar el Mensaje Receptor ante Hacienda al recibir facturas electrónicas.
          El archivo se guarda encriptado con AES-256-GCM y nunca se registra en texto plano.
        </p>

        {/* Estado actual */}
        {certStatus?.configured ? (
          <div className="mb-4 flex items-start justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Certificado activo</p>
                <p className="text-xs text-green-700">
                  {certStatus.nombre || "—"} · Cédula {certStatus.cedula || "—"}
                </p>
                <p className="text-xs text-green-600">
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
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">No hay certificado configurado. Sin él no se puede enviar el Mensaje Receptor a Hacienda.</p>
          </div>
        )}

        {/* Mensaje de resultado */}
        {certMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${certMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
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
              className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-4 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
              {certFile ? (
                <p className="text-sm text-green-700 font-medium">{certFile.name}</p>
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Cédula del receptor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula del receptor</label>
            <input type="text" value={certCedula} onChange={(e) => setCertCedula(e.target.value)}
              placeholder="3101000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Nombre del receptor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del receptor</label>
            <input type="text" value={certNombre} onChange={(e) => setCertNombre(e.target.value)}
              placeholder="Mi Empresa S.A."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <button onClick={subirCert} disabled={certLoading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
          <Upload size={14} />
          {certLoading ? "Guardando…" : certStatus?.configured ? "Reemplazar certificado" : "Guardar certificado"}
        </button>
      </div>

      {/* WhatsApp ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-green-600" />
            <h2 className="text-base font-bold text-slate-900">WhatsApp Business</h2>
          </div>
          {/* Estado badge */}
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
            ${waEstado === "open" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
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
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            <QrCode size={13} /> {waLoading ? "Cargando…" : "Mostrar QR"}
          </button>
          <button onClick={reconectarWA} disabled={waLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50 disabled:opacity-50">
            <RefreshCw size={13} /> Reconectar
          </button>
        </div>

        {/* Mensaje de estado */}
        {waMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${waMsg.type === "ok"   ? "bg-green-50 border border-green-200 text-green-700"
            : waMsg.type === "info" ? "bg-blue-50 border border-blue-200 text-blue-700"
            :                         "bg-red-50 border border-red-200 text-red-700"}`}>
            {waMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {waMsg.text}
          </div>
        )}

        {/* QR Code */}
        {waQR && (
          <div className="mb-5 flex flex-col items-center gap-3 p-5 border-2 border-dashed border-green-300 rounded-xl bg-green-50">
            <p className="text-sm font-semibold text-green-800">Abrí WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo</p>
            <img
              src={waQR.src}
              alt="QR WhatsApp"
              className="w-52 h-52 rounded-lg border-4 border-white shadow-md"
            />
            <p className="text-xs text-green-600">El QR expira en ~60 segundos. Si vence, presioná "Mostrar QR" de nuevo.</p>
            <button onClick={cargarQR} className="text-xs text-green-700 underline">Regenerar QR</button>
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
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              value={waMsgTest}
              onChange={e => setWaMsgTest(e.target.value)}
              placeholder="Mensaje de prueba..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button onClick={enviarMsgTest} disabled={waSending || !waTelTest || !waMsgTest}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
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
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800">
            <RefreshCw size={14} /> Subir mis datos
          </button>
          <button onClick={handlePull}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
            <RefreshCw size={14} /> Descargar del servidor
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Backend: https://organizalo-backend-production.up.railway.app
        </p>
      </div>

      {/* ── Notificaciones Push (ntfy) ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">Notificaciones Push</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Recibí alertas en tu teléfono aunque el navegador esté cerrado: cobros vencidos,
          WhatsApp desconectado, y más. Gratis, sin registrarte en ningún servicio.
        </p>

        {ntfyConfig ? (
          <div className="space-y-4">
            {/* Instrucciones */}
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <p className="text-xs font-bold text-violet-800 mb-2">Cómo configurarlo:</p>
              <ol className="text-xs text-violet-700 space-y-1">
                <li>1. Instalá la app <strong>ntfy</strong> en tu teléfono (iOS o Android, es gratis)</li>
                <li>2. Abrí la app → toca "+" → pegá este topic:</li>
                <li className="ml-3">
                  <code className="bg-violet-100 px-2 py-0.5 rounded font-mono text-violet-900 select-all">
                    {ntfyConfig.topic}
                  </code>
                </li>
                <li>3. Listo — vas a recibir alertas de Organízalo.AI</li>
              </ol>
            </div>

            {/* URL copiable */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL del topic</label>
              <div className="flex gap-2">
                <input readOnly value={ntfyConfig.url}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono text-slate-600 bg-gray-50" />
                <button onClick={() => navigator.clipboard?.writeText(ntfyConfig.url)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-slate-600 hover:bg-gray-50">
                  Copiar
                </button>
              </div>
            </div>

            {/* Botón de prueba */}
            <button onClick={enviarNotifPrueba} disabled={ntfyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              <Bell size={13} /> {ntfyLoading ? "Enviando…" : "Enviar notificación de prueba"}
            </button>

            {ntfyMsg && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
                ${ntfyMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {ntfyMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {ntfyMsg.text}
              </div>
            )}
          </div>
        ) : (
          <button onClick={cargarNtfyConfig}
            className="text-sm text-violet-600 hover:underline">
            Cargar configuración de notificaciones
          </button>
        )}
      </div>
    </div>
  );
}
