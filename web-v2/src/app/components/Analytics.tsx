import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { dashboardApi, menuApi, ordersApi, type RevenueQueryParams } from "../../services/api";
import { formatMoney, getCurrencySymbol } from "../../utils/currency";

const periods = ["Today", "7 Days", "30 Days", "3 Months"];

type RevPoint = { month: string; revenue: number; profit: number };
type ItemPoint = { name: string; revenue: number };
type RadarPoint = { metric: string; score: number };
type HourPoint = { hour: string; covers: number };
type Kpi = { label: string; value: string; change: string; up: boolean };

const shortDay = (iso: string) => {
  const d = new Date((iso || "") + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const catLabel = (slug: string) => slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Other";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function revenueQueryForPeriod(period: string): RevenueQueryParams {
  if (period === "Today") return { period: "day" };
  if (period === "7 Days") return { period: "week" };
  if (period === "30 Days") return { period: "month" };
  const to = isoDate(new Date());
  const from = new Date();
  from.setDate(from.getDate() - 89);
  return { period: "range", from: isoDate(from), to };
}

function orderDateKey(createdAt?: string) {
  return (createdAt || "").slice(0, 10);
}

function orderInSelectedPeriod(createdAt: string | undefined, period: string, range?: { from: string; to: string }) {
  const day = orderDateKey(createdAt);
  if (!day) return false;
  if (period === "Today") return day === isoDate(new Date());
  if (period === "7 Days") {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return day >= isoDate(start) && day <= isoDate(new Date());
  }
  if (period === "30 Days") {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return day >= isoDate(start) && day <= isoDate(new Date());
  }
  if (range) return day >= range.from && day <= range.to;
  return true;
}

// ── Custom dual-line area chart (revenue; profit line only if present) ─────────
function DualAreaChart({ data, cur = "₹" }: { data: RevPoint[]; cur?: string }) {
  const W = 600, H = 180, padL = 48, padR = 16, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (data.length < 2) {
    return <div style={{ height: 180 }} className="flex items-center justify-center"><span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>Not enough data for this period yet</span></div>;
  }
  const hasProfit = data.some(d => d.profit > 0);
  const allVals = data.flatMap(d => hasProfit ? [d.revenue, d.profit] : [d.revenue]);
  const max = Math.max(...allVals) || 1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const yRev = data.map(d => padT + (1 - d.revenue / max) * innerH);
  const yProf = data.map(d => padT + (1 - d.profit / max) * innerH);
  const linePath = (ys: number[]) => xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaPath = (ys: number[]) => linePath(ys) + ` L${xs[xs.length-1].toFixed(1)},${H - padB} L${xs[0].toFixed(1)},${H - padB} Z`;
  const gridYs = [0.25, 0.5, 0.75, 1].map(t => padT + (1 - t) * innerH);
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(30,127,255,0.06)" strokeDasharray="4 3" />
          <text x={padL - 4} y={y + 4} textAnchor="end" fill="#6b82a0" fontSize={9}>
            {cur}{((max * [0.25,0.5,0.75,1][i]) / 1000).toFixed(1)}k
          </text>
        </g>
      ))}
      {data.map((d, i) => i % labelEvery === 0 && (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fill="#6b82a0" fontSize={9}>{d.month}</text>
      ))}
      <path d={areaPath(yRev)} fill="#1e7fff" fillOpacity={0.1} />
      {hasProfit && <path d={areaPath(yProf)} fill="#00c6ff" fillOpacity={0.08} />}
      <path d={linePath(yRev)} fill="none" stroke="#1e7fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {hasProfit && <path d={linePath(yProf)} fill="none" stroke="#00c6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={yRev[i]} r={3} fill="#1e7fff" />
          {hasProfit && <circle cx={x} cy={yProf[i]} r={3} fill="#00c6ff" />}
        </g>
      ))}
    </svg>
  );
}

