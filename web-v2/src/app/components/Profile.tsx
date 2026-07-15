import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import {
  Camera, Save, Globe, DollarSign, FileText, MapPin, Phone, Shield, QrCode,
  Download, Link2, Building2, Trash2, Loader2,
  Printer, ReceiptText, ChefHat, RefreshCw, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "./Toast";
import { restaurantApi, publicApi, RESTAURANT_SETTINGS_CHANGED_EVENT, type ApiRestaurant } from "../../services/api";
import {
  uploadRestaurantLogo,
  removeRestaurantLogoEverywhere,
  syncRestaurantLogoCacheAsync,
} from "../../services/restaurantLogoStorage";
import { getCurrencySymbol, resolveCurrencySymbol, setActiveCurrency, symbolForCode } from "../../utils/currency";
import { computeBillTotals } from "../../utils/billTotals";
import { useAuth } from "../auth";
import { canManagePlan } from "../../config/access";
import { PrinterSetupPanel } from "./PrinterSetupPanel";
import {
  autoReconnectBluetooth,
  printKitchenTicket,
  printTest,
  printerStatus,
} from "../../services/PrintService";
import { getPublicMenuIdentifier, getPublicMenuUrl } from "../../config/site";
import { subscribeMenuChanged } from "../../utils/menuEvents";
import { nameInitials } from "../../utils/initials";
import { useThemeMode } from "../ThemeProvider";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "PKR", "BDT", "NGN", "ZAR"];
const LANGUAGES: [string, string][] = [["en", "English"], ["ar", "Arabic"], ["fr", "French"], ["es", "Spanish"], ["de", "German"], ["hi", "Hindi"], ["ur", "Urdu"]];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — matches restaurantLogoStorage

const EMPTY = {
  name: "", tagline: "", email: "", phone: "", website: "", address: "", city: "", state: "", pincode: "",
  country: "", currency: "USD", currencySymbol: "$", language: "en", dateFormat: "DD/MM/YYYY", taxName: "Tax",
  taxRate: "", serviceCharge: "", taxIncluded: false, receiptFooter: "", vatNumber: "",
};

// Defined at module scope (NOT inside Profile) so they keep a stable component
// identity across renders — otherwise every keystroke remounts the input and
// steals focus.
function InputField({ label, value, onChange, type = "text", placeholder = "", disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)] disabled:opacity-60"
        style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
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
      style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}
    >
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
        <Icon size={16} style={{ color: "#1e7fff" }} />
        <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>{title}</h3>
        {subtitle && <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginLeft: "auto" }}>{subtitle}</span>}
      </div>
      {children}
    </motion.div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", manager: "Manager", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen", founder: "Founder",
};

type PrinterAssignment = { role: 'kitchen' | 'cashier'; channel: 'bluetooth' | 'usb'; name: string };

function profileAddressLine(profile: typeof EMPTY): string {
  return [profile.address, profile.city].filter(Boolean).join(", ");
}

function profilePrintTestOpts(profile: typeof EMPTY, logoUrl: string, serverName: string) {
  const subtotal = 19.0;
  const totals = computeBillTotals({
    subtotal,
    serviceRatePct: profile.serviceCharge ? Number(profile.serviceCharge) : 18,
    taxRatePct: profile.taxRate ? Number(profile.taxRate) : 8.75,
    taxIncluded: profile.taxIncluded,
  });
  return {
    restaurantName: profile.name || "Restaurant",
    logoUrl,
    addressLine: profileAddressLine(profile) || undefined,
    phone: profile.phone || undefined,
    taxId: profile.vatNumber || undefined,
    taxLabel: profile.taxName || "Tax",
    taxRate: totals.taxRate,
    taxIncluded: totals.taxIncluded,
    serviceRate: totals.serviceRate,
    subtotal: totals.subtotal,
    service: totals.service,
    tax: totals.tax,
    total: totals.grandTotal,
    currencySymbol: profile.currencySymbol || getCurrencySymbol(profile.currency),
    currencyCode: profile.currency,
    footer: profile.receiptFooter || undefined,
    serverName: serverName || "Staff",
  };
}

