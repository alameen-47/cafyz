import { Bell, Search, ChevronDown, Menu, Clock, X, UtensilsCrossed, LayoutGrid, ShoppingBag, Users, Package, CalendarCheck } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NotificationDropdown } from "./NotificationDropdown";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { searchApi, type ApiSearchResult } from "../../services/api";

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
  license:      { title: "License & Plan",     subtitle: "Subscription & upgrades" },
  founder:      { title: "Founder Console",    subtitle: "Super admin · All tenants" },
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
  menu:        "#1e7fff",
  table:       "#00c6ff",
  order:       "#a855f7",
  staff:       "#22c55e",
  inventory:   "#f59e0b",
  reservation: "#22d3ee",
};

const metaBadge: Record<string, { color: string; bg: string }> = {
  open:       { color: "#1e7fff",  bg: "rgba(30,127,255,0.1)" },
  sent:       { color: "#a855f7",  bg: "rgba(168,85,247,0.1)" },
  paid:       { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
  voided:     { color: "#6b82a0",  bg: "rgba(107,130,160,0.1)" },
  comped:     { color: "#22d3ee",  bg: "rgba(34,211,238,0.1)" },
  active:     { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
  break:      { color: "#f59e0b",  bg: "rgba(245,158,11,0.1)" },
  off:        { color: "#6b82a0",  bg: "rgba(107,130,160,0.1)" },
  occupied:   { color: "#f59e0b",  bg: "rgba(245,158,11,0.1)" },
  empty:      { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
  low:        { color: "#ff3b5c",  bg: "rgba(255,59,92,0.1)" },
  ok:         { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
  confirmed:  { color: "#1e7fff",  bg: "rgba(30,127,255,0.1)" },
  seated:     { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
  cancelled:  { color: "#ff3b5c",  bg: "rgba(255,59,92,0.1)" },
  available:  { color: "#22c55e",  bg: "rgba(34,197,94,0.1)" },
};

function getBadge(meta: string) {
  return metaBadge[meta] ?? { color: "#a8bdd4", bg: "rgba(168,189,212,0.08)" };
}

interface TopBarProps {
  active: string;
  onMobileMenuOpen: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  role: string;
  plan: string;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

function useClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(() => setTime(
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    ), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function TopBar({ active, onMobileMenuOpen, onNavigate, onLogout, role, plan, userName = "there", userEmail = "", userInitials = "?" }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const time = useClock();
  const initials = (userInitials || userName.split(" ").map(n => n[0]).join("")).slice(0, 2).toUpperCase();
  const debouncedQuery = useDebounce(searchQuery, 280);

  const page = pageLabels[active] || pageLabels.dashboard;
  const showDropdown = searchFocused && (searchQuery.length >= 2 || searchResults.length > 0);

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
      className="app-top-bar sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 border-b"
      style={{
        background: "rgba(6,9,26,0.92)",
        backdropFilter: "blur(20px)",
        borderColor: "rgba(30,127,255,0.1)",
        minHeight: 56,
      }}>

      {/* Mobile hamburger */}
      <button onClick={onMobileMenuOpen}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all active:scale-95"
        style={{ background: "rgba(30,127,255,0.06)", color: "#6b82a0" }}>
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="truncate" style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.98rem", lineHeight: 1.25 }}>
          {page.title}
        </h1>
        <p className="truncate hidden sm:block" style={{ color: "#6b82a0", fontSize: "0.67rem" }}>
          {active === "dashboard" ? `Welcome back, ${userName.split(" ")[0]}` : page.subtitle}
        </p>
      </div>

      {/* Live clock — desktop only */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
        style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <Clock size={12} style={{ color: "#6b82a0" }} />
        <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 600 }}>{time}</span>
      </div>

      {/* Global search — desktop only */}
      <div ref={searchRef} className="hidden md:block relative flex-shrink-0" style={{ width: 220 }}>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200"
          style={{
            background: "#0d1326",
            border: `1px solid ${searchFocused ? "rgba(30,127,255,0.4)" : "rgba(30,127,255,0.1)"}`,
            boxShadow: searchFocused ? "0 0 0 3px rgba(30,127,255,0.08)" : "none",
          }}>
          {searchLoading
            ? <div className="w-3 h-3 border border-white/20 border-t-[#1e7fff] rounded-full animate-spin flex-shrink-0" />
            : <Search size={13} style={{ color: "#6b82a0", flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={e => e.key === "Escape" && clearSearch()}
            className="bg-transparent border-none outline-none flex-1 placeholder:text-[#6b82a0]"
            style={{ color: "#e8eef8", fontSize: "0.82rem" }}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="flex-shrink-0" style={{ color: "#6b82a0" }}>
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
                background: "#0d1326",
                border: "1px solid rgba(30,127,255,0.18)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
                minWidth: 300,
              }}>
              {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading ? (
                <div className="py-8 text-center">
                  <p style={{ color: "#6b82a0", fontSize: "0.8rem" }}>No results for <span style={{ color: "#e8eef8" }}>"{searchQuery}"</span></p>
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-[rgba(30,127,255,0.06)]"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}18` }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: "#e8eef8", fontSize: "0.8rem", fontWeight: 500 }}>
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="truncate" style={{ color: "#6b82a0", fontSize: "0.7rem" }}>
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
                  style={{ borderColor: "rgba(30,127,255,0.08)" }}>
                  <span style={{ color: "#6b82a0", fontSize: "0.65rem" }}>
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </span>
                  <span style={{ color: "#6b82a0", fontSize: "0.62rem" }}>↵ to navigate · Esc to clear</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification bell */}
      <div ref={notifRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-[rgba(30,127,255,0.08)] active:scale-95"
          style={{ color: notifOpen ? "#1e7fff" : "#6b82a0" }}>
          <Bell size={17} />
          {unreadNotifs > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "#ff3b5c", boxShadow: "0 0 6px rgba(255,59,92,0.7)" }} />
          )}
        </button>
        <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} onUnreadChange={setUnreadNotifs} />
      </div>

      {/* Avatar / profile */}
      <div ref={profileRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
          className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-all hover:bg-[rgba(30,127,255,0.06)] active:scale-95">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 10px rgba(30,127,255,0.35)" }}>
            <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 800 }}>{initials}</span>
          </div>
          <div className="hidden md:block text-left">
            <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>{userName}</p>
            <p style={{ color: "#6b82a0", fontSize: "0.62rem", textTransform: "capitalize" }}>{role}</p>
          </div>
          <ChevronDown size={13} className="hidden md:block" style={{ color: "#6b82a0", transform: profileOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </button>
        <UserProfileDropdown
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onNavigate={(p) => { onNavigate(p); setProfileOpen(false); }}
          onLogout={onLogout}
          role={role}
          plan={plan}
          userName={userName}
          userEmail={userEmail}
          userInitials={initials}
        />
      </div>
    </header>
  );
}
