import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Shield, Key, Zap, TrendingUp, Check, X, Copy, RefreshCw, Globe, Building2, CreditCard } from "lucide-react";
import { toast } from "./Toast";
import {
  founderApi, licensesApi,
  type ApiFounderStats, type ApiFounderRestaurant, type ApiFounderInquiry,
  type ApiLicenseKey, type ApiPlanConfig,
} from "../../services/api";

const tabs = ["Overview", "Restaurants", "Trial Requests", "License Keys", "Plan Config"];
const planColors: Record<string, string> = { basic: "#6b82a0", pro: "#1e7fff", premium: "#a855f7" };
const FALLBACK_PRICE: Record<string, number> = { basic: 999, pro: 2499, premium: 5999 };
const shortDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

export function FounderConsole() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [copied, setCopied] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiFounderStats | null>(null);
  const [rests, setRests] = useState<ApiFounderRestaurant[]>([]);
  const [inquiries, setInquiries] = useState<ApiFounderInquiry[]>([]);
  const [keys, setKeys] = useState<ApiLicenseKey[]>([]);
  const [planCfg, setPlanCfg] = useState<ApiPlanConfig[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, r, inq, k, pc] = await Promise.all([
      founderApi.stats().catch(() => null),
      founderApi.restaurants().catch(() => []),
      founderApi.inquiries().catch(() => []),
      licensesApi.list().catch(() => []),
      founderApi.planConfig().catch(() => []),
    ]);
    setStats(s); setRests(r); setInquiries(inq); setKeys(k); setPlanCfg(pc);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const priceByPlan = (plan: string) => planCfg.find(p => p.plan === plan)?.price_monthly ?? FALLBACK_PRICE[plan] ?? 0;

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const decideInquiry = async (id: string, status: "approved" | "denied") => {
    setBusy(true);
    try {
      const res = await founderApi.setInquiryStatus(id, status);
      toast.success(status === "approved" ? "Trial approved" : "Request denied",
        res.licenseKey ? `Key issued: ${res.licenseKey}` : "Updated");
      await load();
    } catch (e) {
      toast.error("Couldn't update request", (e as Error).message);
    } finally { setBusy(false); }
  };

  const generateKey = async (plan: string) => {
    setBusy(true);
    try {
      const res = await licensesApi.generate({ plan: plan.toLowerCase() });
      const created = Array.isArray(res) ? res[0] : res;
      toast.success(`${plan} key generated`, created?.key_code ?? "");
      await load();
    } catch (e) {
      toast.error("Couldn't generate key", (e as Error).message);
    } finally { setBusy(false); }
  };

  const totalRestaurants = (stats?.restaurants_by_plan ?? []).reduce((s, p) => s + p.count, 0) || rests.length;
  const totalMRR = (stats?.restaurants_by_plan ?? []).reduce((s, p) => s + p.count * priceByPlan(p.plan), 0);
  const activeLicenses = stats?.license_keys.activated ?? 0;
  const pendingTrials = stats?.pending_license_requests ?? inquiries.filter(i => i.status === "pending").length;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Founder badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
        <Shield size={14} style={{ color: "#a855f7" }} />
        <span style={{ color: "#a855f7", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em" }}>SUPER ADMIN · FOUNDER CONSOLE</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
            style={activeTab === t ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" } : { color: "#6b82a0" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "Overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Restaurants", value: String(totalRestaurants), icon: Building2, color: "#1e7fff" },
              { label: "Est. Monthly Revenue", value: `${(totalMRR / 1000).toFixed(1)}k`, icon: TrendingUp, color: "#22c55e" },
              { label: "Active Licenses", value: String(activeLicenses), icon: Key, color: "#00c6ff" },
              { label: "Pending Trials", value: String(pendingTrials), icon: Zap, color: "#f59e0b" },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-xl" style={{ background: kpi.color, transform: "translate(30%,-30%)" }} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${kpi.color}15` }}>
                    <Icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <div style={{ color: "#6b82a0", fontSize: "0.7rem", marginBottom: 2 }}>{kpi.label}</div>
                  <div style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem" }}>{kpi.value}</div>
                </motion.div>
              );
            })}
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 12 }}>Plan Distribution</h3>
            <div className="space-y-3">
              {["basic", "pro", "premium"].map(id => {
                const count = stats?.restaurants_by_plan.find(p => p.plan === id)?.count ?? 0;
                const pct = totalRestaurants ? (count / totalRestaurants) * 100 : 0;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span style={{ color: planColors[id], fontSize: "0.78rem", fontWeight: 600, width: 64, textTransform: "capitalize" }}>{id}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(30,127,255,0.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: planColors[id] }} />
                    </div>
                    <span style={{ color: "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.75rem", width: 20 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Restaurants */}
      {activeTab === "Restaurants" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl overflow-hidden" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs uppercase tracking-wider" style={{ color: "#6b82a0", borderColor: "rgba(30,127,255,0.08)", fontFamily: "var(--font-mono)" }}>
            <div className="col-span-4">Restaurant</div>
            <div className="col-span-2 hidden sm:block">Plan</div>
            <div className="col-span-2 hidden md:block">Timezone</div>
            <div className="col-span-2 hidden md:block">Users</div>
            <div className="col-span-2">Status</div>
          </div>
          {rests.length === 0 && <div className="px-4 py-8 text-center" style={{ color: "#6b82a0", fontSize: "0.82rem" }}>No restaurants</div>}
          {rests.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b hover:bg-[rgba(30,127,255,0.03)] transition-all"
              style={{ borderColor: "rgba(30,127,255,0.06)" }}>
              <div className="col-span-4">
                <p style={{ color: "#e8eef8", fontSize: "0.85rem", fontWeight: 500 }}>{r.name}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{r.slug}</p>
              </div>
              <div className="col-span-2 hidden sm:block">
                <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${planColors[r.plan]}15`, color: planColors[r.plan] }}>{r.plan}</span>
              </div>
              <div className="col-span-2 hidden md:flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.78rem" }}>
                <Globe size={11} /> {r.timezone}
              </div>
              <div className="col-span-2 hidden md:block" style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 600 }}>
                {r.user_count}
              </div>
              <div className="col-span-2">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={r.active_key ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  {r.active_key ? "Licensed" : "No license"}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Trial Requests */}
      {activeTab === "Trial Requests" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {inquiries.length === 0 && <div className="rounded-2xl py-10 text-center" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)", color: "#6b82a0", fontSize: "0.82rem" }}>No trial requests</div>}
          {inquiries.map((req, i) => (
            <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 flex flex-wrap items-center gap-4"
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <div className="flex-1 min-w-0">
                <p style={{ color: "#e8eef8", fontWeight: 600, fontSize: "0.9rem" }}>{req.restaurant_name}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.75rem" }}>{req.name} · {req.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${planColors[req.plan]}15`, color: planColors[req.plan] }}>{req.plan}</span>
                  <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{shortDate(req.created_at)}</span>
                </div>
              </div>
              {req.status === "pending" ? (
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={busy} onClick={() => decideInquiry(req.id, "approved")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                    <Check size={12} /> Approve
                  </button>
                  <button disabled={busy} onClick={() => decideInquiry(req.id, "denied")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}>
                    <X size={12} /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full capitalize"
                  style={req.status === "approved" ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(255,59,92,0.1)", color: "#ff3b5c" }}>
                  {req.status}
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* License Keys */}
      {activeTab === "License Keys" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["Pro", "Premium", "Basic"].map(plan => (
              <button key={plan} disabled={busy} onClick={() => generateKey(plan)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: `${planColors[plan.toLowerCase()]}12`, color: planColors[plan.toLowerCase()], border: `1px solid ${planColors[plan.toLowerCase()]}25` }}>
                <Key size={14} /> Generate {plan} Key
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {keys.length === 0 && <div className="rounded-xl py-8 text-center" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)", color: "#6b82a0", fontSize: "0.82rem" }}>No license keys yet</div>}
            {keys.map((lk, i) => (
              <motion.div key={lk.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)" }}>
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{lk.key_code}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs capitalize" style={{ color: planColors[lk.plan] }}>{lk.plan}</span>
                    <span style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{lk.restaurant_id ? `Used by ${lk.restaurant_name ?? "a restaurant"}` : "Available"}</span>
                    <span style={{ color: "#6b82a0", fontSize: "0.7rem" }}>· {shortDate(lk.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={lk.restaurant_id ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(30,127,255,0.1)", color: "#1e7fff" }}>
                    {lk.restaurant_id ? "Used" : "Available"}
                  </span>
                  <button onClick={() => copyKey(lk.key_code)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: copied === lk.key_code ? "rgba(34,197,94,0.1)" : "rgba(30,127,255,0.08)" }}>
                    {copied === lk.key_code ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} style={{ color: "#6b82a0" }} />}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Plan Config */}
      {activeTab === "Plan Config" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {["basic", "pro", "premium"].map(plan => {
            const cfg = planCfg.find(p => p.plan === plan);
            return (
              <div key={plan} className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} style={{ color: planColors[plan] }} />
                  <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "capitalize" }}>{plan} Plan</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Monthly Price ({cfg?.currency_symbol ?? "₹"})</label>
                    <input type="number" defaultValue={cfg?.price_monthly ?? FALLBACK_PRICE[plan]}
                      onBlur={async e => {
                        const price = Number(e.target.value);
                        if (cfg && price !== cfg.price_monthly) {
                          try { await founderApi.updatePlanConfig(plan, { price_monthly: price }); toast.success("Plan price updated", `${plan}: ${price}`); await load(); }
                          catch (err) { toast.error("Couldn't update plan", (err as Error).message); }
                        }
                      }}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }} />
                  </div>
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Billing</label>
                    <input type="text" readOnly value={cfg ? `${cfg.billing_interval_count} ${cfg.billing_interval_unit}` : "1 month"}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "#111b35", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }} />
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={() => void load()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </motion.div>
      )}
    </div>
  );
}