export function Profile() {
  const { user } = useAuth();
  const { theme } = useThemeMode();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [profile, setProfile] = useState(EMPTY);

  // Logo (Cloudinary URL stored on the restaurant)
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // QR code — encodes this restaurant's live public menu URL
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuSync, setMenuSync] = useState({
    loading: true,
    valid: false,
    itemCount: 0,
    syncedAt: null as Date | null,
    error: "",
  });

  const menuIdentifier = getPublicMenuIdentifier(slug, restaurantId);

  const generateQr = useCallback(async (identifier: string) => {
    const url = getPublicMenuUrl(identifier);
    if (!url) {
      setQrDataUrl("");
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256, margin: 2,
        color: { dark: theme === "light" ? "#0f172a" : "#06091a", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch { /* non-fatal */ }
  }, [theme]);

  useEffect(() => {
    if (menuIdentifier) void generateQr(menuIdentifier);
  }, [theme, menuIdentifier, generateQr]);

  const refreshMenuLink = useCallback(async (identifier?: string) => {
    const id = identifier || menuIdentifier;
    if (!id) {
      setMenuSync({ loading: false, valid: false, itemCount: 0, syncedAt: null, error: "Restaurant not loaded" });
      return;
    }
    setMenuSync(s => ({ ...s, loading: true, error: "" }));
    try {
      const data = await publicApi.menu(id, { fresh: true });
      await generateQr(id);
      setMenuSync({
        loading: false,
        valid: true,
        itemCount: data.items.length,
        syncedAt: new Date(),
        error: "",
      });
    } catch (e) {
      await generateQr(id);
      setMenuSync({
        loading: false,
        valid: false,
        itemCount: 0,
        syncedAt: null,
        error: (e as Error).message,
      });
    }
  }, [generateQr, menuIdentifier]);

  // QR code — encodes this restaurant's live public menu URL
  const [printBusy, setPrintBusy] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [kitchenPrinter, setKitchenPrinter] = useState<PrinterAssignment | null>(null);
  const [cashierPrinter, setCashierPrinter] = useState<PrinterAssignment | null>(null);
  const [livePrinter, setLivePrinter] = useState(printerStatus());

  const refreshPrinter = useCallback(() => setLivePrinter(printerStatus()), []);

  useEffect(() => {
    const hint = kitchenPrinter?.name || cashierPrinter?.name;
    void autoReconnectBluetooth(hint).catch(() => {}).finally(refreshPrinter);
  }, [kitchenPrinter?.name, cashierPrinter?.name, refreshPrinter]);

  useEffect(() => {
    restaurantApi.me().then(r => {
      const s = r.slug ?? "";
      setRestaurantId(r.id);
      setSlug(s);
      void refreshMenuLink(getPublicMenuIdentifier(s, r.id));
      setLogoUrl(r.logo_url ?? "");
      void syncRestaurantLogoCacheAsync(r);
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
        currencySymbol: resolveCurrencySymbol(r.currency_code, r.currency_symbol),
        language: r.language_code ?? "en",
        dateFormat: r.date_format ?? "DD/MM/YYYY",
        taxName: r.tax_type ?? "Tax",
        taxRate: r.tax_rate_pct != null ? String(r.tax_rate_pct) : "",
        taxIncluded: r.tax_included === 1 || r.tax_included === true,
        serviceCharge: r.service_charge_pct != null ? String(r.service_charge_pct) : "",
        receiptFooter: r.receipt_footer ?? "",
        vatNumber: r.tax_id ?? "",
      });
      setKitchenPrinter(r.kitchen_printer ?? null);
      setCashierPrinter(r.cashier_printer ?? null);
    }).catch(e => toast.error("Couldn't load settings", (e as Error).message));
  }, []);

  useEffect(() => {
    if (!menuIdentifier) return;
    return subscribeMenuChanged(() => { void refreshMenuLink(menuIdentifier); });
  }, [menuIdentifier, refreshMenuLink]);

  useEffect(() => {
    if (!menuIdentifier) return;
    const timer = window.setInterval(() => { void refreshMenuLink(menuIdentifier); }, 30_000);
    return () => window.clearInterval(timer);
  }, [menuIdentifier, refreshMenuLink]);

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
        currency_symbol: resolveCurrencySymbol(profile.currency, profile.currencySymbol),
        language_code: profile.language,
        date_format: profile.dateFormat,
        tax_type: profile.taxName,
        tax_rate_pct: profile.taxRate ? Number(profile.taxRate) : null,
        tax_included: profile.taxIncluded,
        service_charge_pct: profile.serviceCharge ? Number(profile.serviceCharge) : null,
        receipt_footer: profile.receiptFooter,
        tax_id: profile.vatNumber,
      });
      setActiveCurrency(profile.currency, resolveCurrencySymbol(profile.currency, profile.currencySymbol));
      window.dispatchEvent(new Event(RESTAURANT_SETTINGS_CHANGED_EVENT));
      setSaved(true);
      void refreshMenuLink();
      toast.success("Profile saved", "Your restaurant settings have been updated");
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      toast.error("Couldn't save settings", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Logo upload — Cloudinary when configured, else dithered data URL in DB ────
  const onPickLogo = () => fileRef.current?.click();

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user?.restaurant_id) {
      toast.error("Restaurant not loaded", "Wait a moment and try again.");
      return;
    }
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    const imgTypeOk = file.type ? file.type.startsWith("image/") : ['.jpg','.jpeg','.png','.webp','.gif'].includes(ext);
    if (!imgTypeOk) { toast.error("Invalid file", "Please choose an image (PNG, JPG, WebP)."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Image too large", "Logo must be under 2 MB."); return; }
    setUploadingLogo(true);
    try {
      const url = await uploadRestaurantLogo(user.restaurant_id, file);
      setLogoUrl(url);
      void refreshMenuLink();
      const savedLocally = url.startsWith("data:");
      toast.success(
        "Logo updated",
        savedLocally
          ? "Logo saved on this device and will print on receipts."
          : "Your new logo is live on the QR menu and receipts.",
      );
    } catch (err) {
      toast.error("Upload failed", (err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!user?.restaurant_id) return;
    setUploadingLogo(true);
    try {
      await removeRestaurantLogoEverywhere(user.restaurant_id);
      setLogoUrl("");
      void refreshMenuLink();
      toast.success("Logo removed", "");
    } catch (err) {
      toast.error("Couldn't remove logo", (err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRestaurantPrinterUpdate = (r: ApiRestaurant) => {
    setKitchenPrinter(r.kitchen_printer ?? null);
    setCashierPrinter(r.cashier_printer ?? null);
    refreshPrinter();
  };

  const handlePreviewReceipt = async () => {
    setPrintBusy(true);
    try {
      const method = await printTest(
        profilePrintTestOpts(profile, logoUrl, user?.name),
        { channel: "dialog" },
      );
      toast.success(
        "Receipt preview opened",
        method === "dialog" ? "Check layout, logo, tax, and footer in the print dialog." : "",
      );
    } catch (e) {
      toast.error("Preview failed", (e as Error).message);
    } finally {
      setPrintBusy(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!user?.restaurant_id) {
      toast.error("Restaurant not loaded", "Wait a moment and try again.");
      return;
    }
    setPrintBusy(true);
    try {
      const method = await printTest(
        { ...profilePrintTestOpts(profile, logoUrl, user?.name), restaurantId: user.restaurant_id },
        { channel: "auto" },
      );
      refreshPrinter();
      toast.success(
        method === "dialog" ? "Receipt preview opened" : "Test receipt sent",
        method === "dialog"
          ? "No printer connected — showing browser preview."
          : livePrinter.name || cashierPrinter?.name || "Printer",
      );
    } catch (e) {
      toast.error("Print test failed", (e as Error).message);
    } finally {
      setPrintBusy(false);
    }
  };

  const handlePrintKitchen = async () => {
    if (!user?.restaurant_id) {
      toast.error("Restaurant not loaded", "Wait a moment and try again.");
      return;
    }
    setPrintBusy(true);
    try {
      const method = await printKitchenTicket({
        restaurantName: profile.name || "Restaurant",
        logoUrl,
        ticketId: "TEST",
        tableName: "TEST",
        serverName: user?.name || "Staff",
        covers: 2,
        station: "Grill",
        items: [
          { name: "Test burger", qty: 1, mods: ["No onion"], alert: true },
          { name: "Line test item", qty: 1, alert: true },
        ],
        note: "Kitchen printer test — layout and logo check.",
      }, user.restaurant_id, { channel: "auto", allowDialog: true });
      refreshPrinter();
      toast.success(
        method === "dialog" ? "Kitchen preview opened" : "Kitchen test sent",
        method === "dialog"
          ? "No printer connected — showing browser preview."
          : livePrinter.name || kitchenPrinter?.name || "Printer",
      );
    } catch (e) {
      toast.error("Kitchen test failed", (e as Error).message);
    } finally {
      setPrintBusy(false);
    }
  };

  const initials = nameInitials(profile.name, "??");
  const managerUser = canManagePlan(user?.role ?? "");

  if (!managerUser) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] text-center max-w-md mx-auto">
        <Shield size={32} style={{ color: "var(--cafyz-muted)", marginBottom: 12 }} />
        <p style={{ color: "var(--cafyz-text)", fontWeight: 600 }}>Managers only</p>
        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.55 }}>
          Restaurant settings and plan details are managed by owners and managers. Use the profile menu (top right) for your personal account, password, and PIN.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-3xl md:max-w-4xl lg:max-w-5xl w-full mx-auto">
      {/* Scope banner — restaurant + signed-in manager context */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--cafyz-hero-gradient)",
          border: "1px solid var(--cafyz-border-strong)",
          boxShadow: "var(--cafyz-hero-shadow)",
        }}
      >
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{
                background: logoUrl
                  ? `url(${logoUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #1e7fff, #00c6ff)",
                color: logoUrl ? "var(--cafyz-text-strong)" : "var(--cafyz-on-gradient)",
                border: "1px solid rgba(30,127,255,0.25)",
                boxShadow: "0 4px 16px rgba(30,127,255,0.2)",
              }}
            >
              {!logoUrl && initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="truncate"
                  style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", lineHeight: 1.25 }}
                >
                  {profile.name || user?.restaurant_name || "Your restaurant"}
                </h2>
                {user?.plan && canManagePlan(user.role) && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide flex-shrink-0"
                    style={{ background: "var(--cafyz-badge-bg)", color: "var(--cafyz-brand)", border: "1px solid var(--cafyz-accent-border)" }}
                  >
                    {user.plan}
                  </span>
                )}
              </div>
              {profile.tagline ? (
                <p className="truncate mt-0.5" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem" }}>{profile.tagline}</p>
              ) : (
                <p className="flex items-center gap-1.5 mt-0.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>
                  <Building2 size={12} style={{ flexShrink: 0 }} />
                  Restaurant settings & profile
                </p>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl sm:max-w-[280px]"
            style={{ background: "var(--cafyz-hero-inset-bg)", border: "1px solid var(--cafyz-border)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}
            >
              {(user?.name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ color: "var(--cafyz-text)", fontSize: "0.8rem", fontWeight: 600 }}>
                {user?.name || "Account"}
              </p>
              <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>
                {user?.email || "—"}
              </p>
            </div>
            {user?.role && (
              <span
                className="px-2 py-1 rounded-lg text-[0.65rem] font-semibold flex-shrink-0"
                style={{
                  background: user.role === "owner" ? "rgba(168,85,247,0.14)" : "var(--cafyz-badge-bg)",
                  color: user.role === "owner" ? "#a855f7" : "var(--cafyz-brand)",
                  border: `1px solid ${user.role === "owner" ? "rgba(168,85,247,0.25)" : "var(--cafyz-accent-border)"}`,
                }}
              >
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            )}
          </div>
        </div>

        <div
          className="px-4 py-2 sm:px-5 flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{ background: "var(--cafyz-hero-footer-bg)", borderTop: "1px solid var(--cafyz-border)" }}
        >
          <span className="flex items-center gap-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>
            <Shield size={12} style={{ color: "#1e7fff", flexShrink: 0 }} />
            All settings on this page apply only to this restaurant.
          </span>
          {slug && (
            <span className="sm:ml-auto font-mono truncate max-w-full" style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>
              ID · {restaurantId ? `${restaurantId.slice(0, 8)}…` : slug}
            </span>
          )}
        </div>
      </motion.div>

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
                background: logoUrl ? "var(--cafyz-logo-plate-bg)" : "linear-gradient(135deg, #1e7fff, #00c6ff)",
                boxShadow: logoUrl ? "var(--cafyz-shadow-sm)" : "0 0 20px rgba(30,127,255,0.3)",
                border: logoUrl ? "1px solid var(--cafyz-border)" : "none",
                cursor: uploadingLogo ? "wait" : "pointer",
              }}
            >
              {uploadingLogo
                ? <Loader2 size={22} className="animate-spin" style={{ color: "var(--cafyz-text-strong)" }} />
                : logoUrl
                  ? <img src={logoUrl} alt="Restaurant logo" className="w-full h-full object-cover" />
                  : <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--cafyz-text-strong)", fontSize: "1.4rem" }}>{initials}</span>}
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

      {/* Contact */}
      <Section title="Contact Details" icon={Phone} subtitle="Public — shown to customers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Email" value={profile.email} onChange={v => update("email", v)} type="email" />
          <InputField label="Phone" value={profile.phone} onChange={v => update("phone", v)} />
          <div className="sm:col-span-2">
            <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }} className="flex items-center gap-1.5">
              <Link2 size={12} style={{ color: "var(--cafyz-muted)" }} /> Website
            </label>
            <input
              type="text"
              value={profile.website}
              placeholder="https://your-restaurant.com"
              onChange={e => update("website", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)]"
              style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Currency</label>
            <select value={profile.currency} onChange={e => {
              const code = e.target.value;
              setProfile(p => ({ ...p, currency: code, currencySymbol: symbolForCode(code) }));
            }}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <InputField
            label="Currency symbol"
            value={profile.currencySymbol ?? ""}
            onChange={v => update("currencySymbol", v)}
            placeholder="₹"
          />
          <div>
            <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Language</label>
            <select value={profile.language} onChange={e => update("language", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}>
              {LANGUAGES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Date Format</label>
            <select value={profile.dateFormat} onChange={e => update("dateFormat", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}>
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
        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
          <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem", fontWeight: 600 }}>Tax on menu prices</p>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", lineHeight: 1.45 }}>
            {profile.taxIncluded
              ? "Tax included — menu prices already contain tax. Total due stays the same; tax is shown for reference on the bill and receipt."
              : "Tax excluded — tax is calculated on subtotal + service and added to the total due at checkout."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setProfile(p => ({ ...p, taxIncluded: false }))}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: !profile.taxIncluded ? "rgba(30,127,255,0.15)" : "var(--cafyz-badge-bg)",
                color: !profile.taxIncluded ? "#1e7fff" : "var(--cafyz-muted)",
                border: `1px solid ${!profile.taxIncluded ? "rgba(30,127,255,0.35)" : "var(--cafyz-border)"}`,
              }}
            >
              Tax excluded
            </button>
            <button
              type="button"
              onClick={() => setProfile(p => ({ ...p, taxIncluded: true }))}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: profile.taxIncluded ? "rgba(34,197,94,0.12)" : "var(--cafyz-badge-bg)",
                color: profile.taxIncluded ? "#22c55e" : "var(--cafyz-muted)",
                border: `1px solid ${profile.taxIncluded ? "rgba(34,197,94,0.3)" : "var(--cafyz-border)"}`,
              }}
            >
              Tax included
            </button>
          </div>
        </div>
      </Section>

      {/* Receipt */}
      <Section title="Receipt Footer" icon={FileText}>
        <div>
          <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Footer message (printed on receipts)</label>
          <textarea
            value={profile.receiptFooter}
            onChange={e => update("receiptFooter", e.target.value)}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
          />
        </div>
      </Section>

      {/* Receipt & printer test */}
      <Section title="Receipt & Printer Test" icon={Printer} subtitle="Uses current settings — save first to persist changes">
        <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          Print a sample receipt with your logo, address, tax rates, and footer so you can see exactly how it will look on paper.
        </p>
        <div className="rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
          <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>Printer</span>
          <span style={{ color: livePrinter.type === "none" ? "#fbbf24" : "#22c55e", fontSize: "0.78rem", fontWeight: 600 }}>
            {livePrinter.type === "none"
              ? "Not connected — browser preview available"
              : `Connected · ${livePrinter.name} (${livePrinter.type})`}
          </span>
          {(cashierPrinter || kitchenPrinter) && (
            <span style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>
              {cashierPrinter && `Cashier: ${cashierPrinter.name}`}
              {cashierPrinter && kitchenPrinter && " · "}
              {kitchenPrinter && `Kitchen: ${kitchenPrinter.name}`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreviewReceipt}
            disabled={printBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "var(--cafyz-badge-bg)", color: "var(--cafyz-brand)", border: "1px solid var(--cafyz-accent-border)", opacity: printBusy ? 0.6 : 1 }}
          >
            {printBusy ? <Loader2 size={13} className="animate-spin" /> : <ReceiptText size={13} />}
            Browser preview
          </button>
          <button
            type="button"
            onClick={handlePrintReceipt}
            disabled={printBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: printBusy ? 0.6 : 1 }}
          >
            {printBusy ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
            Print test receipt
          </button>
          <button
            type="button"
            onClick={handlePrintKitchen}
            disabled={printBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "var(--cafyz-accent-soft)", color: "var(--cafyz-text-secondary)", border: "1px solid var(--cafyz-border)", opacity: printBusy ? 0.6 : 1 }}
          >
            {printBusy ? <Loader2 size={13} className="animate-spin" /> : <ChefHat size={13} />}
            Print kitchen test
          </button>
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}
          >
            <Printer size={13} /> Configure printers
          </button>
        </div>
      </Section>

      {showPrinterModal && (
        <PrinterSetupPanel
          modal
          onClose={() => { setShowPrinterModal(false); refreshPrinter(); }}
          kitchen={kitchenPrinter?.name ?? null}
          cashier={cashierPrinter?.name ?? null}
          kitchenPrinter={kitchenPrinter}
          cashierPrinter={cashierPrinter}
          onRestaurantUpdate={handleRestaurantPrinterUpdate}
          restaurantName={profile.name}
          restaurantId={user?.restaurant_id}
          logoUrl={logoUrl}
        />
      )}

      {/* QR Menu card — unique per restaurant, live-synced with menu items */}
      <Section title="Customer QR Menu" icon={QrCode} subtitle="Linked to your live menu">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="flex-shrink-0 rounded-2xl p-3 flex items-center justify-center"
            style={{ background: "#fff", width: 140, height: 140 }}>
            {qrDataUrl
              ? <img src={qrDataUrl} alt="QR code for customer menu" className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
              : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin" style={{ color: "#1e7fff" }} />
                </div>
              )}
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <p style={{ color: "var(--cafyz-text)", fontSize: "0.88rem", fontWeight: 600 }}>
                Scan to view your live menu
              </p>
              <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", marginTop: 3 }}>
                This QR code is unique to <span style={{ color: "var(--cafyz-text)" }}>{profile.name || "your restaurant"}</span>.
                Customers see your current items, prices, and photos — updated whenever you edit the menu.
              </p>
            </div>

            <div className="rounded-xl px-3 py-2.5"
              style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
              <div className="flex flex-wrap items-center gap-2">
                {menuSync.loading ? (
                  <span className="flex items-center gap-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>
                    <Loader2 size={12} className="animate-spin" /> Checking menu…
                  </span>
                ) : menuSync.valid ? (
                  <span className="flex items-center gap-1.5" style={{ color: "#22c55e", fontSize: "0.75rem", fontWeight: 600 }}>
                    <CheckCircle2 size={13} /> Valid · {menuSync.itemCount} item{menuSync.itemCount === 1 ? "" : "s"} live
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5" style={{ color: "#fbbf24", fontSize: "0.75rem", fontWeight: 600 }}>
                    <AlertCircle size={13} /> {menuSync.error || "Menu unavailable"}
                  </span>
                )}
                {menuSync.syncedAt && !menuSync.loading && (
                  <span style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>
                    Synced {menuSync.syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void refreshMenuLink()}
                  disabled={!menuIdentifier || menuSync.loading}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: "rgba(30,127,255,0.12)",
                    color: "#1e7fff",
                    border: "1px solid rgba(30,127,255,0.2)",
                    opacity: !menuIdentifier || menuSync.loading ? 0.5 : 1,
                  }}
                >
                  <RefreshCw size={12} className={menuSync.loading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  if (!qrDataUrl) return;
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = `${slug || restaurantId || "menu"}-qr.png`;
                  a.click();
                }}
                disabled={!qrDataUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "var(--cafyz-badge-bg)", color: "var(--cafyz-brand)", border: "1px solid var(--cafyz-accent-border)", opacity: qrDataUrl ? 1 : 0.5 }}>
                <Download size={12} /> Download PNG
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
