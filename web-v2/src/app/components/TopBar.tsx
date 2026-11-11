import { motion, AnimatePresence } from "motion/react";
import { Bell, Search, Menu, UserRound, Clock, X, UtensilsCrossed, LayoutGrid, ShoppingBag, Users, Package, CalendarCheck, Headset } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { NotificationDropdown } from "./NotificationDropdown";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { PrinterSetupPanel } from "./PrinterSetupPanel";
import { searchApi, restaurantApi, type ApiSearchResult, type ApiRestaurant } from "../../services/api";
import { getRestaurantLogo } from "../../services/restaurantLogoStorage";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useLanguage } from "../../i18n/LanguageProvider";
import { isFounderRole } from "../../config/access";
import { IN_STORE_APP } from "../../config/features";
import { CAFYZ_MARK_SRC } from "../../config/brand";
import type { PageId } from "../../config/access";
import { useNotifications } from "../../hooks/useNotifications";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { nameInitials } from "../../utils/initials";
import { withAlpha } from "../../utils/color";

const pageLabels: Record<string, { title: string; subtitle: string }> = {
  dashboard:    { title: "Dashboard",          subtitle: "Welcome back, Alex" },
  pos:          { title: "Point of Sale",      subtitle: "Take orders & process payments" },
  orders:       { title: "Live Orders",        subtitle: "Real-time order tracking" },
  tables:       { title: "Table Map",          subtitle: "Floor plan & table status" },
  menu:         { title: "Menu Management",    subtitle: "Items, categories & pricing" },
  kds:          { title: "Kitchen Display",    subtitle: "New · In-Prep · Ready · Pass" },
  reservations: { title: "Reservations",       subtitle: "Guest bookings & seating" },
  staff:        { title: "Staff",              subtitle: "Team schedules & roles" },
  analytics:    { title: "Analytics",          subtitle: "Revenue & performance insights" },
  inventory:    { title: "Inventory",          subtitle: "Stock levels & suppliers" },
  roles:        { title: "Roles & Access",     subtitle: "Users, permissions & PINs" },
  profile:      { title: "Restaurant Profile", subtitle: "Brand, contact & tax settings" },
  license:      { title: "License & Plan",     subtitle: IN_STORE_APP ? "Your license key" : "Subscription & upgrades" },
  founder:      { title: "Founder Console",    subtitle: "Super admin · All tenants" },
  account:      { title: "Account",            subtitle: "Profile, security & appearance" },
};

const typeIcon: Record<ApiSearchResult["type"], React.ElementType> = {
  menu:        UtensilsCrossed,
  table:       LayoutGrid,
  order:       ShoppingBag,
  staff:       Users,
  inventory:   Package,
  reservation: CalendarCheck,
};

const typeColor: Record<ApiSearchResult["type"], string> = {
  menu:        "var(--cafyz-brand)",
  table:       "var(--cafyz-brand-2)",
  order:       "var(--cafyz-brand)",
  staff:       "#00d68f",
  inventory:   "#ffaa00",
  reservation: "#00d4ff",
};

