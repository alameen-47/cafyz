import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { Shield, Key, Zap, TrendingUp, Check, X, Copy, RefreshCw, Globe, Building2, CreditCard, Trash2, Users, Pause, Play } from "lucide-react";
import { toast } from "./Toast";
import {
  founderApi, licensesApi,
  type ApiFounderStats, type ApiFounderRestaurant, type ApiFounderInquiry, type ApiFounderUser,
  type ApiLicenseKey, type ApiPlanConfig, type ApiLicensePurchaseRequest,
} from "../../services/api";
import { notifyPlanConfigUpdated, parsePanelsJson, refreshPlanConfigs, formatPlanPrice, formatBillingSuffix } from "../../services/planConfigStore";
import { secureCopyToClipboard, scheduleClipboardClear } from "../../utils/secureClipboard";

const tabs = ["Overview", "Restaurants", "Users", "Trial Requests", "License Keys", "Plan Config"];
const planColors: Record<string, string> = { basic: "#6b82a0", pro: "#1e7fff", premium: "#a855f7" };
const FALLBACK_PRICE: Record<string, number> = { basic: 49, pro: 99, premium: 199 };
const ALL_PANELS = ["pos", "menu", "waiter", "kds", "manager", "inventory", "staff", "reports", "roles", "reservations", "license"];
const PANEL_LABELS: Record<string, string> = {
  pos: "POS", menu: "Menu", waiter: "Tables / Waiter", kds: "KDS", manager: "Dashboard",
  inventory: "Inventory", staff: "Staff", reports: "Reports", roles: "Roles", reservations: "Reservations", license: "License",
};
const CURRENCY_OPTIONS = ["$", "€", "£", "₹", "AED", "SAR"];
const shortDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

