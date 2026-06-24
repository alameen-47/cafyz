import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, ShoppingBag, Grid3X3, UtensilsCrossed,
  Users, BarChart3, Package, Settings, Bell, ChevronLeft,
  ChevronRight, LogOut, Shield, X, ChefHat, CalendarClock,
  CreditCard, UserCog, QrCode, MonitorSpeaker, Crown, Zap
} from "lucide-react";

import type { Plan, Role } from "../auth";
import type { PageId } from "../../config/access";
import { planMeetsRequirement, requiredPlanForPage } from "../../config/access";
import { usePlanConfig } from "../PlanConfigProvider";
import { CafyzLogo } from "./CafyzLogo";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { id: "pos", label: "Point of Sale", icon: MonitorSpeaker, group: "main" },
  { id: "orders", label: "Live Orders", icon: ShoppingBag, group: "main" },
  { id: "tables", label: "Table Map", icon: Grid3X3, group: "main" },
  { id: "menu", label: "Menu", icon: UtensilsCrossed, group: "main" },
  { id: "kds", label: "Kitchen Display", icon: ChefHat, group: "kitchen" },
  { id: "reservations", label: "Reservations", icon: CalendarClock, group: "kitchen" },
  { id: "staff", label: "Staff", icon: Users, group: "manage" },
  { id: "analytics", label: "Analytics", icon: BarChart3, group: "manage" },
  { id: "inventory", label: "Inventory", icon: Package, group: "manage" },
  { id: "roles", label: "Roles & Access", icon: UserCog, group: "settings" },
  { id: "profile", label: "Restaurant", icon: Settings, group: "settings" },
  { id: "license", label: "License", icon: CreditCard, group: "settings" },
  { id: "founder", label: "Founder Console", icon: Crown, group: "founder" },
];

const planConfig: Record<Plan, { label: string; color: string; icon: React.ElementType }> = {
  basic: { label: "Basic", color: "#6b82a0", icon: Shield },
  pro: { label: "Pro", color: "#1e7fff", icon: Zap },
  premium: { label: "Premium", color: "#a855f7", icon: Crown },
};

const roleColors: Record<Role, string> = {
  owner: "#a855f7", manager: "#1e7fff", cashier: "#22d3ee",
  waiter: "#00c6ff", kitchen: "#f59e0b", founder: "#ff3b5c",
};

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  role?: Role;
  plan?: Plan;
  permittedPages?: PageId[];
  onUpgrade?: (requiredPlan: Plan, page: PageId) => void;
  onLogout?: () => void;
  userName?: string;
  userInitials?: string;
}

