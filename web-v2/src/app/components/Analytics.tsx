import { motion } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle, BarChart3,
  Printer, FileText, CalendarRange, ChevronRight,
} from "lucide-react";
import { toast } from "./Toast";
import {
  dashboardApi, menuCategoriesApi, restaurantApi,
  type ApiAnalyticsResponse, type ApiRestaurant,
} from "../../services/api";
import { formatMoney, getCurrencySymbol } from "../../utils/currency";
import { useAuth } from "../auth";
import {
  autoReconnectBluetooth, ensureBluetoothReady, printMonthlyReport, printSalesReport, printerStatus,
} from "../../services/PrintService";
import { buildPeriodBreakdownReport, buildSalesReportFromAnalytics } from "../../services/analyticsReports";
import {
  ANALYTICS_PRESETS, buildAnalyticsQuery, currentMonthISO, defaultCustomFrom,
  formatFilterRange, isoDate, type AnalyticsPreset,
} from "../../utils/analyticsPeriod";

const periods = ANALYTICS_PRESETS;
type PeriodLabel = AnalyticsPreset;

type RevPoint = { month: string; revenue: number; profit: number };
type ItemPoint = { name: string; revenue: number; qty: number };
type RadarPoint = { metric: string; score: number };
type HourPoint = { hour: string; covers: number };
type Kpi = { label: string; value: string; change: string; up: boolean };

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

function shortDay(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function monthBounds(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0);
  return { from, to: isoDate(last) };
}

function compactMoney(cur: string, amount: number): string {
  if (amount >= 1000) return `${cur}${(amount / 1000).toFixed(1)}k`;
  return `${cur}${Math.round(amount)}`;
}