export function FounderConsole() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [copied, setCopied] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiFounderStats | null>(null);
  const [rests, setRests] = useState<ApiFounderRestaurant[]>([]);
  const [inquiries, setInquiries] = useState<ApiFounderInquiry[]>([]);
  const [licReqs, setLicReqs] = useState<ApiLicensePurchaseRequest[]>([]);
  const [keys, setKeys] = useState<ApiLicenseKey[]>([]);
  const [planCfg, setPlanCfg] = useState<ApiPlanConfig[]>([]);
  const [users, setUsers] = useState<ApiFounderUser[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelSyncing, setPanelSyncing] = useState<Set<string>>(() => new Set());
  const panelFlushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const panelSnapshot = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const [s, r, inq, lr, k, pc, u] = await Promise.all([
      founderApi.stats().catch(() => null),
      founderApi.restaurants().catch(() => []),
      founderApi.inquiries().catch(() => []),
      founderApi.licenseRequests().catch(() => []),
      licensesApi.list().catch(() => []),
      founderApi.planConfig().catch(() => []),
      founderApi.users().catch(() => []),
    ]);
    setStats(s); setRests(r); setInquiries(inq); setLicReqs(lr); setKeys(k); setPlanCfg(pc); setUsers(u);
  }, []);

  // Fulfill a renewal/purchase request → mints a key and emails it to the manager.
  const fulfillRequest = async (id: string) => {
    setBusy(true);
    try {
      const res = await founderApi.fulfillLicenseRequest(id);
      toast.success("Request fulfilled", `Key ${res.key_code} emailed to the manager`);
      await load();
    } catch (e) {
      toast.error("Couldn't fulfill request", (e as Error).message);
    } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [load]);

  useEffect(() => () => {
    for (const [plan, timer] of Object.entries(panelFlushTimers.current)) {
      clearTimeout(timer);
      const json = panelSnapshot.current[plan];
      if (json) {
        void founderApi.updatePlanConfig(plan, { panels_json: json })
          .then(() => refreshPlanConfigs(true))
          .catch(() => {});
      }
    }
  }, []);

  const priceByPlan = (plan: string) => planCfg.find(p => p.plan === plan)?.price_monthly ?? FALLBACK_PRICE[plan] ?? 0;

  const copyKey = async (key: string) => {
    const ok = await secureCopyToClipboard(key);
    if (!ok) {
      toast.error("Couldn't copy", "Clipboard access was denied.");
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success("License key copied", "Verify the pasted value before sharing.");
    scheduleClipboardClear(90_000);
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

  const changePlan = async (restaurantId: string, plan: string) => {
    setBusy(true);
    try {
      await founderApi.setPlan(restaurantId, plan);
      toast.success("Plan updated", `Restaurant moved to ${plan}`);
      await load();
    } catch (e) {
      toast.error("Couldn't change plan", (e as Error).message);
    } finally { setBusy(false); }
  };

  const removeRestaurant = async (restaurantId: string, name: string) => {
    if (!window.confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await founderApi.deleteRestaurant(restaurantId);
      toast.success("Restaurant deleted", name);
      await load();
    } catch (e) {
      toast.error("Couldn't delete restaurant", (e as Error).message);
    } finally { setBusy(false); }
  };

  const toggleRestaurantAccess = async (restaurantId: string, name: string, paused: boolean) => {
    const msg = paused
      ? `Pause access for "${name}"? All staff will be signed out and blocked until you resume.`
      : `Resume access for "${name}"? Staff accounts will be reactivated.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await founderApi.setRestaurantAccess(restaurantId, paused);
      toast.success(paused ? "Access paused" : "Access resumed", name);
      await load();
    } catch (e) {
      toast.error(paused ? "Couldn't pause access" : "Couldn't resume access", (e as Error).message);
    } finally { setBusy(false); }
  };

  const toggleUserAccess = async (user: ApiFounderUser) => {
    const paused = user.status !== "off";
    const next = paused ? "off" : "active";
    setBusy(true);
    try {
      await founderApi.setUserStatus(user.id, next);
      toast.success(paused ? "User paused" : "User resumed", user.name);
      await load();
    } catch (e) {
      toast.error("Couldn't update user", (e as Error).message);
    } finally { setBusy(false); }
  };

  const removeUser = async (user: ApiFounderUser) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await founderApi.deleteUser(user.id);
      toast.success("User deleted", user.name);
      await load();
    } catch (e) {
      toast.error("Couldn't delete user", (e as Error).message);
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

  const savePlanField = async (plan: string, patch: Partial<ApiPlanConfig>, options?: { silent?: boolean }) => {
    const previous = planCfg.find(p => p.plan === plan);
    if (!previous) return;

    setPlanCfg(prev => prev.map(p => (p.plan === plan ? { ...p, ...patch } : p)));

    try {
      const updated = await founderApi.updatePlanConfig(plan, patch);
      setPlanCfg(prev => prev.map(p => (p.plan === plan ? updated : p)));
      void refreshPlanConfigs(true);
      notifyPlanConfigUpdated();
      if (!options?.silent) {
        toast.success("Plan updated", `${plan} saved — live on web & mobile`);
      }
    } catch (err) {
      setPlanCfg(prev => prev.map(p => (p.plan === plan ? previous : p)));
      toast.error("Couldn't update plan", (err as Error).message);
    }
  };

  const flushPanelSave = async (plan: string) => {
    const panelsJson = panelSnapshot.current[plan];
    if (!panelsJson) return;

    setPanelSyncing(prev => new Set(prev).add(plan));
    try {
      const updated = await founderApi.updatePlanConfig(plan, { panels_json: panelsJson });
      setPlanCfg(prev => prev.map(p => (p.plan === plan ? updated : p)));
      await refreshPlanConfigs(true);
      notifyPlanConfigUpdated();
    } catch (err) {
      const pc = await founderApi.planConfig().catch(() => planCfg);
      setPlanCfg(pc);
      toast.error("Couldn't save features", (err as Error).message);
    } finally {
      setPanelSyncing(prev => {
        const next = new Set(prev);
        next.delete(plan);
        return next;
      });
    }
  };

  const togglePanel = (plan: string, panel: string) => {
    const cfg = planCfg.find(p => p.plan === plan);
    if (!cfg) return;

    const panels = new Set(parsePanelsJson(cfg.panels_json));
    if (panels.has(panel)) panels.delete(panel);
    else panels.add(panel);

    const nextJson = JSON.stringify([...panels]);
    setPlanCfg(prev => prev.map(p => (p.plan === plan ? { ...p, panels_json: nextJson } : p)));
    panelSnapshot.current[plan] = nextJson;

    const existing = panelFlushTimers.current[plan];
    if (existing) clearTimeout(existing);
    panelFlushTimers.current[plan] = setTimeout(() => {
      delete panelFlushTimers.current[plan];
      void flushPanelSave(plan);
    }, 300);
  };

  const totalRestaurants = (stats?.restaurants_by_plan ?? []).reduce((s, p) => s + p.count, 0) || rests.length;
  const totalMRR = (stats?.restaurants_by_plan ?? []).reduce((s, p) => s + p.count * priceByPlan(p.plan), 0);
  const activeLicenses = stats?.license_keys.activated ?? 0;
  const pendingTrials = stats?.pending_license_requests ?? inquiries.filter(i => i.status === "pending").length;
  const filteredUsers = users.filter(u => !userFilter || u.restaurant_id === userFilter);

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
            <div className="col-span-12 sm:col-span-2">Actions</div>
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
                <div className="flex flex-col gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full w-fit"
                    style={r.active_key ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                    {r.active_key ? "Licensed" : "No license"}
                  </span>
                  {Number(r.access_paused) === 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full w-fit" style={{ background: "rgba(255,59,92,0.1)", color: "#ff3b5c" }}>
                      Paused
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-12 sm:col-span-2 flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
                <button
                  disabled={busy}
                  onClick={() => void toggleRestaurantAccess(r.id, r.name, Number(r.access_paused) !== 1)}
                  className="p-1.5 rounded-lg transition-all"
                  title={Number(r.access_paused) === 1 ? "Resume access" : "Pause access"}
                  style={{ color: Number(r.access_paused) === 1 ? "#22c55e" : "#f59e0b", background: Number(r.access_paused) === 1 ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)" }}
                >
                  {Number(r.access_paused) === 1 ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <select
                  defaultValue={r.plan}
                  disabled={busy}
                  onChange={e => void changePlan(r.id, e.target.value)}
                  className="text-xs rounded-lg px-2 py-1 outline-none capitalize"
                  style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.15)" }}
                >
                  {["basic", "pro", "premium"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  disabled={busy}
                  onClick={() => void removeRestaurant(r.id, r.name)}
                  className="p-1.5 rounded-lg transition-all hover:bg-[rgba(255,59,92,0.1)]"
                  title="Delete restaurant"
                  style={{ color: "#ff3b5c" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Users */}
      {activeTab === "Users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <Users size={14} style={{ color: "#1e7fff" }} />
              <span style={{ color: "#e8eef8", fontSize: "0.82rem", fontWeight: 600 }}>{filteredUsers.length} users</span>
            </div>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: "#0d1326", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.15)" }}
            >
              <option value="">All restaurants</option>
              {rests.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs uppercase tracking-wider" style={{ color: "#6b82a0", borderColor: "rgba(30,127,255,0.08)", fontFamily: "var(--font-mono)" }}>
              <div className="col-span-3">User</div>
              <div className="col-span-3 hidden sm:block">Restaurant</div>
              <div className="col-span-2 hidden md:block">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-12 sm:col-span-2">Actions</div>
            </div>
            {filteredUsers.length === 0 && (
              <div className="px-4 py-8 text-center" style={{ color: "#6b82a0", fontSize: "0.82rem" }}>No users found</div>
            )}
            {filteredUsers.map((u, i) => {
              const paused = u.status === "off" || Number(u.access_paused) === 1;
              const statusLabel = Number(u.access_paused) === 1 ? "tenant paused" : u.status;
              return (
                <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b hover:bg-[rgba(30,127,255,0.03)] transition-all"
                  style={{ borderColor: "rgba(30,127,255,0.06)" }}>
                  <div className="col-span-3 min-w-0">
                    <p className="truncate" style={{ color: "#e8eef8", fontSize: "0.85rem", fontWeight: 500 }}>{u.name}</p>
                    <p className="truncate" style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{u.email}</p>
                  </div>
                  <div className="col-span-3 hidden sm:block min-w-0">
                    <p className="truncate" style={{ color: "#a8bdd4", fontSize: "0.8rem" }}>{u.restaurant_name}</p>
                    <p className="truncate capitalize" style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{u.restaurant_plan}</p>
                  </div>
                  <div className="col-span-2 hidden md:block capitalize" style={{ color: "#6b82a0", fontSize: "0.78rem" }}>{u.role}</div>
                  <div className="col-span-2">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={paused
                        ? { background: "rgba(255,59,92,0.1)", color: "#ff3b5c" }
                        : u.status === "break"
                          ? { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }
                          : { background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="col-span-12 sm:col-span-2 flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
                    <button
                      disabled={busy || Number(u.access_paused) === 1}
                      onClick={() => void toggleUserAccess(u)}
                      className="p-1.5 rounded-lg transition-all"
                      title={Number(u.access_paused) === 1 ? "Resume the restaurant first" : u.status === "off" ? "Resume user" : "Pause user"}
                      style={{
                        color: u.status === "off" ? "#22c55e" : "#f59e0b",
                        background: u.status === "off" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                        opacity: Number(u.access_paused) === 1 ? 0.4 : 1,
                      }}
                    >
                      {u.status === "off" ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void removeUser(u)}
                      className="p-1.5 rounded-lg transition-all hover:bg-[rgba(255,59,92,0.1)]"
                      title="Delete user"
                      style={{ color: "#ff3b5c" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Trial Requests */}
      {activeTab === "Trial Requests" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Renewal / purchase requests from existing restaurants → Fulfill to email a key */}
          {licReqs.filter(r => r.status === "pending").length > 0 && (
            <div className="space-y-2">
              <p style={{ color: "#a855f7", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Renewal / Purchase Requests</p>
              {licReqs.filter(r => r.status === "pending").map(req => (
                <div key={req.id} className="rounded-2xl p-4 flex flex-wrap items-center gap-4"
                  style={{ background: "#0d1326", border: "1px solid rgba(168,85,247,0.25)" }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "#e8eef8", fontWeight: 600, fontSize: "0.9rem" }}>{req.restaurant_name ?? "Restaurant"}</p>
                    <p style={{ color: "#6b82a0", fontSize: "0.75rem" }}>{req.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${planColors[req.plan]}15`, color: planColors[req.plan] }}>{req.plan}</span>
                      <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{shortDate(req.created_at)}</span>
                    </div>
                  </div>
                  <button disabled={busy} onClick={() => fulfillRequest(req.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                    <Key size={12} /> Fulfill & email key
                  </button>
                </div>
              ))}
            </div>
          )}
          {inquiries.length === 0 && licReqs.filter(r => r.status === "pending").length === 0 && <div className="rounded-2xl py-10 text-center" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)", color: "#6b82a0", fontSize: "0.82rem" }}>No pending requests</div>}
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
                  <button onClick={() => void copyKey(lk.key_code)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: copied === lk.key_code ? "rgba(34,197,94,0.1)" : "rgba(30,127,255,0.08)" }}>
                    {copied === lk.key_code ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} style={{ color: "#6b82a0" }} />}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Plan Config — prices, labels, and feature gates sync to all clients */}
      {activeTab === "Plan Config" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p style={{ color: "#6b82a0", fontSize: "0.8rem" }}>
            Changes here update the License page, upgrade prompts, signup inquiry, and feature locks on web and mobile within about a minute.
          </p>
          {["basic", "pro", "premium"].map(plan => {
            const cfg = planCfg.find(p => p.plan === plan);
            const panels = parsePanelsJson(cfg?.panels_json);
            return (
              <div key={plan} className="rounded-2xl p-5 space-y-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} style={{ color: planColors[plan] }} />
                  <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "capitalize" }}>{cfg?.label ?? plan} Plan</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Display name</label>
                    <input type="text" defaultValue={cfg?.label ?? plan}
                      onBlur={e => { if (cfg && e.target.value.trim() && e.target.value !== cfg.label) void savePlanField(plan, { label: e.target.value.trim() }); }}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none capitalize"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }} />
                  </div>
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Currency</label>
                    <select defaultValue={cfg?.currency_symbol ?? "$"}
                      onChange={e => { if (cfg) void savePlanField(plan, { currency_symbol: e.target.value }); }}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }}>
                      {CURRENCY_OPTIONS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Price per period ({cfg?.currency_symbol ?? "$"})</label>
                    <input type="number" min={0} step={1} defaultValue={cfg?.price_monthly ?? FALLBACK_PRICE[plan]}
                      onBlur={e => {
                        const price = Number(e.target.value);
                        if (cfg && Number.isFinite(price) && price !== cfg.price_monthly) void savePlanField(plan, { price_monthly: price });
                      }}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }} />
                  </div>
                  <div>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Billing period</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        defaultValue={cfg?.billing_interval_count ?? 1}
                        onBlur={e => {
                          const count = Math.min(60, Math.max(1, Math.round(Number(e.target.value) || 1)));
                          if (cfg && count !== (cfg.billing_interval_count ?? 1)) {
                            void savePlanField(plan, { billing_interval_count: count });
                          }
                        }}
                        className="w-20 rounded-xl px-3 py-2 text-sm outline-none"
                        style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }}
                      />
                      <select
                        defaultValue={cfg?.billing_interval_unit ?? "month"}
                        onChange={e => {
                          const unit = e.target.value as "month" | "year";
                          if (cfg && unit !== (cfg.billing_interval_unit ?? "month")) {
                            void savePlanField(plan, { billing_interval_unit: unit });
                          }
                        }}
                        className="flex-1 rounded-xl px-3 py-2 text-sm outline-none capitalize"
                        style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }}
                      >
                        <option value="month">Month(s)</option>
                        <option value="year">Year(s)</option>
                      </select>
                    </div>
                    {cfg && (
                      <p style={{ color: "#6b82a0", fontSize: "0.68rem", marginTop: 6 }}>
                        License keys expire after {cfg.billing_interval_count ?? 1} {cfg.billing_interval_unit ?? "month"}
                        {(cfg.billing_interval_count ?? 1) > 1 ? "s" : ""}. Shown as {formatPlanPrice(cfg)}{formatBillingSuffix(cfg)}.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Description (shown on License page)</label>
                  <textarea defaultValue={cfg?.description ?? ""} rows={2}
                    onBlur={e => { if (cfg && e.target.value !== (cfg.description ?? "")) void savePlanField(plan, { description: e.target.value }); }}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                    style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }} />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2" style={{ marginBottom: 8 }}>
                    <label style={{ color: "#6b82a0", fontSize: "0.72rem" }}>Included features</label>
                    {panelSyncing.has(plan) && (
                      <span style={{ color: planColors[plan], fontSize: "0.65rem", fontWeight: 600 }}>Syncing…</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PANELS.map(panel => {
                      const on = panels.includes(panel);
                      const color = planColors[plan];
                      return (
                        <button
                          key={panel}
                          type="button"
                          aria-pressed={on}
                          onClick={() => togglePanel(plan, panel)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium cursor-pointer select-none active:scale-[0.96]"
                          style={{
                            background: on ? `${color}22` : "rgba(255,255,255,0.04)",
                            color: on ? color : "#6b82a0",
                            border: on ? `1px solid ${color}45` : "1px solid rgba(255,255,255,0.06)",
                            boxShadow: on ? `0 0 0 1px ${color}18` : "none",
                            transition: "transform 70ms ease, background-color 90ms ease, border-color 90ms ease, color 90ms ease, box-shadow 90ms ease",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          {on ? <Check size={11} strokeWidth={2.5} /> : null}
                          {PANEL_LABELS[panel] ?? panel}
                        </button>
                      );
                    })}
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
