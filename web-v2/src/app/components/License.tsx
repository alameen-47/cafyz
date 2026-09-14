import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { Shield, Check, X, Key, Zap, Crown, ArrowRight, Clock } from "lucide-react";
import { toast } from "./Toast";
import { licensesApi, billingApi, loadRazorpayCheckout, type ApiSubscriptionStatus, type ApiLicensePurchaseRequest } from "../../services/api";
import { useAuth } from "../auth";
import { usePlanConfig } from "../PlanConfigProvider";
import { formatBillingSuffix, formatPlanPrice, isLifetimePlan, panelLabelsFromConfig } from "../../services/planConfigStore";

const PLAN_STYLE: Record<string, { color: string; icon: typeof Shield; popular?: boolean }> = {
  basic: { color: "var(--cafyz-muted)", icon: Shield },
  pro: { color: "#1e7fff", icon: Zap, popular: true },
  premium: { color: "#a855f7", icon: Crown },
};

// Only used if the plan config cannot be fetched. Every plan ships every
// module — the plans differ by licence term and support window, not features.
const ALL_MODULES = [
  "Point of Sale", "Menu Management", "Tables & Floor", "Kitchen Display (KDS)",
  "Manager Dashboard", "Inventory", "Staff Management", "Analytics & Reports",
  "Roles & Access", "Reservations", "License & Billing",
];
const FALLBACK_FEATURES: Record<string, { features: string[]; locked: string[] }> = {
  basic:   { features: ALL_MODULES, locked: [] },
  pro:     { features: ALL_MODULES, locked: [] },
  premium: { features: ALL_MODULES, locked: [] },
};

const KEY_STEPS = [
  { title: "Request a key", body: "Tap “Request license key” or choose a plan below" },
  { title: "Get it by email", body: "Cafyz sends the key to the owner's email" },
  { title: "Activate it here", body: "Paste the key below — your plan starts right away" },
];

