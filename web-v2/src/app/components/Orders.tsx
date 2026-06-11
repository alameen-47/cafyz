import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Clock, CheckCircle2, ChefHat, Truck, Filter, Search } from "lucide-react";
import { toast } from "./Toast";
import { ordersApi, kdsApi, usersApi } from "../../services/api";
import { getCurrencySymbol } from "../../utils/currency";

type UiStatus = "pending" | "preparing" | "ready" | "served";
type OrderRow = {
  id: string;        // display "#XXXX"
  oid: string;       // real order id
  tid?: string;      // backing KDS ticket id (used to advance kitchen progress)
  table: string; waiter: string;
  items: { name: string; qty: number; price: number }[];
  total: number; status: UiStatus; time: string; priority: boolean;
};

const statuses = ["all", "pending", "preparing", "ready", "served"];

// Order payment status + kitchen-ticket status → the board's vocabulary.
function uiStatus(orderStatus: string, ticketStatus?: string): UiStatus {
  if (orderStatus === "paid" || orderStatus === "comped") return "served";
  switch (ticketStatus) {
    case "prep": return "preparing";
    case "ready": return "ready";
    case "delivered": return "served";
    default: return "pending"; // new ticket / freshly sent
  }
}
function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: Clock,         label: "Pending" },
  preparing: { color: "#1e7fff", bg: "rgba(30,127,255,0.12)",  icon: ChefHat,       label: "Preparing" },
  ready:     { color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  icon: CheckCircle2,  label: "Ready" },
  served:    { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   icon: Truck,         label: "Served" },
};

function OrderCard({ order, cur, onAdvance }: { order: OrderRow; cur: string; onAdvance: (o: OrderRow) => void }) {
  const cfg = statusConfig[order.status];
  const Icon = cfg.icon;
  const nextStatus: Record<string, string> = { pending: "preparing", preparing: "ready", ready: "served" };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5"
      style={{
        background: "#0d1326",
        border: `1px solid ${order.priority ? "rgba(245,158,11,0.25)" : "rgba(30,127,255,0.1)"}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem" }}>{order.id}</span>
          {order.priority && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.62rem" }}>ASAP</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: "#6b82a0" }} />
          <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{order.time}</span>
        </div>
      </div>

      {/* Table + waiter */}
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(30,127,255,0.1)", color: "#1e7fff", fontFamily: "var(--font-mono)" }}>
          {order.table}
        </span>
        <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>· {order.waiter}</span>
      </div>

      {/* Items */}
      <div className="space-y-1 flex-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center">
            <span style={{ color: "#a8bdd4", fontSize: "0.75rem" }}>
              <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)" }}>×{item.qty}</span> {item.name}
            </span>
            <span style={{ color: "#6b82a0", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>{cur}{item.price * item.qty}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-[rgba(30,127,255,0.08)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: cfg.bg }}>
          <Icon size={11} style={{ color: cfg.color }} />
          <span style={{ color: cfg.color, fontSize: "0.7rem", fontWeight: 600 }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.88rem" }}>{cur}{order.total}</span>
          {nextStatus[order.status] && (
            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => onAdvance(order)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", minHeight: 32 }}>
              {nextStatus[order.status] === "preparing" ? "Accept" : nextStatus[order.status] === "ready" ? "Ready" : "Served"}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Orders() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const cur = getCurrencySymbol();

  // Live orders: every non-voided order, enriched with items, total, server,
  // and its kitchen-ticket progress. Polled every 5s.
  const load = useCallback(async () => {
    try {
      const [list, tickets, users] = await Promise.all([
        ordersApi.list(),
        kdsApi.list().catch(() => []),
        usersApi.list().catch(() => []),
      ]);
      const nameById = new Map(users.map(u => [u.id, u.name]));
      const ticketByOrder = new Map(tickets.map(t => [t.order_id, t]));
      const active = list.filter(o => o.status !== "voided")
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      const detailed = await Promise.all(active.map(o => ordersApi.get(o.id).catch(() => null)));
      const rows: OrderRow[] = active.map((o, i) => {
        const items = (detailed[i]?.items ?? []).map(it => ({ name: it.name ?? "Item", qty: it.qty, price: Number(it.price ?? 0) }));
        const ticket = ticketByOrder.get(o.id);
        return {
          id: "#" + o.id.slice(0, 4).toUpperCase(),
          oid: o.id,
          tid: ticket?.id,
          table: o.table_name || "—",
          waiter: o.server_id ? (nameById.get(o.server_id) ?? "") : "",
          items,
          total: items.reduce((s, it) => s + it.price * it.qty, 0),
          status: uiStatus(o.status, ticket?.status),
          time: relTime(o.created_at),
          priority: ticket?.vip === 1,
        };
      });
      setOrders(rows);
    } catch { /* keep last snapshot */ }
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Advance an order's kitchen ticket: pending→preparing→ready→served.
  const handleAdvance = async (order: OrderRow) => {
    const next = ({ pending: "preparing", preparing: "ready", ready: "served" } as Record<string, UiStatus>)[order.status];
    if (!next) return;
    if (!order.tid) { toast.error("No kitchen ticket", `${order.id} has no active kitchen ticket`); return; }
    setOrders(prev => prev.map(o => o.oid === order.oid ? { ...o, status: next } : o));
    const labels: Record<string, string> = { preparing: "Sent to kitchen", ready: "Order is ready", served: "Order served" };
    const icons: Record<string, "success" | "info"> = { preparing: "info", ready: "success", served: "success" };
    try {
      if (next === "preparing") await kdsApi.fire(order.tid);
      else if (next === "ready") await kdsApi.ready(order.tid);
      else if (next === "served") await kdsApi.delivered(order.tid);
      toast[icons[next] || "info"](`${order.id} · ${labels[next]}`, `${order.table} · ${cur}${order.total}`);
      void load();
    } catch (e) {
      toast.error("Couldn't update order", (e as Error).message);
      void load();
    }
  };

  const filtered = orders.filter(o =>
    (filter === "all" || o.status === filter) &&
    (search === "" || o.id.toLowerCase().includes(search.toLowerCase()) || o.table.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = Object.fromEntries(statuses.slice(1).map(s => [s, orders.filter(o => o.status === s).length]));

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Status summary pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <Icon size={13} style={{ color: cfg.color }} />
              <span style={{ color: cfg.color, fontSize: "0.75rem", fontWeight: 600 }}>
                {counts[key] ?? 0} {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Filters + New Order */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <Search size={14} style={{ color: "#6b82a0" }} />
          <input type="text" placeholder="Search order or table..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[#6b82a0]"
            style={{ color: "#e8eef8" }} />
        </div>
        {/* Status filter + new order row */}
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide flex-1"
            style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className="px-2.5 py-1.5 rounded-lg text-xs capitalize transition-all whitespace-nowrap flex-shrink-0"
                style={filter === s
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", fontWeight: 600 }
                  : { color: "#6b82a0" }}>
                {s}
              </button>
            ))}
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            <Plus size={16} />
            <span className="hidden sm:inline">New Order</span>
          </motion.button>
        </div>
      </div>

      {/* Order cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence>
          {filtered.map(order => (
            <OrderCard key={order.oid} order={order} cur={cur} onAdvance={handleAdvance} />
          ))}
          {filtered.length === 0 && (
            <div key="empty" className="col-span-full flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(30,127,255,0.08)" }}>
                <Filter size={22} style={{ color: "#6b82a0" }} />
              </div>
              <p style={{ color: "#6b82a0", fontSize: "0.85rem" }}>No orders match your filter</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