export function Sidebar({
  active, onNavigate, collapsed, onToggle, mobileOpen, onMobileClose,
  role = "owner", plan = "pro", permittedPages = [], onUpgrade, onLogout,
  userName = "User", userInitials = "U",
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  usePlanConfig(); // re-render when founder updates plan gates/prices
  const allowedPages = permittedPages;

  const handleNav = (id: string) => {
    onNavigate(id);
    onMobileClose();
  };

  const PlanIcon = planConfig[plan].icon;
  const groups = ["main", "kitchen", "manage", "settings", "founder"];
  const groupLabels: Record<string, string> = {
    main: "Operations", kitchen: "Kitchen & Bookings", manage: "Management", settings: "Settings", founder: "Super Admin"
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 268 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-full z-50 flex flex-col border-r border-[rgba(30,127,255,0.12)] lg:relative lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} transition-transform duration-300 lg:transition-none`}
        style={{ background: "linear-gradient(180deg, #080c1e 0%, #06091a 100%)", boxShadow: "4px 0 24px rgba(30,127,255,0.06)" }}
      >
        {/* Logo — full wordmark when expanded, compact mark when collapsed */}
        <div
          className={`flex items-center border-b border-[rgba(30,127,255,0.12)] flex-shrink-0 ${
            collapsed
              ? "justify-center px-3 py-4"
              : "justify-center px-4 py-5 lg:px-5 lg:py-6"
          }`}
        >
          <CafyzLogo
            size={collapsed ? "xs" : "sidebar"}
            className="flex-shrink-0 drop-shadow-[0_4px_16px_rgba(30,127,255,0.22)]"
          />
          <button
            onClick={onMobileClose}
            className={`text-[#6b82a0] hover:text-white lg:hidden flex-shrink-0 ${
              collapsed ? "absolute right-3 top-4" : "absolute right-4 top-5"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-hide">
          {groups.map(group => {
            const groupItems = navItems.filter(n => n.group === group && allowedPages.includes(n.id));
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-2">
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="px-4 py-1.5">
                      <span style={{ color: "#6b82a0", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                        {groupLabels[group]}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="px-2 space-y-0.5">
                  {groupItems.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    const reqPlan = requiredPlanForPage(item.id as PageId);
                    const isLocked = reqPlan && !planMeetsRequirement(plan, reqPlan);

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (isLocked && reqPlan) onUpgrade?.(reqPlan, item.id as PageId);
                          else handleNav(item.id);
                        }}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 relative group"
                        style={isActive
                          ? { background: "linear-gradient(135deg, rgba(30,127,255,0.18) 0%, rgba(0,198,255,0.06) 100%)", boxShadow: "inset 0 0 0 1px rgba(30,127,255,0.22)" }
                          : isLocked
                            ? { opacity: 0.4, cursor: "not-allowed" }
                            : { color: "#6b82a0" }
                        }
                      >
                        {isActive && (
                          <motion.div layoutId="activeIndicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                            style={{ background: "linear-gradient(180deg, #1e7fff, #00c6ff)" }} />
                        )}
                        <Icon size={17} className={`flex-shrink-0 ${isActive ? "text-[#1e7fff]" : isLocked ? "text-[#6b82a0]" : "text-[#6b82a0] group-hover:text-white"}`} />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="flex-1 text-left truncate text-sm font-medium"
                              style={{ fontFamily: "var(--font-display)", color: isActive ? "#e8eef8" : "#6b82a0" }}>
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {!collapsed && isLocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", fontSize: "0.6rem" }}>
                            {reqPlan}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom: plan badge + user + logout */}
        <div className="flex-shrink-0 border-t border-[rgba(30,127,255,0.1)] p-3 space-y-2">
          {/* Plan badge */}
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => handleNav("license")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:opacity-90"
                style={{ background: `${planConfig[plan].color}12`, border: `1px solid ${planConfig[plan].color}25` }}
              >
                <PlanIcon size={14} style={{ color: planConfig[plan].color }} />
                <span style={{ color: planConfig[plan].color, fontSize: "0.75rem", fontWeight: 700 }}>
                  {planConfig[plan].label} Plan
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* User block */}
          <div className="flex items-center gap-2 px-1 py-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${roleColors[role]}20`, boxShadow: `0 0 10px ${roleColors[role]}25` }}>
              <span style={{ color: roleColors[role], fontWeight: 700, fontSize: "0.7rem" }}>{userInitials}</span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 600 }} className="truncate">{userName}</p>
                  <p style={{ color: roleColors[role], fontSize: "0.65rem", textTransform: "capitalize" }}>{role}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[#6b82a0] hover:text-[#ff3b5c] hover:bg-[rgba(255,59,92,0.06)] transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium">Logout</motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button onClick={onToggle}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center text-[#6b82a0] hover:text-white transition-colors z-10"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.aside>

      {/* Logout confirm modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(6,9,26,0.85)", backdropFilter: "blur(8px)" }}>
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-xs rounded-2xl p-5 space-y-4"
              style={{ background: "#0d1326", border: "1px solid rgba(255,59,92,0.2)" }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,59,92,0.1)" }}>
                  <LogOut size={22} style={{ color: "#ff3b5c" }} />
                </div>
                <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700 }}>Sign Out?</h3>
                <p style={{ color: "#6b82a0", fontSize: "0.82rem" }}>You'll be redirected to the login screen.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
                  Cancel
                </button>
                <button onClick={() => { setShowLogoutConfirm(false); onLogout?.(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,59,92,0.1)", color: "#ff3b5c", border: "1px solid rgba(255,59,92,0.2)" }}>
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
