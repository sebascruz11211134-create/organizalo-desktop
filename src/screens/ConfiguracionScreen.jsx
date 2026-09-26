import React, { useState, useEffect, useRef, useCallback } from "react";
import { Save, RefreshCw, Upload, Shield, Trash2, CheckCircle, AlertCircle, MessageCircle, Wifi, WifiOff, QrCode, Bell, Users, Plus, Copy, Eye, EyeOff, UserX, RefreshCcw } from "lucide-react";
import db from "../utils/db";
import { pushSync, pullSync } from "../utils/sync";
import { getToken, getUser } from "../utils/auth";

import { BACKEND } from "../utils/config";
import { Modulo, useConfirmar } from "../components/ui";
import { espacio } from "../utils/almacen";
import { estadoRespaldos, descargarExcel, descargarJson } from "../utils/misDatos";

export default function ConfiguracionScreen() {
  const { confirmar, dialogo } = useConfirmar();
  const [almacen, setAlmacen] = useState(null);
  useEffect(() => { espacio().then(setAlmacen); }, []);

  // ── Respaldos y "Descargar mis datos" (administración) ─────────────────────
  const [respaldos, setRespaldos] = useState(null);
  const [descargando, setDescargando] = useState("");
  // El rol se lee con getUser() (funciona también en la app de escritorio). La
  // seguridad real la pone el servidor: estas rutas son solo de administración.
  const [puedeRespaldos, setPuedeRespaldos] = useState(false);
  useEffect(() => {
    let vigente = true;
    getUser().then(u => {
      if (!vigente || !["admin", "superadmin", "gerencia"].includes(u?.rol)) return;
      setPuedeRespaldos(true);
      getToken().then(t => estadoRespaldos(t)).then(e => vigente && setRespaldos(e)).catch(() => vigente && setRespaldos({ error: true }));
    });
    return () => { vigente = false; };
  }, []);
  const descargar = async (tipo) => {
    setDescargando(tipo);
    try { const t = await getToken(); await (tipo === "excel" ? descargarExcel(t) : descargarJson(t)); }
    catch (e) { alert(`No se pudo descargar: ${e.message}`); }
    finally { setDescargando(""); }
  };
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
    if (!(await confirmar("Eliminar usuario", `¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
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
    if (!(await confirmar("Eliminar certificado", "¿Eliminar el certificado? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
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

  // Datos fiscales del emisor (settings.fiscal): el backend los usa para
  // facturar a nombre de ESTA empresa (código de actividad y ubicación son
  // obligatorios en el XML v4.4).
  const fiscal = s.fiscal || {};
  const setFiscal = (k, v) => setS((p) => ({ ...p, fiscal: { ...(p.fiscal || {}), [k]: v } }));
  const fiscalField = (label, key, placeholder = "", extra = {}) => (
    <div>
      <label className="block monki-tag text-monki-k/55 mb-1.5">{label}</label>
      <input value={fiscal[key] || ""} onChange={(e) => setFiscal(key, e.target.value)} placeholder={placeholder} {...extra}
        className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
    </div>
  );
  const requisitosFacturacion = [
    ["Cédula del negocio", !!String(s.cedula || "").replace(/\D/g, "")],
    ["Nombre o razón social", !!(s.razonSocial || s.nombreNegocio)],
    ["Correo electrónico", !!s.correo],
    ["Código de actividad económica (6 dígitos)", /^\d{6}$/.test(fiscal.codigoActividad || "")],
    ["Provincia, cantón y distrito", /^[1-7]$/.test(fiscal.provincia || "") && /^\d{2}$/.test(fiscal.canton || "") && /^\d{2}$/.test(fiscal.distrito || "")],
    ["Llave criptográfica (.p12)", !!certStatus?.configured],
    ["Usuario y contraseña ATV", !!certStatus?.atvConfigurado],
  ];
  const listoParaFacturar = requisitosFacturacion.every(([, ok]) => ok);

  const field = (label, key, type = "text", placeholder = "") => (
    <div>
      <label className="block monki-tag text-monki-k/55 mb-1.5">{label}</label>
      <input type={type} value={s[key] || ""} onChange={(e) => setS((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
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
    <Modulo
      seccion="Sistema"
      titulo="Configuración"
      descripcion="Datos del negocio, facturación electrónica, WhatsApp, sincronización, notificaciones y usuarios."
    >
    <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
    <div className="max-w-3xl space-y-4">
      {/* Negocio */}
      <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k mb-5">Datos del negocio</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Nombre del negocio", "nombreNegocio", "text", "Mi empresa S.A.")}
          {field("Cédula jurídica / física", "cedula", "text", "3-101-000000")}
          {field("Correo electrónico", "correo", "email", "info@minegocio.cr")}
          {field("SINPE Móvil", "sinpe", "text", "8XXX-XXXX")}
          <div className="col-span-2">
            {field("Dirección", "direccion", "text", "San José, Costa Rica")}
          </div>
        </div>

        <h3 className="text-sm font-black text-monki-k mt-6 mb-1">Datos fiscales para facturar</h3>
        <p className="text-xs text-monki-k/60 mb-3">
          Hacienda los exige en cada comprobante. Están en tu inscripción de TRIBU-CR.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">{field("Razón social (como aparece en Hacienda)", "razonSocial", "text", "Mi Empresa Sociedad Anónima")}</div>
          {field("Teléfono", "telefono", "tel", "2222-2222")}
          {fiscalField("Código de actividad económica", "codigoActividad", "Ej. 522001", { inputMode: "numeric", maxLength: 6 })}
          <div>
            <label className="block monki-tag text-monki-k/55 mb-1.5">Provincia</label>
            <select value={fiscal.provincia || ""} onChange={(e) => setFiscal("provincia", e.target.value)}
              className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors">
              <option value="">—</option>
              {["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"].map((n, i) => (
                <option key={n} value={String(i + 1)}>{i + 1} - {n}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fiscalField("Cantón", "canton", "01", { inputMode: "numeric", maxLength: 2 })}
            {fiscalField("Distrito", "distrito", "01", { inputMode: "numeric", maxLength: 2 })}
          </div>
          <div className="col-span-2">{fiscalField("Otras señas", "otrasSenas", "100 m norte del parque")}</div>
        </div>

        <div className={`mt-4 rounded-2xl border-2 px-4 py-3 text-xs ${listoParaFacturar ? "bg-[#FFF4B8] border-monki-y" : "bg-monki-cream border-black/10"}`}>
          <p className={`font-semibold mb-1 ${listoParaFacturar ? "text-monki-k" : "text-monki-k"}`}>
            {listoParaFacturar ? "✓ Listo para facturar" : "Para facturar a nombre de tu empresa falta:"}
          </p>
          {!listoParaFacturar && (
            <ul className="space-y-0.5">
              {requisitosFacturacion.map(([n, ok]) => (
                <li key={n} className={ok ? "text-emerald-700" : "text-monki-k"}>{ok ? "✓" : "○"} {n}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <label className="block monki-tag text-monki-k/55 mb-1.5">Moneda principal</label>
          <div className="flex gap-3">
            {["CRC", "USD"].map((m) => (
              <button key={m} onClick={() => setS((p) => ({ ...p, moneda: m }))}
                className={`px-5 py-2 rounded-full text-sm font-bold border-2 transition-colors
                  ${s.moneda === m ? "border-monki-k bg-monki-k text-monki-y" : "border-black/10 text-monki-k/60 hover:border-black/25"}`}>
                {m === "CRC" ? "₡ Colones" : "$ Dólares"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={guardar}
          className={`mt-6 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ui-boton transition-all duration-300 ease-monki
            ${saved ? "bg-monki-y text-monki-k" : "bg-monki-k text-monki-y hover:shadow-[4px_4px_0_#FFD600]"}`}>
          <Save size={15} />
          {saved ? "¡Guardado!" : "Guardar configuración"}
        </button>
      </div>

      {/* Certificado BCCR ─────────────────────────────────────────────────── */}
      <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-monki-k" />
          <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k">Facturación Electrónica</h2>
        </div>
        <p className="text-xs text-monki-k/60 mb-5">
          Configurá el certificado BCCR (.p12) y las credenciales ATV de Hacienda para enviar y recibir
          facturas electrónicas. El certificado se guarda encriptado con AES-256-GCM y nunca se registra en texto plano.
        </p>

        {/* Estado actual */}
        {certStatus?.configured ? (
          <div className="mb-4 flex items-start justify-between bg-[#FFF4B8] border-2 border-monki-y rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-monki-k shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-monki-k">Certificado activo</p>
                <p className="text-xs text-monki-k">
                  {certStatus.nombre || "—"} · Cédula {certStatus.cedula || "—"}
                </p>
                <p className="text-xs text-monki-k">
                  Subido el {certStatus.subidoEn ? new Date(certStatus.subidoEn).toLocaleDateString("es-CR") : "—"}
                </p>
              </div>
            </div>
            <button onClick={eliminarCert}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-[inset_0_0_0_2px_#dc2626] rounded-full hover:bg-red-600 hover:text-white transition-colors">
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-[#FFF4B8] border-2 border-monki-y rounded-lg">
            <AlertCircle size={15} className="text-monki-k shrink-0" />
            <p className="text-xs text-monki-k">No hay certificado configurado. Sin él no se puede enviar el Mensaje Receptor a Hacienda.</p>
          </div>
        )}

        {/* Mensaje de resultado */}
        {certMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${certMsg.type === "ok" ? "bg-[#FFF4B8] border-2 border-monki-y text-monki-k" : "bg-red-50 border-2 border-red-200 text-red-700"}`}>
            {certMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {certMsg.text}
          </div>
        )}

        {/* Formulario subida */}
        <div className="grid grid-cols-2 gap-3">
          {/* Archivo .p12 */}
          <div className="col-span-2">
            <label className="block monki-tag text-monki-k/55 mb-1.5">Archivo .p12</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black/15 rounded-lg px-4 py-4 text-center cursor-pointer hover:border-monki-k hover:bg-monki-cream/60 transition-colors">
              {certFile ? (
                <p className="text-sm text-monki-k font-medium">{certFile.name}</p>
              ) : (
                <p className="text-sm text-monki-k/45">Click para seleccionar un archivo <span className="font-mono">.p12</span></p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".p12,application/x-pkcs12" className="hidden"
              onChange={(e) => setCertFile(e.target.files[0] || null)} />
          </div>

          {/* Contraseña */}
          <div className="col-span-2">
            <label className="block monki-tag text-monki-k/55 mb-1.5">Contraseña del certificado</label>
            <input type="password" value={certPass} onChange={(e) => setCertPass(e.target.value)}
              placeholder="Contraseña del .p12"
              className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
          </div>

          {/* Cédula del receptor */}
          <div>
            <label className="block monki-tag text-monki-k/55 mb-1.5">Cédula del receptor</label>
            <input type="text" value={certCedula} onChange={(e) => setCertCedula(e.target.value)}
              placeholder="3101000000"
              className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
          </div>

          {/* Nombre del receptor */}
          <div>
            <label className="block monki-tag text-monki-k/55 mb-1.5">Nombre del receptor</label>
            <input type="text" value={certNombre} onChange={(e) => setCertNombre(e.target.value)}
              placeholder="Mi Empresa S.A."
              className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
          </div>
        </div>

        <button onClick={subirCert} disabled={certLoading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-semibold disabled:opacity-50">
          <Upload size={14} />
          {certLoading ? "Guardando…" : certStatus?.configured ? "Reemplazar certificado" : "Guardar certificado"}
        </button>

        {/* ── Credenciales ATV (Hacienda) ───────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-black/10">
          <p className="monki-tag text-monki-k/55 mb-2">Credenciales ATV · Hacienda</p>
          <p className="text-xs text-monki-k/45 mb-4">
            Usuario y contraseña del sistema ATV (<span className="font-mono">atv.hacienda.go.cr</span>) para enviar facturas electrónicas.
            La contraseña se guarda encriptada — nunca en texto plano.
          </p>

          {/* Estado ATV */}
          {certStatus?.atvConfigurado ? (
            <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-[#FFF4B8] border-2 border-monki-y rounded-lg">
              <CheckCircle size={14} className="text-monki-k shrink-0" />
              <div>
                <p className="text-xs font-semibold text-monki-k">ATV configurado</p>
                <p className="text-xs text-monki-k">
                  Usuario: <span className="font-mono">{certStatus.atvUsuario}</span>
                  {certStatus.atvActualizadoEn && ` · Actualizado el ${new Date(certStatus.atvActualizadoEn).toLocaleDateString("es-CR")}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-[#FFF4B8] border-2 border-monki-y rounded-lg">
              <AlertCircle size={14} className="text-monki-k shrink-0" />
              <p className="text-xs text-monki-k">Sin credenciales ATV — necesarias para emitir facturas electrónicas.</p>
            </div>
          )}

          {/* Mensaje resultado ATV */}
          {atvMsg && (
            <div className={`mb-3 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
              ${atvMsg.type === "ok" ? "bg-[#FFF4B8] border-2 border-monki-y text-monki-k" : "bg-red-50 border-2 border-red-200 text-red-700"}`}>
              {atvMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {atvMsg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Usuario ATV</label>
              <input type="text" value={atvUsuario} onChange={e => setAtvUsuario(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
            </div>
            <div>
              <label className="block monki-tag text-monki-k/55 mb-1.5">Contraseña ATV</label>
              <input type="password" value={atvPass} onChange={e => setAtvPass(e.target.value)}
                placeholder="Contraseña del sistema ATV"
                className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
            </div>
          </div>

          <button onClick={subirATV} disabled={atvLoading || !certStatus?.configured}
            title={!certStatus?.configured ? "Primero subí el certificado .p12" : ""}
            className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-semibold disabled:opacity-50">
            <Shield size={14} />
            {atvLoading ? "Guardando…" : certStatus?.atvConfigurado ? "Actualizar credenciales ATV" : "Guardar credenciales ATV"}
          </button>
        </div>
      </div>

      {/* WhatsApp ───────────────────────────────────────────────────────────── */}
      <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-monki-k" />
            <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k">WhatsApp Business</h2>
          </div>
          {/* Estado badge */}
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
            ${waEstado === "open" ? "bg-monki-y text-monki-k" : "bg-black/5 text-monki-k/60"}`}>
            {waEstado === "open" ? <Wifi size={11} /> : <WifiOff size={11} />}
            {waEstado === "open" ? "Conectado" : waEstado || "Sin estado"}
          </span>
        </div>
        <p className="text-xs text-monki-k/60 mb-5">
          Conectá un número de WhatsApp para enviar recordatorios de seguimiento automáticos a tus clientes.
          Los mensajes se envían a las 8am del día programado en el Calendario.
        </p>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={cargarWaEstado}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-monki-k font-bold shadow-[inset_0_0_0_2px_#111] rounded-full hover:bg-monki-k hover:text-monki-y transition-colors text-sm">
            <RefreshCw size={13} /> Actualizar estado
          </button>
          <button onClick={cargarQR} disabled={waLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-medium disabled:opacity-50">
            <QrCode size={13} /> {waLoading ? "Cargando…" : "Mostrar QR"}
          </button>
          <button onClick={reconectarWA} disabled={waLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-monki-y text-monki-k font-bold rounded-full ui-boton hover:shadow-[3px_3px_0_#111] transition-all disabled:opacity-50">
            <RefreshCw size={13} /> Reconectar
          </button>
        </div>

        {/* Mensaje de estado */}
        {waMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            ${waMsg.type === "ok"   ? "bg-[#FFF4B8] border-2 border-monki-y text-monki-k"
            : waMsg.type === "info" ? "bg-monki-cream border-2 border-black/10 text-monki-k"
            :                         "bg-red-50 border-2 border-red-200 text-red-700"}`}>
            {waMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {waMsg.text}
          </div>
        )}

        {/* QR Code */}
        {waQR && (
          <div className="mb-5 flex flex-col items-center gap-3 p-5 border-2 border-dashed border-black/15 rounded-[18px] bg-monki-cream">
            <p className="text-sm font-semibold text-monki-k">Abrí WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo</p>
            <img
              src={waQR.src}
              alt="QR WhatsApp"
              className="w-52 h-52 rounded-lg border-4 border-white shadow-md"
            />
            <p className="text-xs text-monki-k">El QR expira en ~60 segundos. Si vence, presioná "Mostrar QR" de nuevo.</p>
            <button onClick={cargarQR} className="text-xs text-monki-k underline">Regenerar QR</button>
          </div>
        )}

        {/* Test de envío */}
        <div className="border-t border-black/10 pt-4 mt-2">
          <p className="monki-tag text-monki-k/55 mb-2">Probar envío</p>
          <div className="flex gap-2">
            <input
              value={waTelTest}
              onChange={e => setWaTelTest(e.target.value)}
              placeholder="64693392"
              className="w-32 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"
            />
            <input
              value={waMsgTest}
              onChange={e => setWaMsgTest(e.target.value)}
              placeholder="Mensaje de prueba..."
              className="flex-1 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors"
            />
            <button onClick={enviarMsgTest} disabled={waSending || !waTelTest || !waMsgTest}
              className="px-4 py-2 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-medium disabled:opacity-50">
              {waSending ? "…" : "Enviar"}
            </button>
          </div>
          <p className="text-xs text-monki-k/45 mt-1">El número se formatea automáticamente con prefijo 506 (Costa Rica).</p>
        </div>
      </div>

      {/* Respaldos y tus datos */}
      {puedeRespaldos && (
        <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
          <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k mb-2">Respaldos y tus datos</h2>
          <p className="text-sm text-monki-k/60 mb-4">
            Todos los días de madrugada se guarda una copia de seguridad de tu empresa. También podés descargar tus datos cuando quieras.
          </p>
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {respaldos?.error ? (
              <span className="px-3 py-1.5 rounded-full bg-monki-cream text-monki-k/60">No se pudo consultar el estado de los respaldos</span>
            ) : !respaldos ? (
              <span className="px-3 py-1.5 rounded-full bg-monki-cream text-monki-k/60">Consultando…</span>
            ) : respaldos.ultimo ? (
              <>
                <span className="px-3 py-1.5 rounded-full bg-monki-y text-monki-k font-bold">✓ Último respaldo: {respaldos.ultimo}</span>
                <span className="px-3 py-1.5 rounded-full bg-monki-cream text-monki-k/70">{respaldos.cantidad} copias guardadas</span>
                {respaldos.externo ? (
                  <span className="px-3 py-1.5 rounded-full bg-monki-k text-monki-y">🔒 Copia encriptada fuera del servidor</span>
                ) : respaldos.externoConfigurado ? (
                  <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-bold">⚠ Falló la última copia fuera del servidor</span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-monki-cream text-monki-k/60">Solo en el servidor</span>
                )}
                {respaldos.errorUltimo && <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700">El último respaldo falló; se reintenta solo</span>}
              </>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-monki-cream text-monki-k/60">El primer respaldo se hace esta madrugada</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => descargar("excel")} disabled={!!descargando}
              className="flex items-center gap-2 px-4 py-2.5 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm disabled:opacity-50">
              {descargando === "excel" ? "Preparando…" : "Descargar mis datos (Excel)"}
            </button>
            <button onClick={() => descargar("json")} disabled={!!descargando}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-monki-k font-bold shadow-[inset_0_0_0_2px_#111] rounded-full hover:bg-monki-k hover:text-monki-y transition-colors text-sm disabled:opacity-50">
              {descargando === "json" ? "Preparando…" : "Copia completa (JSON)"}
            </button>
          </div>
          <p className="text-xs text-monki-k/45 mt-3">El Excel trae una hoja por módulo. La copia completa incluye además el XML de cada factura electrónica.</p>
        </div>
      )}

      {/* Sync */}
      <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k mb-2">Sincronización</h2>
        <p className="text-sm text-monki-k/60 mb-5">
          Los datos se sincronizan automáticamente cada 3 minutos entre el app móvil y el desktop.
          También podés forzar una sincronización manual.
        </p>

        {syncing && (
          <div className="mb-4 px-4 py-2.5 bg-monki-k rounded-xl text-sm text-monki-y flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin" /> {syncing}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handlePush}
            className="flex items-center gap-2 px-4 py-2.5 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-semibold">
            <RefreshCw size={14} /> Subir mis datos
          </button>
          <button onClick={handlePull}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-monki-k font-bold shadow-[inset_0_0_0_2px_#111] rounded-full hover:bg-monki-k hover:text-monki-y transition-colors text-sm font-semibold">
            <RefreshCw size={14} /> Descargar del servidor
          </button>
        </div>

        <p className="text-xs text-monki-k/45 mt-4">
          Backend: {BACKEND || "Servidor de desarrollo"}
        </p>
        {almacen && (
          <p className="text-xs text-monki-k/45 mt-1">
            Datos en este dispositivo: {(almacen.usado / 1048576).toFixed(1)} MB de {Math.round(almacen.total / 1048576).toLocaleString("es-CR")} MB disponibles · {almacen.motor}
          </p>
        )}
      </div>

      {/* ── Notificaciones Push (ntfy) ─────────────────────────────────── */}
      <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-monki-k" />
          <h2 className="text-[18px] font-black tracking-[-0.02em] text-monki-k">Notificaciones Push</h2>
        </div>
        <p className="text-xs text-monki-k/60 mb-4">
          Cada usuario tiene su propio canal privado en ntfy. Solo vos recibís tus notificaciones —
          nadie más en la empresa las ve. Configurá cuáles querés recibir.
        </p>

        {ntfyConfig && (
          <div className="space-y-4">
            {/* Topic personal */}
            <div className="bg-monki-cream border border-black/10 rounded-lg p-4">
              <p className="text-xs font-bold text-monki-k mb-2">Tu canal personal:</p>
              <ol className="text-xs text-monki-k space-y-1 mb-3">
                <li>1. Instalá <strong>ntfy</strong> en tu teléfono (iOS o Android, gratis)</li>
                <li>2. Abrí la app → tocá "+" → pegá este topic:</li>
              </ol>
              <div className="flex gap-2">
                <input readOnly value={ntfyConfig.topic}
                  className="flex-1 px-2 py-1.5 border border-black/10 rounded-lg text-xs font-mono text-monki-k bg-white" />
                <button onClick={() => navigator.clipboard?.writeText(ntfyConfig.topic)}
                  className="px-3 py-1.5 border border-black/10 rounded-lg text-xs text-monki-k hover:bg-black/5">
                  Copiar
                </button>
              </div>
            </div>

            {/* Preferencias por tipo */}
            {ntfyPrefs && (
              <div>
                <p className="monki-tag text-monki-k/55 mb-2">Qué querés recibir</p>
                <div className="space-y-1">
                  {(ntfyPrefs.tipos || []).map(tipo => (
                    <button
                      key={tipo.id}
                      onClick={() => togglePref(tipo.id)}
                      disabled={ntfySaving}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left
                        ${ntfyPrefs.prefs[tipo.id]
                          ? "bg-monki-cream border-black/10 text-monki-k"
                          : "bg-white border-black/10 text-monki-k/45"}`}
                    >
                      <span className="text-base leading-none">{tipo.icon}</span>
                      <span className="flex-1 font-medium">{tipo.label}</span>
                      <span className={`w-8 h-4 rounded-full relative transition-colors shrink-0
                        ${ntfyPrefs.prefs[tipo.id] ? "bg-monki-cream0" : "bg-black/15"}`}>
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
                ${ntfyMsg.type === "ok" ? "bg-[#FFF4B8] border-2 border-monki-y text-monki-k" : "bg-red-50 border-2 border-red-200 text-red-700"}`}>
                {ntfyMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {ntfyMsg.text}
              </div>
            )}

            {/* Botón de prueba */}
            <button onClick={enviarNotifPrueba} disabled={ntfyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-medium disabled:opacity-50">
              <Bell size={13} /> {ntfyLoading ? "Enviando…" : "Enviar notificación de prueba"}
            </button>
          </div>
        )}

        {!ntfyConfig && (
          <button onClick={cargarNtfyUserConfig}
            className="text-sm text-monki-k hover:underline">
            Cargar configuración de notificaciones
          </button>
        )}
      </div>

      {/* ── Sección: Usuarios de la empresa (solo admin) ─────────────────── */}
      {esAdmin && (
        <div className="ui-tarjeta bg-white rounded-[18px] border-2 border-black/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-monki-k/75" />
              <h3 className="text-[18px] font-black tracking-[-0.02em] text-monki-k">Usuarios de tu empresa</h3>
            </div>
            <button
              onClick={() => { setShowNuevoUsr(true); setUsrMsg(null); setNuevoPass(genPassword()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] transition-colors">
              <Plus size={13} /> Nuevo usuario
            </button>
          </div>

          {/* Credencial recién creada */}
          {credencial && (
            <div className="mb-4 border-2 border-monki-k bg-monki-y rounded-[18px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={15} className="text-monki-k" />
                <span className="text-sm font-semibold text-monki-k">Usuario creado — guardá estas credenciales</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="bg-white rounded-xl border-2 border-monki-k/15 px-3 py-2">
                  <p className="text-xs text-monki-k/60 mb-0.5">Nombre</p>
                  <p className="font-medium text-monki-k">{credencial.nombre}</p>
                </div>
                <div className="bg-white rounded-xl border-2 border-monki-k/15 px-3 py-2">
                  <p className="text-xs text-monki-k/60 mb-0.5">Usuario</p>
                  <p className="font-mono font-medium text-monki-k">{credencial.username}</p>
                </div>
                <div className="col-span-2 bg-white rounded-xl border-2 border-monki-k/15 px-3 py-2">
                  <p className="text-xs text-monki-k/60 mb-0.5">Contraseña</p>
                  <p className="font-mono font-bold text-monki-k tracking-wider">{credencial.password}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(`Usuario: ${credencial.username}\nContraseña: ${credencial.password}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-monki-y text-monki-k font-bold rounded-full ui-boton hover:shadow-[3px_3px_0_#111] transition-all transition-colors">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-monki-k font-bold shadow-[inset_0_0_0_2px_#111] rounded-full hover:bg-monki-k hover:text-monki-y transition-colors transition-colors">
                  🖨 Imprimir
                </button>
                <button onClick={() => setCredencial(null)}
                  className="ml-auto text-xs text-monki-k/45 hover:text-monki-k/75">Cerrar</button>
              </div>
            </div>
          )}

          {/* Tabla de equipo */}
          {equipoLoad ? (
            <p className="text-sm text-monki-k/45 text-center py-4">Cargando equipo…</p>
          ) : equipo.length === 0 ? (
            <p className="text-sm text-monki-k/45 text-center py-4">No hay otros usuarios en tu empresa todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-monki-k/60 uppercase border-b border-black/10">
                    <th className="pb-2 pr-4">Nombre</th>
                    <th className="pb-2 pr-4">Usuario</th>
                    <th className="pb-2 pr-4">Rol</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {equipo.map(u => (
                    <tr key={u.id} className="hover:bg-monki-cream/60">
                      <td className="py-2 pr-4 font-medium text-monki-k">{u.nombre}</td>
                      <td className="py-2 pr-4 font-mono text-monki-k/75 text-xs">{u.username || "—"}</td>
                      <td className="py-2 pr-4">
                        {u.id === meUser?.id ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.rol === "admin" ? "bg-monki-k text-monki-y" :
                            u.rol === "contador" ? "bg-monki-cream text-monki-k" :
                            u.rol === "vendedor" ? "bg-monki-y text-monki-k" :
                            "bg-black/5 text-monki-k/75"
                          }`}>{u.rol}</span>
                        ) : (
                          <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                            className="text-xs border-2 border-black/10 hover:border-monki-k rounded-full px-2.5 py-1 bg-white font-semibold text-monki-k cursor-pointer">
                            <option value="colaborador">colaborador</option>
                            <option value="vendedor">vendedor</option>
                            <option value="contador">contador</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.activo ? "bg-monki-y text-monki-k" : "bg-red-100 text-red-600"
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

          <button onClick={cargarEquipo} className="mt-3 flex items-center gap-1.5 text-xs text-monki-k/45 hover:text-monki-k/75">
            <RefreshCcw size={11} /> Actualizar lista
          </button>

          {/* Modal: Nuevo usuario */}
          {showNuevoUsr && (
            <div className="fixed inset-0 bg-monki-k/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="animate-entrar bg-white rounded-[22px] border-2 border-monki-k shadow-[6px_6px_0_#111] w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-monki-k">
                  <h4 className="text-sm font-black text-monki-y">Crear nuevo usuario</h4>
                  <button onClick={() => { setShowNuevoUsr(false); setUsrMsg(null); }} className="text-monki-k/45 hover:text-white text-xs">✕</button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block monki-tag text-monki-k/55 mb-1.5">Nombre completo</label>
                    <input value={nuevoNombre} onChange={e => {
                        const n = e.target.value;
                        setNuevoNombre(n);
                        const parts = n.trim().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().split(/\s+/).filter(Boolean);
                        const auto = parts.length >= 2 ? `${parts[0]}.${parts[parts.length-1]}` : parts[0] || "";
                        setNuevoUser(auto.replace(/[^a-z0-9.]/g,""));
                      }}
                      placeholder="Ej: María González"
                      className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors" />
                  </div>
                  <div>
                    <label className="block monki-tag text-monki-k/55 mb-1.5">
                      Usuario <span className="text-monki-k/40 normal-case font-normal">· auto-generado</span>
                    </label>
                    <input value={nuevoUser} onChange={e => setNuevoUser(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))}
                      placeholder="Ej: maria.gonzalez"
                      className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="block monki-tag text-monki-k/55 mb-1.5">Contraseña</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={nuevoPass}
                          onChange={e => setNuevoPass(e.target.value)}
                          className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors font-mono pr-8" />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-monki-k/45 hover:text-monki-k/75">
                          {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <button type="button" onClick={() => setNuevoPass(genPassword())}
                        title="Generar contraseña"
                        className="px-3 border-2 border-black/10 hover:border-monki-k rounded-xl text-monki-k/60 text-xs">
                        <RefreshCcw size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block monki-tag text-monki-k/55 mb-1.5">Rol</label>
                    <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value)}
                      className="w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors">
                      <option value="colaborador">Colaborador</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="contador">Contador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {usrMsg && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm
                      ${usrMsg.type === "ok" ? "bg-[#FFF4B8] border-2 border-monki-y text-monki-k" : "bg-red-50 border-2 border-red-200 text-red-700"}`}>
                      {usrMsg.type === "ok" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      {usrMsg.text}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowNuevoUsr(false); setUsrMsg(null); }}
                      className="flex-1 py-2 bg-white text-monki-k font-bold shadow-[inset_0_0_0_2px_#111] rounded-full hover:bg-monki-k hover:text-monki-y transition-colors text-sm">
                      Cancelar
                    </button>
                    <button onClick={crearUsuario} disabled={usrLoading}
                      className="flex-1 py-2 bg-monki-k text-monki-y font-bold rounded-full ui-boton transition-all duration-300 ease-monki hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600] text-sm font-semibold disabled:opacity-50">
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
    </div>
    {dialogo}
    </Modulo>
  );
}
