import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Clock, CheckCircle2, ChefHat, Truck, Filter, Search, Loader2, Package } from "lucide-react";
import { toast } from "./Toast";
import { ordersApi } from "../../services/api";
import { getCurrencySymbol } from "../../utils/currency";
import { useAppNav } from "../nav";
import { onResume } from "../../hooks/useOnResume";
import { usePolling } from "../../hooks/usePolling";
import { keepIfSame } from "../../utils/sameData";
import { withAlpha } from "../../utils/color";

import { HScroll } from "./HScroll";
type UiStatus = "pending" | "preparing" | "ready" | "at_table" | "complete";
type OrderRow = {
  id: string;
  oid: string;
  tid?: string;
  tableId?: string;
  orderStatus: string;
  table: string;
  waiter: string;
  items: { name: string; qty: number; price: number; mods: string[] }[];
  total: number;
  status: UiStatus;
  time: string;
  priority: boolean;
  parcel: boolean;
  note?: string;
};

const statuses = ["all", "pending", "preparing", "ready", "at_table", "complete"];

function parseMods(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch { return []; }
  }
  return [];
}

function uiStatus(orderStatus: string, ticketStatus?: string | null): UiStatus {
  if (orderStatus === "paid" || orderStatus === "comped") return "complete";
  switch (ticketStatus) {
    case "prep": return "preparing";
    case "ready": return "ready";
    case "delivered": return "at_table";
    default: return "pending";
  }
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending:   { color: "#ffaa00", bg: "rgba(255,170,0,0.12)",  icon: Clock,         label: "Pending" },
  preparing: { color: "var(--cafyz-brand)", bg: "rgba(var(--cafyz-brand-rgb),0.12)",  icon: ChefHat,       label: "Preparing" },
  ready:     { color: "#00d4ff", bg: "rgba(0,212,255,0.12)",  icon: CheckCircle2,  label: "Ready" },
  at_table:  { color: "#b9a7e8", bg: "rgba(185,167,232,0.12)", icon: Truck,         label: "At table" },
  complete:  { color: "#00d68f", bg: "rgba(0,214,143,0.12)",   icon: CheckCircle2,  label: "Paid" },
};

const advanceAction: Partial<Record<UiStatus, { action: "fire" | "ready" | "delivered"; label: string }>> = {
  pending:   { action: "fire",      label: "Accept" },
  preparing: { action: "ready",     label: "Ready" },
  ready:     { action: "delivered", label: "Served" },
};

