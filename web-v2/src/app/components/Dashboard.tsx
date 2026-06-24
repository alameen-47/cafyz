import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign,
  Package, ChevronRight, AlertCircle
} from "lucide-react";
import { dashboardApi, ordersApi, menuApi } from "../../services/api";
import { formatMoney, getCurrencySymbol } from "../../utils/currency";
import { useAppNav } from "../nav";

const CAT_COLORS = ["#1e7fff", "#00c6ff", "#a855f7", "#22d3ee", "#f59e0b", "#22c55e"];
const CAT_LABELS: Record<string, string> = { starters: "Starters", mains: "Mains", desserts: "Desserts", wine: "Wine", drinks: "Drinks" };

// Map backend order status → the design's status vocabulary + colors
function mapStatus(s: string): "served" | "preparing" | "ready" {
  if (s === "paid" || s === "comped") return "served";
  if (s === "open") return "ready";
  return "preparing"; // sent / voided / default
}
function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
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

// ── Area sparkline ────────────────────────────────────────────────────────────
function AreaSparkline({ data, color, labels, cur = "₹" }: { data: number[]; color: string; labels?: string[]; cur?: string }) {
  const W = 520, H = 160, padL = 44, padR = 16, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const ys = data.map(v => padT + (1 - (v - min) / range) * innerH);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L${xs[xs.length - 1].toFixed(1)},${padT + innerH} L${xs[0].toFixed(1)},${padT + innerH} Z`;
  const gridTs = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid */}
      {gridTs.map((t, i) => {
        const y = padT + (1 - t) * innerH;
        const val = min + t * range;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(30,127,255,0.07)" strokeDasharray="4 4" />
            <text x={padL - 5} y={y + 3.5} textAnchor="end" fill="#6b82a0" fontSize={9}>{cur}{(val / 1000).toFixed(0)}k</text>
          </g>
        );
      })}
      {/* X-axis labels */}
      {(labels ?? []).map((lbl, i) => i % 2 === 0 && xs[i] != null && (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fill="#6b82a0" fontSize={9}>{lbl}</text>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots — only on data points, highlight last */}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === data.length - 1 ? 4 : 2.5}
          fill={i === data.length - 1 ? color : "#0d1326"}
          stroke={color} strokeWidth={1.5} />
      ))}
      {/* Tooltip anchor on last point */}
      <rect x={xs[xs.length-1] - 24} y={ys[ys.length-1] - 22} width={48} height={16} rx={4}
        fill={color} fillOpacity={0.9} />
      <text x={xs[xs.length-1]} y={ys[ys.length-1] - 11} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold">
        {cur}{(data[data.length-1] / 1000).toFixed(1)}k
      </text>
    </svg>
  );
}

// ── Bar sparkline ─────────────────────────────────────────────────────────────
function BarSparkline({ data, color, cur = "₹" }: { data: { day: string; revenue: number }[]; color: string; cur?: string }) {
  const W = 320, H = 155, padL = 8, padR = 8, padT = 12, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map(d => d.revenue)) || 1;
  const gap = 6;
  const barW = (innerW - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 155 }}>
      {/* Grid lines */}
      {[0.5, 1].map((t, i) => {
        const y = padT + (1 - t) * innerH;
        return (
          <line key={i} x1={padL} y1={y} x2={W - padR} y2={y}
            stroke="rgba(30,127,255,0.06)" strokeDasharray="3 3" />
        );
      })}
      {data.map((d, i) => {
        const barH = Math.max(4, (d.revenue / max) * innerH);
        const x = padL + i * (barW + gap);
        const y = padT + innerH - barH;
        const isMax = d.revenue === max;
        return (
          <g key={i}>
            {/* Bar background track */}
            <rect x={x} y={padT} width={barW} height={innerH} rx={4}
              fill="rgba(30,127,255,0.04)" />
            {/* Bar fill */}
            <rect x={x} y={y} width={barW} height={barH} rx={4}
              fill={isMax ? color : `${color}99`} />
            {/* Value label on tallest bar */}
            {isMax && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
                {cur}{(d.revenue / 1000).toFixed(1)}k
              </text>
            )}
            {/* Day label */}
            <text x={x + barW / 2} y={H - 5} textAnchor="middle" fill="#6b82a0" fontSize={9}>{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut chart using stroke-dasharray (correct and reliable) ─────────────────
function DonutChart({ data, centerValue, centerLabel = "items" }: { data: CatDatum[]; centerValue?: number; centerLabel?: string }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;          // ring radius
  const strokeW = 22;    // ring thickness
  const gap = 3;         // gap between slices in degrees

  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);

  // Build slices: each gets a dasharray segment rotated to its position
  let offsetDeg = -90; // start at top
  const slices = data.map(d => {
    const pct = d.value / total;
    const sliceDeg = pct * 360 - gap;
    const dashLen = (sliceDeg / 360) * circumference;
    const gapLen = circumference - dashLen;
    const rotation = offsetDeg + gap / 2;
    offsetDeg += pct * 360;
    return { ...d, dashLen, gapLen, rotation, pct };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(30,127,255,0.07)" strokeWidth={strokeW} />
      {/* Slices */}
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeW}
          strokeDasharray={`${s.dashLen.toFixed(2)} ${s.gapLen.toFixed(2)}`}
          strokeLinecap="round"
          style={{ transform: `rotate(${s.rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {/* Centre label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e8eef8" fontSize={18} fontWeight="700"
        style={{ fontFamily: "var(--font-display)" }}>
        {centerValue ?? total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b82a0" fontSize={9}>{centerLabel}</text>
    </svg>
  );
}

export function Dashboard() {
  const { goToPage } = useAppNav();
  const [revRows, setRevRows] = useState<{ day: string; revenue: number }[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [stats, setStats] = useState<{ orders_today: number; tables_total: number; tables_occupied: number; inventory_low: number; staff_active: number } | null>(null);
  const [categoryData, setCategoryData] = useState<CatDatum[]>([]);
  const [itemsSold, setItemsSold] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, week, today, sold, menu, orders] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.revenue({ period: 'week' }),
          dashboardApi.revenue({ period: 'day' }),
          dashboardApi.soldItems({ period: 'week' }).catch(() => null),
          menuApi.list().catch(() => []),
          ordersApi.list().catch(() => []),
        ]);
        if (!alive) return;
        setStats(s);
        setTodayRevenue(today.totalRevenue ?? 0);
        setRevRows((week.rows ?? []).map(r => ({
          day: new Date((r.day || '') + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
          revenue: r.revenue,
        })));
        // Category split from sold-items × menu category map
        if (sold && menu.length) {
          const catOf = new Map(menu.map(m => [m.id, m.category]));
          const totals = new Map<string, number>();
          for (const day of sold.days ?? []) for (const it of day.items) {
            const cat = catOf.get(it.menu_item_id) ?? 'other';
            totals.set(cat, (totals.get(cat) ?? 0) + it.qty_sold);
          }
          const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
          setItemsSold([...totals.values()].reduce((a, b) => a + b, 0));
          setCategoryData([...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, qty], i) => ({
            name: CAT_LABELS[cat] ?? cat, value: Math.round((qty / sum) * 100), color: CAT_COLORS[i % CAT_COLORS.length],
          })));
        }
        // Recent orders — enrich the 5 newest with item summary + amount
        const recent = orders.slice(0, 5);
        const detailed = await Promise.all(recent.map(o => ordersApi.get(o.id).catch(() => null)));
        if (!alive) return;
        setRecentOrders(recent.map((o, i) => {
          const full = detailed[i];
          const items = full?.items ?? [];
          const amount = items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);
          const itemText = items.map(it => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''}`).join(', ') || '—';
          return {
            id: '#' + o.id.slice(0, 4).toUpperCase(),
            table: o.table_name || '—',
            items: itemText,
            amount,
            status: mapStatus(o.status),
            time: relativeTime(o.created_at),
          };
        }));
      } catch { /* gracefully render empty */ }
    })();
    return () => { alive = false; };
  }, []);

  const cur = getCurrencySymbol();
  const kpis = [
    { label: "Today's Revenue", value: formatMoney(todayRevenue), change: "Today", up: true, icon: DollarSign, color: "#1e7fff" },
    { label: "Orders Today", value: String(stats?.orders_today ?? 0), change: "Live", up: true, icon: ShoppingBag, color: "#00c6ff" },
    { label: "Active Tables", value: `${stats?.tables_occupied ?? 0}/${stats?.tables_total ?? 0}`, change: stats?.tables_total ? `${Math.round(((stats.tables_occupied) / stats.tables_total) * 100)}% occ.` : "—", up: true, icon: Users, color: "#a855f7" },
    { label: "Low Inventory", value: String(stats?.inventory_low ?? 0), change: "below par", up: (stats?.inventory_low ?? 0) === 0, icon: Package, color: "#22d3ee" },
  ];
  const revenueData = revRows;
  const weeklyData = revRows;
  const lowStock = (stats?.inventory_low ?? 0) > 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Alert banner — only when items are below par */}
      {lowStock && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          onClick={() => goToPage("inventory")}>
          <AlertCircle size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
          <p style={{ color: "#f59e0b", fontSize: "0.78rem", lineHeight: 1.5 }}>
            <strong>Low stock:</strong> {stats?.inventory_low} item{(stats?.inventory_low ?? 0) > 1 ? 's are' : ' is'} below par — reorder soon
          </p>
        </motion.div>
      )}

      {/* KPI Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl p-3 sm:p-4 relative overflow-hidden"
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-xl"
                style={{ background: kpi.color, transform: "translate(30%,-30%)" }} />
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
                style={{ background: `${kpi.color}18` }}>
                <Icon size={16} style={{ color: kpi.color }} />
              </div>
              <div style={{ color: "#6b82a0", fontSize: "0.68rem", marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.2, marginBottom: 4 }}>
                {kpi.value}
              </div>
              <div className="flex items-center gap-1" style={{ color: kpi.up ? "#22c55e" : "#ff3b5c", fontSize: "0.68rem" }}>
                {kpi.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {kpi.change}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts row — stacked on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Revenue sparkline */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-3 sm:p-4"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>7-Day Revenue</h3>
              <p style={{ color: "#6b82a0", fontSize: "0.72rem" }}>Daily breakdown</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>Live</span>
          </div>
          <div className="w-full overflow-hidden">
            <AreaSparkline
              data={revenueData.length >= 2 ? revenueData.map(d => d.revenue) : [0, 0]}
              labels={revenueData.length >= 2 ? revenueData.map(d => d.day) : []}
              cur={cur}
              color="#1e7fff"
            />
          </div>
        </motion.div>

        {/* Category donut */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-3 sm:p-4"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Order Categories</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.72rem", marginBottom: 12 }}>This week's split</p>
          {/* On mobile: horizontal layout; on desktop: stacked */}
          <div className="flex lg:flex-col items-center gap-4 lg:gap-2">
            <div className="flex-shrink-0">
              <DonutChart data={categoryData} centerValue={itemsSold} centerLabel="items" />
            </div>
            <div className="flex-1 w-full space-y-2">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span style={{ color: "#a8bdd4", fontSize: "0.73rem" }}>{cat.name}</span>
                  </div>
                  <span style={{ color: "#e8eef8", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{cat.value}%</span>
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
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", marginBottom: 2 }}>Weekly Revenue</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.72rem", marginBottom: 8 }}>This week</p>
          <div className="w-full overflow-hidden">
            <BarSparkline data={weeklyData.length ? weeklyData : [{ day: '—', revenue: 0 }]} cur={cur} color="#1e7fff" />
          </div>
        </motion.div>

        {/* Recent orders */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="lg:col-span-3 rounded-2xl p-3 sm:p-4"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>Recent Orders</h3>
            <button type="button" onClick={() => goToPage("orders")} className="flex items-center gap-1" style={{ color: "#1e7fff", fontSize: "0.75rem" }}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id}
                className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all"
                style={{ border: "1px solid rgba(30,127,255,0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(30,127,255,0.1)" }}>
                  <span style={{ color: "#1e7fff", fontSize: "0.6rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {order.table}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "#e8eef8", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{order.id}</span>
                    <span style={{ color: "#6b82a0", fontSize: "0.68rem" }}>{order.time}</span>
                  </div>
                  <p className="truncate" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{order.items}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ color: "#e8eef8", fontSize: "0.82rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{cur}{order.amount.toFixed(0)}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: statusBg[order.status], color: statusColors[order.status] }}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