export function License() {
  const { user } = useAuth();
  const { plans: planConfigs } = usePlanConfig();
  const [status, setStatus] = useState<ApiSubscriptionStatus | null>(null);
  const [pendingReq, setPendingReq] = useState<ApiLicensePurchaseRequest | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await licensesApi.mine()); } catch { /* keep last */ }
    try {
      const reqs = await licensesApi.myPurchaseRequests();
      setPendingReq(reqs.find(r => r.status === "pending") ?? null);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Ask the founder to issue a license key — they get an email, then fulfill it
  // from the founder panel (the key is emailed back and activated below). Data is kept.
  const requestRenewal = async (plan: string) => {
    if (pendingReq) { toast.info("Key already requested", "Cafyz will email your license key shortly"); return; }
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan });
      toast.success("License key requested", "Cafyz will email your key. Enter it below when it arrives.");
      await load();
    } catch (e) {
      toast.error("Couldn't send request", (e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  // Online payments are off until Razorpay KYC clears (server decides, via
  // /api/licenses/mine). While off, purchasing emails the founder, who fulfils
  // from the founder panel — the same path a paid Razorpay order ends up in.
  const onlinePayments = status?.online_payments === true;
  const startPurchase = (plan: string) => (onlinePayments ? payWithCard(plan) : requestRenewal(plan));
  const busy = requesting || paying;

  const currentPlan = status?.plan ?? user?.plan ?? "basic";
  const trialDaysLeft = status?.trial_days_left ?? null;
  const onTrial = status?.on_trial === true;
  const expired = status?.trial_expired === true;

  const plans = useMemo(() => {
    const ids = ["basic", "pro", "premium"];
    return ids.map(id => {
      const cfg = planConfigs.find(p => p.plan === id);
      const style = PLAN_STYLE[id] ?? PLAN_STYLE.basic;
      const fallback = FALLBACK_FEATURES[id] ?? { features: [], locked: [] };
      const panelFeatures = cfg ? panelLabelsFromConfig(cfg) : [];
      return {
        id,
        name: cfg?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
        priceLabel: cfg ? formatPlanPrice(cfg) : "—",
        period: cfg ? formatBillingSuffix(cfg).replace(/^\//, "").trim() : "mo",
        lifetime: cfg ? isLifetimePlan(cfg) : false,
        description: cfg?.description ?? "",
        color: style.color,
        icon: style.icon,
        popular: style.popular,
        features: panelFeatures.length ? panelFeatures : fallback.features,
        locked: panelFeatures.length ? [] : fallback.locked,
      };
    });
  }, [planConfigs]);

  const planDef = plans.find(p => p.id === currentPlan) ?? plans[0];
  const PlanIcon = planDef.icon;
  const expiresAt = status?.license?.expires_at ?? null;
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;
  const renewLabel = onTrial
    ? (expired ? `Free trial ended ${expiryDate}` : `Free trial · ends ${expiryDate}`)
    : expiresAt
      ? (expired ? `License ended ${expiryDate}` : `License valid until ${expiryDate}`)
      : "Lifetime license · never expires";
  const statusChip = expired
    ? { label: "Ended", color: "#ff3b5c" }
    : onTrial
      ? { label: "Free trial", color: "#f59e0b" }
      : { label: "Active", color: "#22c55e" };
  const showStatusBanner = trialDaysLeft != null && (expired || onTrial || trialDaysLeft <= 14);

  const activate = async () => {
    if (!licenseKey) return;
    setActivating(true);
    try {
      const res = await licensesApi.activate(licenseKey.trim());
      setActivated(true);
      setLicenseKey("");
      toast.success("License activated!", `Your ${String(res.plan).toUpperCase()} plan is now active`);
      await load();
      setTimeout(() => setActivated(false), 2500);
    } catch (e) {
      toast.error("Activation failed", (e as Error).message);
    } finally {
      setActivating(false);
    }
  };

  // Pay with card/UPI via Razorpay; falls back to the email-renewal flow if the
  // server doesn't have online payments enabled yet.
  const payWithCard = async (plan: string) => {
    if (pendingReq) { toast.info("Key already requested", "Cafyz will email your license key shortly"); return; }
    setPaying(true);
    try {
      const order = await billingApi.createOrder(plan);
      const ready = await loadRazorpayCheckout();
      if (!ready) { toast.error("Couldn't load checkout", "Check your connection and try again."); return; }

      type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
      type RzpInstance = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
      type RzpCtor = new (options: Record<string, unknown>) => RzpInstance;
      const Razorpay = (window as unknown as { Razorpay: RzpCtor }).Razorpay;

      const rzp = new Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        theme: { color: "#1e7fff" },
        handler: async (resp: RzpResponse) => {
          try {
            const res = await billingApi.verify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("Payment successful!", `Your ${res.plan.toUpperCase()} plan is now active.`);
            await load();
          } catch (e) {
            toast.error("Payment verification failed", (e as Error).message);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on("payment.failed", (r) => {
        toast.error("Payment failed", r?.error?.description ?? "Please try again.");
      });
      rzp.open();
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/not enabled|BILLING_DISABLED|contact support/i.test(msg)) {
        // Online payments not configured on the server — use the email flow instead.
        await requestRenewal(plan);
      } else {
        toast.error("Couldn't start checkout", msg);
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl w-full mx-auto">
      {/* Trial / licence status — free trial countdown, a licence nearing its end, or one that ended */}
      {showStatusBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: expired ? "var(--cafyz-danger-bg)" : "var(--cafyz-accent-bg)", border: `1px solid ${expired ? "rgba(220,38,38,0.22)" : "var(--cafyz-accent-border)"}` }}
        >
          <Clock size={18} style={{ color: expired ? "#ff3b5c" : "#1e7fff", flexShrink: 0 }} />
          <div className="flex-1 min-w-[200px]">
            <p style={{ color: "var(--cafyz-text)", fontSize: "0.85rem", fontWeight: 600 }}>
              {expired
                ? <>Your {onTrial ? "free trial" : "license"} has <span style={{ color: "#ff3b5c", fontWeight: 800 }}>ended</span></>
                : onTrial
                  ? (trialDaysLeft === 0
                    ? <>Your free trial ends <span style={{ color: "#1e7fff", fontWeight: 800 }}>today</span></>
                    : <>Free trial · <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800 }}>{trialDaysLeft}</span> day{trialDaysLeft === 1 ? "" : "s"} left</>)
                  : <>License renews in <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800 }}>{trialDaysLeft}</span> day{trialDaysLeft === 1 ? "" : "s"}</>}
            </p>
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>
              {pendingReq
                ? "Key requested — Cafyz will email it to you. Enter it below when it arrives."
                : expired
                  ? "Your data is safe. Request a license key, then activate it below to continue."
                  : "Request a license key from Cafyz before it ends, then activate it below."}
            </p>
          </div>
          {pendingReq ? (
            <span className="text-xs px-3 py-2 rounded-xl flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 600 }}>Key requested</span>
          ) : (
            <button onClick={() => startPurchase(currentPlan)} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
              {paying ? "Opening…" : requesting ? "Requesting…" : onlinePayments ? "Pay & renew" : "Request license key"}
            </button>
          )}
        </motion.div>
      )}

      {/* License key activation — the one step that turns a trial into a subscription */}
      <div id="license-key" className="rounded-2xl p-5 space-y-4" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-accent-border)" }}>
        <div className="flex items-center gap-2">
          <Key size={16} style={{ color: "#1e7fff" }} />
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Activate your license key</h3>
        </div>
        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
          License keys are issued by Cafyz. Your plan starts the moment you activate it and replaces the free trial.
        </p>
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {KEY_STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "var(--cafyz-surface-2)", border: "1px solid var(--cafyz-border)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>{i + 1}</span>
              <span>
                <span style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.8rem", display: "block" }}>{step.title}</span>
                <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", lineHeight: 1.4 }}>
                  {i === 0 && pendingReq ? "Requested — your key is on its way" : step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="CAFYZ-XXX-XXXXXXXX"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") void activate(); }}
            className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
            style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.15)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={activate}
            disabled={!licenseKey || activating}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 flex-shrink-0"
            style={activated
              ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
              : { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: !licenseKey ? 0.5 : 1 }
            }
          >
            {activating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : activated ? <><Check size={15} /> Activated!</> : "Activate"}
          </motion.button>
        </div>
      </div>

      {/* Current plan */}
      <div className="rounded-2xl p-5" style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.15)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Current Plan</h3>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${statusChip.color}1f`, color: statusChip.color }}>{statusChip.label}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${planDef.color}1f` }}>
            <PlanIcon size={22} style={{ color: planDef.color }} />
          </div>
          <div>
            <p style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>
              {planDef.name} Plan{onTrial ? " (trial)" : ""}
            </p>
            {planDef.description && <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>{planDef.description}</p>}
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>{renewLabel}</p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 6 }}>Choose a plan</h3>
        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem", marginBottom: 16 }}>
          Every plan includes all modules. Plans differ only by licence length and how long
          maintenance and support are included.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            // While on a trial or after a licence ends, every plan can be requested — including the trial's.
            const isActive = plan.id === currentPlan && !onTrial && !expired;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl p-5 relative overflow-hidden flex flex-col"
                style={{
                  background: isActive ? `${plan.color}08` : "var(--cafyz-surface)",
                  border: `1px solid ${isActive ? plan.color + "35" : "var(--cafyz-border)"}`,
                  boxShadow: isActive ? `0 0 24px ${plan.color}12` : "none",
                }}
              >
                {"popular" in plan && plan.popular && (
                  <div className="absolute top-3 right-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(30,127,255,0.15)", color: "#1e7fff" }}>
                      ★ Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                    <Icon size={18} style={{ color: plan.color }} />
                  </div>
                  <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>{plan.name}</span>
                </div>
                <div className="mb-4">
                  <span style={{ color: plan.color, fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1.6rem" }}>{plan.priceLabel}</span>
                  <span style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>{plan.lifetime ? plan.period : `/${plan.period}`}</span>
                </div>
                {plan.description && (
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginBottom: 10 }}>{plan.description}</p>
                )}
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={12} style={{ color: plan.color, flexShrink: 0 }} />
                      <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem" }}>{f}</span>
                    </li>
                  ))}
                  {plan.locked.map(f => (
                    <li key={f} className="flex items-center gap-2 opacity-40">
                      <X size={12} style={{ color: "var(--cafyz-muted)", flexShrink: 0 }} />
                      <span style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { if (!isActive) startPurchase(plan.id); }}
                  disabled={isActive || busy || !!pendingReq}
                  className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={isActive
                    ? { background: `${plan.color}12`, color: plan.color, border: `1px solid ${plan.color}25` }
                    : { background: `${plan.color}10`, color: plan.color, border: `1px solid ${plan.color}20`, opacity: (requesting || paying || pendingReq) ? 0.6 : 1 }
                  }
                >
                  {isActive ? "Current plan" : pendingReq ? "Key requested" : paying ? "Opening…" : requesting ? "Requesting…" : <>{onlinePayments ? "Subscribe to" : "Get"} {plan.name} <ArrowRight size={14} /></>}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
        Maintenance and support cover the Cafyz software only. Hardware — including
        Bluetooth and thermal printers, tablets, and other devices — is not covered.
      </p>
    </div>
  );
}
