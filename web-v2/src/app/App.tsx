import { useState } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { MobileNav } from "./components/MobileNav";
import { AIAssistantWidget } from "./components/AIAssistantWidget";
import { Dashboard } from "./components/Dashboard";
import { Orders } from "./components/Orders";
import { Tables } from "./components/Tables";
import { MenuPage } from "./components/MenuPage";
import { Staff } from "./components/Staff";
import { Analytics } from "./components/Analytics";
import { Inventory } from "./components/Inventory";
import { LoginScreen } from "./components/LoginScreen";
import { POS } from "./components/POS";
import { KDS } from "./components/KDS";
import { Roles } from "./components/Roles";
import { Profile } from "./components/Profile";
import { License } from "./components/License";
import { Reservations } from "./components/Reservations";
import { FounderConsole } from "./components/FounderConsole";
import { PublicMenu } from "./components/PublicMenu";
import { useAuth } from "./auth";
import "../styles/fonts.css";

type Role = "owner" | "manager" | "cashier" | "waiter" | "kitchen" | "founder";
type Plan = "basic" | "pro" | "premium";

const pages: Record<string, React.ComponentType> = {
  dashboard:    Dashboard,
  orders:       Orders,
  tables:       Tables,
  menu:         MenuPage,
  staff:        Staff,
  analytics:    Analytics,
  inventory:    Inventory,
  pos:          POS,
  kds:          KDS,
  roles:        Roles,
  profile:      Profile,
  license:      License,
  reservations: Reservations,
  founder:      FounderConsole,
};

// Pages that occupy the full height without overflow scroll
const fullHeightPages = new Set(["pos", "kds"]);

export default function App() {
  const { user, loading, logout } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPublicMenu, setShowPublicMenu] = useState(false);

  // Public customer-facing QR menu — reachable via the /m/:id deep link with no
  // login (the QR a guest scans), or via the in-app preview toggle.
  const isPublicMenuRoute = /^\/m\/[^/]+/.test(window.location.pathname);
  if (isPublicMenuRoute) {
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        <PublicMenu />
      </>
    );
  }
  if (showPublicMenu) {
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        <div onClick={() => setShowPublicMenu(false)}>
          <PublicMenu />
        </div>
      </>
    );
  }

  // Restore-session spinner
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: "#06091a" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#1e7fff] rounded-full animate-spin" />
      </div>
    );
  }

  // Login gate — real auth
  if (!user) {
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        <LoginScreen />
      </>
    );
  }

  const role = user.role as Role;
  const plan = user.plan as Plan;
  const PageComponent = pages[activePage] || Dashboard;
  const isFullHeight = fullHeightPages.has(activePage);

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{ background: "#06091a", fontFamily: "var(--font-body)" }}
    >
      {/* ── Toast provider ── */}
      <Toaster
        position="top-right"
        richColors={false}
        closeButton
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0d1326",
            border: "1px solid rgba(30,127,255,0.2)",
            color: "#e8eef8",
            borderRadius: "14px",
            fontFamily: "var(--font-body)",
            fontSize: "0.85rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          },
        }}
      />

      {/* ── Sidebar ── */}
      <Sidebar
        active={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        role={role}
        plan={plan}
        onLogout={logout}
      />

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          active={activePage}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onNavigate={setActivePage}
          onLogout={logout}
          role={role}
          plan={plan}
        />

        <main
          className={`flex-1 ${isFullHeight ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{
            background: "radial-gradient(ellipse at 20% 0%, rgba(30,127,255,0.04) 0%, transparent 60%), #06091a",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(30,127,255,0.15) transparent",
          }}
        >
          <PageComponent />
          {/* Spacer so content clears the mobile nav */}
          {!isFullHeight && <div className="lg:hidden h-20" />}
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <MobileNav active={activePage} onNavigate={setActivePage} />

      {/* ── AI Assistant floating widget ── */}
      <AIAssistantWidget />
    </div>
  );
}
