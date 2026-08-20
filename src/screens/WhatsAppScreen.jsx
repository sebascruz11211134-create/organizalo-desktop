/**
 * WhatsAppScreen — Conectar WhatsApp Web por empresa
 * Muestra QR para escanear y mantiene la sesión activa en Railway.
 */
import React, { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, RefreshCw, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { getToken } from "../utils/auth";

const BACKEND = "https://organizalo-backend-production.up.railway.app";

async function apiFetch(path, opts = {}) {
  const token = await getToken();
  const res = await fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return res.json();
}

export default function WhatsAppScreen() {
  const [estado,       setEstado]       = useState("loading"); // loading | disconnected | connecting | qr | open | no_instalado
  const [qrBase64,     setQrBase64]     = useState(null);
  const [qrUrl,        setQrUrl]        = useState(null);
  const [error,        setError]        = useState(null);
  const [reconectando, setReconectando] = useState(false);
  const intervalRef = useRef(null);

  async function poll() {
    try {
      const data = await apiFetch("/api/whatsapp/qr");
      if (data.yaConectado) {
        setEstado("open");
        setQrBase64(null);
        setQrUrl(null);
        clearInterval(intervalRef.current);
        return;
      }
      if (data.qr?.base64)    { setQrBase64(data.qr.base64); setQrUrl(null);              setEstado("qr"); }
      if (data.qr?.base64url) { setQrUrl(data.qr.base64url); setQrBase64(null);           setEstado("qr"); }
      if (data.conectando)    { setEstado("connecting"); }
      if (data.error)         { setError(data.error); setEstado("no_instalado"); clearInterval(intervalRef.current); }
    } catch (e) {
      setError("No se pudo conectar al backend.");
    }
  }

  async function iniciar() {
    setEstado("connecting");
    setQrBase64(null);
    setQrUrl(null);
    setError(null);
    clearInterval(intervalRef.current);
    await poll();
    intervalRef.current = setInterval(poll, 3000);
  }

  async function reconectar() {
    setReconectando(true);
    try {
      await apiFetch("/api/whatsapp/reconectar", { method: "POST" });
      await iniciar();
    } catch {}
    setReconectando(false);
  }

  useEffect(() => {
    iniciar();
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">

        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <MessageCircle size={28} className="text-green-500"/>
          <h1 className="text-xl font-bold text-slate-800">WhatsApp</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Conectá WhatsApp de tu empresa para enviar mensajes automáticos</p>

        {/* Estado: conectado */}
        {estado === "open" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-500"/>
            </div>
            <p className="text-lg font-bold text-green-700">¡WhatsApp conectado!</p>
            <p className="text-sm text-slate-500">Los mensajes automáticos ya están activos.</p>
            <button onClick={reconectar} disabled={reconectando}
              className="mt-2 flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <RefreshCw size={14} className={reconectando ? "animate-spin" : ""}/>
              Reconectar con otro número
            </button>
          </div>
        )}

        {/* Estado: QR listo */}
        {estado === "qr" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-semibold text-slate-700">Escaneá este QR con tu WhatsApp</p>
            <p className="text-xs text-slate-400">WhatsApp → ⋮ Menú → Dispositivos vinculados → Vincular dispositivo</p>
            <div className="border-4 border-green-400 rounded-2xl p-2">
              {qrBase64 && <img src={`data:image/png;base64,${qrBase64}`} alt="QR WhatsApp" className="w-56 h-56"/>}
              {qrUrl    && <img src={qrUrl} alt="QR WhatsApp" className="w-56 h-56"/>}
            </div>
            <p className="text-xs text-slate-400 animate-pulse">Esperando escaneo…</p>
          </div>
        )}

        {/* Estado: conectando / cargando */}
        {(estado === "connecting" || estado === "loading") && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <RefreshCw size={28} className="text-slate-400 animate-spin"/>
            </div>
            <p className="text-sm text-slate-500">Iniciando WhatsApp Web…</p>
            <p className="text-xs text-slate-400">Puede tomar hasta 30 segundos la primera vez</p>
          </div>
        )}

        {/* Estado: desconectado */}
        {estado === "disconnected" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <WifiOff size={28} className="text-slate-400"/>
            </div>
            <p className="text-sm text-slate-600">WhatsApp no está conectado</p>
            <button onClick={iniciar}
              className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Conectar WhatsApp
            </button>
          </div>
        )}

        {/* Estado: error / no instalado */}
        {estado === "no_instalado" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-400"/>
            </div>
            <p className="text-sm text-red-600 font-semibold">Error de conexión</p>
            <p className="text-xs text-slate-500 max-w-xs">{error}</p>
            <button onClick={iniciar}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold">
              Reintentar
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700 mb-2">¿Qué hace esto?</p>
          <p>• Envía confirmaciones automáticas cuando se crea un pedido o cita</p>
          <p>• Manda recordatorios de cobro a clientes con CXC vencidas</p>
          <p>• Notifica al cliente cuando su factura está lista</p>
          <p className="pt-1 text-slate-400">El número que escaneás es el que envía los mensajes.</p>
        </div>
      </div>
    </div>
  );
}
