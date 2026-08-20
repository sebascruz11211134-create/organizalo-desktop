/**
 * LoginScreen — Pantalla compacta de login para el desktop.
 *
 * Diseño: 360×500 ventana; fondo navy oscuro, cubo isométrico + wordmark,
 * dropdown de usuarios guardados (electron-store) + campo contraseña.
 *
 * Al login exitoso → guarda el usuario en store y llama loginSuccess()
 * (IPC → main.js expande la ventana a 1280×800).
 *
 * Modo "crear cuenta" se muestra en la misma ventana (scrollable dentro del card).
 */
import React, { useState, useEffect, useRef } from "react";
import {
  Eye, EyeOff, AlertCircle, Loader2, ChevronDown, User,
  ArrowRight, CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { login, register } from "../utils/auth";

const STORE_USERS_KEY = "savedUsers";

// ── Fortaleza de contraseña ───────────────────────────────────────────────────
function passwordStrength(pwd) {
  const reqs = [
    { key: "len",     label: "Mínimo 8 caracteres",      ok: pwd.length >= 8 },
    { key: "upper",   label: "Una mayúscula (A-Z)",       ok: /[A-Z]/.test(pwd) },
    { key: "lower",   label: "Una minúscula (a-z)",       ok: /[a-z]/.test(pwd) },
    { key: "num",     label: "Un número (0-9)",           ok: /[0-9]/.test(pwd) },
    { key: "special", label: "Un carácter especial (!@#$%...)", ok: /[^A-Za-z0-9]/.test(pwd) },
  ];
  const score = reqs.filter(r => r.ok).length;
  return { score, reqs };
}

function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const { score, reqs } = passwordStrength(password);
  const levels = [
    { min: 0, label: "Muy débil",  color: "bg-red-500" },
    { min: 1, label: "Débil",      color: "bg-orange-500" },
    { min: 2, label: "Regular",    color: "bg-yellow-400" },
    { min: 3, label: "Buena",      color: "bg-lime-400" },
    { min: 4, label: "Fuerte",     color: "bg-amber-400" },
    { min: 5, label: "Muy fuerte", color: "bg-amber-400" },
  ];
  const level = [...levels].reverse().find(l => score >= l.min) || levels[0];

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* Barras */}
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-200
            ${score >= i ? level.color : "bg-white/15"}`} />
        ))}
        <span className={`text-[10px] font-semibold ml-1 whitespace-nowrap
          ${score <= 1 ? "text-red-300" : score <= 2 ? "text-orange-300" : score <= 3 ? "text-yellow-300" : "text-amber-300"}`}>
          {level.label}
        </span>
      </div>
      {/* Checklist de requisitos — solo si no es fuerte */}
      {score < 5 && (
        <ul className="space-y-0.5">
          {reqs.map(r => (
            <li key={r.key} className={`flex items-center gap-1 text-[10px] transition-colors
              ${r.ok ? "text-amber-300" : "text-white/40"}`}>
              <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0
                ${r.ok ? "bg-amber-400/30" : "bg-white/10"}`}>
                {r.ok ? "✓" : "·"}
              </span>
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Cubo isométrico (reutiliza el SVG del Sidebar) ───────────────────────────
function CubeLogo({ size = 36 }) {
  const s = size;
  const h = Math.round(s * 0.88);
  return (
    <svg width={s} height={h} viewBox="0 0 34 30" xmlns="http://www.w3.org/2000/svg">
      <polygon points="17,2 27,8 17,14 7,8"    fill="#2aadad"/>
      <polygon points="27,8 27,20 17,26 17,14"  fill="#1a8888"/>
      <polygon points="7,8 17,14 17,26 7,20"    fill="#116060"/>
      <polyline points="17,2 17,14 17,26"        stroke="rgba(255,255,255,0.22)" strokeWidth="0.8"/>
      <polyline points="7,8 17,14 27,8"          stroke="rgba(255,255,255,0.22)" strokeWidth="0.8"/>
      <polyline points="7,20 17,26 27,20"        stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
    </svg>
  );
}

