import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, ArrowRight, Phone, Lock, Mail, Delete, ChevronRight, Star, Store, User } from "lucide-react";
import { toast } from "./Toast";
import { useAuth } from "../auth";
import { authApi, inquiryApi, type ApiPlanConfig } from "../../services/api";
import { usePlanConfig } from "../PlanConfigProvider";
import { formatPlanPrice, formatBillingSuffix } from "../../services/planConfigStore";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useLanguage } from "../../i18n/LanguageProvider";
import { CafyzLogo } from "./CafyzLogo";

type AuthMethod = "password" | "pin" | "otp";
type AuthState = "login" | "forgot" | "reset" | "otp-verify" | "inquiry";

const stats = [
  { label: "Restaurants", value: "2,400+" },
  { label: "Orders / Day", value: "180K+" },
  { label: "Countries", value: "14" },
];

function PinPad({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  const press = (k: string) => {
    if (k === "⌫") { setPin(p => p.slice(0,-1)); return; }
    if (k === "") return;
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) { onSubmit(next); setTimeout(() => setPin(""), 400); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3">
        {[0,1,2,3].map(i => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.1 : 1 }}
            className="w-12 h-12 rounded-xl border-2 flex items-center justify-center"
            style={{ borderColor: pin.length > i ? "#1e7fff" : "rgba(30,127,255,0.2)", background: pin.length > i ? "rgba(30,127,255,0.12)" : "transparent" }}
          >
            {pin.length > i && <div className="w-3 h-3 rounded-full" style={{ background: "#1e7fff" }} />}
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.92 }}
            onClick={() => press(k)}
            className="h-12 rounded-xl text-lg font-semibold transition-all flex items-center justify-center"
            style={k === "" ? { pointerEvents: "none" } : {
              background: k === "⌫" ? "rgba(255,59,92,0.08)" : "rgba(30,127,255,0.06)",
              color: k === "⌫" ? "#ff3b5c" : "#e8eef8",
              border: "1px solid rgba(30,127,255,0.1)",
            }}
          >
            {k === "⌫" ? <Delete size={18} /> : k}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin }: { onLogin?: () => void }) {
  const { t } = useLanguage();
  const { plans: planConfigs } = usePlanConfig();
  const { loginEmail, loginPin, requestOtp, verifyOtp } = useAuth();
  const [method, setMethod] = useState<AuthMethod>("password");
  // If arriving from the reset email link (/login?mode=reset&token=…), mount
  // straight into the reset form — initialise here (not in an effect) so the
  // AnimatePresence renders it directly with no login→reset transition stall.
  const [authState, setAuthState] = useState<AuthState>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") === "reset" && p.get("token") ? "reset" : "login";
  });
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [pinEmail, setPinEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") === "reset" ? p.get("token") : null;
  });
  const [newPw, setNewPw] = useState("");

  // Consume ?mode=reset&token= from email links; strip token from the address bar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get("token");
    if (p.get("mode") === "reset" && token) {
      setAuthState("reset");
      setResetToken(token);
      window.history.replaceState({}, "", window.location.pathname || "/");
    }
  }, []);

  const [inq, setInq] = useState({ name: "", restaurant: "", email: "", plan: "premium", message: "" });
  const setInqField = (k: keyof typeof inq, v: string) => setInq(s => ({ ...s, [k]: v }));

  function errMsg(e: unknown) { return e instanceof Error ? e.message : "Something went wrong"; }

  const submitInquiry = async () => {
    if (!inq.name.trim() || !inq.restaurant.trim() || !inq.email.trim()) {
      toast.error("Name, restaurant, and email are required");
      return;
    }
    setLoading(true);
    try {
      const res = await inquiryApi.submit({
        name: inq.name.trim(),
        restaurant_name: inq.restaurant.trim(),
        email: inq.email.trim().toLowerCase(),
        plan: inq.plan,
        message: inq.message.trim() || undefined,
      });
      toast.success("Trial request sent", {
        description: res.message || "We'll email your login details once the founder approves your request.",
      });
      setAuthState("login");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  // Real backend login (email + password)
  const submitPassword = async () => {
    if (!email.trim() || !password) { toast.error("Enter your email and password"); return; }
    setLoading(true);
    try { await loginEmail(email, password); onLogin?.(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Staff PIN login (needs the work email)
  const submitPin = async (pinValue: string) => {
    if (!pinEmail.trim()) { toast.error("Enter your work email for PIN login"); return; }
    setLoading(true);
    try { await loginPin(pinEmail, pinValue); onLogin?.(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Phone OTP — step 1: send
  const sendOtp = async () => {
    if (!phone.trim()) { toast.error("Enter your phone number"); return; }
    setLoading(true);
    try {
      const r = await requestOtp(phone);
      toast.success(r.message || "OTP sent");
      if (import.meta.env.DEV && r.dev_otp) toast.info(`Dev OTP: ${r.dev_otp}`);
      setAuthState("otp-verify");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Phone OTP — step 2: verify
  const submitOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    try { await verifyOtp(phone, code); onLogin?.(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (v.length > 1) return;
    const next = [...otp]; next[i] = v;
    setOtp(next);
    if (v && i < 5) (document.getElementById(`otp-${i+1}`) as HTMLInputElement)?.focus();
  };

  // Forgot password — request a reset link by email.
  const submitForgot = async () => {
    if (!forgotEmail.trim()) { toast.error("Enter your email address"); return; }
    setLoading(true);
    try {
      const r = await authApi.forgotPassword(forgotEmail.trim());
      if (import.meta.env.DEV && r.dev_reset_url) {
        toast.success("Reset link ready", { description: "Opening the password reset page…" });
        window.location.assign(r.dev_reset_url);
        return;
      }
      toast.success("Check your email", { description: r.message || "If that address is registered, a reset link is on its way." });
      setAuthState("login");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Reset password — set a new password using the emailed token.
  const submitReset = async () => {
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!resetToken) { toast.error("Invalid or expired reset link", { description: "Request a new link from “Forgot password?”" }); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPw);
      toast.success("Password updated", { description: "Sign in with your new password." });
      window.history.replaceState({}, "", window.location.pathname); // drop ?token from the URL
      setResetToken(null); setNewPw("");
      setAuthState("login");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="app-screen app-native-inset-top flex" style={{ background: "#06091a" }}>
      {/* Left hero panel — desktop only */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10"
        style={{
          background: "linear-gradient(160deg, #080d1e 0%, #0a1535 60%, #06091a 100%)",
          borderRight: "1px solid rgba(30,127,255,0.1)",
        }}
      >
        {/* Logo — repo root logo.png */}
        <div className="mb-4 flex justify-start">
          <CafyzLogo size="login" className="drop-shadow-[0_10px_36px_rgba(30,127,255,0.28)]" />
        </div>

        {/* Hero content */}
        <div className="space-y-8">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "2.8rem", lineHeight: 1.15 }}>
              Run your restaurant<br />
              <span style={{ background: "linear-gradient(90deg, #1e7fff, #00c6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                smarter, faster.
              </span>
            </h1>
            <p style={{ color: "#6b82a0", marginTop: 16, fontSize: "1rem", lineHeight: 1.6 }}>
              One platform for POS, kitchen, staff, inventory, and analytics — designed for modern restaurants.
            </p>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background: "rgba(30,127,255,0.06)", border: "1px solid rgba(30,127,255,0.1)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff", fontSize: "1.4rem" }}>{s.value}</div>
                <div style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Testimonial */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(30,127,255,0.06)", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div className="flex gap-0.5">{[...Array(5)].map((_,i) => <Star key={i} size={13} fill="#f59e0b" stroke="none" />)}</div>
            <p style={{ color: "#a8bdd4", fontSize: "0.85rem", lineHeight: 1.6 }}>
              "Cafyz transformed our kitchen workflow. Order errors dropped by 80% and our staff loves the clean interface."
            </p>
            <div style={{ color: "#6b82a0", fontSize: "0.78rem" }}>— Arjun Patel, The Spice Garden</div>
          </div>
        </div>

        <p style={{ color: "#6b82a0", fontSize: "0.72rem" }}>© 2026 Cafyz Technologies. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative lg:justify-center">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
          <LanguageSwitcher variant="login" />
        </div>

        {/* Mobile / tablet: logo band = 30% of screen height, form in the remaining space */}
        <header className="lg:hidden w-full flex flex-col items-center justify-center flex-shrink-0 px-4
          h-[30dvh] min-h-[30dvh] max-h-[30dvh]
          pt-[max(0.75rem,env(safe-area-inset-top))]">
          <CafyzLogo
            size="loginMobile"
            className="drop-shadow-[0_10px_36px_rgba(30,127,255,0.28)]"
          />
        </header>

        <div className="flex-1 w-full min-h-0 flex flex-col items-center overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:flex-none lg:overflow-visible lg:justify-center lg:p-6 lg:pt-6">
        <div className="w-full max-w-[400px]">
          <AnimatePresence mode="wait">
            {authState === "login" && (
              <motion.div key="login" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem" }}>{t("Welcome back")}</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>{t("Sign in to your Cafyz account")}</p>
                </div>

                {/* Auth method tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                  {(["password","pin","otp"] as AuthMethod[]).map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className="flex-1 py-2 rounded-lg text-sm capitalize transition-all font-medium"
                      style={method === m ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" } : { color: "#6b82a0" }}
                    >
                      {m === "password" ? t("Email") : m === "pin" ? "PIN" : "OTP"}
                    </button>
                  ))}
                </div>

                {method === "password" && (
                  <div className="space-y-3">
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{t("Email address")}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Mail size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                        <input type="email" placeholder="alex@restaurant.com" value={email} onChange={e => setEmail(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
                          style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{t("Password")}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Lock size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                        <input type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
                          style={{ color: "#e8eef8" }} />
                        <button onClick={() => setShowPass(s => !s)} style={{ color: "#6b82a0" }}>
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => setAuthState("forgot")} style={{ color: "#1e7fff", fontSize: "0.8rem" }}>{t("Forgot password?")}</button>
                    </div>
                  </div>
                )}

                {method === "pin" && (
                  <div className="space-y-4">
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{t("Email address")}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Mail size={15} style={{ color: "#6b82a0" }} />
                        <input type="email" placeholder="staff@restaurant.com" value={pinEmail} onChange={e => setPinEmail(e.target.value)} className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                    <PinPad onSubmit={(pin) => submitPin(pin)} />
                  </div>
                )}

                {method === "otp" && (
                  <div className="space-y-4">
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{t("Phone number")}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Phone size={15} style={{ color: "#6b82a0" }} />
                        <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
                          style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                    <button onClick={sendOtp} disabled={loading}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-98"
                      style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                      {loading ? t("Sending…") : t("Send OTP")}
                    </button>
                  </div>
                )}

                {method === "password" && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={submitPassword}
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("Sign In")} <ArrowRight size={16} /></>}
                  </motion.button>
                )}

                <p style={{ color: "#6b82a0", fontSize: "0.8rem", textAlign: "center" }}>
                  {t("New to Cafyz?")}{" "}
                  <button onClick={() => setAuthState("inquiry")} style={{ color: "#1e7fff", fontWeight: 600 }}>{t("Start free trial →")}</button>
                </p>
              </motion.div>
            )}

            {authState === "inquiry" && (
              <motion.div key="inquiry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
                <div>
                  <button onClick={() => setAuthState("login")} style={{ color: "#6b82a0", fontSize: "0.8rem" }}>← Back to sign in</button>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem", marginTop: 10 }}>Start your free trial</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4, lineHeight: 1.5 }}>
                    Request access — no password needed now. Our founder will review your request and email you login credentials once approved.
                  </p>
                </div>
                {[
                  { k: "name" as const, label: "Your name", icon: User, type: "text", ph: "Alex Kumar" },
                  { k: "restaurant" as const, label: "Restaurant name", icon: Store, type: "text", ph: "The Spice Garden" },
                  { k: "email" as const, label: "Work email", icon: Mail, type: "email", ph: "alex@restaurant.com" },
                ].map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.k}>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Icon size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                        <input type={f.type} placeholder={f.ph} value={inq[f.k]} onChange={e => setInqField(f.k, e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Preferred plan</label>
                  <select value={inq.plan} onChange={e => setInqField("plan", e.target.value)}
                    className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                    style={{ background: "#0d1326", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.15)" }}>
                    {(planConfigs.length ? planConfigs : [
                      { plan: "basic", label: "Basic", price_monthly: 0, currency_symbol: "$", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                      { plan: "pro", label: "Pro", price_monthly: 0, currency_symbol: "$", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                      { plan: "premium", label: "Premium", price_monthly: 0, currency_symbol: "$", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                    ] as ApiPlanConfig[]).map(p => (
                      <option key={p.plan} value={p.plan}>
                        {p.label ?? p.plan}{p.price_monthly ? ` — ${formatPlanPrice(p)}${formatBillingSuffix(p)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Notes (optional)</label>
                  <textarea value={inq.message} onChange={e => setInqField("message", e.target.value)} rows={3}
                    placeholder="Number of locations, go-live date, etc."
                    className="w-full rounded-xl px-3 py-3 text-sm outline-none placeholder:text-[#6b82a0] resize-none"
                    style={{ background: "#0d1326", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.15)" }} />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={submitInquiry} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Request free trial <ArrowRight size={16} /></>}
                </motion.button>
                <p style={{ color: "#6b82a0", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5 }}>
                  You'll receive a confirmation email now. Login credentials are sent after founder approval.
                </p>
              </motion.div>
            )}

            {authState === "otp-verify" && (
              <motion.div key="otp" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} style={{ color: "#6b82a0", fontSize: "0.8rem" }}>← Back</button>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem", marginTop: 8 }}>Verify OTP</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>Sent to {phone || "+91 98765 43210"}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  {otp.map((v, i) => (
                    <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={v}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      className="w-11 h-12 rounded-xl text-center text-lg font-bold outline-none"
                      style={{ background: "#0d1326", border: `1px solid ${v ? "#1e7fff" : "rgba(30,127,255,0.15)"}`, color: "#e8eef8" }} />
                  ))}
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={submitOtp} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Verifying…" : <>Verify &amp; Sign In <ArrowRight size={16} /></>}
                </motion.button>
                <p style={{ color: "#6b82a0", fontSize: "0.8rem", textAlign: "center" }}>
                  Didn't receive? <button onClick={sendOtp} style={{ color: "#1e7fff" }}>Resend OTP</button>
                </p>
              </motion.div>
            )}

            {authState === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} style={{ color: "#6b82a0", fontSize: "0.8rem" }}>← Back to sign in</button>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem", marginTop: 8 }}>Reset Password</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>We'll send a reset link to your email.</p>
                </div>
                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Email address</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                    <Mail size={15} style={{ color: "#6b82a0" }} />
                    <input type="email" placeholder="alex@restaurant.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                  </div>
                </div>
                <button onClick={submitForgot} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Reset Link"}
                </button>
              </motion.div>
            )}

            {authState === "reset" && (
              <motion.div key="reset" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} style={{ color: "#6b82a0", fontSize: "0.8rem" }}>← Back to sign in</button>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem", marginTop: 8 }}>Set a new password</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>Choose a new password for your account.</p>
                </div>
                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>New password</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                    <Lock size={15} style={{ color: "#6b82a0" }} />
                    <input type={showPass ? "text" : "password"} placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                    <button onClick={() => setShowPass(s => !s)} style={{ color: "#6b82a0" }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button onClick={submitReset} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Update password <ArrowRight size={16} /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>
    </div>
  );
}
