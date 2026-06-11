import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Users, Clock, Plus, Utensils } from "lucide-react";
import { tablesApi, usersApi, ordersApi, reservationsApi, type ApiTable, type ApiReservation, type ApiUser } from "../../services/api";
import { toast } from "./Toast";

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";

interface TableData {
  id: string;          // real table id (for API calls)
  name: string;        // display label, e.g. "T1"
  seats: number;
  status: TableStatus;
  guests?: number;
  waiter?: string;
  since?: string;
  order?: string;
  reservation?: string;
}

// Backend statuses ↔ the floor-plan's status vocabulary.
const STATUS_FWD: Record<string, TableStatus> = {
  empty: "available", occupied: "occupied", paying: "occupied",
  reserved: "reserved", attention: "cleaning",
};
const STATUS_REV: Record<TableStatus, string> = {
  available: "empty", occupied: "occupied", reserved: "reserved", cleaning: "attention",
};

function fmtResTime(t?: string): string {
  if (!t) return "";
  const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
  if (isNaN(d.getTime())) return t;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function mapTable(
  t: ApiTable,
  nameById: Map<string, string>,
  orderByTable: Map<string, string>,
  resvByTable: Map<string, ApiReservation>,
): TableData {
  const status = STATUS_FWD[t.status] ?? "available";
  const order = orderByTable.get(t.id);
  const resv = resvByTable.get(t.id);
  return {
    id: t.id,
    name: t.name,
    seats: t.capacity,
    status,
    guests: status === "occupied" && t.covers ? t.covers : undefined,
    waiter: t.server_id ? nameById.get(t.server_id) : undefined,
    since: status === "occupied" && t.elapsed_min ? `${t.elapsed_min}m` : undefined,
    order: order ? "#" + order.slice(0, 4).toUpperCase() : undefined,
    reservation: status === "reserved"
      ? (resv ? `${fmtResTime(resv.res_time)} · ${resv.guest_name} · ${resv.covers} guests` : "Reserved")
      : undefined,
  };
}

const initialTables: TableData[] = [
  { id: "T-01", seats: 2, status: "available" },
  { id: "T-02", seats: 4, status: "occupied", guests: 3, waiter: "Ravi", since: "7:45pm", order: "#4816" },
  { id: "T-03", seats: 4, status: "occupied", guests: 2, waiter: "Sam", since: "7:20pm", order: "#4819" },
  { id: "T-04", seats: 6, status: "reserved", reservation: "8:30pm · Smith party · 4 guests" },
  { id: "T-05", seats: 4, status: "occupied", guests: 4, waiter: "Ravi", since: "7:00pm", order: "#4821" },
  { id: "T-06", seats: 2, status: "occupied", guests: 2, waiter: "Mia", since: "7:55pm", order: "#4814" },
  { id: "T-07", seats: 4, status: "occupied", guests: 3, waiter: "Ravi", since: "6:50pm", order: "#4818" },
  { id: "T-08", seats: 8, status: "available" },
  { id: "T-09", seats: 4, status: "occupied", guests: 4, waiter: "Mia", since: "6:30pm", order: "#4817" },
  { id: "T-10", seats: 2, status: "cleaning" },
  { id: "T-11", seats: 4, status: "occupied", guests: 2, waiter: "Priya", since: "8:05pm", order: "#4815" },
  { id: "T-12", seats: 6, status: "occupied", guests: 5, waiter: "Priya", since: "7:35pm", order: "#4820" },
  { id: "T-13", seats: 2, status: "available" },
  { id: "T-14", seats: 4, status: "reserved", reservation: "9:00pm · Johnson · 3 guests" },
  { id: "T-15", seats: 6, status: "available" },
  { id: "T-16", seats: 4, status: "cleaning" },
  { id: "T-17", seats: 2, status: "available" },
  { id: "T-18", seats: 8, status: "reserved", reservation: "9:15pm · Birthday party · 7 guests" },
  { id: "T-19", seats: 4, status: "available" },
  { id: "T-20", seats: 2, status: "occupied", guests: 1, waiter: "Sam", since: "8:10pm", order: "#4822" },
  { id: "T-21", seats: 4, status: "available" },
  { id: "T-22", seats: 6, status: "occupied", guests: 4, waiter: "Mia", since: "7:15pm", order: "#4823" },
  { id: "T-23", seats: 2, status: "available" },
  { id: "T-24", seats: 4, status: "cleaning" },
];

const statusConfig: Record<TableStatus, { color: string; bg: string; border: string; label: string }> = {
  available: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", label: "Available" },
  occupied: { color: "#1e7fff", bg: "rgba(30,127,255,0.1)", border: "rgba(30,127,255,0.3)", label: "Occupied" },
  reserved: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", label: "Reserved" },
  cleaning: { color: "#6b82a0", bg: "rgba(107,130,160,0.08)", border: "rgba(107,130,160,0.2)", label: "Cleaning" },
};

function TableCard({ table, onClick }: { table: TableData; onClick: () => void }) {
  const cfg = statusConfig[table.status];
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="rounded-2xl p-4 text-left w-full transition-all"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${cfg.color}18` }}
        >
          <Utensils size={16} style={{ color: cfg.color }} />
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${cfg.color}15`, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#e8eef8", fontSize: "1rem" }} className="mb-1">
        {table.name}
      </div>
      <div className="flex items-center gap-1 mb-2" style={{ color: "#6b82a0", fontSize: "0.72rem" }}>
        <Users size={11} />
        <span>{table.seats} seats</span>
        {table.guests && <span>· {table.guests} guests</span>}
      </div>
      {table.status === "occupied" && (
        <div className="space-y-0.5">
          <p style={{ color: "#a8bdd4", fontSize: "0.72rem" }}>
            <span style={{ color: "#1e7fff" }}>●</span> {table.waiter} · {table.since}
          </p>
          <p style={{ color: "#6b82a0", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>{table.order}</p>
        </div>
      )}
      {table.status === "reserved" && (
        <p style={{ color: "#f59e0b", fontSize: "0.7rem" }}>{table.reservation}</p>
      )}
    </motion.button>
  );
}

export function Tables() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [selected, setSelected] = useState<TableData | null>(null);
  const [filterStatus, setFilterStatus] = useState<TableStatus | "all">("all");

  // Live floor plan: tables joined with their server, active order, reservation.
  const load = useCallback(async () => {
    try {
      const [ts, users, sentOrders, resv] = await Promise.all([
        tablesApi.list(),
        usersApi.list().catch(() => [] as ApiUser[]),
        ordersApi.list({ status: "sent" }).catch(() => []),
        reservationsApi.list().catch(() => [] as ApiReservation[]),
      ]);
      const nameById = new Map(users.map(u => [u.id, u.name]));
      const orderByTable = new Map<string, string>();
      sentOrders.forEach(o => { if (o.table_id) orderByTable.set(o.table_id, o.id); });
      const resvByTable = new Map<string, ApiReservation>();
      resv.forEach(r => {
        if (r.table_id && r.status !== "cancelled" && r.status !== "seated" && r.status !== "no_show" && !resvByTable.has(r.table_id)) {
          resvByTable.set(r.table_id, r);
        }
      });
      setTables(ts.map(t => mapTable(t, nameById, orderByTable, resvByTable)));
    } catch { /* keep last snapshot on transient errors */ }
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const statusCounts = Object.fromEntries(
    (["available", "occupied", "reserved", "cleaning"] as TableStatus[]).map(s => [s, tables.filter(t => t.status === s).length])
  );

  const filtered = filterStatus === "all" ? tables : tables.filter(t => t.status === filterStatus);

  const handleStatusChange = async (id: string, status: TableStatus) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, status, guests: status !== "occupied" ? undefined : t.guests } : t));
    setSelected(null);
    try {
      await tablesApi.updateStatus(id, { status: STATUS_REV[status], ...(status !== "occupied" ? { covers: 0 } : {}) });
      void load();
    } catch (e) {
      toast.error("Couldn't update table", (e as Error).message);
      void load();
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(statusConfig) as [TableStatus, typeof statusConfig[TableStatus]][]).map(([key, cfg]) => (
          <div
            key={key}
            className="rounded-2xl p-4 cursor-pointer transition-all"
            onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
            style={{
              background: filterStatus === key ? cfg.bg : "#0d1326",
              border: `1px solid ${filterStatus === key ? cfg.border : "rgba(30,127,255,0.1)"}`,
            }}
          >
            <div style={{ color: cfg.color, fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{statusCounts[key]}</div>
            <div style={{ color: "#6b82a0", fontSize: "0.78rem" }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Floor Plan · {filtered.length} tables
        </h3>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }}
        >
          <Plus size={16} /> Add Reservation
        </button>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {filtered.map(table => (
          <TableCard key={table.id} table={table} onClick={() => setSelected(table)} />
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(6,9,26,0.8)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 style={{ fontFamily: "var(--font-display)", color: "#e8eef8", fontWeight: 700 }}>{selected.name}</h3>
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: statusConfig[selected.status].bg, color: statusConfig[selected.status].color }}
              >
                {statusConfig[selected.status].label}
              </span>
            </div>
            <div style={{ color: "#6b82a0", fontSize: "0.85rem" }} className="space-y-1">
              <p><span style={{ color: "#a8bdd4" }}>Capacity:</span> {selected.seats} seats</p>
              {selected.guests && <p><span style={{ color: "#a8bdd4" }}>Guests:</span> {selected.guests}</p>}
              {selected.waiter && <p><span style={{ color: "#a8bdd4" }}>Server:</span> {selected.waiter}</p>}
              {selected.since && <p><span style={{ color: "#a8bdd4" }}>Since:</span> {selected.since}</p>}
              {selected.reservation && <p><span style={{ color: "#a8bdd4" }}>Reservation:</span> {selected.reservation}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {(["available", "occupied", "reserved", "cleaning"] as TableStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(selected.id, s)}
                  disabled={selected.status === s}
                  className="py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all hover:opacity-80 disabled:opacity-30"
                  style={{
                    background: statusConfig[s].bg,
                    color: statusConfig[s].color,
                    border: `1px solid ${statusConfig[s].border}`,
                  }}
                >
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
