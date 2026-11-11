import { useEffect, useState } from "react";
import {
  User, UserRound, Lock, KeyRound, Loader2, Mail, ShieldCheck, ChevronRight, Trash2, CalendarClock, LogOut,
  Palette, Check, ArrowLeft,
} from "lucide-react";
import { toast } from "./Toast";
import { HScroll } from "./HScroll";
import { authApi } from "../../services/api";
import { storageSet } from "../../utils/safeStorage";
import { useAuth } from "../auth";
import { THEME_OPTIONS, useThemeMode, type ThemeOption } from "../ThemeProvider";

interface Props {
  /** Back to the screen the person came from. */
  onClose: () => void;
  onUpdated?: () => void;
  initialTab?: Tab;
}

type Tab = "profile" | "appearance" | "password" | "pin" | "privacy";
type PrivacyStep = "overview" | "confirm";

/** Mirrors ACCOUNT_DELETION_GRACE_DAYS on the server. */
const DELETION_GRACE_DAYS = 7;

function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <label className="block">
      <span className="cafyz-field-label">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="cafyz-field"
      />
      {hint && <span className="cafyz-field-hint">{hint}</span>}
    </label>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** A small drawing of the app in a theme's own colours. */
function ThemePreview({ option }: { option: ThemeOption }) {
  const p = option.preview;
  const accent = `linear-gradient(135deg, ${p.from}, ${p.to})`;
  return (
    <span className="cafyz-theme-preview" aria-hidden style={{ background: p.bg }}>
      <span className="cafyz-theme-preview-rail" style={{ background: p.card }}>
        <i style={{ background: accent }} />
        <i style={{ background: p.muted, opacity: 0.35 }} />
        <i style={{ background: p.muted, opacity: 0.35 }} />
      </span>
      <span className="cafyz-theme-preview-main">
        <span className="cafyz-theme-preview-title" style={{ background: p.text }} />
        <span className="cafyz-theme-preview-row">
          <b style={{ background: p.card }}><i style={{ background: accent }} /></b>
          <b style={{ background: p.card }}><i style={{ background: p.muted, opacity: 0.5 }} /></b>
        </span>
        <span className="cafyz-theme-preview-btn" style={{ background: accent }} />
      </span>
    </span>
  );
}

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4">
      <h3 style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem" }}>{title}</h3>
      <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", lineHeight: 1.5, marginTop: 2 }}>{text}</p>
    </div>
  );
}

