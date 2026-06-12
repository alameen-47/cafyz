import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Shield, ArrowRight, Phone, Lock, Mail, Delete, ChevronRight, Star, Store, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth";

type AuthMethod = "password" | "pin" | "otp";
type AuthState = "login" | "forgot" | "reset" | "otp-verify" | "signup";

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
  const { loginEmail, loginPin, requestOtp, verifyOtp, signup } = useAuth();
  const [method, setMethod] = useState<AuthMethod>("password");
  const [authState, setAuthState] = useState<AuthState>("login");
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [pinEmail, setPinEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Free-trial signup form
  const [su, setSu] = useState({ restaurant: "", owner: "", email: "", phone: "", password: "" });
  const setSuField = (k: keyof typeof su, v: string) => setSu(s => ({ ...s, [k]: v }));

  function errMsg(e: unknown) { return e instanceof Error ? e.message : "Something went wrong"; }

  // Create a new restaurant account (free trial), then sign in.
  const submitSignup = async () => {
    if (!su.restaurant.trim()) { toast.error("Restaurant name is required"); return; }
    if (!su.owner.trim()) { toast.error("Your name is required"); return; }
    if (!su.email.trim()) { toast.error("Email is required"); return; }
    if (!su.phone.trim()) { toast.error("Phone is required", { description: "Use international format, e.g. +971500000000" }); return; }
    if (su.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await signup({ restaurant_name: su.restaurant, owner_name: su.owner, email: su.email, phone: su.phone, password: su.password, plan: "premium", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      toast.success("Welcome to Cafyz!", { description: "Your free trial is ready" });
      onLogin?.();
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
      if (r.dev_otp) toast.info(`Dev OTP: ${r.dev_otp}`);
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

  return (
    <div className="min-h-screen flex" style={{ background: "#06091a" }}>
      {/* Left hero panel — desktop only */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10"
        style={{
          background: "linear-gradient(160deg, #080d1e 0%, #0a1535 60%, #06091a 100%)",
          borderRight: "1px solid rgba(30,127,255,0.1)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 24px rgba(30,127,255,0.5)" }}
          >
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.25rem", letterSpacing: "0.08em" }}>CAFYZ</div>
            <div style={{ fontSize: "0.65rem", color: "#6b82a0", letterSpacing: "0.15em" }}>RESTAURANT OS</div>
          </div>
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)" }}>
            <Shield size={18} className="text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.2rem", letterSpacing: "0.08em" }}>CAFYZ</span>
        </div>

        <div className="w-full max-w-[400px]">
          <AnimatePresence mode="wait">
            {authState === "login" && (
              <motion.div key="login" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem" }}>Welcome back</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>Sign in to your Cafyz account</p>
                </div>

                {/* Auth method tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                  {(["password","pin","otp"] as AuthMethod[]).map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className="flex-1 py-2 rounded-lg text-sm capitalize transition-all font-medium"
                      style={method === m ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" } : { color: "#6b82a0" }}
                    >
                      {m === "password" ? "Email" : m === "pin" ? "PIN" : "OTP"}
                    </button>
                  ))}
                </div>

                {method === "password" && (
                  <div className="space-y-3">
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Email address</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Mail size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                        <input type="email" placeholder="alex@restaurant.com" value={email} onChange={e => setEmail(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
                          style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Password</label>
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
                      <button onClick={() => setAuthState("forgot")} style={{ color: "#1e7fff", fontSize: "0.8rem" }}>Forgot password?</button>
                    </div>
                  </div>
                )}

                {method === "pin" && (
                  <div className="space-y-4">
                    <div>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Email address</label>
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
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Phone number</label>
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
                      {loading ? "Sending…" : "Send OTP"}
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
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
                  </motion.button>
                )}

                <p style={{ color: "#6b82a0", fontSize: "0.8rem", textAlign: "center" }}>
                  New to Cafyz?{" "}
                  <button onClick={() => setAuthState("signup")} style={{ color: "#1e7fff", fontWeight: 600 }}>Start free trial →</button>
                </p>
              </motion.div>
            )}

            {authState === "signup" && (
              <motion.div key="signup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
                <div>
                  <button onClick={() => setAuthState("login")} style={{ color: "#6b82a0", fontSize: "0.8rem" }}>← Back to sign in</button>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1.6rem", marginTop: 10 }}>Start your free trial</h2>
                  <p style={{ color: "#6b82a0", fontSize: "0.85rem", marginTop: 4 }}>Create your restaurant account — no card required</p>
                </div>

                {[
                  { k: "restaurant" as const, label: "Restaurant name", icon: Store, type: "text", ph: "The Spice Garden" },
                  { k: "owner" as const, label: "Your name", icon: User, type: "text", ph: "Alex Kumar" },
                  { k: "email" as const, label: "Email address", icon: Mail, type: "email", ph: "alex@restaurant.com" },
                  { k: "phone" as const, label: "Phone (international)", icon: Phone, type: "tel", ph: "+971 50 000 0000" },
                ].map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.k}>
                      <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                        <Icon size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                        <input type={f.type} placeholder={f.ph} value={su[f.k]} onChange={e => setSuField(f.k, e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                      </div>
                    </div>
                  );
                })}

                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.8rem", display: "block", marginBottom: 6 }}>Password</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.15)" }}>
                    <Lock size={15} style={{ color: "#6b82a0", flexShrink: 0 }} />
                    <input type={showPass ? "text" : "password"} placeholder="At least 8 characters" value={su.password} onChange={e => setSuField("password", e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                    <button onClick={() => setShowPass(s => !s)} style={{ color: "#6b82a0" }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <motion.button whileTap={{ scale: 0.97 }} onClick={submitSignup} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create account &amp; start trial <ArrowRight size={16} /></>}
                </motion.button>

                <p style={{ color: "#6b82a0", fontSize: "0.72rem", textAlign: "center" }}>
                  Already have an account?{" "}
                  <button onClick={() => setAuthState("login")} style={{ color: "#1e7fff", fontWeight: 600 }}>Sign in</button>
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
                    <input type="email" placeholder="alex@restaurant.com"
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]" style={{ color: "#e8eef8" }} />
                  </div>
                </div>
                <button onClick={() => setAuthState("login")}
                  className="w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  Send Reset Link
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
