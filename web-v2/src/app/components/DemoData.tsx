import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  FlaskConical, Sparkles, X, ArrowRight, ShoppingCart, ChefHat, LayoutGrid, BarChart3, Loader2,
  UtensilsCrossed, Receipt, CalendarDays, Package, Users, Settings2, CheckCircle2,
} from "lucide-react";
import { demoApi, DEMO_DATA_CHANGED_EVENT, type ApiDemoStatus } from "../../services/api";
import { notifyMenuChanged } from "../../utils/menuEvents";
import { ConfirmModal } from "./ConfirmModal";
import { toast } from "./Toast";

const BRAND_GRADIENT = "linear-gradient(135deg, #1e7fff, #00c6ff)";
const AMBER = "#f59e0b";

function publishDemoStatus(status: ApiDemoStatus) {
  window.dispatchEvent(new CustomEvent(DEMO_DATA_CHANGED_EVENT, { detail: status }));
}

/** Loads the restaurant's demo-data state and keeps it in sync with the Settings toggle. */
export function useDemoStatus(active: boolean, userId?: string) {
  const [status, setStatus] = useState<ApiDemoStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!active) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await demoApi.status());
    } catch {
      setStatus(null);
    }
  }, [active]);

  useEffect(() => { void refresh(); }, [refresh, userId]);

  useEffect(() => {
    const onChange = (e: Event) => setStatus((e as CustomEvent<ApiDemoStatus>).detail ?? null);
    window.addEventListener(DEMO_DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DEMO_DATA_CHANGED_EVENT, onChange);
  }, []);

  const dismissIntro = useCallback(() => {
    if (!status || status.intro_seen) return;
    setStatus({ ...status, intro_seen: true });
    demoApi.dismissIntro().catch(() => {});
  }, [status]);

  return { status, dismissIntro };
}

// ── First-login welcome popup ──────────────────────────────────────────────────

const TOUR = [
  { page: "pos", icon: ShoppingCart, title: "Take an order", body: "Open POS, pick a table and send dishes to the kitchen." },
  { page: "kds", icon: ChefHat, title: "Follow the kitchen", body: "Watch tickets move from New → Prep → Ready." },
  { page: "tables", icon: LayoutGrid, title: "Run the floor", body: "See busy tables, who's paying and tonight's bookings." },
  { page: "analytics", icon: BarChart3, title: "Read your reports", body: "30 days of sample sales to explore every chart." },
];

interface DemoWelcomeModalProps {
  restaurantName: string;
  canManage: boolean;
  onNavigate: (page: string) => void;
  onClose: () => void;
}

