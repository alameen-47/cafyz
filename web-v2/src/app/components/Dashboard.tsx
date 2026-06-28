import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign,
  Package, ChevronRight, AlertCircle, UtensilsCrossed, MonitorSpeaker,
  BarChart3, RefreshCw, UserCheck,
} from "lucide-react";
import { toast } from "./Toast";
import { dashboardApi, ordersApi, menuApi, menuCategoriesApi,
  type ApiDashboardStats, type ApiRevenueRow,
} from "../../services/api";
import { useAuth } from "../auth";
import { planMeetsRequirement, canManagePlan } from "../../config/access";
import { formatMoney, getCurrencySymbol } from "../../utils/currency";
import { useAppNav } from "../nav";

const CAT_COLORS = ["#1e7fff", "#00c6ff", "#a855f7", "#22d3ee", "#f59e0b", "#22c55e"];

function mapStatus(s: string): "served" | "preparing" | "ready" {
  if (s === "paid" || s === "comped") return "served";
  if (s === "open") return "ready";
  return "preparing";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return out;
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function fillRevenueRows(from: string, to: string, rows: ApiRevenueRow[]) {
  const byDay = new Map(rows.map(r => [r.day, r.revenue]));
  return daysBetween(from, to).map(day => ({
    day: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
    revenue: byDay.get(day) ?? 0,
  }));
}

function compactMoney(cur: string, amount: number): string {
  if (amount >= 10_000) return `${cur}${(amount / 1000).toFixed(0)}k`;
  if (amount >= 1000) return `${cur}${(amount / 1000).toFixed(1)}k`;
  return `${cur}${Math.round(amount)}`;
}

type CatDatum = { name: string; value: number; color: string };
type OrderRow = { id: string; table: string; items: string; amount: number; status: string; time: string };

const statusColors: Record<string, string> = {
  served: "#22c55e",
  preparing: "#f59e0b",
  ready: "#1e7fff",
};
const statusBg: Record<string, string> = {
  served: "rgba(34,197,94,0.12)",
  preparing: "rgba(245,158,11,0.12)",
  ready: "rgba(30,127,255,0.12)",
};

function AreaSparkline({ data, color, labels, cur = "₹" }: { data: number[]; color: string; labels?: string[]; cur?: string }) {
  const W = 520, H = 160, padL = 44, padR = 16, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => padL + (i / Math.max(data.length - 1, 1)) * innerW);
  const ys = data.map(v => padT + (1 - (v - min) / range) * innerH);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L${xs[xs.length - 1].toFixed(1)},${padT + innerH} L${xs[0].toFixed(1)},${padT + innerH} Z`;
  const gridTs = [0, 0.25, 0.5, 0.75, 1];
  const lastVal = data[data.length - 1] ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {gridTs.map((t, i) => {
        const y = padT + (1 - t) * innerH;
        const val = min + t * range;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--cafyz-grid-line)" strokeDasharray="4 4" />
            <text x={padL - 5} y={y + 3.5} textAnchor="end" fill="var(--cafyz-muted)" fontSize={9}>{compactMoney(cur, val)}</text>
          </g>
        );
      })}
      {(labels ?? []).map((lbl, i) => i % 2 === 0 && xs[i] != null && (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fill="var(--cafyz-muted)" fontSize={9}>{lbl}</text>
      ))}
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === data.length - 1 ? 4 : 2.5}
          fill={i === data.length - 1 ? color : "var(--cafyz-surface)"} stroke={color} strokeWidth={1.5} />
      ))}
      {data.length > 0 && (
        <>
          <rect x={xs[xs.length - 1] - 28} y={ys[ys.length - 1] - 22} width={56} height={16} rx={4} fill={color} fillOpacity={0.9} />
          <text x={xs[xs.length - 1]} y={ys[ys.length - 1] - 11} textAnchor="middle" fill="var(--cafyz-text-strong)" fontSize={9} fontWeight="bold">
            {compactMoney(cur, lastVal)}
          </text>
        </>
      )}
    </svg>
  );
}

function BarSparkline({ data, color, cur = "₹" }: { data: { day: string; revenue: number }[]; color: string; cur?: string }) {
  const W = 320, H = 155, padL = 8, padR = 8, padT = 12, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const gap = 6;
  const barW = Math.max(4, (innerW - gap * (data.length - 1)) / Math.max(data.length, 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 155 }}>
      {[0.5, 1].map((t, i) => {
        const y = padT + (1 - t) * innerH;
        return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--cafyz-grid-line)" strokeDasharray="3 3" />;
      })}
      {data.map((d, i) => {
        const barH = Math.max(4, (d.revenue / max) * innerH);
        const x = padL + i * (barW + gap);
        const y = padT + innerH - barH;
        const isMax = d.revenue > 0 && d.revenue === max;
        return (
          <g key={i}>
            <rect x={x} y={padT} width={barW} height={innerH} rx={4} fill="var(--cafyz-accent-soft)" />
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={isMax ? color : `${color}99`} />
            {isMax && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
                {compactMoney(cur, d.revenue)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 5} textAnchor="middle" fill="var(--cafyz-muted)" fontSize={9}>{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data, centerValue, centerLabel = "items" }: { data: CatDatum[]; centerValue?: number; centerLabel?: string }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const strokeW = 22;
  const gap = 3;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let offsetDeg = -90;
  const slices = data.map(d => {
    const pct = d.value / total;
    const sliceDeg = pct * 360 - gap;
    const dashLen = (sliceDeg / 360) * circumference;
    const gapLen = circumference - dashLen;
    const rotation = offsetDeg + gap / 2;
    offsetDeg += pct * 360;
    return { ...d, dashLen, gapLen, rotation };
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>No sales yet</span>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cafyz-grid-line)" strokeWidth={strokeW} />
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={strokeW}
          strokeDasharray={`${s.dashLen.toFixed(2)} ${s.gapLen.toFixed(2)}`} strokeLinecap="round"
          style={{ transform: `rotate(${s.rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--cafyz-text)" fontSize={18} fontWeight="700" style={{ fontFamily: "var(--font-display)" }}>
        {centerValue ?? total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--cafyz-muted)" fontSize={9}>{centerLabel}</text>
    </svg>
  );
}

