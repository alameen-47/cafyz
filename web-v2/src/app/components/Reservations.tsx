import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Calendar, Clock, Users, Phone, StickyNote, Check, X, Crown } from "lucide-react";
import { toast } from "./Toast";

type ResStatus = "confirmed" | "pending" | "seated" | "cancelled" | "completed";

interface Reservation {
  id: string;
  guest: string;
  phone: string;
  covers: number;
  date: string;
  time: string;
  table: string;
  note: string;
  status: ResStatus;
}

const reservations: Reservation[] = [
  { id: "r1", guest: "Arjun Mehta", phone: "+91 98765 11111", covers: 4, date: "2026-06-11", time: "19:00", table: "T-04", note: "Anniversary dinner, candle setup", status: "confirmed" },
  { id: "r2", guest: "Priya Sharma", phone: "+91 98765 22222", covers: 2, date: "2026-06-11", time: "19:30", table: "T-01", note: "", status: "confirmed" },
  { id: "r3", guest: "Raj & Family", phone: "+91 98765 33333", covers: 6, date: "2026-06-11", time: "20:00", table: "T-08", note: "High chair needed", status: "pending" },
  { id: "r4", guest: "Birthday Party", phone: "+91 98765 44444", covers: 8, date: "2026-06-11", time: "20:30", table: "T-18", note: "Birthday cake — confirm by 8pm", status: "confirmed" },
  { id: "r5", guest: "Johnson Party", phone: "+91 98765 55555", covers: 3, date: "2026-06-12", time: "21:00", table: "T-14", note: "", status: "pending" },
  { id: "r6", guest: "Corporate Dinner", phone: "+91 98765 66666", covers: 12, date: "2026-06-12", time: "19:00", table: "T-08", note: "Private room requested", status: "confirmed" },
];

const statusConfig: Record<ResStatus, { color: string; bg: string; label: string }> = {
  confirmed: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Confirmed" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending" },
  seated: { color: "#1e7fff", bg: "rgba(30,127,255,0.1)", label: "Seated" },
  cancelled: { color: "#ff3b5c", bg: "rgba(255,59,92,0.1)", label: "Cancelled" },
  completed: { color: "#6b82a0", bg: "rgba(107,130,160,0.1)", label: "Completed" },
};

const timeSlots = ["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"];
const tables = ["T-01","T-02","T-04","T-06","T-08","T-14","T-15","T-18","T-19","T-21"];

export function Reservations() {
  const [items, setItems] = useState(reservations);
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState("2026-06-11");
  const [newRes, setNewRes] = useState({ guest: "", phone: "", covers: 2, date: "2026-06-12", time: "19:00", table: "T-01", note: "" });

  const filtered = items.filter(r => !filterDate || r.date === filterDate);

  const updateStatus = (id: string, status: ResStatus) => {
    const res = items.find(r => r.id === id);
    setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (status === "confirmed") toast.success("Reservation confirmed", `${res?.guest} · ${res?.time} · ${res?.table}`);
    if (status === "cancelled") toast.error("Reservation cancelled", `${res?.guest}'s booking has been cancelled`);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Premium badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <Crown size={14} style={{ color: "#a855f7" }} />
        <span style={{ color: "#a855f7", fontSize: "0.75rem", fontWeight: 600 }}>Premium Feature</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={15} style={{ color: "#6b82a0" }} />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#0d1326", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }}
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}
        >
          <Plus size={16} /> New Reservation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's Reservations", value: filtered.length, color: "#1e7fff" },
          { label: "Confirmed", value: filtered.filter(r => r.status === "confirmed").length, color: "#22c55e" },
          { label: "Pending", value: filtered.filter(r => r.status === "pending").length, color: "#f59e0b" },
          { label: "Total Covers", value: filtered.reduce((s,r) => s + r.covers, 0), color: "#00c6ff" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <div style={{ color: s.color, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>{s.value}</div>
            <div style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Reservations list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl" style={{ border: "1px dashed rgba(30,127,255,0.15)" }}>
            <Calendar size={28} style={{ color: "#6b82a0" }} />
            <p style={{ color: "#6b82a0" }}>No reservations for this date</p>
          </div>
        ) : (
          filtered.sort((a, b) => a.time.localeCompare(b.time)).map((res, i) => {
            const cfg = statusConfig[res.status];
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl p-4 flex flex-wrap items-start gap-4"
                style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}
              >
                {/* Time */}
                <div className="w-16 flex-shrink-0 text-center">
                  <div style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1rem" }}>{res.time}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full mt-1" style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff" }}>{res.table}</div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#e8eef8", fontWeight: 600, fontSize: "0.92rem" }}>{res.guest}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.75rem" }}>
                      <Users size={11} /> {res.covers} covers
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.75rem" }}>
                      <Phone size={11} /> {res.phone}
                    </span>
                    {res.note && (
                      <span className="flex items-center gap-1" style={{ color: "#f59e0b", fontSize: "0.72rem" }}>
                        <StickyNote size={11} /> {res.note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  {res.status === "pending" && (
                    <button onClick={() => updateStatus(res.id, "confirmed")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(34,197,94,0.1)" }}>
                      <Check size={13} style={{ color: "#22c55e" }} />
                    </button>
                  )}
                  {res.status !== "cancelled" && res.status !== "completed" && (
                    <button onClick={() => updateStatus(res.id, "cancelled")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(255,59,92,0.08)" }}>
                      <X size={13} style={{ color: "#ff3b5c" }} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Reservation modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,9,26,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4"
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "#e8eef8", fontWeight: 700 }}>New Reservation</h3>
                <button onClick={() => setShowForm(false)} style={{ color: "#6b82a0" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {[{ label: "Guest Name", field: "guest", placeholder: "Arjun Mehta" }, { label: "Phone", field: "phone", placeholder: "+91 ..." }].map(f => (
                  <div key={f.field}>
                    <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type="text" placeholder={f.placeholder} value={(newRes as any)[f.field]}
                      onChange={e => setNewRes(r => ({ ...r, [f.field]: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[#6b82a0]"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Date</label>
                    <input type="date" value={newRes.date} onChange={e => setNewRes(r => ({ ...r, date: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Time</label>
                    <select value={newRes.time} onChange={e => setNewRes(r => ({ ...r, time: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
                      {timeSlots.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Covers</label>
                    <input type="number" min={1} max={20} value={newRes.covers} onChange={e => setNewRes(r => ({ ...r, covers: +e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Table</label>
                    <select value={newRes.table} onChange={e => setNewRes(r => ({ ...r, table: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
                      {tables.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Note</label>
                  <input type="text" placeholder="Special requests..." value={newRes.note}
                    onChange={e => setNewRes(r => ({ ...r, note: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[#6b82a0]"
                    style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newRes.guest) {
                      setItems(prev => [...prev, { ...newRes, id: `r${prev.length + 1}`, status: "confirmed" }]);
                      toast.success("Reservation created", `${newRes.guest} · ${newRes.date} at ${newRes.time}`);
                      setShowForm(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  <Check size={15} /> Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
