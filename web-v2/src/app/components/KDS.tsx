import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, CheckCircle2, Truck, AlertTriangle, Clock, ChefHat, Printer, Filter } from "lucide-react";
import { toast } from "./Toast";
import { kdsApi, type ApiKdsTicket } from "../../services/api";

type KDSStatus = "new" | "prep" | "ready";

interface KDSOrder {
  id: string; table: string; server: string;
  items: { name: string; qty: number; note?: string; station?: string }[];
  status: KDSStatus; startedAt: number; vip: boolean; allergy?: string;
}

// Station accent colours — known stations get a fixed hue, the rest are mapped
// deterministically onto a palette so each station stays visually distinct.
const STATION_PRESET: Record<string, string> = {
  hot: "#ff6b35", grill: "#f59e0b", tandoor: "#ef4444", oven: "#f97316",
  fry: "#eab308", cold: "#22d3ee", expedite: "#1e7fff", bar: "#a855f7",
};
const STATION_PALETTE = ["#ff6b35", "#f59e0b", "#ef4444", "#f97316", "#eab308", "#22d3ee", "#a855f7", "#1e7fff"];
function stationColor(name?: string): string {
  if (!name) return "#6b82a0";
  const preset = STATION_PRESET[name.toLowerCase()];
  if (preset) return preset;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return STATION_PALETTE[h % STATION_PALETTE.length];
}

function parseMods(mods?: string): string[] {
  if (!mods) return [];
  try { const v = JSON.parse(mods); return Array.isArray(v) ? v : []; } catch { return []; }
}
function tsOf(iso: string): number {
  return new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
}

function useElapsed(startedAt: number) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function ElapsedBadge({ startedAt }: { startedAt: number }) {
  const elapsed = useElapsed(startedAt);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const color = elapsed >= 600 ? "#ff3b5c" : elapsed >= 300 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1">
      <Clock size={11} style={{ color }} />
      <span style={{ color, fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700 }}>
        {m}:{s.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function OrderTicket({ order, onAction }: { order: KDSOrder; onAction: (id: string, s: KDSStatus) => void }) {
  const nextStatus: Partial<Record<KDSStatus, KDSStatus>> = { new: "prep", prep: "ready" };
  const actionLabel: Record<KDSStatus, string> = { new: "Fire", prep: "Mark Ready", ready: "Delivered" };
  const ActionIcon: Record<KDSStatus, React.ElementType> = { new: Flame, prep: CheckCircle2, ready: Truck };
  const Icon = ActionIcon[order.status];
  const next = nextStatus[order.status];

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="rounded-2xl overflow-hidden w-full"
      style={{
        background: "#0d1326",
        border: `1px solid ${order.vip ? "rgba(245,158,11,0.35)" : "rgba(30,127,255,0.12)"}`,
        boxShadow: order.vip ? "0 0 16px rgba(245,158,11,0.08)" : "none",
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5"
        style={{
          background: order.status === "new" ? "rgba(30,127,255,0.08)" : order.status === "prep" ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)",
          borderBottom: "1px solid rgba(30,127,255,0.08)",
        }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.88rem" }}>{order.table}</span>
          {order.vip && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>⭐ VIP</span>}
          {order.allergy && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,59,92,0.15)", color: "#ff3b5c" }}>
              <AlertTriangle size={9} /> {order.allergy}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ElapsedBadge startedAt={order.startedAt} />
          <span style={{ color: "#6b82a0", fontSize: "0.68rem" }}>· {order.server}</span>
        </div>
      </div>

      {/* Items */}
      <div className="p-3 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3, flexShrink: 0 }}>×{item.qty}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: "#e8eef8", fontSize: "0.82rem", fontWeight: 500 }}>{item.name}</span>
                {item.station && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: `${stationColor(item.station)}18`, color: stationColor(item.station) }}>
                    {item.station}
                  </span>
                )}
              </div>
              {item.note && <p style={{ color: "#f59e0b", fontSize: "0.68rem", fontStyle: "italic", marginTop: 2 }}>⚠ {item.note}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="px-3 pb-3">
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (order.status === "ready") onAction(order.id, "ready");
            else if (next) onAction(order.id, next);
          }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: order.status === "new" ? "linear-gradient(135deg, #ff6b35, #f59e0b)"
              : order.status === "prep" ? "linear-gradient(135deg, #22c55e, #16a34a)"
              : "rgba(107,130,160,0.12)",
            color: order.status === "ready" ? "#6b82a0" : "#fff",
          }}>
          <Icon size={14} />
          {actionLabel[order.status]}
        </motion.button>
      </div>
    </motion.div>
  );
}

const columns: { key: KDSStatus; label: string; color: string; icon: React.ElementType }[] = [
  { key: "new",   label: "New Orders",  color: "#1e7fff", icon: Flame },
  { key: "prep",  label: "In Prep",     color: "#f59e0b", icon: ChefHat },
  { key: "ready", label: "Ready · Pass",color: "#22c55e", icon: CheckCircle2 },
];

