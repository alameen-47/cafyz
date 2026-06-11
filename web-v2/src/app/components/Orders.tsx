import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Clock, CheckCircle2, ChefHat, Truck, Filter, Search } from "lucide-react";
import { toast } from "./Toast";

const allOrders = [
  { id: "#4821", table: "T-05", waiter: "Ravi",  items: [{ name: "Butter Chicken", qty: 1, price: 18 }, { name: "Garlic Naan", qty: 2, price: 4 }],   total: 26, status: "served",   time: "2m",  priority: false },
  { id: "#4820", table: "T-12", waiter: "Priya", items: [{ name: "Margherita Pizza", qty: 1, price: 16 }, { name: "Coke", qty: 2, price: 4 }],          total: 24, status: "preparing",time: "5m",  priority: true },
  { id: "#4819", table: "T-03", waiter: "Sam",   items: [{ name: "Grilled Salmon", qty: 1, price: 28 }, { name: "Red Wine", qty: 2, price: 15 }],       total: 58, status: "preparing",time: "8m",  priority: false },
  { id: "#4818", table: "T-07", waiter: "Ravi",  items: [{ name: "Ribeye Steak", qty: 1, price: 45 }, { name: "Fries", qty: 1, price: 8 }, { name: "Beer", qty: 2, price: 9 }], total: 71, status: "ready", time: "11m", priority: false },
  { id: "#4817", table: "T-09", waiter: "Mia",   items: [{ name: "Veg Biryani", qty: 2, price: 14 }, { name: "Raita", qty: 1, price: 4 }],              total: 32, status: "served",   time: "14m", priority: false },
  { id: "#4816", table: "T-02", waiter: "Sam",   items: [{ name: "Caesar Salad", qty: 1, price: 12 }, { name: "Tiramisu", qty: 2, price: 9 }],          total: 30, status: "pending",  time: "1m",  priority: true },
  { id: "#4815", table: "T-11", waiter: "Priya", items: [{ name: "Paneer Tikka", qty: 2, price: 16 }, { name: "Lassi", qty: 2, price: 5 }],             total: 42, status: "pending",  time: "3m",  priority: false },
  { id: "#4814", table: "T-06", waiter: "Mia",   items: [{ name: "Fish & Chips", qty: 1, price: 22 }, { name: "Water", qty: 1, price: 4 }],             total: 26, status: "preparing",time: "6m",  priority: false },
];

const statuses = ["all", "pending", "preparing", "ready", "served"];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: Clock,         label: "Pending" },
  preparing: { color: "#1e7fff", bg: "rgba(30,127,255,0.12)",  icon: ChefHat,       label: "Preparing" },
  ready:     { color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  icon: CheckCircle2,  label: "Ready" },
  served:    { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   icon: Truck,         label: "Served" },
};

function OrderCard({ order, onStatusChange }: { order: typeof allOrders[0]; onStatusChange: (id: string, s: string) => void }) {
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
            <span style={{ color: "#6b82a0", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>₹{item.price * item.qty}</span>
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
          <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.88rem" }}>₹{order.total}</span>
          {nextStatus[order.status] && (
            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => onStatusChange(order.id, nextStatus[order.status])}
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
  const [orders, setOrders] = useState(allOrders);

  const handleStatusChange = (id: string, status: string) => {
    const order = orders.find(o => o.id === id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    const labels: Record<string, string> = { preparing: "Sent to kitchen", ready: "Order is ready", served: "Order served" };
    const icons: Record<string, "success" | "info"> = { preparing: "info", ready: "success", served: "success" };
    if (order && labels[status]) {
      toast[icons[status] || "info"](`${order.id} · ${labels[status]}`, `${order.table} · ₹${order.total}`);
    }
  };

  const filtered = orders.filter(o =>
    (filter === "all" || o.status === filter) &&
    (search === "" || o.id.includes(search) || o.table.toLowerCase().includes(search.toLowerCase()))
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
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
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
