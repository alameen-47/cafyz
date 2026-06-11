import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, X, CheckCircle2, AlertTriangle, Package, ShoppingBag, Users, Check } from "lucide-react";

interface Notification {
  id: string;
  type: "order" | "alert" | "stock" | "staff" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const initialNotifications: Notification[] = [
  { id: "n1", type: "order",  title: "New Order — T-04",     body: "Paneer Tikka ×2, Biryani ×1, Mango Lassi ×2",   time: "just now", read: false },
  { id: "n2", type: "alert",  title: "Table T-07 needs attention", body: "Table has been occupied for 2h 10m with no bill request", time: "3m ago",   read: false },
  { id: "n3", type: "stock",  title: "Low stock alert",       body: "Basmati Rice below par level — 2kg remaining",  time: "8m ago",   read: false },
  { id: "n4", type: "staff",  title: "Sam Wilson clocked in", body: "Shift starting · Assigned T-03, T-20",          time: "22m ago",  read: true },
  { id: "n5", type: "order",  title: "Order #4818 paid",      body: "T-07 · ₹71 · Card payment · Ravi",             time: "31m ago",  read: true },
  { id: "n6", type: "stock",  title: "Olive Oil critically low", body: "Only 500ml remaining — par level is 5L",     time: "45m ago",  read: true },
  { id: "n7", type: "system", title: "Daily report ready",    body: "Revenue ₹52,840 · 342 orders · 18/24 tables",  time: "1h ago",   read: true },
];

const typeConfig = {
  order:  { icon: ShoppingBag, color: "#1e7fff",  bg: "rgba(30,127,255,0.1)" },
  alert:  { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  stock:  { icon: Package,      color: "#ff3b5c",  bg: "rgba(255,59,92,0.1)" },
  staff:  { icon: Users,        color: "#22d3ee",  bg: "rgba(34,211,238,0.1)" },
  system: { icon: CheckCircle2, color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
};

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: NotificationDropdownProps) {
  const [notes, setNotes] = useState(initialNotifications);
  const unreadCount = notes.filter(n => !n.read).length;

  const markAllRead = () => setNotes(n => n.map(x => ({ ...x, read: true })));
  const markRead = (id: string) => setNotes(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  const dismiss = (id: string) => setNotes(n => n.filter(x => x.id !== id));

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={onClose} />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="absolute top-full right-0 mt-2 w-80 sm:w-96 rounded-2xl overflow-hidden z-50"
            style={{
              background: "#0d1326",
              border: "1px solid rgba(30,127,255,0.18)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
              <div className="flex items-center gap-2">
                <Bell size={15} style={{ color: "#1e7fff" }} />
                <span style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.92rem" }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "#ff3b5c", color: "#fff", fontFamily: "var(--font-mono)" }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-[rgba(30,127,255,0.08)]"
                    style={{ color: "#1e7fff" }}>
                    Mark all read
                  </button>
                )}
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-[rgba(30,127,255,0.08)] transition-all"
                  style={{ color: "#6b82a0" }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 380 }}>
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Check size={28} style={{ color: "#22c55e" }} />
                  <p style={{ color: "#6b82a0", fontSize: "0.82rem" }}>All caught up!</p>
                </div>
              ) : (
                notes.map(note => {
                  const cfg = typeConfig[note.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={note.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => markRead(note.id)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-[rgba(30,127,255,0.04)] border-b"
                      style={{
                        borderColor: "rgba(30,127,255,0.06)",
                        background: note.read ? "transparent" : "rgba(30,127,255,0.03)",
                      }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.bg }}>
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p style={{ color: note.read ? "#a8bdd4" : "#e8eef8", fontWeight: note.read ? 400 : 600, fontSize: "0.8rem", lineHeight: 1.3 }}>
                            {note.title}
                          </p>
                          {!note.read && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: "#1e7fff" }} />
                          )}
                        </div>
                        <p style={{ color: "#6b82a0", fontSize: "0.72rem", marginTop: 2, lineHeight: 1.4 }}>{note.body}</p>
                        <p style={{ color: "#6b82a0", fontSize: "0.65rem", marginTop: 3 }}>{note.time}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); dismiss(note.id); }}
                        className="p-0.5 rounded-md hover:bg-[rgba(255,59,92,0.08)] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        style={{ color: "#6b82a0" }}>
                        <X size={12} />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
              <button style={{ color: "#1e7fff", fontSize: "0.78rem", fontWeight: 600 }}>
                View all notifications →
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
