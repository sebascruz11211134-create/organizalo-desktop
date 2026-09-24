/**
 * WhatsAppScreen — Conectar WhatsApp Web por empresa
 * Muestra QR para escanear y mantiene la sesión activa en Railway.
 */
import React, { useState, useEffect, useRef } from "react";
import { WifiOff, RefreshCw, MessageCircle, CheckCircle2, AlertCircle, Check } from "lucide-react";
import { Modulo, Boton } from "../components/ui";
import { getToken } from "../utils/auth";

import { BACKEND } from "../utils/config.js";

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

  const Circulo = ({ children, tono = "bg-monki-y text-monki-k" }) => (
    <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-[5px_5px_0_#111] ${tono}`}>{children}</div>
  );
  return (
    <Modulo seccion="Integraciones" titulo="WhatsApp" descripcion="Conectá el WhatsApp de tu empresa para enviar mensajes automáticos.">
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-3 max-w-4xl">
          <div className="animate-entrar bg-white rounded-[22px] border-2 border-monki-k shadow-[8px_8px_0_#111] p-8 text-center min-h-[360px] flex flex-col items-center justify-center">
            {estado === "open" && (
              <div className="flex flex-col items-center gap-4">
                <Circulo><CheckCircle2 size={40}/></Circulo>
                <p className="text-[22px] font-black tracking-[-0.03em] text-monki-k">¡WhatsApp conectado!</p>
                <p className="text-sm text-monki-k/55 flex items-center gap-2"><span className="monki-pulse"/>Los mensajes automáticos están activos.</p>
                <Boton variante="secundario" icono={RefreshCw} cargando={reconectando} disabled={reconectando} onClick={reconectar}>Reconectar con otro número</Boton>
              </div>
            )}
            {estado === "qr" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-[18px] font-black text-monki-k">Escaneá este QR con tu WhatsApp</p>
                <p className="font-mono text-[11px] text-monki-k/50">WhatsApp → Menú → Dispositivos vinculados → Vincular dispositivo</p>
                <div className="rounded-[20px] p-3 bg-monki-y border-2 border-monki-k">
                  <div className="bg-white rounded-xl p-2">
                    {qrBase64 && <img src={`data:image/png;base64,${qrBase64}`} alt="QR de WhatsApp" className="w-56 h-56"/>}
                    {qrUrl    && <img src={qrUrl} alt="QR de WhatsApp" className="w-56 h-56"/>}
                  </div>
                </div>
                <p className="text-sm text-monki-k/50 animate-pulse">Esperando que lo escanees…</p>
              </div>
            )}
            {(estado === "connecting" || estado === "loading") && (
              <div className="flex flex-col items-center gap-4">
                <Circulo tono="bg-monki-cream text-monki-k"><RefreshCw size={30} className="animate-spin"/></Circulo>
                <p className="text-[18px] font-black text-monki-k">Iniciando WhatsApp Web…</p>
                <p className="text-sm text-monki-k/50">La primera vez puede tardar hasta 30 segundos.</p>
              </div>
            )}
            {estado === "disconnected" && (
              <div className="flex flex-col items-center gap-4">
                <Circulo tono="bg-monki-cream text-monki-k"><WifiOff size={30}/></Circulo>
                <p className="text-[18px] font-black text-monki-k">WhatsApp no está conectado</p>
                <Boton icono={MessageCircle} onClick={iniciar}>Conectar WhatsApp</Boton>
              </div>
            )}
            {estado === "no_instalado" && (
              <div className="flex flex-col items-center gap-4">
                <Circulo tono="bg-red-100 text-red-600"><AlertCircle size={30}/></Circulo>
                <p className="text-[18px] font-black text-red-600">Error de conexión</p>
                <p className="text-sm text-monki-k/55 max-w-xs">{error}</p>
                <Boton icono={RefreshCw} onClick={iniciar}>Reintentar</Boton>
              </div>
            )}
          </div>
          <div className="animate-entrar bg-monki-k text-white rounded-[22px] p-6" style={{ animationDelay: "100ms" }}>
            <p className="monki-tag text-monki-y mb-3">¿Qué hace esto?</p>
            {["Confirma automáticamente pedidos y citas", "Recuerda los cobros de cuentas vencidas", "Avisa al cliente cuando su factura está lista"].map(t => (
              <p key={t} className="flex items-start gap-2.5 text-sm text-white/80 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-monki-y text-monki-k flex items-center justify-center shrink-0 mt-0.5"><Check size={12} strokeWidth={3}/></span>{t}
              </p>
            ))}
            <p className="text-xs text-white/45 mt-4">El número que escaneás es el que envía los mensajes.</p>
          </div>
        </div>
      </div>
    </Modulo>
  );
}