export function KDS() {
  const [tickets, setTickets] = useState<ApiKdsTicket[]>([]);
  const [stationFilter, setStationFilter] = useState("All");
  const [autoPrint, setAutoPrint] = useState(true);
  const [activeCol, setActiveCol] = useState<KDSStatus>("new"); // mobile tab

  // Live board: poll kitchen tickets every 5s.
  const load = useCallback(async () => {
    try { setTickets(await kdsApi.list()); } catch { /* keep last board on transient errors */ }
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Map live tickets → the board's order shape (drop delivered tickets).
  const orders: KDSOrder[] = tickets
    .filter(t => t.status !== "delivered")
    .map(t => ({
      id: t.id,
      table: t.table_name || "—",
      server: t.server_name || "",
      items: (t.items ?? []).map(it => {
        const mods = parseMods(it.mods);
        return { name: it.name, qty: it.qty, note: mods.length ? mods.join(", ") : undefined, station: it.station };
      }),
      status: t.status as KDSStatus,
      startedAt: tsOf(t.created_at),
      vip: t.vip === 1,
      allergy: (t.items ?? []).some(it => it.alert) ? "Allergy" : undefined,
    }));

  // Advance a ticket through fire → ready → delivered, persisting each move.
  const handleAction = async (id: string, status: KDSStatus) => {
    const order = orders.find(o => o.id === id);
    try {
      if (order?.status === "ready") {
        await kdsApi.delivered(id);
        setTickets(prev => prev.filter(t => t.id !== id));
        toast.success(`${order.table} delivered`, "Order cleared from KDS");
      } else if (status === "prep") {
        await kdsApi.fire(id);
        setTickets(prev => prev.map(t => (t.id === id ? { ...t, status: "prep" } : t)));
        toast.info(`${order?.table} — Cooking started`, "Moved to In-Prep");
      } else if (status === "ready") {
        await kdsApi.ready(id);
        setTickets(prev => prev.map(t => (t.id === id ? { ...t, status: "ready" } : t)));
        toast.success(`${order?.table} — Ready to serve!`, "Notify your waiter");
      }
    } catch (e) {
      toast.error("Couldn't update ticket", (e as Error).message);
    }
  };

  // Station filter list — built from whatever stations are live on the board.
  const stationSet = new Set<string>();
  tickets.forEach(t => t.items?.forEach(it => { if (it.station) stationSet.add(it.station); }));
  const stations = ["All", ...[...stationSet].sort()];

  const filteredOrders = (status: KDSStatus) =>
    orders.filter(o => o.status === status &&
      (stationFilter === "All" || o.items.some(i => i.station === stationFilter)));

  return (
    <div className="p-3 md:p-5 h-full flex flex-col gap-3 overflow-hidden">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          {stations.map(s => (
            <button key={s} onClick={() => setStationFilter(s)}
              className="px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all font-medium flex-shrink-0"
              style={stationFilter === s ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" } : { color: "#6b82a0" }}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto px-3 py-2 rounded-xl"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <Printer size={13} style={{ color: "#6b82a0" }} />
          <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>Auto-print</span>
          <button onClick={() => setAutoPrint(p => !p)}
            className="w-8 h-4 rounded-full relative transition-all flex-shrink-0"
            style={{ background: autoPrint ? "#1e7fff" : "rgba(30,127,255,0.1)" }}>
            <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all"
              style={{ left: autoPrint ? "calc(100% - 14px)" : 2 }} />
          </button>
        </div>
      </div>

      {/* ── Mobile: column tabs ── */}
      <div className="md:hidden flex gap-1 p-1 rounded-xl flex-shrink-0"
        style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        {columns.map(col => {
          const count = filteredOrders(col.key).length;
          return (
            <button key={col.key} onClick={() => setActiveCol(col.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={activeCol === col.key ? { background: `${col.color}20`, color: col.color } : { color: "#6b82a0" }}>
              <span>{col.label.split(" ")[0]}</span>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ background: activeCol === col.key ? `${col.color}25` : "rgba(30,127,255,0.08)", color: activeCol === col.key ? col.color : "#6b82a0", fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Desktop: 3-column kanban ── */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 flex-1 overflow-hidden">
        {columns.map(col => {
          const colOrders = filteredOrders(col.key);
          const Icon = col.icon;
          return (
            <div key={col.key} className="flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Icon size={15} style={{ color: col.color }} />
                  <span style={{ color: col.color, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.88rem" }}>{col.label}</span>
                </div>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${col.color}18`, color: col.color, fontFamily: "var(--font-mono)" }}>
                  {colOrders.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3">
                <AnimatePresence>
                  {colOrders.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-10 rounded-2xl"
                      style={{ border: "1px dashed rgba(30,127,255,0.1)" }}>
                      <p style={{ color: "#6b82a0", fontSize: "0.78rem" }}>No orders</p>
                    </motion.div>
                  ) : colOrders.map(order => (
                    <OrderTicket key={order.id} order={order} onAction={handleAction} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: single column view ── */}
      <div className="md:hidden flex-1 overflow-y-auto scrollbar-hide space-y-3">
        <AnimatePresence>
          {filteredOrders(activeCol).length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 rounded-2xl"
              style={{ border: "1px dashed rgba(30,127,255,0.1)" }}>
              <Filter size={24} style={{ color: "#6b82a0" }} />
              <p style={{ color: "#6b82a0", fontSize: "0.78rem", marginTop: 8 }}>No orders in this column</p>
            </motion.div>
          ) : filteredOrders(activeCol).map(order => (
            <OrderTicket key={order.id} order={order} onAction={handleAction} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
