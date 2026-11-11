import { useState, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, ArrowRight, Phone, Lock, Mail, Delete, Store, User, CheckCircle2, ShieldCheck, ChefHat } from "lucide-react";
import { toast } from "./Toast";
import { useAuth, type SocialChoice, type SocialSignup, type SocialProvider } from "../auth";
import { AmetronyxCredit } from "./AmetronyxCredit";
import { getNativeGoogleIdToken, googleSignInConfig, isGoogleCancel, isNativeShell, mountGoogleTrigger, type GoogleConfig } from "../../services/googleSignIn";
import { appleSignInConfig, getAppleCredential, isAppleCancel, isAppleSignInAvailable, type AppleConfig } from "../../services/appleSignIn";
import { authApi, inquiryApi, type ApiPlanConfig } from "../../services/api";
import { usePlanConfig } from "../PlanConfigProvider";
import { formatPlanPrice, formatBillingSuffix } from "../../services/planConfigStore";
import { SHOW_PLAN_PRICING } from "../../config/features";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useLanguage } from "../../i18n/LanguageProvider";
import { CafyzLogo } from "./CafyzLogo";
import { setStatusBarOverride } from "../../utils/statusBarLook";
import { useLoginFit } from "./useLoginFit";
import "./LoginScreen.css";

type AuthMethod = "password" | "pin" | "otp";
type AuthState = "login" | "forgot" | "reset" | "otp-verify" | "inquiry" | "inquiry-sent" | "google-choose" | "google-signup";

/** The screen's top colour, so the phone's status bar runs straight into it. */
const LOGIN_TOP = "#070511";