function pctLabel(pct: number): string {
  if (pct === 0) return "same as prior period";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior period`;
}

function buildKpis(data: ApiAnalyticsResponse): Kpi[] {
  const { revenue, totalQty, tables_total, tables_occupied, deltas } = data;
  const totalRev = revenue.totalRevenue;
  const totalOrders = revenue.totalOrders;
  const avg = totalOrders ? totalRev / totalOrders : 0;
  const occ = tables_total ? Math.round((tables_occupied / tables_total) * 100) : 0;

  return [
    {
      label: "Revenue",
      value: formatMoney(totalRev),
      change: pctLabel(deltas.revenuePct),
      up: deltas.revenuePct >= 0,
    },
    {
      label: "Avg Order Value",
      value: formatMoney(avg),
      change: "per paid order",
      up: true,
    },
    {
      label: "Orders",
      value: String(totalOrders),
      change: pctLabel(deltas.ordersPct),
      up: deltas.ordersPct >= 0,
    },
    {
      label: "Items Sold",
      value: String(totalQty),
      change: formatFilterRange(data.from, data.to),
      up: totalQty > 0,
    },
    {
      label: "Active Tables",
      value: `${tables_occupied}/${tables_total}`,
      change: `${occ}% occupied now`,
      up: tables_occupied > 0,
    },
    {
      label: "Avg Items / Order",
      value: totalOrders ? (totalQty / totalOrders).toFixed(1) : "0",
      change: "Items per paid order",
      up: totalQty > 0,
    },
  ];
}

function mapAnalytics(
  data: ApiAnalyticsResponse,
  catLabels: Map<string, string>,
) {
  const revTrend: RevPoint[] = daysBetween(data.from, data.to).map(day => {
    const row = data.revenue.rows.find(r => r.day === day);
    return { month: shortDay(day), revenue: row?.revenue ?? 0, profit: 0 };
  });

  const topItems: ItemPoint[] = data.topItems
    .slice(0, 8)
    .map(it => ({ name: it.item_name, revenue: it.revenue, qty: it.qty_sold }));

  const maxCat = Math.max(1, ...data.categories.map(c => c.qty_sold));
  const radar: RadarPoint[] = data.categories.map(c => ({
    metric: catLabels.get(c.category) ?? (c.category ? c.category.charAt(0).toUpperCase() + c.category.slice(1) : "Other"),
    score: Math.round((c.qty_sold / maxCat) * 100),
  }));

  const hourly: HourPoint[] = data.hours
    .filter(h => h.hour >= 9 && h.hour <= 23)
    .map(h => ({ hour: `${h.hour}:00`, covers: h.covers }));

  return {
    kpis: buildKpis(data),
    revTrend,
    topItems,
    radar,
    hourly,
    periodLabel: data.periodLabel,
  };
}

// ── Custom dual-line area chart ───────────────────────────────────────────────
function DualAreaChart({ data, cur = "₹" }: { data: RevPoint[]; cur?: string }) {
  const W = 600, H = 180, padL = 48, padR = 16, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const hasData = data.some(d => d.revenue > 0);
  if (!hasData) {
    return (
      <div style={{ height: 180 }} className="flex items-center justify-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No paid orders in this period yet</span>
      </div>
    );
  }
  if (data.length < 2) {
    return (
      <div style={{ height: 180 }} className="flex items-center justify-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>Not enough data for a trend line yet</span>
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.revenue), 1);
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const yRev = data.map(d => padT + (1 - d.revenue / max) * innerH);
  const linePath = (ys: number[]) => xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaPath = (ys: number[]) => linePath(ys) + ` L${xs[xs.length - 1].toFixed(1)},${H - padB} L${xs[0].toFixed(1)},${H - padB} Z`;
  const gridYs = [0.25, 0.5, 0.75, 1].map(t => padT + (1 - t) * innerH);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(30,127,255,0.06)" strokeDasharray="4 3" />
          <text x={padL - 4} y={y + 4} textAnchor="end" fill="#6b82a0" fontSize={9}>
            {compactMoney(cur, max * [0.25, 0.5, 0.75, 1][i])}
          </text>
        </g>
      ))}
      {data.map((d, i) => i % labelEvery === 0 && (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fill="#6b82a0" fontSize={9}>{d.month}</text>
      ))}
      <path d={areaPath(yRev)} fill="#1e7fff" fillOpacity={0.1} />
      <path d={linePath(yRev)} fill="none" stroke="#1e7fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={yRev[i]} r={3} fill="#1e7fff" />
      ))}
    </svg>
  );
}

function HorizontalBarChart({ data, cur = "₹" }: { data: ItemPoint[]; cur?: string }) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No sales recorded for this period yet</span>
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.revenue / max) * 100;
        return (
          <div key={item.name + i} className="flex items-center gap-3">
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
            <span style={{ color: "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", width: 72, textAlign: "right", flexShrink: 0 }}>
              {compactMoney(cur, item.revenue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RadarChart({ data }: { data: RadarPoint[] }) {
  const cx = 110, cy = 110, r = 80;
  const n = data.length;
  if (n < 2) {
    return (
      <div style={{ height: 200 }} className="flex items-center justify-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>Not enough categories sold yet</span>
      </div>
    );
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
    <svg viewBox="0 0 220 220" className="w-full" style={{ height: 200 }}>
      {rings.map((scale, i) => (
        <path key={i} d={ringPath(scale)} fill="none" stroke="rgba(30,127,255,0.1)" strokeWidth={1} />
      ))}
      {[...Array(n)].map((_, i) => {
        const { x, y } = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(30,127,255,0.08)" strokeWidth={1} />;
      })}
      <path d={dataPath} fill="#1e7fff" fillOpacity={0.15} stroke="#1e7fff" strokeWidth={2} />
      {data.map((d, i) => {
        const { x, y } = pt(i, (d.score / 100) * r);
        const lp = pt(i, r + 14);
        return (
          <g key={d.metric}>
            <circle cx={x} cy={y} r={3} fill="#1e7fff" />
            <text x={lp.x} y={lp.y + 4} textAnchor="middle" fill="#6b82a0" fontSize={8.5}>{d.metric}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineSparkline({ data }: { data: HourPoint[] }) {
  const W = 600, H = 120, padL = 30, padR = 12, padT = 8, padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const hasCovers = data.some(d => d.covers > 0);
  if (!hasCovers) {
    return (
      <div style={{ height: 120 }} className="flex items-center justify-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No cover activity in this period yet</span>
      </div>
    );
  }
  if (data.length < 2) {
    return (
      <div style={{ height: 120 }} className="flex items-center justify-center">
        <span style={{ color: "#6b82a0", fontSize: "0.8rem" }}>Not enough hourly data yet</span>
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.covers), 1);
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
        <text key={d.hour} x={xs[i]} y={H - 4} textAnchor="middle" fill="#6b82a0" fontSize={8}>{d.hour}</text>
      ))}
      <path d={linePath} fill="none" stroke="#00c6ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[peak]} cy={ys[peak]} r={4} fill="#00c6ff" />
      <text x={xs[peak]} y={ys[peak] - 8} textAnchor="middle" fill="#00c6ff" fontSize={8} fontWeight="bold">peak</text>
    </svg>
  );
}

export function Analytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodLabel>("30 Days");
  const [anchorDate, setAnchorDate] = useState(() => isoDate(new Date()));
  const [filterMonth, setFilterMonth] = useState(currentMonthISO);
  const [customFrom, setCustomFrom] = useState(defaultCustomFrom);
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [revTrend, setRevTrend] = useState<RevPoint[]>([]);
  const [topItems, setTopItems] = useState<ItemPoint[]>([]);
  const [radar, setRadar] = useState<RadarPoint[]>([]);
  const [hourly, setHourly] = useState<HourPoint[]>([]);
  const [analyticsData, setAnalyticsData] = useState<ApiAnalyticsResponse | null>(null);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [catLabels, setCatLabels] = useState<Map<string, string>>(new Map());
  const [printBusy, setPrintBusy] = useState<"sales" | "period" | null>(null);
  const [livePrinter, setLivePrinter] = useState(printerStatus);
  const cur = getCurrencySymbol();

  const refreshPrinter = useCallback(() => setLivePrinter(printerStatus()), []);
  const setPreset = useCallback((next: PeriodLabel) => {
    setPeriod(next);
    if (next === "Custom") return;
    if (next === "Today") {
      setCustomFrom(anchorDate);
      setCustomTo(anchorDate);
      return;
    }
    if (next === "7 Days") {
      const d = new Date(`${anchorDate}T12:00:00`);
      const diffToMon = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setCustomFrom(isoDate(mon));
      setCustomTo(isoDate(sun));
      return;
    }
    if (next === "30 Days") {
      const bounds = monthBounds(filterMonth);
      setCustomFrom(bounds.from);
      setCustomTo(bounds.to);
      return;
    }
    const to = anchorDate;
    const fromD = new Date(`${to}T12:00:00`);
    fromD.setDate(fromD.getDate() - 89);
    setCustomFrom(isoDate(fromD));
    setCustomTo(to);
  }, [anchorDate, filterMonth]);

  useEffect(() => {
    const hint = restaurant?.cashier_printer?.name || restaurant?.kitchen_printer?.name;
    void autoReconnectBluetooth(hint).finally(refreshPrinter);
  }, [restaurant?.cashier_printer?.name, restaurant?.kitchen_printer?.name, refreshPrinter]);

  const revenueQuery = useCallback(() => buildAnalyticsQuery({
    preset: period,
    anchorDate,
    month: filterMonth,
    customFrom,
    customTo,
  }), [period, anchorDate, filterMonth, customFrom, customTo]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const query = revenueQuery();
      const [data, categories, rest] = await Promise.all([
        dashboardApi.analytics(query),
        menuCategoriesApi.list().catch(() => []),
        restaurantApi.me().catch(() => null),
      ]);
      const labels = new Map(categories.map(c => [c.slug, c.label]));
      const mapped = mapAnalytics(data, labels);
      setAnalyticsData(data);
      setRestaurant(rest);
      setCatLabels(labels);
      setKpis(mapped.kpis);
      setRevTrend(mapped.revTrend);
      setTopItems(mapped.topItems);
      setRadar(mapped.radar);
      setHourly(mapped.hourly);
      setPeriodLabel(mapped.periodLabel);
    } catch (e) {
      const msg = (e as Error).message || "Couldn't load analytics";
      setError(msg);
      if (!silent) toast.error("Analytics unavailable", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [revenueQuery]);

  const filterRangeCaption = analyticsData
    ? formatFilterRange(analyticsData.from, analyticsData.to)
    : "";

  const runReportPrint = useCallback(async (kind: "sales" | "period") => {
    if (!restaurant) {
      toast.error("Report unavailable", "Restaurant details are still loading.");
      return;
    }
    setPrintBusy(kind);
    try {
      const latestData = await dashboardApi.analytics(revenueQuery());
      if (latestData.revenue.totalOrders === 0) {
        toast.error("Nothing to print", "No paid sales in this period.");
        return;
      }
      const labels = catLabels.size
        ? catLabels
        : new Map((await menuCategoriesApi.list().catch(() => [])).map(c => [c.slug, c.label]));
      setAnalyticsData(latestData);
      setCatLabels(labels);
      setPeriodLabel(latestData.periodLabel);

      const hint = restaurant.cashier_printer?.name || restaurant.kitchen_printer?.name;
      await ensureBluetoothReady(hint);
      refreshPrinter();

      const method = kind === "sales"
        ? await printSalesReport(
            buildSalesReportFromAnalytics(latestData, restaurant, labels),
            restaurant.id,
          )
        : await printMonthlyReport(
            buildPeriodBreakdownReport(latestData, restaurant),
            restaurant.id,
          );

      const via = method === "bluetooth" ? "thermal printer"
        : method === "usb" ? "USB printer"
          : "print dialog";
      toast.success("Report sent", `Printed via ${via}.`);
    } catch (e) {
      toast.error("Print failed", (e as Error).message);
    } finally {
      setPrintBusy(null);
      refreshPrinter();
    }
  }, [restaurant, catLabels, refreshPrinter, revenueQuery]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onOrder = () => { void load(true); };
    window.addEventListener("CAFYZ_ORDER_SENT", onOrder);
    const timer = window.setInterval(() => { void load(true); }, 60_000);
    return () => {
      window.removeEventListener("CAFYZ_ORDER_SENT", onOrder);
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 rounded-xl w-fit flex-wrap" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            {periods.map(p => (
              <button key={p} type="button" onClick={() => setPreset(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={period === p ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" } : { color: "#6b82a0" }}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {periodLabel && (
              <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{periodLabel}</span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(30,127,255,0.1)", color: "#1e7fff", opacity: loading || refreshing ? 0.6 : 1 }}
            >
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl px-4 py-3"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)" }}>
          <label className="flex flex-col gap-1">
            <span style={{ color: "#6b82a0", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>From</span>
            <input type="date" value={customFrom} max={customTo}
              onChange={e => {
                setCustomFrom(e.target.value);
                setPeriod("Custom");
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "#080c1e", border: "1px solid rgba(30,127,255,0.15)", color: "#e8eef8" }} />
          </label>
          <label className="flex flex-col gap-1">
            <span style={{ color: "#6b82a0", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>To</span>
            <input type="date" value={customTo} min={customFrom}
              onChange={e => {
                setCustomTo(e.target.value);
                setPeriod("Custom");
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "#080c1e", border: "1px solid rgba(30,127,255,0.15)", color: "#e8eef8" }} />
          </label>
          {filterRangeCaption && (
            <p style={{ color: "#a8bdd4", fontSize: "0.78rem", marginLeft: "auto" }}>
              Showing <span style={{ color: "#1e7fff", fontWeight: 600 }}>{filterRangeCaption}</span>
            </p>
          )}
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)" }}>
          <AlertCircle size={16} style={{ color: "#ff3b5c", flexShrink: 0 }} />
          <p style={{ color: "#f87171", fontSize: "0.82rem" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "#1e7fff" }} />
          <p style={{ color: "#6b82a0", fontSize: "0.85rem" }}>Loading analytics…</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
                <div style={{ color: "#6b82a0", fontSize: "0.7rem", marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>
                  {kpi.up ? <TrendingUp size={10} style={{ color: "#22c55e" }} /> : <TrendingDown size={10} style={{ color: "#f59e0b" }} />}
                  {kpi.change}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600 }}>Revenue Trend</h3>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#1e7fff" }}>
                <span className="w-3 h-0.5 rounded inline-block" style={{ background: "#1e7fff" }} /> Paid revenue
              </span>
            </div>
            <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>Daily paid revenue · {filterRangeCaption || periodLabel}</p>
            <DualAreaChart data={revTrend} cur={cur} />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="lg:col-span-2 rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Top Performing Items</h3>
              <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 16 }}>By revenue from paid orders</p>
              <HorizontalBarChart data={topItems} cur={cur} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Sales by Category</h3>
              <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 4 }}>Share of items sold</p>
              <RadarChart data={radar} />
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Covers by Hour</h3>
            <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>Paid orders · {filterRangeCaption || periodLabel}</p>
            <LineSparkline data={hourly} />
          </motion.div>

          {/* Reports — thermal printer + browser fallback */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="rounded-2xl p-5 space-y-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600 }}>Reports & Printouts</h3>
                <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginTop: 4 }}>
                  Print on connected thermal printers (Bluetooth/USB) or use the browser print dialog.
                </p>
                {(periodLabel || filterRangeCaption) && (
                  <div className="mt-3 inline-flex flex-col gap-0.5 rounded-lg px-3 py-2"
                    style={{ background: "rgba(30,127,255,0.06)", border: "1px solid rgba(30,127,255,0.12)" }}>
                    <span style={{ color: "#6b82a0", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Report period
                    </span>
                    <span style={{ color: "#e8eef8", fontSize: "0.82rem", fontWeight: 600 }}>{periodLabel}</span>
                    {filterRangeCaption && (
                      <span style={{ color: "#1e7fff", fontSize: "0.75rem" }}>{filterRangeCaption}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "rgba(30,127,255,0.06)", border: "1px solid rgba(30,127,255,0.12)" }}>
                <p style={{ color: "#6b82a0", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Printer</p>
                <p style={{ color: livePrinter.type === "none" ? "#fbbf24" : "#22c55e", fontSize: "0.78rem", fontWeight: 600 }}>
                  {livePrinter.type === "none"
                    ? "Not connected — configure in Restaurant profile"
                    : `Connected · ${livePrinter.name}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 space-y-3" style={{ background: "#080c1e", border: "1px solid rgba(30,127,255,0.08)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(30,127,255,0.12)" }}>
                    <FileText size={18} style={{ color: "#1e7fff" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ color: "#e8eef8", fontWeight: 700, fontSize: "0.9rem" }}>Sales Summary Report</p>
                    <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginTop: 4, lineHeight: 1.5 }}>
                      KPIs, top items, category breakdown, peak hour — {filterRangeCaption || periodLabel}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!printBusy || analyticsData?.revenue.totalOrders === 0}
                  onClick={() => void runReportPrint("sales")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: "linear-gradient(135deg, #1e7fff, #00c6ff)",
                    color: "#fff",
                    opacity: printBusy || analyticsData?.revenue.totalOrders === 0 ? 0.55 : 1,
                  }}
                >
                  {printBusy === "sales" ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                  Print summary
                </button>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "#080c1e", border: "1px solid rgba(30,127,255,0.08)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.12)" }}>
                    <CalendarRange size={18} style={{ color: "#a855f7" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ color: "#e8eef8", fontWeight: 700, fontSize: "0.9rem" }}>Daily Breakdown Report</p>
                    <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginTop: 4, lineHeight: 1.5 }}>
                      Day-by-day orders and revenue for {filterRangeCaption || periodLabel}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!printBusy || analyticsData?.revenue.totalOrders === 0}
                  onClick={() => void runReportPrint("period")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: "rgba(168,85,247,0.15)",
                    color: "#c4b5fd",
                    border: "1px solid rgba(168,85,247,0.25)",
                    opacity: printBusy || analyticsData?.revenue.totalOrders === 0 ? 0.55 : 1,
                  }}
                >
                  {printBusy === "period" ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                  Print daily breakdown
                </button>
              </div>
            </div>

            {user?.role && ["owner", "manager"].includes(user.role) && (
              <p className="flex items-center gap-1.5" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>
                <ChevronRight size={12} />
                Pair printers in Restaurant → Receipt &amp; Printer Test if not connected.
              </p>
            )}
          </motion.div>

          {!error && kpis.length > 0 && kpis[0].value === formatMoney(0) && (
            <div className="rounded-xl px-4 py-6 text-center flex flex-col items-center gap-2" style={{ background: "#0d1326", border: "1px dashed rgba(30,127,255,0.15)" }}>
              <BarChart3 size={24} style={{ color: "#6b82a0" }} />
              <p style={{ color: "#a8bdd4", fontSize: "0.88rem", fontWeight: 600 }}>No paid sales in this period</p>
              <p style={{ color: "#6b82a0", fontSize: "0.78rem" }}>Complete payments in POS — charts update automatically.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
