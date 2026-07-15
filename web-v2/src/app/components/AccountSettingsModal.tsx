import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, User, Lock, KeyRound, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "./Toast";
import { authApi } from "../../services/api";
import { storageSet } from "../../utils/safeStorage";
import { useAuth } from "../auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

type Tab = "profile" | "password" | "pin";

function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)] disabled:opacity-60"
        style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
      />
    </div>
  );
}

export function AccountSettingsModal({ open, onClose, onUpdated }: Props) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteRestaurant, setDeleteRestaurant] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setPw({ current: "", next: "", confirm: "" });
    setPin({ current: "", next: "", confirm: "" });
    setDeletePw("");
    setDeleteRestaurant(false);
    setLoading(true);
    authApi.me()
      .then(u => setProfile({
        name: u.name ?? "",
        email: u.email ?? "",
        phone: u.phone ?? "",
        role: u.role ?? "",
      }))
      .catch(e => toast.error("Couldn't load account", (e as Error).message))
      .finally(() => setLoading(false));
  }, [open]);

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
      setProfile({
        name: updated.name,
        email: updated.email,
        phone: updated.phone ?? "",
        role: updated.role,
      });
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

  const deleteAccount = async () => {
    if (!deletePw) {
      toast.error("Password required", "Enter your password to confirm deletion.");
      return;
    }
    if (isOwner && !deleteRestaurant) {
      toast.error("Confirmation required", "Owners must check the box to delete the entire restaurant.");
      return;
    }
    setDeleting(true);
    try {
      const res = await authApi.deleteAccount(deletePw, isOwner ? true : false);
      toast.success("Account deleted", res.message);
      onClose();
      logout();
    } catch (e) {
      toast.error("Couldn't delete account", (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (typeof document === "undefined") return null;

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "pin", label: "PIN", icon: KeyRound },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "var(--cafyz-overlay)" }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
            style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border-strong)", boxShadow: "var(--cafyz-shadow-lg)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
              <div>
                <h2 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}>Account Settings</h2>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>Your personal login & security</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--cafyz-surface-hover)]" aria-label="Close">
                <X size={18} style={{ color: "var(--cafyz-muted)" }} />
              </button>
            </div>

            <div className="flex gap-1 px-3 pt-3">
              {tabs.map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: active ? "rgba(30,127,255,0.12)" : "transparent",
                      color: active ? "#1e7fff" : "var(--cafyz-muted)",
                      border: active ? "1px solid rgba(30,127,255,0.2)" : "1px solid transparent",
                    }}
                  >
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin" style={{ color: "#1e7fff" }} /></div>
              ) : tab === "profile" ? (
                <>
                  <Field label="Full name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Your name" />
                  <Field label="Login email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} type="email" placeholder="you@restaurant.com" />
                  <Field label="Mobile" value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+971500000000" />
                  <Field label="Role" value={profile.role} onChange={() => {}} disabled />
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", lineHeight: 1.45 }}>
                    Role changes are managed by your restaurant owner or manager from Roles & Access.
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={savingProfile}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: savingProfile ? 0.7 : 1 }}
                  >
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </>
              ) : tab === "password" ? (
                <>
                  <Field label="Current password" value={pw.current} onChange={v => setPw(p => ({ ...p, current: v }))} type="password" />
                  <Field label="New password" value={pw.next} onChange={v => setPw(p => ({ ...p, next: v }))} type="password" placeholder="Min 8 characters" />
                  <Field label="Confirm new password" value={pw.confirm} onChange={v => setPw(p => ({ ...p, confirm: v }))} type="password" />
                  <button
                    type="button"
                    onClick={() => void savePassword()}
                    disabled={savingPw || !pw.current || !pw.next}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", opacity: (savingPw || !pw.current || !pw.next) ? 0.5 : 1 }}
                  >
                    {savingPw ? "Updating…" : "Update password"}
                  </button>
                  <div className="rounded-xl p-3 mt-2" style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
                    <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", marginBottom: 8 }}>Forgot your password?</p>
                    <button
                      type="button"
                      onClick={() => void sendForgotPassword()}
                      disabled={sendingReset}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--cafyz-subtle-bg)", color: "var(--cafyz-brand)", border: "1px solid var(--cafyz-accent-border)" }}
                    >
                      {sendingReset ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      {sendingReset ? "Sending…" : "Email me a reset link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Current PIN" value={pin.current} onChange={v => setPin(p => ({ ...p, current: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
                  <Field label="New PIN" value={pin.next} onChange={v => setPin(p => ({ ...p, next: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
                  <Field label="Confirm new PIN" value={pin.confirm} onChange={v => setPin(p => ({ ...p, confirm: v.replace(/\D/g, "").slice(0, 4) }))} type="password" placeholder="4 digits" />
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", lineHeight: 1.45 }}>
                    PIN is used for quick login on this device. Your manager can reset access from Roles & Access at any time.
                  </p>
                  <button
                    type="button"
                    onClick={() => void savePin()}
                    disabled={savingPin || pin.current.length !== 4 || pin.next.length !== 4}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", opacity: (savingPin || pin.current.length !== 4 || pin.next.length !== 4) ? 0.5 : 1 }}
                  >
                    {savingPin ? "Updating…" : "Update PIN"}
                  </button>
                </>
              )}
            </div>

            {canDeleteAccount && (
              <div className="px-4 pb-4 border-t pt-4 space-y-3" style={{ borderColor: "var(--cafyz-border)" }}>
                <div className="flex items-center gap-2">
                  <Trash2 size={15} style={{ color: "#ff3b5c" }} />
                  <h3 style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: "0.85rem" }}>Delete account</h3>
                </div>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
                  {isOwner
                    ? "Permanently deletes your restaurant, all staff accounts, orders, and menu data. This cannot be undone."
                    : "Permanently removes your personal login. Your manager can invite you again later if needed."}
                </p>
                {isOwner && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteRestaurant}
                      onChange={e => setDeleteRestaurant(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.72rem", lineHeight: 1.45 }}>
                      I understand this will delete my entire restaurant and all associated data.
                    </span>
                  </label>
                )}
                <Field
                  label="Confirm with password"
                  value={deletePw}
                  onChange={setDeletePw}
                  type="password"
                  placeholder="Your current password"
                />
                <button
                  type="button"
                  onClick={() => void deleteAccount()}
                  disabled={deleting || !deletePw || (isOwner && !deleteRestaurant)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "rgba(255,59,92,0.1)",
                    color: "#ff3b5c",
                    border: "1px solid rgba(255,59,92,0.25)",
                    opacity: (deleting || !deletePw || (isOwner && !deleteRestaurant)) ? 0.5 : 1,
                  }}
                >
                  {deleting ? "Deleting…" : isOwner ? "Delete restaurant & account" : "Delete my account"}
                </button>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem", lineHeight: 1.45 }}>
                  See our <a href="/privacy" style={{ color: "#1e7fff" }}>Privacy Policy</a> and <a href="/support" style={{ color: "#1e7fff" }}>Support</a> page.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