export function DemoWelcomeModal({ restaurantName, canManage, onNavigate, onClose }: DemoWelcomeModalProps) {
  const go = (page: string) => {
    onClose();
    onNavigate(page);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-welcome-title"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl"
        style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border-strong)", boxShadow: "var(--cafyz-shadow-lg)" }}
      >
        <div className="relative px-5 pt-6 pb-5 sm:px-6" style={{ background: "var(--cafyz-hero-gradient)", borderBottom: "1px solid var(--cafyz-border)" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg transition-all hover:bg-[rgba(30,127,255,0.08)]"
            style={{ color: "var(--cafyz-muted)" }}
          >
            <X size={16} />
          </button>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: BRAND_GRADIENT, boxShadow: "0 8px 24px rgba(30,127,255,0.35)" }}
          >
            <Sparkles size={22} color="#fff" />
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide"
            style={{ background: "rgba(245,158,11,0.14)", color: AMBER, border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <FlaskConical size={11} /> Demo data
          </span>
          <h2
            id="demo-welcome-title"
            className="mt-2"
            style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.25 }}
          >
            Welcome to {restaurantName || "Cafyz"} 👋
          </h2>
          <p className="mt-1.5" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.85rem", lineHeight: 1.55 }}>
            We've filled your restaurant with <b>sample data</b> — menu, tables, orders, staff, bookings and stock — so you can
            see how everything works before adding your own. None of it is real.
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6 space-y-4">
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Try these first
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TOUR.map(({ page, icon: Icon, title, body }) => (
              <button
                key={page}
                type="button"
                onClick={() => go(page)}
                className="group text-left rounded-2xl p-3 transition-all hover:-translate-y-0.5"
                style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(30,127,255,0.12)" }}>
                    <Icon size={15} color="#1e7fff" />
                  </span>
                  <span style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.85rem" }}>{title}</span>
                  <ArrowRight size={14} color="#1e7fff" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                </div>
                <p className="mt-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", lineHeight: 1.45 }}>{body}</p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl p-3.5 flex gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Settings2 size={18} color={AMBER} className="flex-shrink-0 mt-0.5" />
            <div>
              <p style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.83rem" }}>Ready to add your real data?</p>
              <p className="mt-1" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.77rem", lineHeight: 1.5 }}>
                {canManage ? (
                  <>Go to <b>Settings → Restaurant → Demo Data</b> and switch it off. All sample data disappears in one tap — then add your own menu, tables and staff.</>
                ) : (
                  <>When the restaurant is ready to go live, your owner or manager will switch off demo data from Settings.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
            {canManage && (
              <button
                type="button"
                onClick={() => go("profile")}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:bg-[rgba(30,127,255,0.08)]"
                style={{ color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
              >
                Show me the switch
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: "0 6px 18px rgba(30,127,255,0.3)" }}
            >
              Start exploring <ArrowRight size={15} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Slim reminder shown on every screen while demo data is on ────────────────────

interface DemoBannerProps {
  canManage: boolean;
  onOpenGuide: () => void;
  onManage: () => void;
  onDismiss: () => void;
}

export function DemoBanner({ canManage, onOpenGuide, onManage, onDismiss }: DemoBannerProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 flex-shrink-0"
      style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.14), rgba(30,127,255,0.08))", borderBottom: "1px solid rgba(245,158,11,0.22)" }}
    >
      <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.16)" }}>
        <FlaskConical size={13} color={AMBER} />
      </span>
      <button type="button" onClick={onOpenGuide} className="flex-1 min-w-0 text-left truncate" style={{ color: "var(--cafyz-text)", fontSize: "0.78rem" }}>
        <b>Demo mode</b>
        <span style={{ color: "var(--cafyz-text-secondary)" }}>
          {" "}— you're exploring sample data.{" "}
          <span className="hidden lg:inline">Switch it off when you're ready to add your own.</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenGuide}
        className="hidden sm:inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all hover:bg-[rgba(30,127,255,0.08)]"
        style={{ color: "var(--cafyz-text-secondary)" }}
      >
        How it works
      </button>
      {canManage && (
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all hover:opacity-90"
          style={{ background: "rgba(245,158,11,0.16)", color: AMBER, border: "1px solid rgba(245,158,11,0.3)" }}
        >
          Turn off demo <ArrowRight size={12} className="rtl:rotate-180" />
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide demo banner"
        className="p-1 rounded-lg flex-shrink-0 transition-all hover:bg-[rgba(30,127,255,0.08)]"
        style={{ color: "var(--cafyz-muted)" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Settings → Restaurant → Demo Data ───────────────────────────────────────────

const COUNT_LABELS: { key: keyof ApiDemoStatus["counts"]; label: string; icon: React.ElementType }[] = [
  { key: "menu_items", label: "menu items", icon: UtensilsCrossed },
  { key: "tables", label: "tables", icon: LayoutGrid },
  { key: "orders", label: "orders", icon: Receipt },
  { key: "reservations", label: "bookings", icon: CalendarDays },
  { key: "inventory", label: "stock items", icon: Package },
  { key: "staff", label: "staff", icon: Users },
];

const STEPS = [
  { title: "Explore", body: "Take orders in POS, follow tickets in the Kitchen and check Reports." },
  { title: "Switch off", body: "When you're ready, turn this off — all sample data is removed in one tap." },
  { title: "Go live", body: "Add your real menu, tables and staff. Your own data is never touched." },
];

function DemoSwitch({ on, busy, disabled, onToggle }: { on: boolean; busy: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Show demo data"
      disabled={busy || disabled}
      onClick={onToggle}
      className="relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(30,127,255,0.5)]"
      style={{ background: on ? BRAND_GRADIENT : "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(24px)" : "translateX(3px)" }}
      >
        {busy && <Loader2 size={12} color="#1e7fff" className="animate-spin" />}
      </span>
    </button>
  );
}

export function DemoDataPanel() {
  const [status, setStatus] = useState<ApiDemoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    demoApi.status().then(setStatus).catch(() => setStatus(null)).finally(() => setLoaded(true));
  }, []);

  const apply = async (enabled: boolean) => {
    setConfirmOff(false);
    setBusy(true);
    try {
      const next = await demoApi.setEnabled(enabled);
      setStatus(next);
      publishDemoStatus(next);
      notifyMenuChanged();
      if (enabled) toast.success("Demo data is back", "Sample menu, tables, orders and reports are loaded again.");
      else toast.success("Demo data removed", "Your restaurant is clean — start adding your real menu, tables and staff.");
    } catch {
      // The API client already shows the error toast.
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    // Hold the panel's space while loading so the settings page doesn't jump when it appears.
    return loaded ? null : (
      <div
        aria-hidden
        className="rounded-2xl h-[132px] animate-pulse"
        style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}
      />
    );
  }

  const on = status.enabled;
  const counts = COUNT_LABELS.filter(c => status.counts[c.key] > 0);

  return (
    <>
      <motion.div
        id="demo-data"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--cafyz-surface)", border: `1px solid ${on ? "rgba(245,158,11,0.35)" : "var(--cafyz-border)"}` }}
      >
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
          <FlaskConical size={16} style={{ color: on ? AMBER : "#1e7fff" }} />
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>Demo Data</h3>
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-[0.65rem] font-semibold"
            style={on
              ? { background: "rgba(245,158,11,0.14)", color: AMBER, border: "1px solid rgba(245,158,11,0.3)" }
              : { background: "var(--cafyz-surface-2)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}
          >
            {on ? "ON · sample data visible" : "OFF"}
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.9rem" }}>Show demo data</p>
            <p className="mt-1" style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", lineHeight: 1.55 }}>
              {on
                ? "Sample data fills your screens so you can try every feature safely. Switch it off when you're ready to go live — it's removed instantly and your own data stays untouched."
                : "Demo data is hidden. Switch it on anytime to reload the sample restaurant and explore the app again."}
            </p>
            {!status.can_manage && (
              <p className="mt-1" style={{ color: AMBER, fontSize: "0.75rem" }}>Only owners and managers can change this.</p>
            )}
          </div>
          <DemoSwitch
            on={on}
            busy={busy}
            disabled={!status.can_manage}
            onToggle={() => (on ? setConfirmOff(true) : void apply(true))}
          />
        </div>

        {on && counts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {counts.map(({ key, label, icon: Icon }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)", color: "var(--cafyz-text-secondary)", fontSize: "0.75rem" }}
              >
                <Icon size={13} color="#1e7fff" />
                <b style={{ color: "var(--cafyz-text)" }}>{status.counts[key]}</b> {label}
              </span>
            ))}
          </div>
        )}

        {on ? (
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl p-3" style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0"
                    style={{ background: BRAND_GRADIENT, color: "#fff" }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.82rem" }}>{step.title}</span>
                </div>
                <p className="mt-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.74rem", lineHeight: 1.45 }}>{step.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <CheckCircle2 size={16} color="#22c55e" className="flex-shrink-0" />
            <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", lineHeight: 1.5 }}>
              You're set up for real data. Add your menu, tables and staff from the sidebar.
            </p>
          </div>
        )}
      </motion.div>

      <ConfirmModal
        open={confirmOff}
        title="Remove demo data?"
        message="All sample menu items, tables, orders, bookings, stock and demo staff will be removed — including any orders you placed while exploring. Everything you added yourself stays. You can switch demo data back on anytime."
        confirmLabel="Remove demo data"
        cancelLabel="Keep exploring"
        onConfirm={() => void apply(false)}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  );
}
