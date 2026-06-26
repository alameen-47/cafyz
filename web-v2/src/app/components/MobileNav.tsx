import { LayoutDashboard, ShoppingBag, Grid3X3, UtensilsCrossed, BarChart3, MonitorSpeaker, ChefHat } from "lucide-react";
import { motion } from "motion/react";

const mobileNavItems = [
  { id: "dashboard", label: "Home",   icon: LayoutDashboard },
  { id: "pos",       label: "POS",    icon: MonitorSpeaker },
  { id: "orders",    label: "Orders", icon: ShoppingBag },
  { id: "tables",    label: "Tables", icon: Grid3X3 },
  { id: "menu",      label: "Menu",   icon: UtensilsCrossed },
];

interface MobileNavProps {
  active: string;
  onNavigate: (id: string) => void;
  permittedPages?: string[];
}

export function MobileNav({ active, onNavigate, permittedPages }: MobileNavProps) {
  const items = mobileNavItems.filter(i => !permittedPages?.length || permittedPages.includes(i.id));
  return (
    <nav
      className="app-mobile-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1"
      style={{
        background: "var(--cafyz-mobile-nav-bg)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--cafyz-sidebar-border)",
        paddingTop: "0.375rem",
      }}
    >
      {items.map(item => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all relative flex-1"
            style={{ minHeight: 52 }}
          >
            {isActive && (
              <motion.div
                layoutId="mobileActiveIndicator"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(30,127,255,0.1)" }}
              />
            )}
            <Icon size={20} style={{ color: isActive ? "#1e7fff" : "var(--cafyz-muted)", position: "relative", zIndex: 1 }} />
            <span style={{
              color: isActive ? "#1e7fff" : "var(--cafyz-muted)",
              fontSize: "0.6rem",
              fontWeight: isActive ? 700 : 400,
              fontFamily: "var(--font-display)",
              position: "relative",
              zIndex: 1,
              lineHeight: 1,
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
