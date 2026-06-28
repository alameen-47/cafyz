import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Clock, Plus, Utensils, X, Save } from "lucide-react";
import { tablesApi, usersApi, ordersApi, reservationsApi, type ApiTable, type ApiReservation, type ApiUser } from "../../services/api";
import { toast } from "./Toast";
import { useAppNav } from "../nav";

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

const statusConfig: Record<TableStatus, { color: string; bg: string; border: string; label: string }> = {
  available: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", label: "Available" },
  occupied: { color: "#1e7fff", bg: "var(--cafyz-badge-bg)", border: "rgba(30,127,255,0.3)", label: "Occupied" },
  reserved: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", label: "Reserved" },
  cleaning: { color: "var(--cafyz-muted)", bg: "rgba(107,130,160,0.08)", border: "rgba(107,130,160,0.2)", label: "Cleaning" },
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
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--cafyz-text)", fontSize: "1rem" }} className="mb-1">
        {table.name}
      </div>
      <div className="flex items-center gap-1 mb-2" style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>
        <Users size={11} />
        <span>{table.seats} seats</span>
        {table.guests && <span>· {table.guests} guests</span>}
      </div>
      {table.status === "occupied" && (
        <div className="space-y-0.5">
          <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.72rem" }}>
            <span style={{ color: "#1e7fff" }}>●</span> {table.waiter} · {table.since}
          </p>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>{table.order}</p>
        </div>
      )}
      {table.status === "reserved" && (
        <p style={{ color: "#f59e0b", fontSize: "0.7rem" }}>{table.reservation}</p>
      )}
    </motion.button>
  );
}

export function Tables() {
  const nav = useAppNav();
  const [tables, setTables] = useState<TableData[]>([]);
  const [selected, setSelected] = useState<TableData | null>(null);
  const [filterStatus, setFilterStatus] = useState<TableStatus | "all">("all");
  const [tableForm, setTableForm] = useState<null | { mode: "create"; name: string; seats: string; zone: string } | { mode: "edit"; id: string; name: string; seats: string }>(null);
  const [savingTable, setSavingTable] = useState(false);

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
      const today = new Date().toISOString().slice(0, 10);
      resv.forEach(r => {
        const resDate = r.res_time?.slice(0, 10) ?? "";
        if (
          r.table_id
          && r.status === "confirmed"
          && resDate >= today
          && !resvByTable.has(r.table_id)
        ) {
          resvByTable.set(r.table_id, r);
        }
      });
      setTables(ts.map(t => mapTable(t, nameById, orderByTable, resvByTable)));
    } catch { /* keep last snapshot on transient errors */ }
  }, []);
  useEffect(() => {
    void load();
    const onResChange = () => void load();
    window.addEventListener("CAFYZ_RESERVATION_CHANGED", onResChange);
    const id = window.setInterval(() => void load(), 8000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("CAFYZ_RESERVATION_CHANGED", onResChange);
    };
  }, [load]);

  const statusCounts = Object.fromEntries(
    (["available", "occupied", "reserved", "cleaning"] as TableStatus[]).map(s => [s, tables.filter(t => t.status === s).length])
  );

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

  const filtered = filterStatus === "all" ? tables : tables.filter(t => t.status === filterStatus);

  const saveTableForm = async () => {
    if (!tableForm) return;
    const name = tableForm.name.trim();
    const seats = Number(tableForm.seats);
    if (!name) { toast.error("Table name required"); return; }
    if (!Number.isFinite(seats) || seats < 1) { toast.error("Enter a valid seat count"); return; }
    setSavingTable(true);
    try {
      if (tableForm.mode === "create") {
        await tablesApi.create({ name, zone: tableForm.zone.trim() || "Main", capacity: seats });
        toast.success("Table added", name);
      } else {
        await tablesApi.update(tableForm.id, { name, capacity: seats });
        toast.success("Table updated", name);
        setSelected(prev => prev?.id === tableForm.id ? { ...prev, name, seats } : prev);
      }
      setTableForm(null);
      void load();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSavingTable(false);
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
              background: filterStatus === key ? cfg.bg : "var(--cafyz-surface)",
              border: `1px solid ${filterStatus === key ? cfg.border : "var(--cafyz-border)"}`,
            }}
          >
            <div style={{ color: cfg.color, fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{statusCounts[key]}</div>
            <div style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem" }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text-strong)" }}>
          Floor Plan · {filtered.length} tables
        </h3>
        <button
          onClick={() => setTableForm({ mode: "create", name: "", seats: "4", zone: "Main" })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.2)" }}
        >
          <Plus size={16} /> Add Table
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
          style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>{selected.name}</h3>
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: statusConfig[selected.status].bg, color: statusConfig[selected.status].color }}
              >
                {statusConfig[selected.status].label}
              </span>
            </div>
            <div style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem" }} className="space-y-1">
              <p><span style={{ color: "var(--cafyz-text-secondary)" }}>Capacity:</span> {selected.seats} seats</p>
              {selected.guests && <p><span style={{ color: "var(--cafyz-text-secondary)" }}>Guests:</span> {selected.guests}</p>}
              {selected.waiter && <p><span style={{ color: "var(--cafyz-text-secondary)" }}>Server:</span> {selected.waiter}</p>}
              {selected.since && <p><span style={{ color: "var(--cafyz-text-secondary)" }}>Since:</span> {selected.since}</p>}
              {selected.reservation && <p><span style={{ color: "var(--cafyz-text-secondary)" }}>Reservation:</span> {selected.reservation}</p>}
            </div>
            <button
              onClick={() => setTableForm({ mode: "edit", id: selected.id, name: selected.name, seats: String(selected.seats) })}
              className="w-full py-2 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.15)" }}
            >
              Edit name / capacity
            </button>
            {/* Primary action: take / view this table's order in the POS */}
            <button
              onClick={() => { nav.goToTableOrder(selected.id); setSelected(null); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}
            >
              <Utensils size={15} /> {selected.status === "occupied" ? "View / Edit Order" : "Take Order"}
            </button>

            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Set status</p>
            <div className="grid grid-cols-2 gap-2">
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
            <button
              onClick={async () => {
                if (!window.confirm(`Delete ${selected.name}?`)) return;
                try {
                  await tablesApi.delete(selected.id);
                  toast.success("Table removed", selected.name);
                  setSelected(null);
                  void load();
                } catch (e) { toast.error("Delete failed", (e as Error).message); }
              }}
              className="w-full py-2 rounded-xl text-xs font-medium"
              style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}
            >
              Delete table
            </button>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {tableForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setTableForm(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>
                  {tableForm.mode === "create" ? "Add Table" : "Edit Table"}
                </h3>
                <button onClick={() => setTableForm(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Table name</label>
                  <input type="text" value={tableForm.name}
                    onChange={e => setTableForm(f => f ? { ...f, name: e.target.value } : f)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Seats</label>
                  <input type="number" min={1} value={tableForm.seats}
                    onChange={e => setTableForm(f => f ? { ...f, seats: e.target.value } : f)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                {tableForm.mode === "create" && (
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Zone</label>
                    <input type="text" value={tableForm.zone}
                      onChange={e => setTableForm(f => f && f.mode === "create" ? { ...f, zone: e.target.value } : f)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setTableForm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => void saveTableForm()} disabled={savingTable}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: savingTable ? 0.7 : 1 }}>
                  <Save size={15} /> Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
