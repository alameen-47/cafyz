import { House, ShoppingBag, Grid3X3, UtensilsCrossed, Plus } from "lucide-react";
import { motion } from "motion/react";

// Two destinations either side of the centre tile. The centre button starts a new bill,
// which is the Point of Sale screen, so every destination the old bar had is still here.
const leftItems = [
  { id: "dashboard", label: "Home",   icon: House },
  { id: "orders",    label: "Orders", icon: ShoppingBag },
];
const rightItems = [
  { id: "tables",    label: "Tables", icon: Grid3X3 },
  { id: "menu",      label: "Menu",   icon: UtensilsCrossed },
];

interface MobileNavProps {
  active: string;
  onNavigate: (id: string) => void;
  /** Starts a new bill in the Point of Sale. */
  onNewBill: () => void;
  permittedPages?: string[];
}

export function MobileNav({ active, onNavigate, onNewBill, permittedPages }: MobileNavProps) {
  const allowed = (id: string) => !permittedPages?.length || permittedPages.includes(id);
  const canBill = allowed("pos");
  const posActive = active === "pos";

  const renderItem = (item: (typeof leftItems)[number]) => {
    if (!allowed(item.id)) return null;
    const Icon = item.icon;
    const isActive = active === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? "page" : undefined}
        className={`cafyz-tab ${isActive ? "is-active" : ""}`}
      >
        {isActive && (
          <motion.span
            layoutId="mobileActiveIndicator"
            aria-hidden
            className="cafyz-tab-pill"
            transition={{ type: "spring", damping: 30, stiffness: 380 }}
          />
        )}
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} className="relative" />
        <span className="cafyz-tab-label relative">{item.label}</span>
      </button>
    );
  };

  return (
    <nav className="app-mobile-nav cafyz-tabbar md:hidden" aria-label="Main">
      <div className="cafyz-tabbar-inner">
        <div className="cafyz-tabbar-side">{leftItems.map(renderItem)}</div>
        {canBill && (
          <div className="cafyz-tabbar-centre">
            <button
              type="button"
              onClick={onNewBill}
              aria-label="New bill"
              title="New bill"
              className={`cafyz-tab-plus ${posActive ? "is-active" : ""}`}
            >
              <Plus size={22} strokeWidth={2.25} />
            </button>
          </div>
        )}
        <div className="cafyz-tabbar-side">{rightItems.map(renderItem)}</div>
      </div>
    </nav>
  );
}
