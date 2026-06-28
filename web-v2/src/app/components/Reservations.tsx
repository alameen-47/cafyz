import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Calendar, Users, StickyNote, Check, X, Crown, Edit2, Trash2, Armchair, Loader2 } from "lucide-react";
import { toast } from "./Toast";
import { reservationsApi, tablesApi, type ApiReservation, type ApiTable } from "../../services/api";
import { useAppNav } from "../nav";

type ResStatus = "confirmed" | "seated" | "cancelled" | "completed";

interface Reservation {
  id: string;
  guest: string;
  covers: number;
  date: string;
  time: string;
  table: string;
  tableId: string;
  note: string;
  status: ResStatus;
}

const statusConfig: Record<ResStatus, { color: string; bg: string; label: string }> = {
  confirmed: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Confirmed" },
  seated: { color: "#1e7fff", bg: "var(--cafyz-badge-bg)", label: "Seated" },
  cancelled: { color: "#ff3b5c", bg: "rgba(255,59,92,0.1)", label: "Cancelled" },
  completed: { color: "var(--cafyz-muted)", bg: "rgba(107,130,160,0.1)", label: "No-show" },
};

const timeSlots = ["12:00", "12:30", "13:00", "13:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

const ST_FWD: Record<string, ResStatus> = { confirmed: "confirmed", seated: "seated", cancelled: "cancelled", "no-show": "completed" };
const ST_REV: Partial<Record<ResStatus, string>> = { confirmed: "confirmed", seated: "seated", cancelled: "cancelled", completed: "no-show" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitResTime(rt?: string): { date: string; time: string } {
  if (!rt) return { date: "", time: "" };
  const s = rt.includes("T") ? rt : rt.replace(" ", "T");
  const [d, t = ""] = s.split("T");
  return { date: d, time: t.slice(0, 5) };
}

function notifyReservationChange() {
  window.dispatchEvent(new Event("CAFYZ_RESERVATION_CHANGED"));
  window.dispatchEvent(new Event("CAFYZ_NOTIFICATIONS_REFRESH"));
}

function mapRow(r: ApiReservation, nameById: Map<string, string>): Reservation {
  const { date, time } = splitResTime(r.res_time);
  return {
    id: r.id,
    guest: r.guest_name,
    covers: r.covers,
    date, time,
    table: r.table_name || (r.table_id ? nameById.get(r.table_id) ?? "—" : "—"),
    tableId: r.table_id ?? "",
    note: r.note ?? "",
    status: ST_FWD[r.status] ?? "confirmed",
  };
}

function TableSelect({
  value, covers, tables, onChange,
}: {
  value: string;
  covers: number;
  tables: ApiTable[];
  onChange: (id: string) => void;
}) {
  const fits = tables.filter(t => t.capacity >= covers);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
      <option value="">No table assigned</option>
      {fits.map(t => (
        <option key={t.id} value={t.id}>
          {t.name} · {t.capacity} seats{t.status === "reserved" ? " (reserved)" : t.status === "occupied" ? " (busy)" : ""}
        </option>
      ))}
      {fits.length === 0 && tables.length > 0 && (
        <option disabled value="">No table fits {covers} covers</option>
      )}
    </select>
  );
}

export function Reservations() {
  const { goToTableOrder } = useAppNav();
  const [items, setItems] = useState<Reservation[]>([]);
  const [tableOpts, setTableOpts] = useState<ApiTable[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editRes, setEditRes] = useState<Reservation | null>(null);
  const [filterDate, setFilterDate] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newRes, setNewRes] = useState({
    guest: "", covers: 2, date: todayIso(), time: "19:00", table: "", note: "",
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const listParams = filterDate ? { date: filterDate } : undefined;
      const [rows, tables] = await Promise.all([
        reservationsApi.list(listParams),
        tablesApi.list().catch(() => [] as ApiTable[]),
      ]);
      setTableOpts(tables);
      const nameById = new Map(tables.map(t => [t.id, t.name]));
      setItems(rows.map(r => mapRow(r, nameById)));
      setLoadError(null);
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      if (!silent) toast.error("Couldn't load reservations", msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const filtered = useMemo(() =>
    [...items].sort((a, b) => a.time.localeCompare(b.time)),
    [items],
  );

  const updateStatus = async (id: string, status: ResStatus, openPos = false) => {
    const res = items.find(r => r.id === id);
    setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    try {
      await reservationsApi.update(id, { status: ST_REV[status] ?? "confirmed" });
      notifyReservationChange();
      if (status === "seated") {
        toast.success("Guest seated", `${res?.guest} · ${res?.table}`);
        if (openPos && res?.tableId) goToTableOrder(res.tableId);
      } else if (status === "cancelled") {
        toast.error("Reservation cancelled", `${res?.guest}'s booking has been cancelled`);
      } else if (status === "completed") {
        toast.info("Marked no-show", res?.guest ?? "");
      }
      void load(true);
    } catch (e) {
      toast.error("Couldn't update reservation", (e as Error).message);
      void load(true);
    }
  };

  const deleteReservation = async (res: Reservation) => {
    if (!window.confirm(`Delete reservation for ${res.guest}?`)) return;
    try {
      await reservationsApi.delete(res.id);
      notifyReservationChange();
      toast.success("Reservation deleted", res.guest);
      await load(true);
    } catch (e) {
      toast.error("Couldn't delete reservation", (e as Error).message);
    }
  };

  const saveReservation = async (draft: typeof newRes, id?: string) => {
    if (!draft.guest.trim()) {
      toast.error("Guest name required", "Enter a name for the reservation");
      return;
    }
    const date = draft.date || todayIso();
    const payload = {
      guest_name: draft.guest.trim(),
      covers: draft.covers,
      res_time: `${date}T${draft.time}:00`,
      note: draft.note || undefined,
      table_id: draft.table || undefined,
    };
    try {
      if (id) {
        await reservationsApi.update(id, payload);
        toast.success("Reservation updated", `${draft.guest} · ${date} at ${draft.time}`);
        setEditRes(null);
      } else {
        await reservationsApi.create(payload);
        toast.success("Reservation created", `${draft.guest} · ${date} at ${draft.time}`);
        setShowForm(false);
        setNewRes({ guest: "", covers: 2, date: todayIso(), time: "19:00", table: "", note: "" });
      }
      notifyReservationChange();
      await load(true);
    } catch (e) {
      toast.error(id ? "Couldn't update reservation" : "Couldn't create reservation", (e as Error).message);
    }
  };

  const statsLabel = filterDate ? `Reservations · ${filterDate}` : "All reservations";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <Crown size={14} style={{ color: "#a855f7" }} />
        <span style={{ color: "#a855f7", fontSize: "0.75rem", fontWeight: 600 }}>Premium Feature</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={15} style={{ color: "var(--cafyz-muted)" }} />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--cafyz-surface)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border)" }}
          />
          <button type="button" onClick={() => setFilterDate(todayIso())}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "var(--cafyz-border)", color: "#1e7fff" }}>
            Today
          </button>
        </div>
        <button type="button" onClick={() => { setNewRes(r => ({ ...r, date: filterDate || todayIso() })); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
          <Plus size={16} /> New Reservation
        </button>
      </div>

      {loadError && (
        <p className="px-3 py-2 rounded-lg text-sm" style={{ color: "#ff3b5c", background: "rgba(255,59,92,0.08)" }}>
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: statsLabel, value: filtered.length, color: "#1e7fff" },
          { label: "Confirmed", value: filtered.filter(r => r.status === "confirmed").length, color: "#22c55e" },
          { label: "Seated", value: filtered.filter(r => r.status === "seated").length, color: "#1e7fff" },
          { label: "Total Covers", value: filtered.reduce((s, r) => s + r.covers, 0), color: "#00c6ff" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
            <div style={{ color: s.color, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>{s.value}</div>
            <div style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "#1e7fff" }} />
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem" }}>Loading reservations…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl" style={{ border: "1px dashed rgba(30,127,255,0.15)" }}>
              <Calendar size={28} style={{ color: "var(--cafyz-muted)" }} />
              <p style={{ color: "var(--cafyz-muted)" }}>No reservations for {filterDate || "this date"}</p>
            </div>
          ) : (
            filtered.map((res, i) => {
              const cfg = statusConfig[res.status];
              return (
                <motion.div
                  key={res.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl p-4 flex flex-wrap items-start gap-4"
                  style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}
                >
                  <div className="w-16 flex-shrink-0 text-center">
                    <div style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1rem" }}>{res.time}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full mt-1" style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff" }}>{res.table}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p style={{ color: "var(--cafyz-text)", fontWeight: 600, fontSize: "0.92rem" }}>{res.guest}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1" style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>
                        <Users size={11} /> {res.covers} covers
                      </span>
                      {res.note && (
                        <span className="flex items-center gap-1" style={{ color: "#f59e0b", fontSize: "0.72rem" }}>
                          <StickyNote size={11} /> {res.note}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {res.status === "confirmed" && (
                      <>
                        <button type="button" onClick={() => void updateStatus(res.id, "seated", true)} title="Seat guest & open POS"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>
                          <Armchair size={13} /> Seat
                        </button>
                        <button type="button" onClick={() => void updateStatus(res.id, "completed")} title="Mark no-show"
                          className="px-2 py-1 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(107,130,160,0.12)", color: "var(--cafyz-muted)" }}>
                          No-show
                        </button>
                      </>
                    )}
                    {res.status !== "cancelled" && res.status !== "completed" && (
                      <>
                        <button type="button" onClick={() => setEditRes(res)} title="Edit"
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(30,127,255,0.08)" }}>
                          <Edit2 size={13} style={{ color: "#1e7fff" }} />
                        </button>
                        <button type="button" onClick={() => void updateStatus(res.id, "cancelled")} title="Cancel"
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(255,59,92,0.08)" }}>
                          <X size={13} style={{ color: "#ff3b5c" }} />
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => void deleteReservation(res)} title="Delete"
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(107,130,160,0.1)" }}>
                      <Trash2 size={13} style={{ color: "var(--cafyz-muted)" }} />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>New Reservation</h3>
                <button type="button" onClick={() => setShowForm(false)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Guest Name</label>
                  <input type="text" placeholder="Guest name" value={newRes.guest}
                    onChange={e => setNewRes(r => ({ ...r, guest: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Date</label>
                    <input type="date" value={newRes.date} onChange={e => setNewRes(r => ({ ...r, date: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Time</label>
                    <select value={newRes.time} onChange={e => setNewRes(r => ({ ...r, time: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                      {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Covers</label>
                    <input type="number" min={1} max={20} value={newRes.covers}
                      onChange={e => setNewRes(r => ({ ...r, covers: +e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Table</label>
                    <TableSelect value={newRes.table} covers={newRes.covers} tables={tableOpts}
                      onChange={id => setNewRes(r => ({ ...r, table: id }))} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Note</label>
                  <input type="text" placeholder="Special requests…" value={newRes.note}
                    onChange={e => setNewRes(r => ({ ...r, note: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button type="button" onClick={() => void saveReservation(newRes)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  <Check size={15} /> Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editRes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setEditRes(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>Edit Reservation</h3>
                <button type="button" onClick={() => setEditRes(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Guest Name</label>
                  <input type="text" value={editRes.guest}
                    onChange={e => setEditRes(r => r ? { ...r, guest: e.target.value } : r)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Date</label>
                    <input type="date" value={editRes.date}
                      onChange={e => setEditRes(r => r ? { ...r, date: e.target.value } : r)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Time</label>
                    <select value={editRes.time}
                      onChange={e => setEditRes(r => r ? { ...r, time: e.target.value } : r)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                      {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Covers</label>
                    <input type="number" min={1} max={20} value={editRes.covers}
                      onChange={e => setEditRes(r => r ? { ...r, covers: +e.target.value } : r)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Table</label>
                    <TableSelect value={editRes.tableId} covers={editRes.covers} tables={tableOpts}
                      onChange={id => setEditRes(r => r ? { ...r, tableId: id } : r)} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Note</label>
                  <input type="text" value={editRes.note}
                    onChange={e => setEditRes(r => r ? { ...r, note: e.target.value } : r)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditRes(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button type="button"
                  onClick={() => editRes && void saveReservation({
                    guest: editRes.guest,
                    covers: editRes.covers,
                    date: editRes.date,
                    time: editRes.time,
                    table: editRes.tableId,
                    note: editRes.note,
                  }, editRes.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  <Check size={15} /> Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
