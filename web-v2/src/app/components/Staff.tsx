import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Plus, Phone, Mail, Clock, CheckCircle, XCircle, Coffee } from "lucide-react";
import { toast } from "./Toast";
import { usersApi, tablesApi, ordersApi, type ApiUser } from "../../services/api";
import { useAppNav } from "../nav";

type StaffStatus = "on-shift" | "on-break" | "off-duty";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: StaffStatus;
  shift: string;
  tablesAssigned: string[];
  ordersToday: number;
  phone: string;
  email: string;
  avatar: string;
}

const statusConfig: Record<StaffStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  "on-shift": { color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: CheckCircle, label: "On Shift" },
  "on-break": { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: Coffee, label: "On Break" },
  "off-duty": { color: "var(--cafyz-muted)", bg: "rgba(107,130,160,0.1)", icon: XCircle, label: "Off Duty" },
};

// Backend roles → display label + accent colour.
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", manager: "Manager", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen", founder: "Founder",
};
const roleColors: Record<string, string> = {
  Owner: "#1e7fff", Manager: "#a855f7", Cashier: "#22d3ee", Waiter: "#00c6ff", Kitchen: "#f59e0b", Founder: "#f97316",
};
const STATUS_MAP: Record<string, StaffStatus> = { active: "on-shift", break: "on-break", off: "off-duty" };

const avatarColors = [
  "linear-gradient(135deg, #1e7fff, #00c6ff)",
  "linear-gradient(135deg, #a855f7, #1e7fff)",
  "linear-gradient(135deg, #22d3ee, #1e7fff)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #00c6ff, #22d3ee)",
  "linear-gradient(135deg, #1e7fff, #a855f7)",
];

export function Staff() {
  const { goToPage } = useAppNav();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [filterRole, setFilterRole] = useState("All");

  const load = useCallback(async () => {
    try {
      const [users, tables, orders] = await Promise.all([
        usersApi.list(),
        tablesApi.list().catch(() => []),
        ordersApi.list().catch(() => []),
      ]);
      const tablesBySrv = new Map<string, string[]>();
      tables.forEach(t => {
        if (t.server_id) tablesBySrv.set(t.server_id, [...(tablesBySrv.get(t.server_id) ?? []), t.name]);
      });
      const today = new Date().toISOString().slice(0, 10);
      const ordersBySrv = new Map<string, number>();
      orders.forEach(o => {
        if (!o.server_id) return;
        const day = (o.created_at || "").slice(0, 10);
        if (day === today) ordersBySrv.set(o.server_id, (ordersBySrv.get(o.server_id) ?? 0) + 1);
      });
      setMembers(users.map((u: ApiUser) => {
        const role = ROLE_LABEL[u.role] ?? u.role;
        return {
          id: u.id,
          name: u.name,
          role,
          status: STATUS_MAP[u.status] ?? "off-duty",
          shift: u.start_time && u.start_time !== "—" ? u.start_time : "—",
          tablesAssigned: tablesBySrv.get(u.id) ?? [],
          ordersToday: ordersBySrv.get(u.id) ?? 0,
          phone: u.phone ?? "—",
          email: u.email,
          avatar: u.initials || (u.name || "?").slice(0, 2).toUpperCase(),
        };
      }));
    } catch (e) {
      toast.error("Couldn't load staff", (e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const handleAddStaff = () => {
    goToPage("roles");
    toast.info("Roles & Access", "Create staff accounts there — they appear here automatically");
  };

  const staff = members;
  const roles = ["All", ...Array.from(new Set(staff.map(s => s.role)))];
  const filtered = filterRole === "All" ? staff : staff.filter(s => s.role === filterRole);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(["on-shift", "on-break", "off-duty"] as StaffStatus[]).map(s => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className="rounded-2xl p-4" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} style={{ color: cfg.color }} />
                <span style={{ color: cfg.color, fontSize: "0.75rem", fontWeight: 600 }}>{cfg.label}</span>
              </div>
              <div style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>
                {staff.filter(m => m.status === s).length}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all flex-shrink-0 font-medium"
              style={filterRole === r
                ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }
                : { background: "var(--cafyz-surface)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }
              }
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={handleAddStaff}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }}
        >
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Staff grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((member, i) => {
          const cfg = statusConfig[member.status];
          const StatusIcon = cfg.icon;
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelected(member)}
              className="rounded-2xl p-4 cursor-pointer transition-all hover:border-[rgba(30,127,255,0.25)]"
              style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: avatarColors[i % avatarColors.length], boxShadow: "0 0 12px rgba(30,127,255,0.3)" }}
                >
                  <span style={{ color: "white", fontWeight: 700, fontSize: "0.85rem" }}>{member.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }} className="truncate">{member.name}</h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${roleColors[member.role] || "#1e7fff"}18`, color: roleColors[member.role] || "#1e7fff" }}
                  >
                    {member.role}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: cfg.bg }}>
                  <StatusIcon size={11} style={{ color: cfg.color }} />
                  <span style={{ color: cfg.color, fontSize: "0.65rem", fontWeight: 600 }}>{cfg.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg p-2 text-center" style={{ background: "rgba(30,127,255,0.06)" }}>
                  <div style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9rem" }}>{member.ordersToday}</div>
                  <div style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>Today</div>
                </div>
                <div className="rounded-lg p-2 text-center" style={{ background: "rgba(30,127,255,0.06)" }}>
                  <div className="flex items-center justify-center gap-1">
                    <StatusIcon size={10} style={{ color: cfg.color }} />
                    <span style={{ color: cfg.color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.75rem" }}>{cfg.label}</span>
                  </div>
                  <div style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>Status</div>
                </div>
                <div className="rounded-lg p-2 text-center" style={{ background: "rgba(30,127,255,0.06)" }}>
                  <div style={{ color: "var(--cafyz-text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9rem" }}>{member.tablesAssigned.length}</div>
                  <div style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>Tables</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>
                <Clock size={11} />
                <span>{member.shift}</span>
                {member.tablesAssigned.length > 0 && (
                  <span className="ml-auto" style={{ color: "#1e7fff" }}>{member.tablesAssigned.join(", ")}</span>
                )}
              </div>
            </motion.div>
          );
        })}
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
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: avatarColors[staff.indexOf(selected) % avatarColors.length], boxShadow: "0 0 16px rgba(30,127,255,0.3)" }}
              >
                <span style={{ color: "white", fontWeight: 700 }}>{selected.avatar}</span>
              </div>
              <div>
                <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{selected.name}</h3>
                <p style={{ color: "#1e7fff", fontSize: "0.8rem" }}>{selected.role}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm" style={{ color: "var(--cafyz-text-secondary)" }}>
              <div className="flex items-center gap-2"><Phone size={14} style={{ color: "var(--cafyz-muted)" }} />{selected.phone}</div>
              <div className="flex items-center gap-2"><Mail size={14} style={{ color: "var(--cafyz-muted)" }} />{selected.email}</div>
              <div className="flex items-center gap-2"><Clock size={14} style={{ color: "var(--cafyz-muted)" }} />Shift: {selected.shift}</div>
            </div>
            {selected.tablesAssigned.length > 0 && (
              <div>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", marginBottom: 8 }}>Assigned Tables</p>
                <div className="flex gap-2 flex-wrap">
                  {selected.tablesAssigned.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: "var(--cafyz-border)", color: "#1e7fff" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
