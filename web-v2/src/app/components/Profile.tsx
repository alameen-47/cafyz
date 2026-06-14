import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Camera, Save, Globe, DollarSign, FileText, MapPin, Phone, Shield, QrCode,
  Download, ExternalLink, User, Lock, Link2, Building2, Trash2, Loader2,
} from "lucide-react";
import { toast } from "./Toast";
import { restaurantApi, authApi } from "../../services/api";
import { setActiveCurrencyCode } from "../../utils/currency";
import { useAuth } from "../auth";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "PKR", "BDT", "NGN", "ZAR"];
const LANGUAGES: [string, string][] = [["en", "English"], ["ar", "Arabic"], ["fr", "French"], ["es", "Spanish"], ["de", "German"], ["hi", "Hindi"], ["ur", "Urdu"]];
const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4 MB

const EMPTY = {
  name: "", tagline: "", email: "", phone: "", website: "", address: "", city: "", state: "", pincode: "",
  country: "", currency: "USD", language: "en", dateFormat: "DD/MM/YYYY", taxName: "Tax",
  taxRate: "", serviceCharge: "", receiptFooter: "", vatNumber: "",
};

// Defined at module scope (NOT inside Profile) so they keep a stable component
// identity across renders — otherwise every keystroke remounts the input and
// steals focus.
function InputField({ label, value, onChange, type = "text", placeholder = "", disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[#6b82a0] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)] disabled:opacity-60"
        style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}
      />
    </div>
  );
}

function Section({ title, icon: Icon, children, subtitle }: { title: string; icon: React.ElementType; children: React.ReactNode; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}
    >
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(30,127,255,0.08)" }}>
        <Icon size={16} style={{ color: "#1e7fff" }} />
        <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>{title}</h3>
        {subtitle && <span style={{ color: "#6b82a0", fontSize: "0.72rem", marginLeft: "auto" }}>{subtitle}</span>}
      </div>
      {children}
    </motion.div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", manager: "Manager", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen", founder: "Founder",
};

