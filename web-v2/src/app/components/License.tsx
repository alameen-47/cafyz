import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { Shield, Check, X, Key, Zap, Crown, ArrowRight, Clock } from "lucide-react";
import { toast } from "./Toast";
import { licensesApi, type ApiSubscriptionStatus, type ApiLicensePurchaseRequest } from "../../services/api";
import { useAuth } from "../auth";
import { usePlanConfig } from "../PlanConfigProvider";
import { formatBillingSuffix, formatPlanPrice, panelLabelsFromConfig } from "../../services/planConfigStore";

const PLAN_STYLE: Record<string, { color: string; icon: typeof Shield; popular?: boolean }> = {
  basic: { color: "var(--cafyz-muted)", icon: Shield },
  pro: { color: "#1e7fff", icon: Zap, popular: true },
  premium: { color: "#a855f7", icon: Crown },
};

const FALLBACK_FEATURES: Record<string, { features: string[]; locked: string[] }> = {
  basic: {
    features: ["POS & Tables", "Menu Management", "Staff Management", "Email Support"],
    locked: ["KDS", "Analytics", "Inventory", "Reservations"],
  },
  pro: {
    features: ["Full POS & KDS", "Menu & Inventory", "Analytics & Reports", "Staff & Roles", "Priority Support"],
    locked: ["Multi-branch", "Reservations", "Dedicated Manager"],
  },
  premium: {
    features: ["Unlimited Branches", "Full Feature Access", "Reservations", "Dedicated Account Manager", "24/7 Support"],
    locked: [],
  },
};

export function License() {
  const { user } = useAuth();
  const { plans: planConfigs } = usePlanConfig();
  const [status, setStatus] = useState<ApiSubscriptionStatus | null>(null);
  const [pendingReq, setPendingReq] = useState<ApiLicensePurchaseRequest | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await licensesApi.mine()); } catch { /* keep last */ }
    try {
      const reqs = await licensesApi.myPurchaseRequests();
      setPendingReq(reqs.find(r => r.status === "pending") ?? null);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Ask the founder to issue/renew a license — they get an email, then fulfill it
  // (a key is emailed back to you, which you activate below). Your data is kept.
  const requestRenewal = async (plan: string) => {
    if (pendingReq) { toast.info("Request already pending", "The Cafyz team will email your key shortly"); return; }
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan });
      toast.success("Renewal requested", "We've emailed the Cafyz team — your license key will arrive by email");
      await load();
    } catch (e) {
      toast.error("Couldn't send request", (e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  const currentPlan = status?.plan ?? user?.plan ?? "basic";
  const trialDaysLeft = status?.trial_days_left ?? null;

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
        period: cfg ? formatBillingSuffix(cfg).replace(/^\//, "") : "mo",
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
  const renewLabel = status?.license?.expires_at
    ? `Renews ${new Date(status.license.expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
    : "Active · no expiry";

  const activate = async () => {
    if (!licenseKey) return;
    setActivating(true);
    try {
      const res = await licensesApi.activate(licenseKey.trim());
      setActivated(true);
      toast.success("License activated!", `Your plan is now ${res.plan}`);
      await load();
      setTimeout(() => setActivated(false), 2500);
    } catch (e) {
      toast.error("Activation failed", (e as Error).message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl w-full">
      {/* Trial banner — only when on a time-limited trial/license */}
      {trialDaysLeft != null && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: status?.trial_expired ? "rgba(255,59,92,0.08)" : "rgba(30,127,255,0.08)", border: `1px solid ${status?.trial_expired ? "rgba(255,59,92,0.2)" : "rgba(30,127,255,0.2)"}` }}
        >
          <Clock size={18} style={{ color: status?.trial_expired ? "#ff3b5c" : "#1e7fff", flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ color: "var(--cafyz-text)", fontSize: "0.85rem", fontWeight: 600 }}>
              {status?.trial_expired
                ? <>Your trial has <span style={{ color: "#ff3b5c", fontWeight: 800 }}>expired</span></>
                : <>Trial expires in <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800 }}>{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}</span></>}
            </p>
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>
              {pendingReq ? "Renewal requested — your license key will arrive by email." : "Request a renewal, then activate the key we email you. Your data is kept."}
            </p>
          </div>
          {pendingReq ? (
            <span className="text-xs px-3 py-2 rounded-xl flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 600 }}>Request pending</span>
          ) : (
            <button onClick={() => requestRenewal(currentPlan)} disabled={requesting}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: requesting ? 0.6 : 1 }}>
              {requesting ? "Requesting…" : "Renew now"}
            </button>
          )}
        </motion.div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl p-5" style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.15)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Current Plan</h3>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>Active</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${planDef.color}1f` }}>
            <PlanIcon size={22} style={{ color: planDef.color }} />
          </div>
          <div>
            <p style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>{planDef.name} Plan</p>
            {planDef.description && <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>{planDef.description}</p>}
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>{renewLabel}</p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 16 }}>Compare Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isActive = plan.id === currentPlan;
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
                  <span style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>/{plan.period}</span>
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
                  onClick={() => { if (!isActive) requestRenewal(plan.id); }}
                  disabled={isActive || requesting || !!pendingReq}
                  className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={isActive
                    ? { background: `${plan.color}12`, color: plan.color, border: `1px solid ${plan.color}25` }
                    : { background: `${plan.color}10`, color: plan.color, border: `1px solid ${plan.color}20`, opacity: (requesting || pendingReq) ? 0.6 : 1 }
                  }
                >
                  {isActive ? "Current Plan" : pendingReq ? "Request pending" : <>Request {plan.name} <ArrowRight size={14} /></>}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* License key activation */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
        <div className="flex items-center gap-2">
          <Key size={16} style={{ color: "#1e7fff" }} />
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>License Key Activation</h3>
        </div>
        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>Have a license key? Enter it below to activate your plan.</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="CAFYZ-XXXX-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value.toUpperCase())}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
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
    </div>
  );
}
