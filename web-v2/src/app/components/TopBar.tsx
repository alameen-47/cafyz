import { Bell, Search, ChevronDown, Menu, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { NotificationDropdown } from "./NotificationDropdown";
import { UserProfileDropdown } from "./UserProfileDropdown";

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

interface TopBarProps {
  active: string;
  onMobileMenuOpen: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  role: string;
  plan: string;
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

export function TopBar({ active, onMobileMenuOpen, onNavigate, onLogout, role, plan }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const time = useClock();
  const page = pageLabels[active] || pageLabels.dashboard;

  // Close dropdowns on outside click handled inside each component

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 border-b"
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
          {page.subtitle}
        </p>
      </div>

      {/* Live clock — desktop only */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
        style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        <Clock size={12} style={{ color: "#6b82a0" }} />
        <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 600 }}>{time}</span>
      </div>

      {/* Search — desktop only */}
      <div
        className="hidden md:flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 flex-shrink-0"
        style={{
          background: "#0d1326",
          border: `1px solid ${searchFocused ? "rgba(30,127,255,0.4)" : "rgba(30,127,255,0.1)"}`,
          width: 190,
          boxShadow: searchFocused ? "0 0 0 3px rgba(30,127,255,0.08)" : "none",
        }}>
        <Search size={13} style={{ color: "#6b82a0", flexShrink: 0 }} />
        <input type="text" placeholder="Search..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="bg-transparent border-none outline-none flex-1 placeholder:text-[#6b82a0]"
          style={{ color: "#e8eef8", fontSize: "0.82rem" }} />
      </div>

      {/* Notification bell */}
      <div ref={notifRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-[rgba(30,127,255,0.08)] active:scale-95"
          style={{ color: notifOpen ? "#1e7fff" : "#6b82a0" }}>
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "#ff3b5c", boxShadow: "0 0 6px rgba(255,59,92,0.7)" }} />
        </button>
        <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
      </div>

      {/* Avatar / profile */}
      <div ref={profileRef} className="relative flex-shrink-0">
        <button
          onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
          className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-all hover:bg-[rgba(30,127,255,0.06)] active:scale-95">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 10px rgba(30,127,255,0.35)" }}>
            <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 800 }}>AK</span>
          </div>
          <div className="hidden md:block text-left">
            <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>Alex Kumar</p>
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
        />
      </div>
    </header>
  );
}