export function Profile() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [profile, setProfile] = useState(EMPTY);

  // Logo (Cloudinary URL stored on the restaurant)
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manager / owner account (the logged-in user) — scoped to this restaurant.
  const [account, setAccount] = useState({ name: "", email: "", phone: "", role: "" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    restaurantApi.me().then(r => {
      setSlug(r.slug ?? "");
      setLogoUrl(r.logo_url ?? "");
      setProfile({
        name: r.name ?? "",
        tagline: r.tagline ?? "",
        email: r.contact_email ?? "",
        phone: r.contact_phone ?? "",
        website: r.website_url ?? "",
        address: r.address_line1 ?? "",
        city: r.city ?? "",
        state: r.address_line2 ?? "",
        pincode: r.postal_code ?? "",
        country: r.country ?? "",
        currency: r.currency_code ?? "USD",
        language: r.language_code ?? "en",
        dateFormat: r.date_format ?? "DD/MM/YYYY",
        taxName: r.tax_type ?? "Tax",
        taxRate: r.tax_rate_pct != null ? String(r.tax_rate_pct) : "",
        serviceCharge: r.service_charge_pct != null ? String(r.service_charge_pct) : "",
        receiptFooter: r.receipt_footer ?? "",
        vatNumber: r.tax_id ?? "",
      });
    }).catch(e => toast.error("Couldn't load settings", (e as Error).message));

    authApi.me().then(u => {
      setAccount({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "", role: u.role ?? "" });
    }).catch(e => toast.error("Couldn't load your account", (e as Error).message));
  }, []);

  const update = (key: string, val: string) => setProfile(p => ({ ...p, [key]: val }));

  // ── Restaurant settings (scoped to restaurant_id on the server) ──────────────
  const handleSave = async () => {
    setBusy(true);
    try {
      await restaurantApi.update({
        name: profile.name,
        tagline: profile.tagline,
        logo_url: logoUrl,
        contact_email: profile.email,
        contact_phone: profile.phone,
        website_url: profile.website,
        address_line1: profile.address,
        address_line2: profile.state,
        city: profile.city,
        postal_code: profile.pincode,
        country: profile.country,
        currency_code: profile.currency,
        language_code: profile.language,
        date_format: profile.dateFormat,
        tax_type: profile.taxName,
        tax_rate_pct: profile.taxRate ? Number(profile.taxRate) : null,
        service_charge_pct: profile.serviceCharge ? Number(profile.serviceCharge) : null,
        receipt_footer: profile.receiptFooter,
        tax_id: profile.vatNumber,
      });
      setActiveCurrencyCode(profile.currency);
      setSaved(true);
      toast.success("Profile saved", "Your restaurant settings have been updated");
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      toast.error("Couldn't save settings", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Logo upload (Cloudinary) — persists immediately so it shows on QR menu ────
  const onPickLogo = () => fileRef.current?.click();

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Invalid file", "Please choose an image (PNG, JPG, WebP)."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Image too large", "Logo must be under 4 MB."); return; }
    setUploadingLogo(true);
    try {
      const { url } = await restaurantApi.uploadLogo(file);
      await restaurantApi.update({ logo_url: url });
      setLogoUrl(url);
      toast.success("Logo updated", "Your new logo is live on the QR menu.");
    } catch (err) {
      toast.error("Upload failed", (err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      await restaurantApi.update({ logo_url: "" });
      setLogoUrl("");
      toast.success("Logo removed", "");
    } catch (err) {
      toast.error("Couldn't remove logo", (err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Manager account (the logged-in user) ─────────────────────────────────────
  const handleSaveAccount = async () => {
    if (!account.name.trim() || !account.email.trim()) {
      toast.error("Name and email are required", "");
      return;
    }
    setSavingAccount(true);
    try {
      const updated = await authApi.updateProfile({
        name: account.name.trim(),
        email: account.email.trim().toLowerCase(),
        phone: account.phone.trim(),
      });
      setAccount({ name: updated.name, email: updated.email, phone: updated.phone ?? "", role: updated.role });
      // Keep the cached session in sync so the sidebar avatar/name refresh on reload.
      try {
        const stored = localStorage.getItem("cafyz_user");
        if (stored) {
          const u = JSON.parse(stored);
          u.name = updated.name; u.email = updated.email; u.initials = updated.initials || u.initials;
          localStorage.setItem("cafyz_user", JSON.stringify(u));
        }
      } catch { /* non-fatal */ }
      toast.success("Account updated", "Your manager details have been saved.");
    } catch (e) {
      toast.error("Couldn't update account", (e as Error).message);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
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

  const initials = (profile.name || "??").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-3xl w-full">
      {/* Scope banner — makes it explicit this profile belongs to one restaurant + manager */}
      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
        style={{ background: "rgba(30,127,255,0.06)", border: "1px solid rgba(30,127,255,0.14)" }}>
        <div className="flex items-center gap-2">
          <Building2 size={15} style={{ color: "#1e7fff" }} />
          <span style={{ color: "#e8eef8", fontSize: "0.85rem", fontWeight: 600 }}>{user?.restaurant_name || profile.name || "Your restaurant"}</span>
        </div>
        <span style={{ color: "#6b82a0", fontSize: "0.78rem" }}>
          Managed by <span style={{ color: "#a8bdd4" }}>{account.email || user?.email || "—"}</span>
          {account.role && <> · {ROLE_LABEL[account.role] ?? account.role}</>}
        </span>
        <span className="ml-auto" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>
          All data on this page is scoped to this restaurant.
        </span>
      </div>

      {/* Brand section */}
      <Section title="Brand Identity" icon={Shield}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
        <div className="flex items-start gap-4">
          {/* Logo upload */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={onPickLogo}
              disabled={uploadingLogo}
              className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{
                background: logoUrl ? "#0a1024" : "linear-gradient(135deg, #1e7fff, #00c6ff)",
                boxShadow: "0 0 20px rgba(30,127,255,0.3)",
                border: logoUrl ? "1px solid rgba(30,127,255,0.2)" : "none",
                cursor: uploadingLogo ? "wait" : "pointer",
              }}
            >
              {uploadingLogo
                ? <Loader2 size={22} className="animate-spin" style={{ color: "#fff" }} />
                : logoUrl
                  ? <img src={logoUrl} alt="Restaurant logo" className="w-full h-full object-cover" />
                  : <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.4rem" }}>{initials}</span>}
            </button>
            <button
              type="button"
              onClick={onPickLogo}
              disabled={uploadingLogo}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "#1e7fff", boxShadow: "0 2px 8px rgba(30,127,255,0.4)" }}
            >
              <Camera size={13} className="text-white" />
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <InputField label="Restaurant Name" value={profile.name} onChange={v => update("name", v)} placeholder="The Spice Garden" />
            <InputField label="Tagline" value={profile.tagline} onChange={v => update("tagline", v)} placeholder="A short brand tagline (shown on your QR menu)" />
            {logoUrl && (
              <button onClick={handleRemoveLogo} disabled={uploadingLogo}
                className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#f87171" }}>
                <Trash2 size={12} /> Remove logo
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* Manager account (the logged-in user) */}
      <Section title="Manager Account" icon={User} subtitle="Your login & identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Full Name" value={account.name} onChange={v => setAccount(a => ({ ...a, name: v }))} placeholder="Your name" />
          <InputField label="Login Email" value={account.email} onChange={v => setAccount(a => ({ ...a, email: v }))} type="email" placeholder="you@restaurant.com" />
          <InputField label="Phone" value={account.phone} onChange={v => setAccount(a => ({ ...a, phone: v }))} placeholder="+971500000000" />
          <InputField label="Role" value={ROLE_LABEL[account.role] ?? account.role} onChange={() => {}} disabled />
        </div>
        <button
          onClick={handleSaveAccount}
          disabled={savingAccount}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", opacity: savingAccount ? 0.6 : 1 }}
        >
          {savingAccount ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save account
        </button>
      </Section>

      {/* Security */}
      <Section title="Security" icon={Lock} subtitle="Change password">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField label="Current Password" value={pw.current} onChange={v => setPw(p => ({ ...p, current: v }))} type="password" />
          <InputField label="New Password" value={pw.next} onChange={v => setPw(p => ({ ...p, next: v }))} type="password" placeholder="Min 8 characters" />
          <InputField label="Confirm New Password" value={pw.confirm} onChange={v => setPw(p => ({ ...p, confirm: v }))} type="password" />
        </div>
        <button
          onClick={handleChangePassword}
          disabled={savingPw || !pw.current || !pw.next}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", opacity: (savingPw || !pw.current || !pw.next) ? 0.5 : 1 }}
        >
          {savingPw ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Update password
        </button>
      </Section>

      {/* Contact */}
      <Section title="Contact Details" icon={Phone} subtitle="Public — shown to customers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Email" value={profile.email} onChange={v => update("email", v)} type="email" />
          <InputField label="Phone" value={profile.phone} onChange={v => update("phone", v)} />
          <div className="sm:col-span-2">
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }} className="flex items-center gap-1.5">
              <Link2 size={12} style={{ color: "#6b82a0" }} /> Website
            </label>
            <input
              type="text"
              value={profile.website}
              placeholder="https://your-restaurant.com"
              onChange={e => update("website", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[#6b82a0] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)]"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}
            />
          </div>
        </div>
      </Section>

      {/* Address */}
      <Section title="Address" icon={MapPin}>
        <InputField label="Street Address" value={profile.address} onChange={v => update("address", v)} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="City" value={profile.city} onChange={v => update("city", v)} />
          <InputField label="State" value={profile.state} onChange={v => update("state", v)} />
          <InputField label="PIN Code" value={profile.pincode} onChange={v => update("pincode", v)} />
          <InputField label="Country" value={profile.country} onChange={v => update("country", v)} />
        </div>
      </Section>

      {/* Localisation */}
      <Section title="Localisation" icon={Globe}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Currency</label>
            <select value={profile.currency} onChange={e => update("currency", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Language</label>
            <select value={profile.language} onChange={e => update("language", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {LANGUAGES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Date Format</label>
            <select value={profile.dateFormat} onChange={e => update("dateFormat", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Tax */}
      <Section title="Tax & Charges" icon={DollarSign}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="Tax Name" value={profile.taxName} onChange={v => update("taxName", v)} placeholder="GST / VAT" />
          <InputField label="Tax Rate (%)" value={profile.taxRate} onChange={v => update("taxRate", v)} type="number" />
          <InputField label="Service Charge (%)" value={profile.serviceCharge} onChange={v => update("serviceCharge", v)} type="number" />
          <InputField label="Tax/VAT Number" value={profile.vatNumber} onChange={v => update("vatNumber", v)} />
        </div>
      </Section>

      {/* Receipt */}
      <Section title="Receipt Footer" icon={FileText}>
        <div>
          <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Footer message (printed on receipts)</label>
          <textarea
            value={profile.receiptFooter}
            onChange={e => update("receiptFooter", e.target.value)}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}
          />
        </div>
      </Section>

      {/* QR Menu card */}
      <Section title="Customer QR Menu" icon={QrCode}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#fff" }}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              : (
                <div className="grid grid-cols-3 gap-0.5">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-4 h-4 rounded-sm" style={{ background: [0,2,6,8].includes(i) ? "#06091a" : i === 4 ? "#1e7fff" : "rgba(6,9,26,0.3)" }} />
                  ))}
                </div>
              )}
          </div>
          <div className="flex-1 space-y-2">
            <p style={{ color: "#a8bdd4", fontSize: "0.82rem" }}>
              Share your digital menu with customers via QR code.
            </p>
            <p style={{ color: "#6b82a0", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
              {`${window.location.host}/m/${slug || "your-restaurant"}`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => slug && window.open(`/m/${slug}`, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(30,127,255,0.1)", color: "#1e7fff" }}>
                <Download size={12} /> Download
              </button>
              <button onClick={() => slug && window.open(`/m/${slug}`, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(30,127,255,0.06)", color: "#6b82a0" }}>
                <ExternalLink size={12} /> Open
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={busy}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: saved ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, #1e7fff, #00c6ff)", color: saved ? "#22c55e" : "#fff", border: saved ? "1px solid rgba(34,197,94,0.3)" : "none", opacity: busy ? 0.6 : 1 }}
      >
        <Save size={16} /> {saved ? "Saved!" : busy ? "Saving…" : "Save Changes"}
      </motion.button>
    </div>
  );
}
