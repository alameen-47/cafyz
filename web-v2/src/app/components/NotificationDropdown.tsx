import { motion, AnimatePresence } from "motion/react";
import { Bell, X, CheckCircle2, AlertTriangle, Package, ShoppingBag, Check, ChefHat, CalendarCheck } from "lucide-react";
import type { ApiNotification } from "../../services/api";

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
  items: ApiNotification[];
  unread: number;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (keys: string[]) => void;
  onDismiss: (id: string) => void;
  onNavigate?: (page: string) => void;
}

const typeConfig = {
  order:       { icon: ShoppingBag,   color: "#1e7fff",  bg: "rgba(30,127,255,0.1)" },
  kds:         { icon: ChefHat,       color: "#a855f7",  bg: "rgba(168,85,247,0.1)" },
  alert:       { icon: AlertTriangle, color: "#f59e0b",  bg: "rgba(245,158,11,0.1)" },
  stock:       { icon: Package,       color: "#ff3b5c",  bg: "rgba(255,59,92,0.1)" },
  reservation: { icon: CalendarCheck, color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
  system:      { icon: CheckCircle2,  color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
};

function relTime(iso?: string): string {
  if (!iso) return "recently";
  if (iso === "today") return "today";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationDropdown({
  open,
  onClose,
  items,
  unread,
  loading,
  error,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  onDismiss,
  onNavigate,
}: NotificationDropdownProps) {
  const handleClick = (note: ApiNotification) => {
    if (!note.read) onMarkRead([note.key]);
    if (note.page && onNavigate) {
      onNavigate(note.page);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
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
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
              <div className="flex items-center gap-2">
                <Bell size={15} style={{ color: "#1e7fff" }} />
                <span style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.92rem" }}>
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "#ff3b5c", color: "#fff", fontFamily: "var(--font-mono)" }}>
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onRefresh}
                  className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-[rgba(30,127,255,0.08)]"
                  style={{ color: "#6b82a0" }}>
                  Refresh
                </button>
                {unread > 0 && (
                  <button type="button" onClick={onMarkAllRead}
                    className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-[rgba(30,127,255,0.08)]"
                    style={{ color: "#1e7fff" }}>
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[rgba(30,127,255,0.08)] transition-all"
                  style={{ color: "#6b82a0" }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 text-xs" style={{ color: "#f87171", borderBottom: "1px solid rgba(255,59,92,0.15)" }}>
                {error}
              </div>
            )}

            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 380 }}>
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-[#1e7fff] rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Check size={28} style={{ color: "#22c55e" }} />
                  <p style={{ color: "#6b82a0", fontSize: "0.82rem" }}>All caught up!</p>
                </div>
              ) : (
                items.map(note => {
                  const cfg = typeConfig[note.type] ?? typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={note.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => handleClick(note)}
                      className="group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-[rgba(30,127,255,0.04)] border-b"
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
                        <p style={{ color: "#6b82a0", fontSize: "0.65rem", marginTop: 3 }}>{relTime(note.at)}</p>
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); onDismiss(note.id); }}
                        className="p-0.5 rounded-md hover:bg-[rgba(255,59,92,0.08)] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        style={{ color: "#6b82a0" }}>
                        <X size={12} />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