export function AccountScreen({ onClose, onUpdated, initialTab = "profile" }: Props) {
  const { themeId, setThemeId } = useThemeMode();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [privacyStep, setPrivacyStep] = useState<PrivacyStep>("overview");
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);
  const [passwordLogin, setPasswordLogin] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setLoading(true);
    authApi.me()
      .then(u => {
        setProfile({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "", role: u.role ?? "" });
        setDeletionScheduledAt(u.deletion_scheduled_at ?? null);
        setPasswordLogin(u.password_login !== 0);
      })
      .catch(e => toast.error("Couldn't load account", (e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const syncSession = (name: string, email: string, initials?: string) => {
    try {
      if (!user) return;
      const next = { ...user, name, email, initials: initials ?? user.initials };
      storageSet("cafyz_user", JSON.stringify(next));
      onUpdated?.();
    } catch { /* non-fatal */ }
  };

  const saveProfile = async () => {
    if (!profile.name.trim() || !profile.email.trim()) {
      toast.error("Name and email are required", "");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
        phone: profile.phone.trim(),
      });
      setProfile({ name: updated.name, email: updated.email, phone: updated.phone ?? "", role: updated.role });
      syncSession(updated.name, updated.email, updated.initials);
      toast.success("Profile saved", "Your details have been updated.");
    } catch (e) {
      toast.error("Couldn't save profile", (e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (pw.next.length < 8) { toast.error("Password too short", "Use at least 8 characters."); return; }
    if (pw.next !== pw.confirm) { toast.error("Passwords don't match", ""); return; }
    setSavingPw(true);
    try {
      await authApi.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed", "Use your new password next time you sign in.");
    } catch (e) {
      toast.error("Couldn't change password", (e as Error).message);
    } finally {
      setSavingPw(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin.next)) { toast.error("Invalid PIN", "PIN must be exactly 4 digits."); return; }
    if (pin.next !== pin.confirm) { toast.error("PINs don't match", ""); return; }
    setSavingPin(true);
    try {
      await authApi.changePin(pin.current, pin.next);
      setPin({ current: "", next: "", confirm: "" });
      toast.success("PIN updated", "Use your new PIN on this device.");
    } catch (e) {
      toast.error("Couldn't change PIN", (e as Error).message);
    } finally {
      setSavingPin(false);
    }
  };

  const sendForgotPassword = async () => {
    const email = profile.email.trim().toLowerCase();
    if (!email) { toast.error("Email required", "Add your login email under Profile first."); return; }
    setSendingReset(true);
    try {
      const res = await authApi.forgotPassword(email);
      toast.success("Reset email sent", res.message || "Check your inbox for a password reset link.");
    } catch (e) {
      toast.error("Couldn't send reset email", (e as Error).message);
    } finally {
      setSendingReset(false);
    }
  };

  const isOwner = profile.role === "owner";
  const canDeleteAccount = profile.role !== "founder";
  const deleteReady = deleteConfirm.trim().toUpperCase() === "DELETE" && (!passwordLogin || deletePw.length > 0);

  const scheduleDeletion = async () => {
    if (!deleteReady) return;
    setDeleting(true);
    try {
      const res = await authApi.deleteAccount({ confirm: "DELETE", ...(passwordLogin ? { password: deletePw } : {}) });
      toast.success("Account deletion scheduled", res.message);
      // Signed out so that signing in again is a deliberate "keep my account".
      logout();
    } catch {
      // The API client already shows the error.
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeletion = async () => {
    setCancelling(true);
    try {
      const res = await authApi.cancelAccountDeletion();
      setDeletionScheduledAt(null);
      toast.success("Your account is staying", res.message);
    } catch {
      // The API client already shows the error.
    } finally {
      setCancelling(false);
    }
  };

  const sections: { id: Tab; label: string; hint: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", hint: "Name, email and mobile", icon: User },
    { id: "appearance", label: "Appearance", hint: "Choose a theme", icon: Palette },
    { id: "password", label: "Password", hint: "Change or reset it", icon: Lock },
    { id: "pin", label: "PIN", hint: "Quick sign-in on this device", icon: KeyRound },
    ...(canDeleteAccount ? [{ id: "privacy" as Tab, label: "Privacy & data", hint: "Your data and account", icon: ShieldCheck }] : []),
  ];
  const currentTheme = THEME_OPTIONS.find(o => o.id === themeId) ?? THEME_OPTIONS[0];
  const openSection = (id: Tab) => { setTab(id); if (id === "privacy") setPrivacyStep("overview"); };

  return (
    <div className="cafyz-account p-3 sm:p-4 md:p-6 max-w-6xl mx-auto w-full space-y-4">
      {/* Who is signed in */}
      <section className="cafyz-account-hero">
        <button type="button" onClick={onClose} aria-label="Back" className="cafyz-topbar-btn flex-shrink-0">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <span className="cafyz-account-avatar" aria-hidden><UserRound size={28} strokeWidth={1.8} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="truncate" style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            {profile.name || user?.name || "Your account"}
          </h2>
          <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.82rem" }}>{profile.email || user?.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {(profile.role || user?.role) && (
              <span className="cafyz-chip is-brand" style={{ textTransform: "capitalize" }}>{profile.role || user?.role}</span>
            )}
            {user?.restaurant_name && <span className="cafyz-chip">{user.restaurant_name}</span>}
            <span className="cafyz-chip">{currentTheme.name}</span>
          </div>
        </div>
        <div className="hidden sm:block flex-shrink-0">
          <button type="button" onClick={logout} className="cafyz-pill-btn">
            <LogOut size={15} className="rtl:rotate-180" /> Sign out
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] gap-4 items-start">
        {/* Sections: a row of pills on phones, a list on larger screens */}
        <nav aria-label="Account sections">
          <div className="md:hidden">
          <HScroll className="gap-2 pb-1">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} type="button" onClick={() => openSection(s.id)}
                  aria-current={tab === s.id ? "page" : undefined}
                  className={`cafyz-shortcut flex-shrink-0 ${tab === s.id ? "is-primary" : ""}`}>
                  <Icon size={17} strokeWidth={1.9} style={{ flexShrink: 0 }} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </HScroll>
          </div>
          <div className="hidden md:block cafyz-dash-card p-2 space-y-1">
            {sections.map(s => {
              const Icon = s.icon;
              const active = tab === s.id;
              return (
                <button key={s.id} type="button" onClick={() => openSection(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`cafyz-nav-item px-2 ${active ? "is-active" : ""}`}>
                  <span className="cafyz-nav-icon"><Icon size={17} strokeWidth={1.75} /></span>
                  <span className="flex-1 min-w-0 text-start">
                    <span className="cafyz-nav-label block truncate">{s.label}</span>
                    <span className="block truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", fontWeight: 400 }}>{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="cafyz-dash-card p-4 sm:p-5 min-w-0">
          {tab === "appearance" ? (
            <>
              <SectionHeading title="Appearance" text="Pick a theme. It changes every screen straight away and is remembered on this device." />
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {THEME_OPTIONS.map(option => {
                  const selected = option.id === themeId;
                  return (
                    <button key={option.id} type="button" role="radio" aria-checked={selected}
                      onClick={() => setThemeId(option.id)}
                      className={`cafyz-theme-card ${selected ? "is-selected" : ""}`}>
                      <ThemePreview option={option} />
                      <span className="flex items-start gap-2 w-full">
                        <span className="flex-1 min-w-0 text-start">
                          <span className="block" style={{ color: "var(--cafyz-text-strong)", fontWeight: 700, fontSize: "0.9rem" }}>{option.name}</span>
                          <span className="block" style={{ color: "var(--cafyz-muted)", fontSize: "0.74rem", lineHeight: 1.45 }}>{option.description}</span>
                        </span>
                        <span className="cafyz-theme-check" aria-hidden>{selected && <Check size={13} strokeWidth={3} />}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : loading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: "var(--cafyz-brand)" }} /></div>
          ) : tab === "profile" ? (
            <>
              <SectionHeading title="Profile" text="Your personal sign-in details." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field label="Full name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Your name" />
                <Field label="Login email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} type="email" placeholder="you@restaurant.com" />
                <Field label="Mobile" value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+91 98765 43210" />
                <Field label="Role" value={profile.role} onChange={() => {}} disabled
                  hint="Role changes are managed by your restaurant owner or manager from Roles & Access." />
              </div>
              <div className="cafyz-account-actions">
                <button type="button" onClick={() => void saveProfile()} disabled={savingProfile}
                  className="cafyz-btn-primary cafyz-btn" style={{ opacity: savingProfile ? 0.7 : 1 }}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
              </div>
            </>
          ) : tab === "password" ? (
            <>
              <SectionHeading title="Password" text="Use at least 8 characters." />
              <div className="grid grid-cols-1 gap-3.5 max-w-md">
                <Field label="Current password" value={pw.current} onChange={v => setPw(p => ({ ...p, current: v }))} type="password" />
                <Field label="New password" value={pw.next} onChange={v => setPw(p => ({ ...p, next: v }))} type="password" placeholder="Min 8 characters" />
                <Field label="Confirm new password" value={pw.confirm} onChange={v => setPw(p => ({ ...p, confirm: v }))} type="password" />
              </div>
              <div className="cafyz-account-actions">
                <button type="button" onClick={() => void savePassword()} disabled={savingPw || !pw.current || !pw.next}
                  className="cafyz-btn-primary cafyz-btn" style={{ opacity: (savingPw || !pw.current || !pw.next) ? 0.5 : 1 }}>
                  {savingPw ? "Updating…" : "Update password"}
                </button>
              </div>
              <div className="cafyz-account-note mt-5 max-w-md">
                <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.8rem", marginBottom: 10 }}>
                  {passwordLogin ? "Forgot your password?" : "You sign in with Google. Want a password too?"}
                </p>
                <button type="button" onClick={() => void sendForgotPassword()} disabled={sendingReset}
                  className="cafyz-btn-secondary cafyz-btn w-full">
                  {sendingReset ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {sendingReset ? "Sending…" : passwordLogin ? "Email me a reset link" : "Email me a link to set one"}
                </button>
              </div>
            </>
          ) : tab === "pin" ? (
            <>
              <SectionHeading title="PIN" text="A 4-digit PIN for quick sign-in on this device. Your manager can reset access from Roles & Access at any time." />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-xl">
                <Field label="Current PIN" value={pin.current} onChange={v => setPin(p => ({ ...p, current: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
                <Field label="New PIN" value={pin.next} onChange={v => setPin(p => ({ ...p, next: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
                <Field label="Confirm new PIN" value={pin.confirm} onChange={v => setPin(p => ({ ...p, confirm: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
              </div>
              <div className="cafyz-account-actions">
                <button type="button" onClick={() => void savePin()} disabled={savingPin || pin.current.length !== 4 || pin.next.length !== 4}
                  className="cafyz-btn-primary cafyz-btn" style={{ opacity: (savingPin || pin.current.length !== 4 || pin.next.length !== 4) ? 0.5 : 1 }}>
                  {savingPin ? "Updating…" : "Update PIN"}
                </button>
              </div>
            </>
          ) : privacyStep === "overview" ? (
            <>
              <SectionHeading title="Privacy & data" text="Your data and your account." />
              <div className="space-y-3 max-w-2xl">
                <div className="cafyz-account-note flex gap-3">
                  <ShieldCheck size={18} color="var(--cafyz-success)" className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.86rem" }}>Your data stays private to your restaurant</p>
                    <p style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem", lineHeight: 1.5, marginTop: 3 }}>
                      Only people your restaurant adds can see it. Read our{" "}
                      <a href="/privacy" style={{ color: "var(--cafyz-brand)" }}>Privacy Policy</a> or <a href="/support" style={{ color: "var(--cafyz-brand)" }}>contact support</a>.
                    </p>
                  </div>
                </div>

                {deletionScheduledAt ? (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--cafyz-warning-bg)", border: "1px solid rgba(255,170,0,0.3)" }}>
                    <div className="flex gap-3">
                      <CalendarClock size={18} color="var(--cafyz-warning)" className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.86rem" }}>Deletion scheduled for {formatDay(deletionScheduledAt)}</p>
                        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem", lineHeight: 1.5, marginTop: 3 }}>
                          {isOwner ? "Your restaurant and all its data" : "Your login"} will be permanently deleted on that day.
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => void cancelDeletion()} disabled={cancelling}
                      className="cafyz-btn-primary cafyz-btn w-full" style={{ opacity: cancelling ? 0.7 : 1 }}>
                      {cancelling ? "Keeping your account…" : "Keep my account"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPrivacyStep("confirm")}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-start hover:bg-[var(--cafyz-surface-hover)]"
                    style={{ border: "1px solid var(--cafyz-border)" }}>
                    <span className="flex items-center gap-3">
                      <Trash2 size={16} color="var(--cafyz-danger)" />
                      <span>
                        <span style={{ color: "var(--cafyz-text)", fontSize: "0.86rem", fontWeight: 600, display: "block" }}>Delete account</span>
                        <span style={{ color: "var(--cafyz-muted)", fontSize: "0.76rem" }}>
                          {isOwner ? "Remove your restaurant and all its data" : "Remove your personal login"}
                        </span>
                      </span>
                    </span>
                    <ChevronRight size={16} className="rtl:rotate-180" style={{ color: "var(--cafyz-muted)" }} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <SectionHeading title="Delete your account?"
                text={`Please read this first. Once the ${DELETION_GRACE_DAYS} days are up it can't be undone.`} />
              <div className="space-y-3 max-w-2xl">
                <ul className="rounded-2xl p-4 space-y-1.5" style={{ background: "var(--cafyz-danger-bg)", border: "1px solid rgba(255,65,108,0.24)" }}>
                  {(isOwner
                    ? ["Your restaurant, menu, tables, orders and reports are deleted", "Every staff login for this restaurant stops working", "Sales history and reports can't be recovered"]
                    : ["Your personal login is removed", "Your restaurant's data stays with your owner or manager"]
                  ).map(line => (
                    <li key={line} className="flex gap-2" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.8rem", lineHeight: 1.45 }}>
                      <span style={{ color: "var(--cafyz-danger)" }}>•</span>{line}
                    </li>
                  ))}
                </ul>

                <div className="cafyz-account-note flex gap-2.5">
                  <CalendarClock size={16} color="var(--cafyz-brand)" className="flex-shrink-0 mt-0.5" />
                  <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                    <b style={{ color: "var(--cafyz-text)" }}>Nothing is deleted for {DELETION_GRACE_DAYS} days.</b> Change your mind? Just sign in again before then and your account stays.
                  </p>
                </div>

                <div className="cafyz-account-note flex items-center gap-2.5">
                  <LogOut size={16} style={{ color: "var(--cafyz-muted)", flexShrink: 0 }} />
                  <p className="flex-1" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.8rem", lineHeight: 1.45 }}>
                    Just need a break? Sign out instead. Nothing is deleted.
                  </p>
                  <button type="button" onClick={logout} className="cafyz-btn-secondary cafyz-btn flex-shrink-0">Sign out</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label='Type "DELETE" to confirm' value={deleteConfirm} onChange={setDeleteConfirm} placeholder="DELETE" />
                  {passwordLogin && (
                    <Field label="Your password" value={deletePw} onChange={setDeletePw} type="password" placeholder="Current password" />
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <button type="button" onClick={() => setPrivacyStep("overview")} className="cafyz-btn-primary cafyz-btn flex-1">
                    Keep my account
                  </button>
                  <button type="button" onClick={() => void scheduleDeletion()} disabled={!deleteReady || deleting}
                    className="cafyz-btn-danger cafyz-btn flex-1" style={{ opacity: (!deleteReady || deleting) ? 0.5 : 1 }}>
                    {deleting ? "Scheduling…" : `Delete in ${DELETION_GRACE_DAYS} days`}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="sm:hidden">
        <button type="button" onClick={logout} className="cafyz-btn-secondary cafyz-btn w-full">
          <LogOut size={15} className="rtl:rotate-180" /> Sign out
        </button>
      </div>
    </div>
  );
}