/** A fine-dining room after dark in the brand's neon (scripts/art). Decorative only. */
function LoginBackdrop({ className, sizes }: { className: string; sizes: string }) {
  return (
    <img
      src="/login/neon-dining-1024.webp"
      srcSet="/login/neon-dining-640.webp 640w, /login/neon-dining-1024.webp 1024w"
      sizes={sizes}
      alt=""
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}

/** The neon sweeps in the bottom corners (violet left, blue right). Decorative only. */
function LoginArcs() {
  return (
    <div className="login-arcs" aria-hidden="true">
      {[
        { id: "login-arc-violet", from: "#d946ff", to: "#641aff" },
        { id: "login-arc-blue", from: "#00d4ff", to: "#007bff" },
      ].map(({ id, from, to }) => (
        <svg key={id} viewBox="0 0 200 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={from} stopOpacity="0.95" />
              <stop offset="1" stopColor={to} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={to} stopOpacity="0.28" />
              <stop offset="1" stopColor={to} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 34 C 52 52, 112 86, 200 120 L 0 120 Z" fill={`url(#${id}-fill)`} />
          <path d="M0 34 C 52 52, 112 86, 200 120" fill="none" stroke={`url(#${id})`} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M0 58 C 44 72, 96 98, 150 120" fill="none" stroke={`url(#${id})`} strokeWidth="1" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </div>
  );
}

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
    <div className="login-pin">
      <div className="flex justify-center gap-2 sm:gap-3">
        {[0,1,2,3].map(i => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.1 : 1 }}
            className="login-pin-dot rounded-xl border-2 flex items-center justify-center"
            style={{ borderColor: pin.length > i ? "var(--cz-violet)" : "var(--cz-line-soft)", background: pin.length > i ? "rgba(180,68,255,0.14)" : "var(--cz-glass)", boxShadow: pin.length > i ? "var(--cz-glow-purple)" : "none" }}
          >
            {pin.length > i && <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ background: "var(--cz-violet)" }} />}
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {keys.map((k, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.92 }}
            onClick={() => press(k)}
            className="login-pin-key rounded-2xl text-base sm:text-lg font-semibold transition-colors flex items-center justify-center"
            aria-label={k === "⌫" ? "Delete" : undefined}
            style={k === "" ? { pointerEvents: "none" } : {
              background: "var(--cz-glass)",
              color: k === "⌫" ? "var(--cz-text-2)" : "var(--cz-text)",
              border: "1px solid var(--cz-line-soft)",
            }}
          >
            {k === "⌫" ? <Delete size={18} /> : k}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ActivityLoader({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4 sm:gap-5 text-center">
      <div className="relative w-16 h-16" aria-hidden>
        <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(180,68,255,0.16)" }} />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#b444ff] animate-spin" />
        <div
          className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#00d4ff] animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "0.85s" }}
        />
        <div className="absolute inset-[18px] rounded-full" style={{ background: "rgba(100,26,255,0.28)" }} />
      </div>
      <div>
        <p style={{ color: "var(--cafyz-text)", fontSize: "0.95rem", fontWeight: 600 }}>{label}</p>
        {sublabel ? (
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", marginTop: 6, lineHeight: 1.5, maxWidth: 280 }}>{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin }: { onLogin?: () => void }) {
  const { t, lang } = useLanguage();
  const { plans: planConfigs } = usePlanConfig();
  const { loginEmail, loginPin, requestEmailOtp, verifyEmailOtp, loginSocial, loginSocialSelect, signupSocial } = useAuth();
  // "back" carries the accent in English; other languages show the phrase whole.
  const welcome = t("Welcome back");
  const welcomeAccentAt = welcome === "Welcome back" ? 8 : -1;
  const [method, setMethod] = useState<AuthMethod>("password");
  // If arriving from the reset email link (/login?mode=reset&token=…), mount
  // straight into the reset form — initialise here (not in an effect) so the
  // AnimatePresence renders it directly with no login→reset transition stall.
  const [authState, setAuthState] = useState<AuthState>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") === "reset" && p.get("token") ? "reset" : "login";
  });
  const [showPass, setShowPass] = useState(false);
  // Google sign-in is advertised by the API, so it can be enabled or disabled
  // without shipping a new web or native build.
  const [googleCfg, setGoogleCfg] = useState<GoogleConfig | null>(null);
  const googleEnabled = googleCfg?.enabled === true;
  // Sign in with Apple is iOS-only and, like Google, switched on by the API.
  const [appleCfg, setAppleCfg] = useState<AppleConfig | null>(null);
  const appleEnabled = appleCfg?.enabled === true && isAppleSignInAvailable();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleChoice, setGoogleChoice] = useState<SocialChoice | null>(null);
  const [googleSignup, setGoogleSignup] = useState<SocialSignup | null>(null);
  const [signupForm, setSignupForm] = useState({ restaurant: "", name: "", phone: "" });
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  // Phones fit the sign-in step to the screen instead of scrolling it (useLoginFit).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const brandRef = useRef<HTMLDivElement | null>(null);
  const credentialsRef = useRef<HTMLDivElement | null>(null);
  const fitRefs = useMemo(() => ({ scroll: scrollRef, canvas: canvasRef, brand: brandRef, content: credentialsRef }), []);
  useLoginFit(authState === "login", method === "password", fitRefs);
  const native = isNativeShell();
  const [email, setEmail] = useState("");
  const [pinLogin, setPinLogin] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
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

  const [inq, setInq] = useState({ name: "", restaurant: "", email: "", phone: "", plan: "premium", message: "" });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySentMessage, setInquirySentMessage] = useState("");
  const setInqField = (k: keyof typeof inq, v: string) => setInq(s => ({ ...s, [k]: v }));

  const goToSignIn = (prefillEmail?: string) => {
    if (prefillEmail) setEmail(prefillEmail);
    setMethod("password");
    setAuthState("login");
    setInquirySubmitting(false);
  };

  function errMsg(e: unknown) { return e instanceof Error ? e.message : "Something went wrong"; }

  const submitInquiry = async () => {
    if (inquirySubmitting) return;
    if (!inq.name.trim() || !inq.restaurant.trim() || !inq.email.trim() || !inq.phone.trim()) {
      toast.error("Name, restaurant, email, and mobile number are required");
      return;
    }
    setInquirySubmitting(true);
    try {
      const res = await inquiryApi.submit({
        name: inq.name.trim(),
        restaurant_name: inq.restaurant.trim(),
        email: inq.email.trim().toLowerCase(),
        phone: inq.phone.trim(),
        plan: inq.plan,
        message: inq.message.trim() || undefined,
      });
      const submittedEmail = inq.email.trim().toLowerCase();
      setInquirySentMessage(
        res.message || "Your trial request is pending founder approval. We'll email your login details once approved.",
      );
      setEmail(submittedEmail);
      setAuthState("inquiry-sent");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setInquirySubmitting(false);
    }
  };

  // This screen is dark in both themes, so the status bar takes its top colour
  // and white text while it is up.
  useEffect(() => {
    setStatusBarOverride({ content: "light", color: LOGIN_TOP });
    return () => setStatusBarOverride(null);
  }, []);

  // Real backend login (email + password)
  useEffect(() => {
    let alive = true;
    void googleSignInConfig().then((cfg) => {
      if (!alive) return;
      setGoogleCfg(cfg);
    });
    if (isAppleSignInAvailable()) {
      void appleSignInConfig().then((cfg) => {
        if (!alive) return;
        setAppleCfg(cfg);
      });
    }
    return () => { alive = false; };
  }, []);

  const completeSocial = async (provider: SocialProvider, idToken: string, name?: string) => {
    setGoogleBusy(true);
    try {
      const res = await loginSocial(provider, idToken, name);
      if (res && "choose" in res) {    // email maps to several restaurants
        setGoogleChoice(res.choose);
        setAuthState("google-choose");
        return;
      }
      if (res && "signup" in res) {    // new to Cafyz: ask for the restaurant, then start the trial
        setGoogleSignup(res.signup);
        setSignupForm({ restaurant: "", name: res.signup.name, phone: "" });
        setAuthState("google-signup");
        return;
      }
      onLogin?.();
    } catch { /* the API layer already surfaced the message */ }
    finally { setGoogleBusy(false); }
  };

  // Native uses our own button + the system picker; web must use Google's
  // rendered button (One Tap cannot be triggered reliably on click).
  const submitGoogleNative = async () => {
    if (!googleCfg) return;
    setGoogleBusy(true);
    let idToken: string | null;
    try {
      idToken = await getNativeGoogleIdToken(googleCfg);
    } catch (e) {
      // Picker errors never reach the API layer, so they must be shown here.
      if (!isGoogleCancel(e)) {
        console.error("[google sign-in]", e);
        toast.error(t("Google sign-in failed. Please try again."));
      }
      setGoogleBusy(false);
      return;
    }
    if (!idToken) { setGoogleBusy(false); return; }   // user dismissed the picker
    await completeSocial("google", idToken);
  };

  // Sign in with Apple: the system sheet, then the same flow as Google. Apple
  // gives the name only on the first authorization, so it is forwarded when present.
  const submitAppleNative = async () => {
    setGoogleBusy(true);
    let credential: Awaited<ReturnType<typeof getAppleCredential>>;
    try {
      credential = await getAppleCredential();
    } catch (e) {
      if (!isAppleCancel(e)) {
        console.error("[apple sign-in]", e);
        toast.error(t("Sign in with Apple failed. Please try again."));
      }
      setGoogleBusy(false);
      return;
    }
    if (!credential) { setGoogleBusy(false); return; }   // user dismissed the sheet
    await completeSocial("apple", credential.idToken, credential.name || undefined);
  };

  // Web: null while Google's button loads, false if its script failed to load.
  const [webGoogleReady, setWebGoogleReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (native || !googleCfg?.enabled || authState !== "login") return;
    const el = googleBtnRef.current;
    if (!el) return;
    let alive = true;
    setWebGoogleReady(null);
    void mountGoogleTrigger(el, googleCfg, (idToken) => { void completeSocial("google", idToken); })
      .then((ok) => { if (alive) setWebGoogleReady(ok); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, googleCfg, authState]);

  // Clicks normally land on Google's invisible button; this only runs when it isn't there.
  const googleWebUnavailable = () => {
    toast.error(webGoogleReady === false
      ? t("Couldn't reach Google. Check your connection and reload the page.")
      : t("Google sign-in is still loading. Try again in a moment."));
  };

  const chooseGoogleAccount = async (restaurantId: string) => {
    if (!googleChoice) return;
    setGoogleBusy(true);
    try {
      await loginSocialSelect(googleChoice.provider, googleChoice.selectionToken, restaurantId);
      onLogin?.();
    } catch {
      setAuthState("login");
      setGoogleChoice(null);
    } finally { setGoogleBusy(false); }
  };

  const submitGoogleSignup = async () => {
    if (!googleSignup) return;
    const restaurant = signupForm.restaurant.trim();
    const digits = signupForm.phone.replace(/\D/g, "");
    if (restaurant.length < 2) { toast.error("Enter your restaurant name"); return; }
    if (digits.length < 8) { toast.error("Enter your mobile number"); return; }
    // A 10-digit number without a country code is taken as an Indian mobile.
    const phone = signupForm.phone.trim().startsWith("+") ? signupForm.phone.trim() : digits.length === 10 ? "+91" + digits : "+" + digits;
    setGoogleBusy(true);
    try {
      await signupSocial(googleSignup.provider, googleSignup.signupToken, {
        restaurant_name: restaurant,
        phone,
        owner_name: signupForm.name.trim() || undefined,
      });
      onLogin?.();
    } catch (e) {
      // The signup token expired: start again from the Google button.
      if (/took too long/i.test((e as Error).message)) { setGoogleSignup(null); setAuthState("login"); }
    } finally { setGoogleBusy(false); }
  };

  const submitPassword = async () => {
    if (!email.trim() || !password) { toast.error("Enter your email or mobile number and password"); return; }
    setLoading(true);
    try { await loginEmail(email, password); onLogin?.(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Staff PIN login (needs the work email)
  const submitPin = async (pinValue: string) => {
    if (!pinLogin.trim()) { toast.error("Enter your work email or mobile number for PIN login"); return; }
    setLoading(true);
    try { await loginPin(pinLogin, pinValue); onLogin?.(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Email OTP — step 1: email a 6-digit code
  const sendOtp = async () => {
    const address = otpEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { toast.error(t("Enter your email address")); return; }
    setLoading(true);
    try {
      const r = await requestEmailOtp(address);
      toast.success(r.message || t("Check your email for a 6-digit code."));
      if (import.meta.env.DEV && r.dev_otp) toast.info(`Dev OTP: ${r.dev_otp}`);
      setOtp(["","","","","",""]);
      setAuthState("otp-verify");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Email OTP — step 2: verify. An address in several restaurants asks which one,
  // through the same picker Google and Apple use.
  const submitOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) { toast.error(t("Enter the 6-digit code")); return; }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(otpEmail, code);
      if (res?.choose) {
        setGoogleChoice(res.choose);
        setAuthState("google-choose");
        return;
      }
      onLogin?.();
    }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  };

  // Typing fills one box at a time; pasting or autofilling the code fills them all.
  const handleOtpChange = (i: number, v: string) => {
    const digits = v.replace(/\D/g, "");
    const next = [...otp];
    if (digits.length > 1) {
      digits.slice(0, 6 - i).split("").forEach((d, k) => { next[i + k] = d; });
      setOtp(next);
      const last = Math.min(i + digits.length, 6) - 1;
      (document.getElementById(`otp-${last}`) as HTMLInputElement | null)?.focus();
      return;
    }
    next[i] = digits;
    setOtp(next);
    if (digits && i < 5) (document.getElementById(`otp-${i+1}`) as HTMLInputElement | null)?.focus();
  };
  const handleOtpKeyDown = (i: number, e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) (document.getElementById(`otp-${i-1}`) as HTMLInputElement | null)?.focus();
    if (e.key === "Enter") void submitOtp();
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
    <div className="login-screen app-screen app-native-inset-top flex h-full min-h-[100dvh] w-full flex-col overflow-hidden md:flex-row">
      {/* Tablet & desktop: the dining room fills the left column. */}
      <aside className="login-photo-panel hidden md:flex">
        <LoginBackdrop className="login-photo-img" sizes="50vw" />
        <div className="login-photo-scrim" aria-hidden="true" />
        <div className="login-photo-copy">
          <div className="flex justify-start">
            <CafyzLogo size="xl" tone="onDark" />
          </div>
          <div>
            <h1 className="login-photo-title">Run your restaurant smarter, faster.</h1>
            <p className="login-photo-sub">
              One platform for POS, kitchen, staff, inventory, and analytics — designed for modern restaurants.
            </p>
            <p className="login-photo-legal">© 2026 Cafyz Technologies. All rights reserved.</p>
          </div>
        </div>
      </aside>

      <div className="login-screen-form-shell relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="login-lang absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-30 sm:right-4 md:top-6 md:right-6">
          <LanguageSwitcher variant="login" />
        </div>

        <div className="login-sheet login-screen-panel flex-1 min-h-0">
          <div ref={scrollRef} className="login-screen-panel-scroll h-full">
            <div ref={canvasRef} className="login-canvas" data-step={authState === "login" ? "sign-in" : "other"}>
            {/* Phones: the dining room across the top, scrolling with the form. */}
            <div className="login-backdrop md:hidden" aria-hidden="true">
              <LoginBackdrop className="login-backdrop-img" sizes="100vw" />
            </div>
            <div className="login-screen-panel-inner">
              <div ref={brandRef} className="login-brand md:hidden">
                <CafyzLogo size="lg" tone="onDark" />
              </div>
              <div ref={credentialsRef} className="login-screen-credentials">
          <AnimatePresence mode="wait" initial={false}>
            {authState === "login" && (
              <motion.div key="login" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="login-step">
                <div className="login-welcome">
                  <h2 className="login-title">
                    {welcomeAccentAt > 0
                      ? <>{welcome.slice(0, welcomeAccentAt)}<span className="login-accent">{welcome.slice(welcomeAccentAt)}</span></>
                      : welcome}
                  </h2>
                  <p className="login-subtitle">{t("Sign in to your Cafyz account")}</p>
                  <span className="login-welcome-rule" aria-hidden="true" />
                </div>

                {/* Auth method tabs */}
                <div className="login-seg" role="group" aria-label={t("Sign in with")}>
                  {(["password","pin","otp"] as AuthMethod[]).map(m => {
                    const Icon = m === "password" ? Mail : m === "pin" ? Lock : ShieldCheck;
                    return (
                      <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}>
                        <Icon size={17} aria-hidden="true" />
                        {m === "password" ? t("Email / Mobile") : m === "pin" ? "PIN" : "OTP"}
                      </button>
                    );
                  })}
                </div>

                {method === "password" && (
                  <div className="login-fields">
                    <div>
                      <label className="login-label" htmlFor="login-identity"><Mail size={17} aria-hidden="true" />{t("Email or mobile")}</label>
                      <div className="login-field">
                        <Mail size={19} aria-hidden="true" />
                        <input id="login-identity" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                          placeholder="alex@restaurant.com or +971500000000" value={email} onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") void submitPassword(); }}
                          className="flex-1 bg-transparent outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="login-label" htmlFor="login-password"><Lock size={17} aria-hidden="true" />{t("Password")}</label>
                      <div className="login-field">
                        <Lock size={19} aria-hidden="true" />
                        <input id="login-password" type={showPass ? "text" : "password"} autoComplete="current-password"
                          placeholder={t("Enter your password")} value={password} onChange={e => setPassword(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") void submitPassword(); }}
                          className="flex-1 bg-transparent outline-none" />
                        <button type="button" className="login-reveal" onClick={() => setShowPass(s => !s)} aria-label={showPass ? t("Hide password") : t("Show password")}>
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="login-forgot">
                      <button type="button" className="login-link" onClick={() => setAuthState("forgot")}>
                        {t("Forgot password?")} <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {method === "pin" && (
                  <div className="login-fields">
                    <div>
                      <label className="login-label">{t("Email or mobile")}</label>
                      <div className="login-field">
                        <Phone size={15} style={{ color: "var(--cafyz-muted)" }} />
                        <input type="text" placeholder="staff@restaurant.com or +971500000000" value={pinLogin} onChange={e => setPinLogin(e.target.value)} className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                      </div>
                    </div>
                    <PinPad onSubmit={(pin) => submitPin(pin)} />
                  </div>
                )}

                {method === "otp" && (
                  <div className="login-fields">
                    <div>
                      <label className="login-label" htmlFor="login-otp-email"><Mail size={17} aria-hidden="true" />{t("Email address")}</label>
                      <div className="login-field">
                        <Mail size={19} aria-hidden="true" />
                        <input id="login-otp-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                          placeholder="alex@restaurant.com" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") void sendOtp(); }}
                          className="flex-1 bg-transparent outline-none" />
                      </div>
                      <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", marginTop: 8 }}>
                        {t("We'll email you a 6-digit code to sign in.")}
                      </p>
                    </div>
                    <button type="button" onClick={sendOtp} disabled={loading}
                      className="w-full login-primary flex items-center justify-center gap-2"
                      style={{ opacity: loading ? 0.7 : 1 }}>
                      {loading ? t("Sending…") : <>{t("Email me a code")} <span className="login-primary-arrow" aria-hidden="true"><ArrowRight size={16} /></span></>}
                    </button>
                  </div>
                )}

                {method === "password" && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={submitPassword}
                    disabled={loading}
                    className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("Sign In")} <span className="login-primary-arrow" aria-hidden="true"><ArrowRight size={16} /></span></>}
                  </motion.button>
                )}

                {(googleEnabled || appleEnabled) && (
                  <>
                    <div className="login-or" aria-hidden="true">{t("or")}</div>

                    <div className="login-socials" data-count={Number(googleEnabled) + Number(appleEnabled)}>
                    {googleEnabled && (
                    /* One visible design for both platforms. On web an invisible
                       Google button is pinned on top (see mountGoogleTrigger);
                       on native this button drives the system picker itself. */
                    <div className="relative w-full">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={native ? submitGoogleNative : googleWebUnavailable}
                        disabled={googleBusy || loading}
                        aria-label={t("Continue with Google")}
                        className="login-social login-social--google w-full flex items-center justify-center gap-3"
                        style={{ opacity: (googleBusy || loading) ? 0.6 : 1 }}
                      >
                        {googleBusy ? (
                          <div className="w-4 h-4 border-2 rounded-full animate-spin"
                               style={{ borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#fff" }} />
                        ) : (
                          <>
                            {/* Google's four-colour G stands on its own on dark buttons. */}
                            <span className="flex items-center justify-center" style={{ width: 22, height: 22, flexShrink: 0 }}>
                              <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
                                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
                                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
                                <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"/>
                                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
                              </svg>
                            </span>
                            <span className="login-social-label">{t("Continue with Google")}</span>
                          </>
                        )}
                      </motion.button>

                      {/* Google's real button, transparent, on top (web only). */}
                      {!native && (
                        <div
                          ref={googleBtnRef}
                          className="absolute inset-0"
                          // Until Google's button is in, let clicks reach ours underneath.
                          style={{ opacity: 0, cursor: "pointer", pointerEvents: webGoogleReady ? "auto" : "none" }}
                        />
                      )}
                    </div>
                    )}

                    {/* Sign in with Apple. Black is one of the three appearances
                        Apple's guidelines allow, and the logo must keep its
                        clear space, so it is not scaled with the label. */}
                    {appleEnabled && (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={submitAppleNative}
                        disabled={googleBusy || loading}
                        aria-label={t("Continue with Apple")}
                        // On the deep indigo, Apple's black button needs its outline.
                        className="login-social login-social--apple w-full flex items-center justify-center gap-3"
                        style={{ opacity: (googleBusy || loading) ? 0.6 : 1 }}
                      >
                        {googleBusy ? (
                          <div className="w-4 h-4 border-2 rounded-full animate-spin"
                               style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                        ) : (
                          <>
                            <svg width="19" height="19" viewBox="0 0 170 170" aria-hidden="true" style={{ flexShrink: 0, marginTop: -3 }}>
                              <path fill="#fff" d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929 0.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925s12.793-5.51 19.948-5.629c3.915 0 9.049 1.211 15.429 3.591 6.362 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002 0.11 10.337 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-0.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-0.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.252 8.99-3.497 13.1-3.71 0.12 1.083 0.17 2.166 0.17 3.241z"/>
                            </svg>
                            <span className="login-social-label">{t("Continue with Apple")}</span>
                          </>
                        )}
                      </motion.button>
                    )}
                    </div>
                  </>
                )}

                <p className="login-trial">
                  {t("New to Cafyz?")}{" "}
                  <button type="button" className="login-link" onClick={() => setAuthState("inquiry")}>{t("Start free trial →")}</button>
                </p>
              </motion.div>
            )}

            {authState === "inquiry" && (
              <motion.div key="inquiry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-3 sm:space-y-4 relative">
                {inquirySubmitting ? (
                  <ActivityLoader
                    label="Sending your trial request…"
                    sublabel="We're notifying our founder and sending you a confirmation email. This usually takes a few seconds."
                  />
                ) : (
                  <>
                <div>
                  <button type="button" onClick={() => goToSignIn()} className="login-back">← Back to sign in</button>
                  <h2 className="text-xl sm:text-[1.6rem]" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)", marginTop: 10 }}>Start your free trial</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", marginTop: 4, lineHeight: 1.5 }}>
                    Request access — no password needed now. Our founder will review your request and email you login credentials once approved. You can sign in later with your email or mobile number.
                  </p>
                </div>
                {[
                  { k: "name" as const, label: "Your name", icon: User, type: "text", ph: "Alex Kumar" },
                  { k: "restaurant" as const, label: "Restaurant name", icon: Store, type: "text", ph: "The Spice Garden" },
                  { k: "email" as const, label: "Work email", icon: Mail, type: "email", ph: "alex@restaurant.com" },
                  { k: "phone" as const, label: "Mobile number", icon: Phone, type: "tel", ph: "+971500000000" },
                ].map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.k}>
                      <label className="login-label">{f.label}</label>
                      <div className="login-field">
                        <Icon size={15} style={{ color: "var(--cafyz-muted)", flexShrink: 0 }} />
                        <input type={f.type} placeholder={f.ph} value={inq[f.k]} onChange={e => setInqField(f.k, e.target.value)}
                          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <label className="login-label">Preferred plan</label>
                  <select value={inq.plan} onChange={e => setInqField("plan", e.target.value)}
                    className="login-box">
                    {(planConfigs.length ? planConfigs : [
                      { plan: "basic", label: "Basic", price_monthly: 0, currency_symbol: "₹", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                      { plan: "pro", label: "Pro", price_monthly: 0, currency_symbol: "₹", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                      { plan: "premium", label: "Premium", price_monthly: 0, currency_symbol: "₹", billing_interval_unit: "month" as const, billing_interval_count: 1 },
                    ] as ApiPlanConfig[]).map(p => (
                      <option key={p.plan} value={p.plan}>
                        {p.label ?? p.plan}{SHOW_PLAN_PRICING && p.price_monthly ? ` — ${formatPlanPrice(p)}${formatBillingSuffix(p)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="login-label">Notes (optional)</label>
                  <textarea value={inq.message} onChange={e => setInqField("message", e.target.value)} rows={3}
                    placeholder="Number of locations, go-live date, etc."
                    className="login-box resize-none" />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={submitInquiry} disabled={inquirySubmitting}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ opacity: inquirySubmitting ? 0.7 : 1 }}>
                  <>Request free trial <ArrowRight size={16} /></>
                </motion.button>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5 }}>
                  You'll receive a confirmation email now. Login credentials are sent after founder approval — use email or mobile with your password to sign in.
                </p>
                  </>
                )}
              </motion.div>
            )}

            {authState === "inquiry-sent" && (
              <motion.div
                key="inquiry-sent"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4 sm:space-y-6"
              >
                <div className="rounded-2xl p-4 sm:p-6 text-center space-y-3 sm:space-y-4"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
                  <div className="flex justify-center">
                    <CheckCircle2 size={44} style={{ color: "#22c55e" }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-[1.35rem]" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)" }}>
                      Trial request received
                    </h2>
                    <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.85rem", marginTop: 10, lineHeight: 1.6 }}>
                      {inquirySentMessage}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--cz-glass)", border: "1px solid var(--cz-line-soft)" }}>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>What happens next</p>
                  {[
                    "Check your inbox for a confirmation email.",
                    "Our founder reviews your request (usually within 24 hours).",
                    "Once approved, you'll get login credentials by email.",
                    "Sign in with your email or mobile number and password.",
                  ].map((step, i) => (
                    <div key={step} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: "rgba(180,68,255,0.16)", color: "var(--cz-violet)" }}>
                        {i + 1}
                      </span>
                      <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem", lineHeight: 1.5 }}>{step}</p>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => goToSignIn(email || inq.email.trim().toLowerCase())}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  
                >
                  Back to sign in <ArrowRight size={16} />
                </motion.button>

                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5 }}>
                  Already approved? Use the credentials from your approval email to sign in above.
                </p>
              </motion.div>
            )}

            {authState === "google-choose" && googleChoice && (
              <motion.div key="google-choose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <button onClick={() => { setAuthState("login"); setGoogleChoice(null); }} className="login-back">← {t("Back")}</button>
                </div>
                <div>
                  <h2 style={{ color: "var(--cafyz-text)", fontSize: "1.15rem", fontWeight: 700 }}>{t("Choose an account")}</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>
                    {googleChoice.provider === "email"
                      ? t("That email is used by more than one restaurant.")
                      : googleChoice.provider === "apple"
                        ? t("That Apple ID's email is used by more than one restaurant.")
                        : t("That Google address is used by more than one restaurant.")}
                  </p>
                </div>
                <div className="space-y-2">
                  {googleChoice.accounts.map((a) => (
                    <button
                      key={a.restaurant_id}
                      onClick={() => chooseGoogleAccount(a.restaurant_id)}
                      disabled={googleBusy}
                      className="w-full px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-start transition-all hover:opacity-90"
                      style={{ background: "var(--cafyz-surface, rgba(255,255,255,0.04))", border: "1px solid var(--cafyz-border, rgba(255,255,255,0.12))", opacity: googleBusy ? 0.6 : 1 }}
                    >
                      <span>
                        <span style={{ color: "var(--cafyz-text)", fontSize: "0.9rem", fontWeight: 600, display: "block" }}>{a.restaurant_name}</span>
                        <span style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>{a.name} · {a.role}</span>
                      </span>
                      <ArrowRight size={16} style={{ color: "var(--cz-violet)", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {authState === "google-signup" && googleSignup && (
              <motion.div key="google-signup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-3 sm:space-y-4">
                <button onClick={() => { setAuthState("login"); setGoogleSignup(null); }} className="login-back">← {t("Back")}</button>
                <div>
                  <h2 className="text-xl sm:text-[1.6rem]" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)" }}>{t("Set up your restaurant")}</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", marginTop: 4, lineHeight: 1.5 }}>
                    {googleSignup.provider === "apple" ? t("Signed in with Apple as") : t("Signed in with Google as")} <b style={{ color: "var(--cafyz-text-secondary)" }}>{googleSignup.email}</b>
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                  <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                    <b style={{ color: "var(--cafyz-text)" }}>{googleSignup.trialDays}-day free trial of Premium</b> — every feature unlocked, no payment needed to start.
                  </p>
                </div>
                {([
                  ["restaurant", "Restaurant name", Store, "e.g. Spice Garden", "text", "organization"],
                  ["name", "Your name", User, "Your full name", "text", "name"],
                  ["phone", "Mobile number", Phone, "+91 98765 43210", "tel", "tel"],
                ] as const).map(([key, label, Icon, placeholder, type, autoComplete]) => (
                  <div key={key}>
                    <label className="login-label">{t(label)}</label>
                    <div className="login-field">
                      <Icon size={15} style={{ color: "var(--cafyz-muted)" }} />
                      <input type={type} autoComplete={autoComplete} placeholder={placeholder} value={signupForm[key]}
                        onChange={e => setSignupForm(f => ({ ...f, [key]: e.target.value }))}
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                    </div>
                  </div>
                ))}
                <motion.button whileTap={{ scale: 0.97 }} onClick={submitGoogleSignup} disabled={googleBusy}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ opacity: googleBusy ? 0.7 : 1 }}>
                  {googleBusy
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <>{t("Start my free trial")} <ArrowRight size={16} /></>}
                </motion.button>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5 }}>
                  {t("When the trial ends, activate a license key from Cafyz to keep going. Your data stays safe.")}
                </p>
              </motion.div>
            )}

            {authState === "otp-verify" && (
              <motion.div key="otp" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} className="login-back">← Back</button>
                  <h2 className="text-xl sm:text-[1.6rem] mt-2" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)" }}>{t("Enter your code")}</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem", marginTop: 4, overflowWrap: "anywhere" }}>{t("Sent to")} {otpEmail}</p>
                </div>
                <div className="flex gap-1.5 sm:gap-2 justify-center">
                  {otp.map((v, i) => (
                    <input key={i} id={`otp-${i}`} type="text" value={v}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      autoComplete={i === 0 ? "one-time-code" : "off"} autoFocus={i === 0}
                      inputMode="numeric" pattern="[0-9]*" aria-label={`Digit ${i + 1}`} data-filled={v ? "true" : "false"} className="login-otp-cell" />
                  ))}
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={submitOtp} disabled={loading}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? t("Verifying…") : <>{t("Verify & Sign In")} <span className="login-primary-arrow" aria-hidden="true"><ArrowRight size={16} /></span></>}
                </motion.button>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", textAlign: "center" }}>
                  {t("Didn't get it? Check spam, or")} <button type="button" onClick={sendOtp} disabled={loading} className="login-link">{t("send a new code")}</button>
                </p>
              </motion.div>
            )}

            {authState === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} className="login-back">← Back to sign in</button>
                  <h2 className="text-xl sm:text-[1.6rem] mt-2" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)" }}>Reset Password</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem", marginTop: 4 }}>We'll send a reset link to your email.</p>
                </div>
                <div>
                  <label className="login-label">Email address</label>
                  <div className="login-field">
                    <Mail size={15} style={{ color: "var(--cafyz-muted)" }} />
                    <input type="email" placeholder="alex@restaurant.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                  </div>
                </div>
                <button onClick={submitForgot} disabled={loading}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Reset Link"}
                </button>
              </motion.div>
            )}

            {authState === "reset" && (
              <motion.div key="reset" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">
                <div>
                  <button onClick={() => setAuthState("login")} className="login-back">← Back to sign in</button>
                  <h2 className="text-xl sm:text-[1.6rem] mt-2" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)" }}>Set a new password</h2>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem", marginTop: 4 }}>Choose a new password for your account.</p>
                </div>
                <div>
                  <label className="login-label">New password</label>
                  <div className="login-field">
                    <Lock size={15} style={{ color: "var(--cafyz-muted)" }} />
                    <input type={showPass ? "text" : "password"} placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                    <button type="button" className="login-reveal" onClick={() => setShowPass(s => !s)} aria-label={showPass ? t("Hide password") : t("Show password")}>
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button onClick={submitReset} disabled={loading}
                  className="w-full login-primary text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Update password <ArrowRight size={16} /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
              </div>
              <footer className="login-footer">
                <p className="login-footer-links">
                  <a href="/privacy">Privacy</a>
                  <span aria-hidden="true">•</span>
                  <a href="/terms">Terms</a>
                  <span aria-hidden="true">•</span>
                  <a href="/support">Support</a>
                </p>
                <AmetronyxCredit className="login-credit" />
                <div className="login-hat" aria-hidden="true"><ChefHat size={26} strokeWidth={1.6} /></div>
              </footer>
            </div>
            <LoginArcs />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
