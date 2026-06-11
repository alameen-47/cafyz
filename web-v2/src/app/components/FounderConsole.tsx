import { useState } from "react";
import { motion } from "motion/react";
import { Shield, Users, Key, Zap, Crown, TrendingUp, Check, X, Copy, RefreshCw, Globe, Building2, CreditCard } from "lucide-react";

const tabs = ["Overview", "Restaurants", "Trial Requests", "License Keys", "Plan Config"];

const restaurants = [
  { id: "r1", name: "The Spice Garden", owner: "Alex Kumar", plan: "pro", status: "active", location: "Bangalore", since: "Jan 2026", mrr: 2499 },
  { id: "r2", name: "Pizza Palace", owner: "Marco Rossi", plan: "premium", status: "active", location: "Mumbai", since: "Mar 2026", mrr: 5999 },
  { id: "r3", name: "Sushi Sakura", owner: "Yuki Tanaka", plan: "basic", status: "active", location: "Delhi", since: "May 2026", mrr: 999 },
  { id: "r4", name: "Burger Bros", owner: "Jake Smith", plan: "pro", status: "trial", location: "Chennai", since: "Jun 2026", mrr: 0 },
  { id: "r5", name: "The Royal Kitchen", owner: "Priya Nair", plan: "premium", status: "active", location: "Hyderabad", since: "Feb 2026", mrr: 5999 },
];

const trialRequests = [
  { id: "t1", name: "Cafe Corner", owner: "Ravi M", email: "ravi@cafecorner.in", phone: "+91 9876 543210", plan: "pro", date: "Jun 10", status: "pending" },
  { id: "t2", name: "Dosa Hub", owner: "Ananya K", email: "a@dosahub.in", phone: "+91 9988 776655", plan: "basic", date: "Jun 09", status: "approved" },
  { id: "t3", name: "Noodle Nation", owner: "Chen Wei", email: "chen@noodles.in", phone: "+91 8877 665544", plan: "premium", date: "Jun 08", status: "pending" },
];

const licenseKeys = [
  { key: "CAFYZ-PRO1-ABCD-EFGH-1234", plan: "Pro", used: true, restaurant: "The Spice Garden", created: "Jan 5" },
  { key: "CAFYZ-PRE1-WXYZ-PQRS-5678", plan: "Premium", used: true, restaurant: "Pizza Palace", created: "Mar 12" },
  { key: "CAFYZ-PRO2-MNOP-QRST-9012", plan: "Pro", used: false, restaurant: null, created: "Jun 1" },
  { key: "CAFYZ-BAS1-UVWX-YZAB-3456", plan: "Basic", used: false, restaurant: null, created: "Jun 8" },
];

const planColors: Record<string, string> = { basic: "#6b82a0", pro: "#1e7fff", premium: "#a855f7" };

export function FounderConsole() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [copied, setCopied] = useState<string | null>(null);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalMRR = restaurants.filter(r => r.status === "active").reduce((s, r) => s + r.mrr, 0);

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
              { label: "Total Restaurants", value: restaurants.length, icon: Building2, color: "#1e7fff" },
              { label: "Monthly Revenue", value: `₹${(totalMRR/1000).toFixed(1)}k`, icon: TrendingUp, color: "#22c55e" },
              { label: "Active Licenses", value: restaurants.filter(r => r.status === "active").length, icon: Key, color: "#00c6ff" },
              { label: "Pending Trials", value: trialRequests.filter(r => r.status === "pending").length, icon: Zap, color: "#f59e0b" },
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
              {[["basic", "Basic", 999], ["pro", "Pro", 2499], ["premium", "Premium", 5999]].map(([id, name, price]) => {
                const count = restaurants.filter(r => r.plan === id).length;
                const pct = (count / restaurants.length) * 100;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span style={{ color: planColors[id as string], fontSize: "0.78rem", fontWeight: 600, width: 64 }}>{name as string}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(30,127,255,0.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: planColors[id as string] }} />
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
            <div className="col-span-2 hidden md:block">Location</div>
            <div className="col-span-2 hidden md:block">MRR</div>
            <div className="col-span-2">Status</div>
          </div>
          {restaurants.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b hover:bg-[rgba(30,127,255,0.03)] transition-all"
              style={{ borderColor: "rgba(30,127,255,0.06)" }}>
              <div className="col-span-4">
                <p style={{ color: "#e8eef8", fontSize: "0.85rem", fontWeight: 500 }}>{r.name}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{r.owner}</p>
              </div>
              <div className="col-span-2 hidden sm:block">
                <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${planColors[r.plan]}15`, color: planColors[r.plan] }}>{r.plan}</span>
              </div>
              <div className="col-span-2 hidden md:flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.78rem" }}>
                <Globe size={11} /> {r.location}
              </div>
              <div className="col-span-2 hidden md:block" style={{ color: r.mrr > 0 ? "#22c55e" : "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 600 }}>
                {r.mrr > 0 ? `₹${r.mrr.toLocaleString()}` : "Trial"}
              </div>
              <div className="col-span-2">
                <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                  style={r.status === "active" ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  {r.status}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Trial Requests */}
      {activeTab === "Trial Requests" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {trialRequests.map((req, i) => (
            <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 flex flex-wrap items-center gap-4"
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <div className="flex-1 min-w-0">
                <p style={{ color: "#e8eef8", fontWeight: 600, fontSize: "0.9rem" }}>{req.name}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.75rem" }}>{req.owner} · {req.email} · {req.phone}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${planColors[req.plan]}15`, color: planColors[req.plan] }}>{req.plan}</span>
                  <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{req.date}</span>
                </div>
              </div>
              {req.status === "pending" ? (
                <div className="flex gap-2 flex-shrink-0">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                    <Check size={12} /> Approve
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}>
                    <X size={12} /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>Approved</span>
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
              <button key={plan} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: `${planColors[plan.toLowerCase()]}12`, color: planColors[plan.toLowerCase()], border: `1px solid ${planColors[plan.toLowerCase()]}25` }}>
                <Key size={14} /> Generate {plan} Key
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {licenseKeys.map((lk, i) => (
              <motion.div key={lk.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)" }}>
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{lk.key}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: planColors[lk.plan.toLowerCase()] }}>{lk.plan}</span>
                    <span style={{ color: "#6b82a0", fontSize: "0.7rem" }}>{lk.used ? `Used by ${lk.restaurant}` : "Available"}</span>
                    <span style={{ color: "#6b82a0", fontSize: "0.7rem" }}>· {lk.created}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={lk.used ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(30,127,255,0.1)", color: "#1e7fff" }}>
                    {lk.used ? "Used" : "Available"}
                  </span>
                  <button onClick={() => copyKey(lk.key)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: copied === lk.key ? "rgba(34,197,94,0.1)" : "rgba(30,127,255,0.08)" }}>
                    {copied === lk.key ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} style={{ color: "#6b82a0" }} />}
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
          {["basic", "pro", "premium"].map(plan => (
            <div key={plan} className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} style={{ color: planColors[plan] }} />
                  <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "capitalize" }}>{plan} Plan</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Monthly Price (₹)</label>
                  <input type="number" defaultValue={plan === "basic" ? 999 : plan === "pro" ? 2499 : 5999}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }} />
                </div>
                <div>
                  <label style={{ color: "#6b82a0", fontSize: "0.72rem", display: "block", marginBottom: 4 }}>Trial Days</label>
                  <input type="number" defaultValue={7}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)", fontFamily: "var(--font-mono)" }} />
                </div>
              </div>
            </div>
          ))}
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            <RefreshCw size={15} /> Save Config
          </button>
        </motion.div>
      )}
    </div>
  );
}
