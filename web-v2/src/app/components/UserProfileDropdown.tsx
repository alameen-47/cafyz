import { motion, AnimatePresence } from "motion/react";
import { User, Settings, Shield, LogOut, ChevronRight, Zap, Crown } from "lucide-react";
import { isFounderRole } from "../../config/access";

interface UserProfileDropdownProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  role: string;
  plan: string;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

const planColors: Record<string, string> = { basic: "var(--cafyz-muted)", pro: "#1e7fff", premium: "#a855f7" };
const roleColors: Record<string, string> = {
  owner: "#a855f7", manager: "#1e7fff", cashier: "#22d3ee",
  waiter: "#00c6ff", kitchen: "#f59e0b", founder: "#ff3b5c",
};

export function UserProfileDropdown({ open, onClose, onNavigate, onLogout, role, plan, userName = "User", userEmail = "", userInitials = "?" }: UserProfileDropdownProps) {
  const initials = (userInitials || userName.split(" ").map(n => n[0]).join("")).slice(0, 2).toUpperCase();
  const founderUser = isFounderRole(role);
  const menuItems = founderUser
    ? []
    : [
        { icon: User, label: "My Profile", action: () => onNavigate("profile") },
        { icon: Settings, label: "Restaurant Settings", action: () => onNavigate("profile") },
        { icon: Shield, label: "Roles & Permissions", action: () => onNavigate("roles") },
        { icon: Zap, label: "Upgrade Plan", action: () => onNavigate("license") },
      ];

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
            className="absolute top-full right-0 mt-2 w-64 rounded-2xl overflow-hidden z-50"
            style={{
              background: "var(--cafyz-surface)",
              border: "1px solid var(--cafyz-border-strong)",
              boxShadow: "var(--cafyz-shadow-lg)",
            }}>
            {/* User info */}
            <div className="px-4 py-4 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 12px rgba(30,127,255,0.35)" }}>
                  <span style={{ color: "var(--cafyz-text-strong)", fontWeight: 800, fontSize: "0.8rem" }}>{initials}</span>
                </div>
                <div>
                  <p style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: "0.88rem" }}>{userName}</p>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>{userEmail || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                      style={{ background: `${roleColors[role] || "#1e7fff"}15`, color: roleColors[role] || "#1e7fff" }}>
                      {founderUser ? "Super Admin" : role}
                    </span>
                    {!founderUser && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                        style={{ background: `${planColors[plan] || "#1e7fff"}15`, color: planColors[plan] || "#1e7fff" }}>
                        {plan}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items — restaurant users only */}
            {menuItems.length > 0 && (
              <div className="py-1">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button key={item.label}
                      onClick={() => { item.action(); onClose(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-[var(--cafyz-surface-hover)]">
                      <Icon size={15} style={{ color: "var(--cafyz-muted)", flexShrink: 0 }} />
                      <span style={{ color: "var(--cafyz-text-secondary)", flex: 1, textAlign: "left" }}>{item.label}</span>
                      <ChevronRight size={13} style={{ color: "var(--cafyz-muted)" }} />
                    </button>
                  );
                })}
              </div>
            )}

            {founderUser && (
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--cafyz-muted)" }}>
                  <Crown size={14} style={{ color: "#ff3b5c" }} />
                  Founder console — platform administration only
                </div>
              </div>
            )}

            {/* Divider + logout */}
            <div className={`${menuItems.length > 0 || founderUser ? "border-t" : ""} py-1`} style={{ borderColor: "var(--cafyz-border)" }}>
              <button onClick={() => { onLogout(); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-[rgba(255,59,92,0.06)]">
                <LogOut size={15} style={{ color: "#ff3b5c", flexShrink: 0 }} />
                <span style={{ color: "#ff3b5c" }}>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