const metaBadge: Record<string, { color: string; bg: string }> = {
  open:       { color: "var(--cafyz-brand)",  bg: "var(--cafyz-badge-bg)" },
  sent:       { color: "var(--cafyz-brand)",  bg: "rgba(var(--cafyz-brand-rgb),0.1)" },
  paid:       { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
  voided:     { color: "var(--cafyz-muted)",  bg: "rgba(166,160,199,0.1)" },
  comped:     { color: "#00d4ff",  bg: "rgba(0,212,255,0.1)" },
  active:     { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
  break:      { color: "#ffaa00",  bg: "rgba(255,170,0,0.1)" },
  off:        { color: "var(--cafyz-muted)",  bg: "rgba(166,160,199,0.1)" },
  occupied:   { color: "#ffaa00",  bg: "rgba(255,170,0,0.1)" },
  empty:      { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
  low:        { color: "#ff416c",  bg: "rgba(255,65,108,0.1)" },
  ok:         { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
  confirmed:  { color: "var(--cafyz-brand)",  bg: "var(--cafyz-badge-bg)" },
  seated:     { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
  cancelled:  { color: "#ff416c",  bg: "rgba(255,65,108,0.1)" },
  available:  { color: "#00d68f",  bg: "rgba(0,214,143,0.1)" },
};

function getBadge(meta: string) {
  return metaBadge[meta] ?? { color: "var(--cafyz-text-secondary)", bg: "rgba(207,201,234,0.08)" };
}

interface TopBarProps {
  active: string;
  onMobileMenuOpen: () => void;
  /** Opens the Account screen. */
  onOpenAccount: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  role: string;
  plan: string;
  permittedPages?: PageId[];
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

const formatClock = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Ticks on its own, so the rest of the top bar doesn't re-render every second. */
function LiveClock() {
  const [time, setTime] = useState(formatClock);
  useEffect(() => {
    const id = setInterval(() => setTime(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    // translate="no": digits need no translation, and without this the tick
    // queues a translation pass every second for the life of the session.
    <span translate="no" style={{ color: "var(--cafyz-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 600 }}>{time}</span>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function TopBar({ active, onMobileMenuOpen, onOpenAccount, onNavigate, onLogout, role, plan, permittedPages = [], userName = "there", userEmail = "", userInitials = "?" }: TopBarProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationsEnabled = role !== "founder";
  const founderUser = isFounderRole(role);
  const {
    items: notifItems,
    unread: unreadNotifs,
    loading: notifLoading,
    error: notifError,
    refresh: refreshNotifs,
    markRead,
    markAllRead,
    dismissLocal,
  } = useNotifications(notificationsEnabled);
  usePushNotifications(notificationsEnabled);
  const initials = userInitials || nameInitials(userName);
  const debouncedQuery = useDebounce(searchQuery, 280);

  const page = useMemo(() => {
    const base = pageLabels[active] || pageLabels.dashboard;
    return {
      title: t(base.title),
      subtitle: t(base.subtitle),
    };
  }, [active, t]);
  const showDropdown = searchFocused && (searchQuery.length >= 2 || searchResults.length > 0);

  const openPrinterSetup = useCallback(() => {
    setProfileOpen(false);
    setNotifOpen(false);
    setPrinterOpen(true);
    if (!restaurant) void restaurantApi.me().then(setRestaurant).catch(() => {});
  }, [restaurant]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let alive = true;
    setSearchLoading(true);
    searchApi.search(debouncedQuery)
      .then(r => { if (alive) setSearchResults(r.results); })
      .catch(() => { if (alive) setSearchResults([]); })
      .finally(() => { if (alive) setSearchLoading(false); });
    return () => { alive = false; };
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    inputRef.current?.blur();
  }, []);

  const handleResultClick = useCallback((result: ApiSearchResult) => {
    onNavigate(result.page);
    clearSearch();
  }, [onNavigate, clearSearch]);
  const openSupport = useCallback(() => {
    window.dispatchEvent(new CustomEvent("cafyz:open-support"));
  }, []);

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="app-top-bar cafyz-topbar sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6"
      style={{ background: "var(--cafyz-topbar-bg)", backdropFilter: "blur(20px)" }}>

      {/* Phones and tablets: the brand tile opens the menu drawer */}
      <button onClick={onMobileMenuOpen} type="button" aria-label="Open menu"
        className="cafyz-brand-tile md:hidden flex-shrink-0">
        <img src={CAFYZ_MARK_SRC} alt="" draggable={false} />
        <span className="cafyz-brand-tile-menu" aria-hidden><Menu size={10} strokeWidth={2.5} /></span>
      </button>

      {/* Phones: app name over the current page. Desktop: page title over its subtitle. */}
      <div className="flex-1 min-w-0">
        <p className="md:hidden truncate" translate="no" style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.02rem", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
          Cafyz
        </p>
        <h1 className="truncate cafyz-topbar-title">
          {page.title}
        </h1>
        <p className="truncate hidden md:block" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>
          {active === "dashboard" ? `${t("Welcome back,")} ${(userName ?? "").trim().split(/\s+/)[0] || "there"}` : page.subtitle}
        </p>
      </div>

      {/* Live clock — desktop only */}
      <div className="hidden md:flex items-center gap-1.5 px-3.5 rounded-full flex-shrink-0"
        style={{ background: "var(--cafyz-glass)", border: "1px solid var(--cafyz-border)", minHeight: 40 }}>
        <Clock size={12} style={{ color: "var(--cafyz-muted)" }} />
        <LiveClock />
      </div>

      {/* Global search — desktop only (restaurant users) */}
      {!founderUser && (
      <div ref={searchRef} className="hidden md:block relative flex-shrink-0 w-[140px] lg:w-[200px] xl:w-[220px]">
        <div
          className="flex items-center gap-2 rounded-full px-3.5 transition-all duration-200"
          style={{
            minHeight: 40,
            background: "var(--cafyz-glass)",
            border: `1px solid ${searchFocused ? "rgba(var(--cafyz-brand-rgb),0.4)" : "var(--cafyz-border)"}`,
            boxShadow: searchFocused ? "0 0 0 3px rgba(var(--cafyz-brand-rgb),0.08)" : "none",
          }}>
          {searchLoading
            ? <div className="w-3 h-3 border border-white/20 border-t-[var(--cafyz-brand)] rounded-full animate-spin flex-shrink-0" />
            : <Search size={13} style={{ color: "var(--cafyz-muted)", flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            type="text"
            placeholder={t("Search…")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={e => e.key === "Escape" && clearSearch()}
            className="bg-transparent border-none outline-none flex-1 placeholder:text-[var(--cafyz-muted)]"
            style={{ color: "var(--cafyz-text)", fontSize: "0.82rem" }}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="flex-shrink-0" style={{ color: "var(--cafyz-muted)" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
              style={{
                background: "var(--cafyz-surface)",
                border: "1px solid var(--cafyz-border-strong)",
                boxShadow: "var(--cafyz-shadow-lg)",
                minWidth: 300,
              }}>
              {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading ? (
                <div className="py-8 text-center">
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>No results for <span style={{ color: "var(--cafyz-text)" }}>"{searchQuery}"</span></p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="py-1.5 overflow-y-auto" style={{ maxHeight: 380 }}>
                  {searchResults.map(result => {
                    const Icon = typeIcon[result.type];
                    const color = typeColor[result.type];
                    const badge = getBadge(result.meta);
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onMouseDown={e => { e.preventDefault(); handleResultClick(result); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-start transition-all hover:bg-[var(--cafyz-surface-hover)]"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${withAlpha(color, 0x18)}` }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: "var(--cafyz-text)", fontSize: "0.8rem", fontWeight: 500 }}>
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem" }}>
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[0.62rem] font-semibold capitalize flex-shrink-0"
                          style={{ background: badge.bg, color: badge.color }}>
                          {result.meta.replace(/_/g, " ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {searchResults.length > 0 && (
                <div className="px-4 py-2 border-t flex items-center justify-between"
                  style={{ borderColor: "rgba(var(--cafyz-brand-rgb),0.08)" }}>
                  <span style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </span>
                  <span style={{ color: "var(--cafyz-muted)", fontSize: "0.62rem" }}>↵ to navigate · Esc to clear</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Language — compact on mobile, full label on desktop */}
      <LanguageSwitcher variant="icon" className="flex-shrink-0 sm:hidden" />
      <LanguageSwitcher variant="header" className="flex-shrink-0 hidden sm:block" />

      {/* Customer support */}
      <button
        onClick={openSupport}
        className="cafyz-topbar-btn flex-shrink-0"
        title="Customer support"
        aria-label="Open customer support"
      >
        <Headset size={17} />
      </button>

      {/* Notification bell — restaurant users only */}
      {notificationsEnabled && (
      <div ref={notifRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
          aria-label="Notifications"
          className={`cafyz-topbar-btn ${notifOpen ? "is-open" : ""}`}>
          <Bell size={18} />
          {unreadNotifs > 0 && <span className="cafyz-topbar-dot" aria-hidden />}
        </button>
        <NotificationDropdown
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          items={notifItems}
          unread={unreadNotifs}
          loading={notifLoading}
          error={notifError}
          onRefresh={() => void refreshNotifs()}
          onMarkAllRead={() => void markAllRead()}
          onMarkRead={keys => void markRead(keys)}
          onDismiss={dismissLocal}
          onNavigate={onNavigate}
        />
      </div>
      )}

      {/* Avatar / profile */}
      <div ref={profileRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
          aria-label="Account menu"
          className="flex items-center gap-1.5 md:gap-2 rounded-full ps-0.5 pe-0.5 md:pe-3 py-0.5 transition-all hover:bg-[var(--cafyz-surface-hover)] active:scale-95">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--cafyz-gradient)", boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 0 16px rgba(var(--cafyz-brand-rgb),0.4)" }}>
            <UserRound size={20} strokeWidth={2} color="#ffffff" aria-hidden />
          </div>
          <div className="hidden md:block text-start">
            <p style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>{userName}</p>
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.62rem", textTransform: "capitalize" }}>{founderUser ? "Super Admin" : role}</p>
          </div>
        </button>
        <UserProfileDropdown
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onNavigate={(p) => { onNavigate(p); setProfileOpen(false); }}
          onOpenAccountSettings={() => { onOpenAccount(); setProfileOpen(false); }}
          onOpenPrinter={founderUser ? undefined : openPrinterSetup}
          onLogout={onLogout}
          role={role}
          permittedPages={permittedPages}
          userName={userName}
          userEmail={userEmail}
          userInitials={initials}
        />
      </div>
      {printerOpen && (
        restaurant ? (
          <PrinterSetupPanel
            modal
            onClose={() => setPrinterOpen(false)}
            kitchen={restaurant.kitchen_printer?.name}
            cashier={restaurant.cashier_printer?.name}
            kitchenPrinter={restaurant.kitchen_printer ?? null}
            cashierPrinter={restaurant.cashier_printer ?? null}
            restaurantName={restaurant.name}
            restaurantId={restaurant.id}
            logoUrl={getRestaurantLogo(restaurant.id, restaurant.logo_url)}
            onRestaurantUpdate={setRestaurant}
          />
        ) : (
          <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: "var(--cafyz-overlay)" }}>
            <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--cafyz-brand)] rounded-full animate-spin" />
          </div>
        )
      )}
    </header>
  );
}
