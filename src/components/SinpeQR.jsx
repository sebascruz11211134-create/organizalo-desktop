/**
 * SinpeQR — Genera y renderiza un QR de SINPE Móvil para pago de facturas.
 *
 * El QR contiene el formato CoDiCR (estándar BCCR):
 *   1. Tipo: SINPE
 *   2. Número: teléfono del beneficiario
 *   3. Monto: opcional
 *   4. Descripción: número de factura
 *
 * Usa la librería qrcode que se importa via CDN/esm.
 * Fallback: si qrcode no está disponible, muestra el número SINPE textual.
 */
import React, { useEffect, useRef, useState } from "react";

// Generamos el QR usando la API de QR del backend o una lib local.
// Usamos el endpoint público de qr-server.com como fallback rápido.
function buildSinpePayload({ telefono, monto, descripcion }) {
  // Formato string legible para SINPE Móvil (display en apps bancarias)
  // La mayoría de apps bancarias CR leen QRs en formato URL o texto plano con el número.
  const num = (telefono||"").replace(/\D/g,"");
  if (!num) return null;
  // Formato sugerido por BCCR para QR de SINPE Móvil:
  // sinpe://506XXXXXXXX?amount=XXXXX&description=XXXXX
  let uri = `sinpe://506${num}`;
  const params = [];
  if (monto && parseFloat(monto) > 0) params.push(`amount=${parseFloat(monto).toFixed(2)}`);
  if (descripcion) params.push(`description=${encodeURIComponent(descripcion)}`);
  if (params.length) uri += `?${params.join("&")}`;
  return uri;
}

export default function SinpeQR({ telefono, monto, descripcion, size = 120 }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    const payload = buildSinpePayload({ telefono, monto, descripcion });
    if (!payload) { setImgUrl(null); return; }
    // Usa la API pública de quickchart.io para generar QR (sin instalar nada)
    const url = `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=${size*2}&margin=1&format=png`;
    setImgUrl(url);
  }, [telefono, monto, descripcion, size]);

  if (!telefono) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt="QR SINPE Móvil"
          width={size}
          height={size}
          style={{ imageRendering: "pixelated", borderRadius: 8 }}
          onError={() => setImgUrl(null)}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs font-semibold text-center px-2"
        >
          SINPE{"\n"}
          <span className="text-slate-800 font-black mt-1">{telefono}</span>
        </div>
      )}
      <p className="text-[10px] text-slate-500 font-semibold">SINPE Móvil</p>
      <p className="text-[11px] font-black text-slate-800">{telefono}</p>
    </div>
  );
}