// ── Dropdown de usuarios guardados ────────────────────────────────────────────
function UserDropdown({ users, value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = users.find(u => u.identifier === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/20 bg-white/10
          text-sm text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
          <User size={12} className="text-white" />
        </div>
        <span className="flex-1 text-left font-medium truncate">
          {selected ? selected.nombre : value || t("login.selectUser")}
        </span>
        <ChevronDown size={14} className={`text-white/80 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/20 overflow-hidden z-20"
          style={{ background: "rgba(4,120,87,0.95)", backdropFilter: "blur(12px)" }}>
          {users.map(u => (
            <button
              key={u.identifier}
              type="button"
              onClick={() => { onChange(u.identifier); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                ${u.identifier === value
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10"}`}
            >
              <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                {u.nombre[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{u.nombre}</p>
                <p className="text-[11px] text-white/50 truncate">{u.identifier}</p>
              </div>
            </button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />
          <button
            type="button"
            onClick={() => { onChange("__custom__"); setOpen(false); }}
            className="w-full px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors text-left"
          >
            {t("login.otherAccount")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Campo de contraseña ───────────────────────────────────────────────────────
function PasswordField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="current-password"
        className="w-full px-3 py-2.5 pr-10 rounded-xl border border-white/20 bg-white/10
          text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30
          focus:border-white/40 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ── Formulario de registro ────────────────────────────────────────────────────
const SUPERADMIN_REG_EMAIL = "sebascruz11211134@gmail.com";

function RegisterForm({ onSuccess, onBack }) {
  const { t } = useTranslation();
  const [form, setForm]     = useState({ nombre: "", email: "", telefono: "", password: "", confirm: "", codigoAcceso: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [errors, setErrors] = useState({});

  const u = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  const esSuperAdmin = form.email.trim().toLowerCase() === SUPERADMIN_REG_EMAIL;

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())            e.nombre   = t("common.required");
    if (!form.email.includes("@"))      e.email    = t("login.register.errorInvalidEmail");
    const { score } = passwordStrength(form.password);
    if (score < 5)                      e.password = "La contraseña no cumple todos los requisitos de seguridad";
    if (form.password !== form.confirm) e.confirm  = t("login.register.errorPasswordMismatch");
    if (!esSuperAdmin && !form.codigoAcceso.trim()) e.codigoAcceso = t("common.required");
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      const data = await register({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        telefono: form.telefono.trim(),
        codigoAcceso: form.codigoAcceso.trim().toUpperCase(),
      });
      onSuccess(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || t("login.register.errorCreate"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (key) =>
    `w-full px-3 py-2 rounded-xl border text-sm text-white placeholder-white/40
     focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors
     ${errors[key] ? "border-red-300/50 bg-red-500/20" : "border-white/20 bg-white/10"}`;

  const field = (label, key, opts = {}) => (
    <div>
      <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1">{label}</label>
      <input type={opts.type || "text"} value={form[key]} onChange={u(key)}
        placeholder={opts.placeholder || ""} className={inputCls(key)} />
      {errors[key] && <p className="text-[11px] text-red-200 mt-0.5">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      {field(t("login.register.fullName"), "nombre", { placeholder: t("login.register.fullNamePlaceholder") })}
      {field(t("common.email"), "email", { type: "email", placeholder: t("login.register.emailPlaceholder") })}
      {field(t("login.register.phoneLabel"), "telefono", { placeholder: t("login.register.phonePlaceholder") })}

      <div>
        <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1">{t("login.passwordLabel")}</label>
        <PasswordField value={form.password} onChange={u("password")} placeholder="Mín. 8 caracteres, mayúscula, número y símbolo" />
        <PasswordStrengthMeter password={form.password} />
        {errors.password && <p className="text-[11px] text-red-200 mt-1">{errors.password}</p>}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1">{t("login.register.confirmLabel")}</label>
        <PasswordField value={form.confirm} onChange={u("confirm")} placeholder={t("login.register.confirmPlaceholder")} />
        {errors.confirm && <p className="text-[11px] text-red-200 mt-0.5">{errors.confirm}</p>}
      </div>

      {!esSuperAdmin && (
        <div>
          <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1">{t("login.register.accessCodeLabel")}</label>
          <input
            type="text"
            value={form.codigoAcceso}
            onChange={(e) => {
              let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
              if (v.length === 5 && !v.includes("-")) v = v.slice(0,4) + "-" + v[4];
              if (v.length > 9) v = v.slice(0,9);
              setForm(p => ({ ...p, codigoAcceso: v }));
              setErrors(p => ({ ...p, codigoAcceso: "" }));
            }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            className={`${inputCls("codigoAcceso")} font-mono tracking-widest`}
          />
          {errors.codigoAcceso
            ? <p className="text-[11px] text-red-200 mt-0.5">{errors.codigoAcceso}</p>
            : <p className="text-[11px] text-white/65 mt-0.5">{t("login.register.accessCodeHint")}</p>}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-300/30 text-red-100 text-xs">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="login-btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> {t("login.register.creating")}</> : <><ArrowRight size={15} /> {t("login.register.submit")}</>}
      </button>

      <button type="button" onClick={onBack} className="w-full text-xs text-white/50 hover:text-white transition-colors py-1">
        {t("login.register.back")}
      </button>
    </form>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [savedUsers, setSavedUsers] = useState([]);
  const [identifier, setIdentifier] = useState(""); // email o username seleccionado
  const [customId, setCustomId] = useState("");      // cuando elige "Otra cuenta"
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const isElectron = !!window.electronAPI?.store;

  // Cargar usuarios guardados
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.store.get(STORE_USERS_KEY).then(users => {
      if (Array.isArray(users) && users.length > 0) {
        setSavedUsers(users);
        setIdentifier(users[0].identifier);
      }
    });
  }, []);

  // Si no hay usuarios guardados o eligió "Otra cuenta", usa el campo libre
  const effectiveId = (identifier === "__custom__" || savedUsers.length === 0) ? customId : identifier;

  const handleLogin = async (e) => {
    e.preventDefault();
    const id = effectiveId.trim();
    if (!id || !password) return setError(t("login.errorRequired"));
    setLoading(true);
    setError("");
    try {
      const data = await login({ email: id, password });
      // Guardar en store para futuros logins
      if (isElectron) {
        const existing = (await window.electronAPI.store.get(STORE_USERS_KEY)) ?? [];
        const idLower  = id.toLowerCase();
        const alreadyIn = existing.some(u => u.identifier === idLower);
        if (!alreadyIn) {
          await window.electronAPI.store.set(STORE_USERS_KEY, [
            ...existing,
            { identifier: idLower, nombre: data.user.nombre },
          ]);
        }
        // Señal IPC → main.js expande la ventana
        window.electronAPI.window?.loginSuccess?.();
      }
      onLogin?.(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || t("login.errorServer"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSuccess = (user, token) => {
    if (isElectron) window.electronAPI.window?.loginSuccess?.();
    onLogin?.(user, token);
  };

  const handleGuest = () => {
    const trialEnds = new Date(Date.now() + 7 * 86400_000).toISOString();
    // Expandir ventana igual que en login exitoso
    if (isElectron) window.electronAPI.window?.loginSuccess?.();
    onLogin?.({ id: "guest", nombre: "Usuario Demo", email: "", plan: "trial", trialEnds }, null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="login-screen flex flex-col h-screen overflow-hidden font-sans select-none relative"
      style={{ background: "linear-gradient(135deg, #047857 0%, #059669 40%, #10b981 75%, #34d399 100%)" }}
    >
      {/* Círculos decorativos */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.07)" }} />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Drag region — espacio para semáforos macOS */}
      <div className="drag-region h-9 shrink-0" />

      {/* Contenido centrado */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-6 overflow-y-auto no-drag">
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="mb-3">
            <img src="/MK_Logo2.png" alt="Monki.AI" style={{ width: 64, height: 64, objectFit: "contain" }} />
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[22px] font-bold text-white tracking-tight leading-none">Monki</span>
            <span className="text-[14px] font-bold leading-none" style={{ color: "#FACC15" }}>.AI</span>
          </div>
          <p className="text-[11px] text-white/80 mt-1 tracking-wide">{t("login.tagline")}</p>
        </div>

        {/* Separador */}
        <div className="w-full mb-6" style={{ height: 1, background: "rgba(255,255,255,0.2)" }} />

        {/* Formulario */}
        <div className="w-full max-w-[280px]">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  {t("login.userLabel")}
                </label>

                {/* Dropdown si hay usuarios guardados, o input de texto si no */}
                {savedUsers.length > 0 ? (
                  <>
                    <UserDropdown
                      users={savedUsers}
                      value={identifier}
                      onChange={setIdentifier}
                    />
                    {identifier === "__custom__" && (
                      <input
                        type="text"
                        value={customId}
                        onChange={e => setCustomId(e.target.value)}
                        placeholder={t("login.userPlaceholder")}
                        autoFocus
                        className="mt-2 w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10
                          text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2
                          focus:ring-white/30 transition-colors"
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={customId}
                    onChange={e => { setCustomId(e.target.value); setError(""); }}
                    placeholder={t("login.userPlaceholder")}
                    autoComplete="username"
                    className="w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10
                      text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2
                      focus:ring-white/30 transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  {t("login.passwordLabel")}
                </label>
                <PasswordField
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder={t("login.passwordPlaceholder")}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-300/30 text-red-100 text-xs">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> {t("login.signingIn")}</>
                  : <><ArrowRight size={15} /> {t("login.signIn")}</>}
              </button>

              {/* Links secundarios */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-xs text-white/80 hover:text-white transition-colors"
                >
                  {t("login.createAccount")}
                </button>
              </div>
            </form>
          ) : (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onBack={() => setMode("login")}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 no-drag flex items-center justify-center gap-3 pb-3 shrink-0">
        <p className="text-[10px] text-white/55">Monki.AI · Costa Rica · v1.0</p>
        <div className="flex items-center gap-1 text-[10px] font-semibold">
          <button
            onClick={() => i18n.changeLanguage("es")}
            className={`px-1.5 py-0.5 rounded transition-colors ${i18n.language === "es" ? "text-white bg-white/20" : "text-white/45 hover:text-white"}`}
          >
            ES
          </button>
          <span className="text-white/25">|</span>
          <button
            onClick={() => i18n.changeLanguage("en")}
            className={`px-1.5 py-0.5 rounded transition-colors ${i18n.language === "en" ? "text-white bg-white/20" : "text-white/45 hover:text-white"}`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