const QUICK_ACTIONS = [
  { id: "pos", label: "POS", icon: MonitorSpeaker, color: "#1e7fff" },
  { id: "tables", label: "Tables", icon: Users, color: "#00c6ff" },
  { id: "menu", label: "Menu", icon: UtensilsCrossed, color: "#a855f7" },
  { id: "orders", label: "Orders", icon: ShoppingBag, color: "#22d3ee" },
  { id: "analytics", label: "Analytics", icon: BarChart3, color: "#f59e0b" },
] as const;

export function Dashboard() {
  const { goToPage, goToPos } = useAppNav();
  const { user } = useAuth();
  const hasProAnalytics = planMeetsRequirement(user?.plan ?? "basic", "pro");
  const showPlanCta = canManagePlan(user?.role ?? "");
  const [revRows, setRevRows] = useState<{ day: string; revenue: number }[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [stats, setStats] = useState<ApiDashboardStats | null>(null);
  const [categoryData, setCategoryData] = useState<CatDatum[]>([]);
  const [itemsSold, setItemsSold] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [s, week, today, sold, menu, categories, orders] = await Promise.all([
        dashboardApi.stats(),
        hasProAnalytics ? dashboardApi.revenue({ period: "week" }).catch(() => null) : Promise.resolve(null),
        hasProAnalytics ? dashboardApi.revenue({ period: "day" }).catch(() => null) : Promise.resolve(null),
        hasProAnalytics ? dashboardApi.soldItems({ period: "week" }).catch(() => null) : Promise.resolve(null),
        menuApi.list().catch(() => []),
        menuCategoriesApi.list().catch(() => []),
        ordersApi.list().catch(() => []),
      ]);

      setStats(s);
      setTodayRevenue(today?.totalRevenue ?? 0);
      setWeekTotal(week?.totalRevenue ?? 0);
      const filled = week ? fillRevenueRows(week.from, week.to, week.rows ?? []) : [];
      setRevRows(filled);

      const catLabels = new Map(categories.map(c => [c.slug, c.label]));
      if (sold && menu.length) {
        const catOf = new Map(menu.map(m => [m.id, m.category]));
        const totals = new Map<string, number>();
        for (const day of sold.days ?? []) {
          for (const it of day.items) {
            const cat = catOf.get(it.menu_item_id) ?? "other";
            totals.set(cat, (totals.get(cat) ?? 0) + it.qty_sold);
          }
        }
        const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
        setItemsSold([...totals.values()].reduce((a, b) => a + b, 0));
        setCategoryData([...totals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat, qty], i) => ({
            name: catLabels.get(cat) ?? cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            value: Math.round((qty / sum) * 100),
            color: CAT_COLORS[i % CAT_COLORS.length],
          })));
      } else {
        setItemsSold(0);
        setCategoryData([]);
      }

      const recent = [...orders]
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 5);
      let liveRecent: Awaited<ReturnType<typeof ordersApi.live>> = [];
      try {
        liveRecent = await ordersApi.live();
      } catch { /* fallback below */ }
      const liveById = new Map(liveRecent.map(o => [o.id, o]));
      setRecentOrders(recent.map((o) => {
        const full = liveById.get(o.id);
        const items = full?.items ?? [];
        const amount = full?.subtotal ?? items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);
        const itemText = items.map(it => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ") || "—";
        return {
          id: "#" + o.id.slice(0, 4).toUpperCase(),
          table: o.table_name || "—",
          items: itemText,
          amount,
          status: mapStatus(o.status),
          time: relativeTime(o.created_at),
        };
      }));
    } catch (e) {
      toast.error("Couldn't load dashboard", (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasProAnalytics]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 45_000);
    return () => window.clearInterval(id);
  }, [load]);

  const cur = getCurrencySymbol();
  const occPct = stats?.tables_total ? Math.round((stats.tables_occupied / stats.tables_total) * 100) : 0;
  const lowStock = (stats?.inventory_low ?? 0) > 0;

  const kpis = [
    { label: "Today's Revenue", value: formatMoney(todayRevenue), change: "Paid orders today", up: todayRevenue > 0, icon: DollarSign, color: "#1e7fff", page: "analytics" as const },
    { label: "Orders Today", value: String(stats?.orders_today ?? 0), change: `${stats?.orders_paid ?? 0} paid`, up: (stats?.orders_today ?? 0) > 0, icon: ShoppingBag, color: "#00c6ff", page: "orders" as const },
    { label: "Active Tables", value: `${stats?.tables_occupied ?? 0}/${stats?.tables_total ?? 0}`, change: stats?.tables_total ? `${occPct}% occupied` : "—", up: occPct > 0, icon: Users, color: "#a855f7", page: "tables" as const },
    { label: "Low Inventory", value: String(stats?.inventory_low ?? 0), change: "below par", up: (stats?.inventory_low ?? 0) === 0, icon: Package, color: "#22d3ee", page: "inventory" as const },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>Overview</h2>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>
            {stats ? (
              <>
                <UserCheck size={12} className="inline mr-1" style={{ verticalAlign: "-2px" }} />
                {stats.staff_active} on shift
                {stats.staff_on_break > 0 && ` · ${stats.staff_on_break} on break`}
                {weekTotal > 0 && ` · ${formatMoney(weekTotal)} this week`}
              </>
            ) : "Loading restaurant snapshot…"}
          </p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "var(--cafyz-border)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.15)" }}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {lowStock && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          onClick={() => goToPage("inventory")}>
          <AlertCircle size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
          <p style={{ color: "#f59e0b", fontSize: "0.78rem", lineHeight: 1.5 }}>
            <strong>Low stock:</strong> {stats?.inventory_low} item{(stats?.inventory_low ?? 0) > 1 ? "s are" : " is"} below par — tap to review inventory
          </p>
        </motion.div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {QUICK_ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.id} type="button"
              onClick={() => { if (a.id === "pos") goToPos(); else goToPage(a.id); }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl flex-shrink-0 transition-all min-h-[44px]"
              style={{ background: "var(--cafyz-surface)", border: `1px solid ${a.color}33` }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${a.color}18` }}>
                <Icon size={16} style={{ color: a.color }} />
              </span>
              <span style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontWeight: 600 }}>{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.button key={kpi.label} type="button" onClick={() => goToPage(kpi.page)}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="rounded-2xl p-3 sm:p-4 relative overflow-hidden text-left transition-all hover:border-[rgba(30,127,255,0.25)]"
              style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-xl"
                style={{ background: kpi.color, transform: "translate(30%,-30%)" }} />
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
                style={{ background: `${kpi.color}18` }}>
                <Icon size={16} style={{ color: kpi.color }} />
              </div>
              <div style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem", marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.2, marginBottom: 4 }}>
                {loading ? "—" : kpi.value}
              </div>
              <div className="flex items-center gap-1" style={{ color: kpi.up ? "#22c55e" : "#ff3b5c", fontSize: "0.68rem" }}>
                {kpi.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {kpi.change}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-3 sm:p-4"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>7-Day Revenue</h3>
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>Paid orders · daily</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>
              {formatMoney(weekTotal)}
            </span>
          </div>
          <div className="w-full overflow-hidden">
            {loading ? (
              <div className="h-40 flex items-center justify-center"><span style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>Loading…</span></div>
            ) : revRows.length >= 1 ? (
              <AreaSparkline
                data={revRows.map(d => d.revenue)}
                labels={revRows.map(d => d.day)}
                cur={cur}
                color="#1e7fff"
              />
            ) : !hasProAnalytics ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>
                  {showPlanCta ? "Revenue charts require the Pro plan" : "Revenue charts require the Pro plan — ask your manager to upgrade"}
                </span>
                {showPlanCta && (
                <button type="button" onClick={() => goToPage("license")} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>View plans</button>
                )}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center"><span style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>No paid orders this week yet</span></div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-3 sm:p-4"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Items by Category</h3>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginBottom: 12 }}>This week's sales mix</p>
          <div className="flex lg:flex-col items-center gap-4 lg:gap-2">
            <div className="flex-shrink-0">
              <DonutChart data={categoryData} centerValue={itemsSold} centerLabel="sold" />
            </div>
            <div className="flex-1 w-full space-y-2">
              {categoryData.length === 0 && !loading && (
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", textAlign: "center" }}>No item sales this week</p>
              )}
              {categoryData.map(cat => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="truncate" style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.73rem" }}>{cat.name}</span>
                  </div>
                  <span style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Weekly bar + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-2xl p-3 sm:p-4"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Daily Totals</h3>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginBottom: 8 }}>Bar view · this week</p>
          <BarSparkline data={revRows.length ? revRows : [{ day: "—", revenue: 0 }]} cur={cur} color="#1e7fff" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="lg:col-span-3 rounded-2xl p-3 sm:p-4"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>Recent Orders</h3>
            <button type="button" onClick={() => goToPage("orders")} className="flex items-center gap-1" style={{ color: "#1e7fff", fontSize: "0.75rem" }}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {loading && (
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem", textAlign: "center", padding: "2rem 0" }}>Loading orders…</p>
            )}
            {!loading && recentOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <ShoppingBag size={24} style={{ color: "var(--cafyz-muted)" }} />
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>No orders yet — start from POS</p>
                <button type="button" onClick={goToPos}
                  className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  Open POS
                </button>
              </div>
            )}
            {recentOrders.map(order => (
              <button key={order.id} type="button" onClick={() => goToPage("orders")}
                className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all text-left hover:border-[rgba(30,127,255,0.2)]"
                style={{ border: "1px solid rgba(30,127,255,0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--cafyz-border)" }}>
                  <span style={{ color: "#1e7fff", fontSize: "0.6rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {order.table}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{order.id}</span>
                    <span style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>{order.time}</span>
                  </div>
                  <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>{order.items}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ color: "var(--cafyz-text)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{formatMoney(order.amount)}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: statusBg[order.status], color: statusColors[order.status] }}>
                    {order.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
