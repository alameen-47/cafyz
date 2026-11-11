import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, ShoppingBag, Grid3X3, UtensilsCrossed,
  Users, BarChart3, Package, Settings, Bell, ChevronLeft,
  ChevronRight, LogOut, Shield, X, ChefHat, CalendarClock,
  CreditCard, UserCog, QrCode, MonitorSpeaker, Crown, Zap, Sun, Moon
} from "lucide-react";

import type { Plan, Role } from "../auth";
import type { PageId } from "../../config/access";
import { isFounderRole, planMeetsRequirement, requiredPlanForPage, canManagePlan } from "../../config/access";
import { usePlanConfig } from "../PlanConfigProvider";
import { useThemeMode } from "../ThemeProvider";
import { CAFYZ_MARK_SRC } from "../../config/brand";

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

const planConfig: Record<Plan, { label: string; icon: React.ElementType }> = {
  basic: { label: "Basic", icon: Shield },
  pro: { label: "Pro", icon: Zap },
  premium: { label: "Premium", icon: Crown },
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
  /** Shown under the app name at the top of the sidebar. */
  restaurantName?: string;
}

export function Sidebar({
  active, onNavigate, collapsed, onToggle, mobileOpen, onMobileClose,
  role = "owner", plan = "pro", permittedPages = [], onUpgrade, onLogout,
  restaurantName,
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { theme, toggleTheme } = useThemeMode();
  usePlanConfig(); // re-render when founder updates plan gates/prices
  const allowedPages = permittedPages;

  const handleNav = (id: string) => {
    onNavigate(id);
    onMobileClose();
  };

  const PlanIcon = planConfig[plan].icon;
  const founderUser = isFounderRole(role);
  const groups = founderUser ? ["founder"] : ["main", "kitchen", "manage", "settings"];
  const groupLabels: Record<string, string> = {
    main: "Operations", kitchen: "Kitchen & Bookings", manage: "Management", settings: "Settings", founder: "Super Admin"
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="cafyz-drawer-overlay fixed inset-0 z-40 md:hidden"
            onClick={onMobileClose} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 276 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        data-collapsed={collapsed ? "true" : "false"}
        className={`cafyz-sidebar-shell cafyz-sidebar fixed left-0 top-0 h-full z-50 flex flex-col border-r md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} transition-transform duration-300 md:transition-none`}
      >
        {/* Identity: the logo as an app icon, the name beside it, the restaurant beneath */}
        <div className={`cafyz-brand-head flex-shrink-0 ${collapsed ? "is-collapsed" : ""}`}>
          <span className="cafyz-app-icon">
            <img src={CAFYZ_MARK_SRC} alt="Cafyz" draggable={false} />
          </span>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="cafyz-brand-name" translate="no">Cafyz</p>
              <p className="cafyz-brand-sub truncate">{founderUser ? "Super Admin" : (restaurantName || "Restaurant Management")}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="cafyz-brand-head-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 pt-3 pb-2 overflow-y-auto scrollbar-hide">
          {groups.map((group, groupIndex) => {
            const groupItems = navItems.filter(n => n.group === group && allowedPages.includes(n.id));
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                {collapsed ? (
                  groupIndex > 0 && <div className="cafyz-sidebar-rule mx-5 mb-3" aria-hidden />
                ) : (
                  <div className="px-5 pb-1.5 pt-1">
                    <span className="cafyz-sidebar-group-label">{groupLabels[group]}</span>
                  </div>
                )}
                <div className="px-3 space-y-1">
                  {groupItems.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    const reqPlan = requiredPlanForPage(item.id as PageId);
                    const isLocked = reqPlan && !planMeetsRequirement(plan, reqPlan);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          if (isLocked && reqPlan) onUpgrade?.(reqPlan, item.id as PageId);
                          else handleNav(item.id);
                        }}
                        className={`cafyz-nav-item group ${isActive ? "is-active" : ""} ${isLocked && !isActive ? "is-locked" : ""} ${collapsed ? "justify-center px-0" : "px-2"}`}
                      >
                        {isActive && (
                          <motion.span layoutId="activeIndicator" aria-hidden
                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            className="cafyz-nav-accent" />
                        )}
                        <span className="cafyz-nav-icon">
                          <Icon size={17} strokeWidth={1.75} />
                        </span>
                        {!collapsed && (
                          <span className="cafyz-nav-label flex-1 text-start truncate">{item.label}</span>
                        )}
                        {!collapsed && isLocked && (
                          <span className="cafyz-nav-lock flex-shrink-0">{reqPlan}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer: plan card, profile, theme and sign-out */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2 space-y-2.5">
          {!founderUser && canManagePlan(role) && allowedPages.includes("license") && (
            <button
              type="button"
              onClick={() => handleNav("license")}
              title={collapsed ? `${planConfig[plan].label} Plan` : undefined}
              className={`cafyz-plan-card w-full ${collapsed ? "justify-center p-2" : "px-3 py-2.5"}`}
            >
              <span className="cafyz-plan-icon"><PlanIcon size={16} strokeWidth={1.75} /></span>
              {!collapsed && (
                <>
                  <span className="flex-1 min-w-0 text-start">
                    <span className="cafyz-plan-title block truncate">{planConfig[plan].label} Plan</span>
                    <span className="cafyz-plan-sub block truncate">Manage subscription</span>
                  </span>
                  <ChevronRight size={15} className="cafyz-plan-arrow flex-shrink-0 rtl:rotate-180" />
                </>
              )}
            </button>
          )}
          {founderUser && (
            <div
              title={collapsed ? "Super Admin" : undefined}
              className={`cafyz-plan-card w-full ${collapsed ? "justify-center p-2" : "px-3 py-2.5"}`}
            >
              <span className="cafyz-plan-icon"><Crown size={16} strokeWidth={1.75} /></span>
              {!collapsed && <span className="cafyz-plan-title flex-1 text-start truncate">Super Admin</span>}
            </div>
          )}

          <div className="cafyz-sidebar-rule" aria-hidden />

          {/* Theme + Logout */}
          <div className={`flex ${collapsed ? "flex-col gap-1" : "flex-row items-center"}`}>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="cafyz-sidebar-action flex-1"
            >
              {theme === "dark" ? <Sun size={16} strokeWidth={1.75} className="flex-shrink-0" /> : <Moon size={16} strokeWidth={1.75} className="flex-shrink-0" />}
              {!collapsed && <span className="truncate">{theme === "dark" ? "Light" : "Dark"}</span>}
            </button>
            {!collapsed && <span className="cafyz-sidebar-vrule" aria-hidden />}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
              className="cafyz-sidebar-action is-danger flex-1"
            >
              <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0 rtl:rotate-180" />
              {!collapsed && <span className="truncate">Logout</span>}
            </button>
          </div>
        </div>

        {/* Collapse toggle (desktop) */}
        <button onClick={onToggle} type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="cafyz-sidebar-collapse-btn hidden md:flex absolute -right-3 top-[1.9rem] w-6 h-6 rounded-lg items-center justify-center z-10">
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </motion.aside>

      {/* Logout confirm modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}>
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-xs rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(255,65,108,0.2)" }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,65,108,0.1)" }}>
                  <LogOut size={22} style={{ color: "#ff416c" }} />
                </div>
                <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>Sign Out?</h3>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.82rem" }}>You'll be redirected to the login screen.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--cafyz-accent-soft)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => { setShowLogoutConfirm(false); onLogout?.(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,65,108,0.1)", color: "#ff416c", border: "1px solid rgba(255,65,108,0.2)" }}>
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