function OrderCard({
  order, cur, onAdvance, onOpen,
}: {
  order: OrderRow;
  cur: string;
  onAdvance: (o: OrderRow) => void;
  onOpen: (o: OrderRow) => void;
}) {
  const cfg = statusConfig[order.status];
  const Icon = cfg.icon;
  const next = advanceAction[order.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpen(order); }}
      className="rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 cursor-pointer transition-colors hover:border-[rgba(var(--cafyz-brand-rgb),0.25)]"
      style={{
        background: "var(--cafyz-surface)",
        border: `1px solid ${order.priority ? "rgba(255,170,0,0.25)" : "var(--cafyz-border)"}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem" }}>{order.id}</span>
          {order.priority && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,170,0,0.12)", color: "#ffaa00", fontSize: "0.62rem" }}>ASAP</span>
          )}
          {order.parcel && (
            <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", fontSize: "0.62rem" }}>
              <Package size={10} /> Parcel
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: "var(--cafyz-muted)" }} />
          <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>{order.time}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: "var(--cafyz-border)", color: "var(--cafyz-brand)", fontFamily: "var(--font-mono)" }}>
          {order.table}
        </span>
        {order.waiter && <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>· {order.waiter}</span>}
      </div>

      {order.note && (
        <p className="text-[0.68rem] px-2 py-1 rounded-lg" style={{ color: "var(--cafyz-text-secondary)", background: "rgba(var(--cafyz-brand-rgb),0.05)" }}>
          Note: {order.note}
        </p>
      )}

      <div className="space-y-1 flex-1">
        {order.items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--cafyz-brand)", fontFamily: "var(--font-mono)" }}>×{item.qty}</span> {item.name}
              </span>
              <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>{cur}{(item.price * item.qty).toFixed(2)}</span>
            </div>
            {item.mods.length > 0 && (
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem", paddingLeft: 14 }}>{item.mods.join(" · ")}</p>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-[rgba(var(--cafyz-brand-rgb),0.08)] flex items-center justify-between gap-2"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: cfg.bg }}>
          <Icon size={11} style={{ color: cfg.color }} />
          <span style={{ color: cfg.color, fontSize: "0.7rem", fontWeight: 600 }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.88rem" }}>{cur}{order.total.toFixed(2)}</span>
          {next && (
            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => onAdvance(order)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "var(--cafyz-gradient)", color: "#fff", minHeight: 32 }}>
              {next.label}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Orders() {
  const { goToPos, goToTableOrder } = useAppNav();
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cur = getCurrencySymbol();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await ordersApi.live({ active: viewMode === "active" });
      // A poll that brings back the same service re-renders nothing.
      setOrders(prev => keepIfSame(prev, rows.map(o => ({
        id: o.bill_no ? `Bill ${o.bill_no}` : "#" + o.id.slice(0, 4).toUpperCase(),
        oid: o.id,
        tid: o.ticket_id ?? undefined,
        tableId: o.table_id ?? undefined,
        orderStatus: o.status,
        table: o.order_type === "parcel" ? "PARCEL" : (o.table_name || "Counter"),
        waiter: o.server_name || "",
        items: (o.items ?? []).map(it => ({
          name: it.name ?? "Item",
          qty: it.qty,
          price: Number(it.price ?? 0),
          mods: parseMods(it.mods),
        })),
        total: o.subtotal ?? (o.items ?? []).reduce((s, it) => s + Number(it.price ?? 0) * it.qty, 0),
        status: uiStatus(o.status, o.ticket_status),
        time: relTime(o.ticket_updated_at || o.updated_at || o.created_at),
        priority: o.ticket_vip === 1,
        parcel: o.order_type === "parcel",
        note: o.note || undefined,
      }))));
      setLoadError(null);
    } catch (e) {
      const msg = (e as Error).message || "Couldn't load orders";
      setLoadError(msg);
      if (!silent) toast.error("Live Orders unavailable", msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    void load();
    const onSent = () => void load(true);
    window.addEventListener("CAFYZ_ORDER_SENT", onSent);
    const stopResume = onResume(() => { void load(true); });
    return () => {
      window.removeEventListener("CAFYZ_ORDER_SENT", onSent);
      stopResume();
    };
  }, [load]);

  usePolling(() => { void load(true); }, 5000);

  const handleAdvance = async (order: OrderRow) => {
    const next = advanceAction[order.status];
    if (!next) return;

    const optimistic: UiStatus = (
      { fire: "preparing", ready: "ready", delivered: "at_table" } as const
    )[next.action];
    setOrders(prev => prev.map(o => o.oid === order.oid ? { ...o, status: optimistic } : o));

    const labels = { fire: "Sent to kitchen", ready: "Order is ready", delivered: "Served at table" };
    try {
      if (!order.tid) {
        if (next.action === "fire" || next.action === "ready") {
          await ordersApi.updateStatus(order.oid, "sent");
        }
      } else {
        await ordersApi.advanceKitchen(order.oid, next.action);
      }
      toast.success(`${order.id} · ${labels[next.action]}`, `${order.table} · ${cur}${order.total.toFixed(2)}`);
      void load(true);
    } catch (e) {
      toast.error("Couldn't update order", (e as Error).message);
      void load(true);
    }
  };

  const handleOpen = (order: OrderRow) => {
    if (order.tableId && order.orderStatus !== "paid") {
      goToTableOrder(order.tableId);
    }
  };

  const source = viewMode === "active"
    ? orders.filter(o => o.orderStatus === "open" || o.orderStatus === "sent")
    : orders;

  const filtered = source.filter(o =>
    (filter === "all" || o.status === filter) &&
    (search === "" ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.table.toLowerCase().includes(search.toLowerCase()) ||
      o.waiter.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = Object.fromEntries(
    ["pending", "preparing", "ready", "at_table", "complete"].map(s => [s, source.filter(o => o.status === s).length]),
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: cfg.bg, border: `1px solid ${withAlpha(cfg.color, 0x22)}` }}>
              <Icon size={13} style={{ color: cfg.color }} />
              <span style={{ color: cfg.color, fontSize: "0.75rem", fontWeight: 600 }}>
                {counts[key] ?? 0} {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <Search size={14} style={{ color: "var(--cafyz-muted)" }} />
          <input type="text" placeholder="Search order, table, or waiter..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--cafyz-muted)]"
            style={{ color: "var(--cafyz-text)" }} />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <div className="flex gap-1 p-1 rounded-xl flex-shrink-0"
            style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
            {(["active", "all"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="px-2.5 py-1.5 rounded-lg text-xs capitalize transition-all whitespace-nowrap"
                style={viewMode === mode
                  ? { background: "rgba(var(--cafyz-brand-rgb),0.15)", color: "var(--cafyz-brand)", fontWeight: 600 }
                  : { color: "var(--cafyz-muted)" }}>
                {mode === "active" ? "Active" : "All"}
              </button>
            ))}
          </div>
          {/* Phones: the status filter takes its own full-width row, so every status shows. */}
          <div className="order-last basis-full grow sm:order-none sm:basis-0 min-w-0 p-1 rounded-xl"
            style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
            <HScroll className="gap-1">
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className="flex-1 sm:flex-none px-1.5 sm:px-2.5 py-1.5 rounded-lg text-xs capitalize transition-all whitespace-nowrap flex-shrink-0"
                style={filter === s
                  ? { background: "var(--cafyz-gradient)", color: "#fff", fontWeight: 600 }
                  : { color: "var(--cafyz-muted)" }}>
                {s === "at_table" ? "At table" : s}
              </button>
            ))}
            </HScroll>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={goToPos} aria-label="New order"
            className="ms-auto sm:ms-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: "var(--cafyz-gradient)", color: "#fff" }}>
            <Plus size={16} />
            <span className="hidden sm:inline">New Order</span>
          </motion.button>
        </div>
      </div>

      {loadError && (
        <p className="px-3 py-2 rounded-lg text-sm" style={{ color: "#ff416c", background: "rgba(255,65,108,0.08)" }}>
          {loadError}
        </p>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--cafyz-brand)" }} />
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem" }}>Loading live orders…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map(order => (
              <OrderCard key={order.oid} order={order} cur={cur} onAdvance={handleAdvance} onOpen={handleOpen} />
            ))}
            {filtered.length === 0 && !loading && (
              <div key="empty" className="col-span-full flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(var(--cafyz-brand-rgb),0.08)" }}>
                  <Filter size={22} style={{ color: "var(--cafyz-muted)" }} />
                </div>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem" }}>
                  {viewMode === "active" ? "No active orders — send one from POS" : "No orders match your filter"}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
