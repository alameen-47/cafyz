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
import { onResume } from "../../hooks/useOnResume";
import { usePolling } from "../../hooks/usePolling";
import { keepIfSame } from "../../utils/sameData";
import { withAlpha } from "../../utils/color";

import { HScroll } from "./HScroll";
const CAT_COLORS = ["var(--cafyz-brand)", "#b9a7e8", "var(--cafyz-brand-alt)", "var(--cafyz-brand-alt)", "#00d4ff", "#9188b8"];

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
  served: "#00d68f",
  preparing: "#ffaa00",
  ready: "var(--cafyz-brand)",
};
const statusBg: Record<string, string> = {
  served: "rgba(0,214,143,0.12)",
  preparing: "rgba(255,170,0,0.12)",
  ready: "rgba(var(--cafyz-brand-rgb),0.12)",
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
      <defs>
        <linearGradient id="cafyzAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--cafyz-brand-deep)" }} stopOpacity={0.42} />
          <stop offset="100%" style={{ stopColor: "var(--cafyz-brand-alt)" }} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="cafyzAreaLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" style={{ stopColor: "var(--cafyz-brand-alt)" }} />
          <stop offset="45%" style={{ stopColor: "var(--cafyz-brand-bright)" }} />
          <stop offset="100%" style={{ stopColor: "var(--cafyz-brand-deep)" }} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#cafyzAreaFill)" />
      <path d={linePath} fill="none" stroke="url(#cafyzAreaLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === data.length - 1 ? 4 : 2.5}
          fill={color} stroke="var(--cafyz-surface)" strokeWidth={1.5} />
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
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={isMax ? color : `${withAlpha(color, 0x99)}`} />
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
  { id: "pos", label: "POS", icon: MonitorSpeaker, color: "var(--cafyz-brand)" },
  { id: "tables", label: "Tables", icon: Users, color: "var(--cafyz-brand-2)" },
  { id: "menu", label: "Menu", icon: UtensilsCrossed, color: "var(--cafyz-brand)" },
  { id: "orders", label: "Orders", icon: ShoppingBag, color: "var(--cafyz-brand-2)" },
  { id: "inventory", label: "Inventory", icon: Package, color: "var(--cafyz-brand-2)" },
  { id: "analytics", label: "Analytics", icon: BarChart3, color: "var(--cafyz-brand)" },
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

      setStats(prev => keepIfSame(prev, s));
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
          table: o.order_type === "parcel" ? "Parcel" : (o.table_name || "Counter"),
          items: itemText,
          amount,
          status: mapStatus(o.status),
          time: relativeTime(o.created_at),
        };
      }));
    } catch (e) {
      // A load that fails while the app is in the background retries on resume — no toast for it.
      if (document.visibilityState === "visible") toast.error("Couldn't load dashboard", (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasProAnalytics]);

  useEffect(() => {
    void load();
    const stopResume = onResume(() => { void load(true); });
    return () => { stopResume(); };
  }, [load]);

  usePolling(() => { void load(true); }, 45_000);

  const cur = getCurrencySymbol();
  const occPct = stats?.tables_total ? Math.round((stats.tables_occupied / stats.tables_total) * 100) : 0;
  const lowStock = (stats?.inventory_low ?? 0) > 0;

  const kpis = [
    { label: "Today's Revenue", value: formatMoney(todayRevenue), change: "Paid orders today", up: todayRevenue > 0, icon: DollarSign, color: "var(--cafyz-brand)", page: "analytics" as const },
    { label: "Orders Today", value: String(stats?.orders_today ?? 0), change: `${stats?.orders_paid ?? 0} paid`, up: (stats?.orders_today ?? 0) > 0, icon: ShoppingBag, color: "var(--cafyz-brand-2)", page: "orders" as const },
    { label: "Active Tables", value: `${stats?.tables_occupied ?? 0}/${stats?.tables_total ?? 0}`, change: stats?.tables_total ? `${occPct}% occupied` : "—", up: occPct > 0, icon: Users, color: "var(--cafyz-brand)", page: "tables" as const },
    { label: "Low Inventory", value: String(stats?.inventory_low ?? 0), change: "below par", up: (stats?.inventory_low ?? 0) === 0, icon: Package, color: "var(--cafyz-brand-2)", page: "inventory" as const },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.45rem", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Overview</h2>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.76rem", marginTop: 2 }}>
            {stats ? (
              <>
                <UserCheck size={13} className="inline me-1" style={{ verticalAlign: "-2px" }} />
                {stats.staff_active} on shift
                {stats.staff_on_break > 0 && ` · ${stats.staff_on_break} on break`}
                {weekTotal > 0 && ` · ${formatMoney(weekTotal)} this week`}
              </>
            ) : "Loading restaurant snapshot…"}
          </p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing}
          className="cafyz-pill-btn flex-shrink-0">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {lowStock && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          role="button" tabIndex={0}
          className="cafyz-warn-banner cursor-pointer"
          onKeyDown={e => { if (e.key === "Enter") goToPage("inventory"); }}
          onClick={() => goToPage("inventory")}>
          <AlertCircle size={18} style={{ color: "var(--cafyz-warning)", flexShrink: 0 }} />
          <p className="flex-1 min-w-0" style={{ color: "var(--cafyz-warning)", fontSize: "0.82rem", lineHeight: 1.45 }}>
            <strong>Low stock:</strong> {stats?.inventory_low} item{(stats?.inventory_low ?? 0) > 1 ? "s are" : " is"} below par — tap to review inventory
          </p>
          <ChevronRight size={16} className="flex-shrink-0 rtl:rotate-180" style={{ color: "var(--cafyz-text-secondary)" }} />
        </motion.div>
      )}

      {/* Quick actions */}
      <HScroll className="gap-2.5 pb-1">
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button key={a.id} type="button"
              onClick={() => { if (a.id === "pos") goToPos(); else goToPage(a.id); }}
              className={`cafyz-shortcut flex-shrink-0 ${i === 0 ? "is-primary" : ""}`}>
              <Icon size={19} strokeWidth={1.9} style={{ color: i === 0 ? "#ffffff" : a.color, flexShrink: 0 }} />
              <span>{a.label}</span>
            </button>
          );
        })}
      </HScroll>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.button key={kpi.label} type="button" onClick={() => goToPage(kpi.page)}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`cafyz-metric ${i % 2 === 1 ? "is-alt" : ""}`}>
              <span className="cafyz-metric-wave" aria-hidden />
              <span className="cafyz-metric-icon" style={{ background: `${withAlpha(kpi.color, 0x2e)}`, color: kpi.color }}>
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <span className="cafyz-metric-label">{kpi.label}</span>
              <span className="cafyz-metric-value">{loading ? "—" : kpi.value}</span>
              <span className="cafyz-metric-status" style={{ color: kpi.up ? "var(--cafyz-success)" : "var(--cafyz-danger)" }}>
                {kpi.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span className="truncate">{kpi.change}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="md:col-span-2 cafyz-dash-card p-4"
          style={{ background: "var(--cafyz-card-a)" }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3 size={22} strokeWidth={2.2} style={{ color: "var(--cafyz-brand)", flexShrink: 0 }} />
              <div className="min-w-0">
                <h3 className="truncate" style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}>7-Day Revenue</h3>
                <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.76rem" }}>Paid orders · daily</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: "rgba(var(--cafyz-brand-rgb),0.14)", color: "var(--cafyz-brand-bright)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.4)", fontSize: "0.8rem", fontWeight: 700 }}>
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
                color="var(--cafyz-brand)"
              />
            ) : !hasProAnalytics ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>
                  {showPlanCta ? "Revenue charts require the Pro plan" : "Revenue charts require the Pro plan — ask your manager to upgrade"}
                </span>
                {showPlanCta && (
                <button type="button" onClick={() => goToPage("license")} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(var(--cafyz-brand-rgb),0.12)", color: "var(--cafyz-brand)" }}>View plans</button>
                )}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center"><span style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>No paid orders this week yet</span></div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="cafyz-dash-card p-4">
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Items by Category</h3>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginBottom: 12 }}>This week's sales mix</p>
          <div className="flex md:flex-col items-center gap-4 md:gap-2">
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="md:col-span-2 cafyz-dash-card p-4">
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Daily Totals</h3>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", marginBottom: 8 }}>Bar view · this week</p>
          <BarSparkline data={revRows.length ? revRows : [{ day: "—", revenue: 0 }]} cur={cur} color="var(--cafyz-brand)" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="md:col-span-3 cafyz-dash-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>Recent Orders</h3>
            <button type="button" onClick={() => goToPage("orders")} className="flex items-center gap-1" style={{ color: "var(--cafyz-brand)", fontSize: "0.75rem" }}>
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
                  style={{ background: "var(--cafyz-gradient)", color: "#fff" }}>
                  Open POS
                </button>
              </div>
            )}
            {recentOrders.map(order => (
              <button key={order.id} type="button" onClick={() => goToPage("orders")}
                className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all text-start hover:border-[rgba(var(--cafyz-brand-rgb),0.2)]"
                style={{ border: "1px solid rgba(var(--cafyz-brand-rgb),0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--cafyz-border)" }}>
                  <span style={{ color: "var(--cafyz-brand)", fontSize: "0.6rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
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
                <div className="text-end flex-shrink-0">
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
