import { motion } from "motion/react";
import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

const periods = ["Today", "7 Days", "30 Days", "3 Months"];

const revenueMonthly = [
  { month: "Jan", revenue: 142000, profit: 48000 },
  { month: "Feb", revenue: 158000, profit: 54000 },
  { month: "Mar", revenue: 171000, profit: 61000 },
  { month: "Apr", revenue: 165000, profit: 58000 },
  { month: "May", revenue: 183000, profit: 67000 },
  { month: "Jun", revenue: 196000, profit: 74000 },
];

const topItems = [
  { name: "Chicken Tikka Masala", revenue: 22320 },
  { name: "Garlic Naan", revenue: 8400 },
  { name: "Grilled Salmon", revenue: 17920 },
  { name: "Ribeye Steak", revenue: 14400 },
  { name: "Mango Lassi", revenue: 4750 },
  { name: "Tiramisu", revenue: 4680 },
];

const hourlyAvg = [
  { hour: "9h", covers: 4 }, { hour: "10h", covers: 8 }, { hour: "11h", covers: 16 },
  { hour: "12h", covers: 38 }, { hour: "13h", covers: 42 }, { hour: "14h", covers: 28 },
  { hour: "15h", covers: 18 }, { hour: "16h", covers: 14 }, { hour: "17h", covers: 22 },
  { hour: "18h", covers: 44 }, { hour: "19h", covers: 52 }, { hour: "20h", covers: 46 },
  { hour: "21h", covers: 34 }, { hour: "22h", covers: 20 },
];

const customerRadar = [
  { metric: "Food Quality", score: 92 },
  { metric: "Service", score: 88 },
  { metric: "Ambiance", score: 85 },
  { metric: "Value", score: 78 },
  { metric: "Speed", score: 82 },
  { metric: "Cleanliness", score: 94 },
];

const kpis = [
  { label: "Monthly Revenue", value: "₹1.96L", change: "+7.1%", up: true },
  { label: "Avg Order Value", value: "₹1,540", change: "+4.2%", up: true },
  { label: "Covers / Day", value: "286", change: "+6.8%", up: true },
  { label: "Table Turnover", value: "3.2×", change: "-0.1×", up: false },
  { label: "Food Cost %", value: "28.4%", change: "-1.2%", up: true },
  { label: "Customer Rating", value: "4.7 ★", change: "+0.1", up: true },
];

// ── Custom dual-line area chart ──────────────────────────────────────────────
function DualAreaChart({ data }: { data: typeof revenueMonthly }) {
  const W = 600, H = 180, padL = 48, padR = 16, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals = data.flatMap(d => [d.revenue, d.profit]);
  const max = Math.max(...allVals);
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const yRev = data.map(d => padT + (1 - d.revenue / max) * innerH);
  const yProf = data.map(d => padT + (1 - d.profit / max) * innerH);
  const linePath = (ys: number[]) => xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaPath = (ys: number[]) => linePath(ys) + ` L${xs[xs.length-1].toFixed(1)},${H - padB} L${xs[0].toFixed(1)},${H - padB} Z`;
  const gridYs = [0.25, 0.5, 0.75, 1].map(t => padT + (1 - t) * innerH);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(30,127,255,0.06)" strokeDasharray="4 3" />
          <text x={padL - 4} y={y + 4} textAnchor="end" fill="#6b82a0" fontSize={9}>
            ₹{((max * [0.25,0.5,0.75,1][i]) / 1000).toFixed(0)}k
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fill="#6b82a0" fontSize={9}>{d.month}</text>
      ))}
      <path d={areaPath(yRev)} fill="#1e7fff" fillOpacity={0.1} />
      <path d={areaPath(yProf)} fill="#00c6ff" fillOpacity={0.08} />
      <path d={linePath(yRev)} fill="none" stroke="#1e7fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={linePath(yProf)} fill="none" stroke="#00c6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={yRev[i]} r={3} fill="#1e7fff" />
          <circle cx={x} cy={yProf[i]} r={3} fill="#00c6ff" />
        </g>
      ))}
    </svg>
  );
}

// ── Custom horizontal bar chart ───────────────────────────────────────────────
function HorizontalBarChart({ data }: { data: typeof topItems }) {
  const max = Math.max(...data.map(d => d.revenue));
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
            <span style={{ color: "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", width: 50, textAlign: "right", flexShrink: 0 }}>
              ₹{(item.revenue / 1000).toFixed(1)}k
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Custom radar / spider chart ───────────────────────────────────────────────
function RadarChart({ data }: { data: typeof customerRadar }) {
  const cx = 110, cy = 110, r = 80;
  const n = data.length;
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
function LineSparkline({ data }: { data: typeof hourlyAvg }) {
  const W = 600, H = 120, padL = 30, padR = 12, padT = 8, padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map(d => d.covers));
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
            <div className="flex items-center gap-1 mt-1" style={{ color: kpi.up ? "#22c55e" : "#ff3b5c", fontSize: "0.72rem" }}>
              {kpi.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {kpi.change}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Revenue vs Profit */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600 }}>Revenue vs Profit</h3>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#1e7fff" }}>
              <span className="w-3 h-0.5 rounded inline-block" style={{ background: "#1e7fff" }} /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#00c6ff" }}>
              <span className="w-3 h-0.5 rounded inline-block" style={{ background: "#00c6ff" }} /> Profit
            </span>
          </div>
        </div>
        <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>6-month trend</p>
        <DualAreaChart data={revenueMonthly} />
      </motion.div>

      {/* Top items + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="lg:col-span-2 rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Top Performing Items</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 16 }}>By revenue generated</p>
          <HorizontalBarChart data={topItems} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Customer Satisfaction</h3>
          <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 4 }}>Avg ratings by category</p>
          <RadarChart data={customerRadar} />
        </motion.div>
      </div>

      {/* Hourly covers */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="rounded-2xl p-5" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>Average Covers by Hour</h3>
        <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginBottom: 12 }}>Identifies peak dining times</p>
        <LineSparkline data={hourlyAvg} />
      </motion.div>
    </div>
  );
}