// ── Custom horizontal bar chart ───────────────────────────────────────────────
function HorizontalBarChart({ data, cur = "₹" }: { data: ItemPoint[]; cur?: string }) {
  if (data.length === 0) {
    return <div className="py-8 text-center"><span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No sales recorded for this period yet</span></div>;
  }
  const max = Math.max(...data.map(d => d.revenue)) || 1;
  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.revenue / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-right flex-shrink-0" style={{ color: "#a8bdd4", fontSize: "0.72rem", width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(30,127,255,0.08)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: i === 0 ? "#1e7fff" : i === 2 ? "#00c6ff" : "#1e4a88" }}
              />
            </div>
            <span style={{ color: "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", width: 56, textAlign: "right", flexShrink: 0 }}>
              {cur}{(item.revenue / 1000).toFixed(1)}k
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Custom radar / spider chart ───────────────────────────────────────────────
function RadarChart({ data }: { data: RadarPoint[] }) {
  const cx = 110, cy = 110, r = 80;
  const n = data.length;
  if (n < 3) {
    return <div style={{ height: 200 }} className="flex items-center justify-center"><span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>Not enough categories sold yet</span></div>;
  }
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;
  const rings = [0.25, 0.5, 0.75, 1];

  const pt = (i: number, radius: number) => {
    const a = startAngle + i * angleStep;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  const ringPath = (scale: number) =>
    [...Array(n)].map((_, i) => {
      const { x, y } = pt(i, r * scale);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z";

  const dataPath = data.map((d, i) => {
    const { x, y } = pt(i, (d.score / 100) * r);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";

  return (
    <svg viewBox={`0 0 220 220`} className="w-full" style={{ height: 200 }}>
      {rings.map((scale, i) => (
        <path key={i} d={ringPath(scale)} fill="none" stroke="rgba(30,127,255,0.1)" strokeWidth={1} />
      ))}
      {[...Array(n)].map((_, i) => {
        const { x, y } = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(30,127,255,0.08)" strokeWidth={1} />;
      })}
      <path d={dataPath} fill="#1e7fff" fillOpacity={0.15} stroke="#1e7fff" strokeWidth={2} />
      {data.map((d, i) => {
        const { x, y } = pt(i, (d.score / 100) * r);
        const lp = pt(i, r + 14);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill="#1e7fff" />
            <text x={lp.x} y={lp.y + 4} textAnchor="middle" fill="#6b82a0" fontSize={8.5}>{d.metric}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Custom line sparkline ─────────────────────────────────────────────────────
function LineSparkline({ data }: { data: HourPoint[] }) {
  const W = 600, H = 120, padL = 30, padR = 12, padT = 8, padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (data.length < 2) {
    return <div style={{ height: 120 }} className="flex items-center justify-center"><span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No order activity yet</span></div>;
  }
  const max = Math.max(...data.map(d => d.covers)) || 1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const ys = data.map(d => padT + (1 - d.covers / max) * innerH);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const peak = ys.indexOf(Math.min(...ys));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {[0.5, 1].map((t, i) => {
        const y = padT + (1 - t) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(30,127,255,0.06)" strokeDasharray="4 3" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fill="#6b82a0" fontSize={8}>{Math.round(max * t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => i % 2 === 0 && (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fill="#6b82a0" fontSize={8}>{d.hour}</text>
      ))}
      <path d={linePath} fill="none" stroke="#00c6ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[peak]} cy={ys[peak]} r={4} fill="#00c6ff" />
      <text x={xs[peak]} y={ys[peak] - 8} textAnchor="middle" fill="#00c6ff" fontSize={8} fontWeight="bold">peak</text>
    </svg>
  );
}

export function Analytics() {
  const [period, setPeriod] = useState("30 Days");
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [revTrend, setRevTrend] = useState<RevPoint[]>([]);
  const [topItems, setTopItems] = useState<ItemPoint[]>([]);
  const [radar, setRadar] = useState<RadarPoint[]>([]);
  const [hourly, setHourly] = useState<HourPoint[]>([]);
  const cur = getCurrencySymbol();

  useEffect(() => {
    let alive = true;
    const query = revenueQueryForPeriod(period);
    const periodKey: RevenuePeriod = query.period ?? "month";
    (async () => {
      const [stats, rev, sold, menu, orders] = await Promise.all([
        dashboardApi.stats().catch(() => null),
        dashboardApi.revenue(query).catch(() => null),
        dashboardApi.soldItems(query).catch(() => null),
        menuApi.list().catch(() => []),
        ordersApi.list().catch(() => []),
      ]);
      if (!alive) return;

      const range = query.period === "range" && query.from && query.to
        ? { from: query.from, to: query.to }
        : undefined;

      // Revenue trend (daily rows)
      setRevTrend((rev?.rows ?? []).map(r => ({ month: shortDay(r.day), revenue: r.revenue, profit: 0 })));

      // Top items + category split from sold-items × menu prices
      const priceById = new Map(menu.map(m => [m.id, m.price]));
      const nameById = new Map(menu.map(m => [m.id, m.name]));
      const catById = new Map(menu.map(m => [m.id, m.category]));
      const itemRev = new Map<string, number>();
      const catQty = new Map<string, number>();
      for (const day of sold?.days ?? []) for (const it of day.items) {
        itemRev.set(it.menu_item_id, (itemRev.get(it.menu_item_id) ?? 0) + (priceById.get(it.menu_item_id) ?? 0) * it.qty_sold);
        const cat = catById.get(it.menu_item_id) ?? "other";
        catQty.set(cat, (catQty.get(cat) ?? 0) + it.qty_sold);
      }
      setTopItems([...itemRev.entries()]
        .map(([id, r]) => ({ name: nameById.get(id) ?? "Item", revenue: r }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 6));

      const allCats = [...new Set(menu.map(m => m.category))];
      const maxCat = Math.max(1, ...[...catQty.values()]);
      setRadar(allCats.map(c => ({ metric: catLabel(c), score: Math.round(((catQty.get(c) ?? 0) / maxCat) * 100) })));

      // Covers by hour from orders in the selected period
      const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, covers: 0 }));
      orders
        .filter(o => orderInSelectedPeriod(o.created_at, period, range))
        .forEach(o => {
          const h = parseInt((o.created_at || "").slice(11, 13), 10);
          if (!isNaN(h) && h >= 0 && h < 24) buckets[h].covers += o.covers || 1;
        });
      setHourly(buckets.slice(9, 24));

      const paidInPeriod = orders.filter(o =>
        (o.status === "paid" || o.status === "comped") && orderInSelectedPeriod(o.created_at, period, range),
      ).length;

      // KPIs from real totals
      const totalRev = rev?.totalRevenue ?? 0;
      const totalOrders = rev?.totalOrders ?? 0;
      const itemsSold = [...catQty.values()].reduce((a, b) => a + b, 0);
      const occ = stats?.tables_total ? Math.round((stats.tables_occupied / stats.tables_total) * 100) : 0;
      setKpis([
        { label: "Revenue", value: formatMoney(totalRev), change: rev?.periodLabel ?? period, up: true },
        { label: "Avg Order Value", value: formatMoney(totalOrders ? totalRev / totalOrders : 0), change: "per order", up: true },
        { label: "Orders", value: String(totalOrders), change: period, up: true },
        { label: "Items Sold", value: String(itemsSold), change: "this period", up: true },
        { label: "Active Tables", value: `${stats?.tables_occupied ?? 0}/${stats?.tables_total ?? 0}`, change: `${occ}% occ.`, up: true },
        { label: "Paid Orders", value: String(paidInPeriod), change: period, up: true },
      ]);
    })();
    return () => { alive = false; };
  }, [period]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2 p-1 rounded-xl w-fit" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={period === p ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" } : { color: "#6b82a0" }}>
            {p}
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div style={{ color: "#6b82a0", fontSize: "0.7rem", marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>{kpi.value}</div>
            <div className="flex items-center gap-1 mt-1" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>
              <TrendingUp size={10} style={{ color: "#1e7fff" }} />
              {kpi.change}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Revenue trend */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600 }}>Revenue Trend</h3>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "#1e7fff" }}>
            <span className="w-3 h-0.5 rounded inline-block" style={{ background: "#1e7fff" }} /> Revenue
          </span>
        </div>
        <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>Daily revenue · {period}</p>
        <DualAreaChart data={revTrend} cur={cur} />
      </motion.div>

      {/* Top items + Category split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="lg:col-span-2 rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Top Performing Items</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 16 }}>By revenue generated</p>
          <HorizontalBarChart data={topItems} cur={cur} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Sales by Category</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 4 }}>Share of items sold</p>
          <RadarChart data={radar} />
        </motion.div>
      </div>

      {/* Hourly covers */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Covers by Hour</h3>
        <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>Orders in {period.toLowerCase()}</p>
        <LineSparkline data={hourly} />
      </motion.div>
    </div>
  );
}
