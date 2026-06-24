import { useState, useEffect, useCallback } from "react";
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
import { UpgradeModal } from "./components/UpgradeModal";
import { TrialExpiredModal } from "./components/TrialExpiredModal";
import { useAuth, type Plan, type Role } from "./auth";
import { NavContext } from "./nav";
import { licensesApi, usersApi, type ApiSubscriptionStatus } from "../services/api";
import {
  allowedPages, canAccessPage, planMeetsRequirement, requiredPlanForPage, type PageId,
} from "../config/access";
import { useKitchenPrintWorker } from "../hooks/useKitchenPrintWorker";
import { usePlanConfig } from "./PlanConfigProvider";
import "../styles/fonts.css";

const pages: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  orders: Orders,
  tables: Tables,
  menu: MenuPage,
  staff: Staff,
  analytics: Analytics,
  inventory: Inventory,
  pos: POS,
  kds: KDS,
  roles: Roles,
  profile: Profile,
  license: License,
  reservations: Reservations,
  founder: FounderConsole,
};

const fullHeightPages = new Set(["pos", "kds"]);

export default function App() {
  const { user, loading, logout } = useAuth();
  usePlanConfig(); // refresh nav gates when founder updates plan structure
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [posTableId, setPosTableId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<ApiSubscriptionStatus | null>(null);
  const [accessPages, setAccessPages] = useState<PageId[] | null>(null);
  const [accessJson, setAccessJson] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ requiredPlan: Plan; page: PageId } | null>(null);

  useKitchenPrintWorker(Boolean(user && user.role !== "founder"));

  useEffect(() => {
    if (!user || user.role === "founder") return;
    void licensesApi.mine().then(setSubscription).catch(() => setSubscription(null));
    void usersApi.list().then(list => {
      const me = list.find(u => u.id === user.id);
      if (me?.access_json) {
        setAccessJson(me.access_json);
        try {
          const parsed = JSON.parse(me.access_json);
          if (Array.isArray(parsed)) setAccessPages(parsed as PageId[]);
        } catch { /* screen map handled via accessJson */ }
      }
    }).catch(() => {});
  }, [user?.id, user?.role]);

  const role = (user?.role ?? "waiter") as Role;
  const plan = (user?.plan ?? "basic") as Plan;
  const permitted = user ? allowedPages(role, plan, accessPages) : [];

  // Deep link: /?page=founder — founders land on Founder Console by default
  useEffect(() => {
    if (!user) return;
    const page = new URLSearchParams(window.location.search).get("page") as PageId | null;
    if (page && pages[page] && canAccessPage(page, role, plan, accessPages, accessJson)) {
      setActivePage(page);
    } else if (user.role === "founder") {
      setActivePage("founder");
    }
  }, [user?.id, user?.role, role, plan, accessPages, accessJson]);

  const navigate = useCallback((page: string) => {
    const p = page as PageId;
    if (!user) return;
    if (!canAccessPage(p, role, plan, accessPages, accessJson)) {
      const req = requiredPlanForPage(p);
      if (req && !planMeetsRequirement(plan, req)) {
        setUpgrade({ requiredPlan: req, page: p });
        return;
      }
      return;
    }
    setActivePage(p);
  }, [user, role, plan, accessPages, accessJson]);

  const goToTableOrder = (tableId: string) => { setPosTableId(tableId); navigate("pos"); };
  const goToPos = () => { setPosTableId(null); navigate("pos"); };

  const isPublicMenuRoute = /^\/m\/[^/]+/.test(window.location.pathname);
  if (isPublicMenuRoute) {
    return (<><Toaster position="bottom-right" richColors closeButton /><PublicMenu /></>);
  }

  if (loading) {
    return (
      <div className="flex app-screen app-native-inset-top w-full items-center justify-center" style={{ background: "#06091a" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#1e7fff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (<><Toaster position="bottom-right" richColors closeButton /><LoginScreen /></>);
  }

  const trialExpired = subscription?.trial_expired && user.role !== "founder";
  const lockedExceptLicense = trialExpired && activePage !== "license";

  if (lockedExceptLicense) {
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        <TrialExpiredModal expiresAt={subscription?.trial_expires_at} onGoLicense={() => setActivePage("license")} />
        <div className="flex app-screen app-native-inset-top w-full overflow-hidden" style={{ background: "#06091a" }}>
          <License />
        </div>
      </>
    );
  }

  const PageComponent = pages[activePage] || Dashboard;
  const isFullHeight = fullHeightPages.has(activePage);

  return (
    <NavContext.Provider value={{ goToTableOrder, goToPos, goToPage: navigate, posTableId, clearPosTable: () => setPosTableId(null) }}>
      <div className="flex app-screen w-full overflow-hidden" style={{ background: "#06091a", fontFamily: "var(--font-body)" }}>
        <Toaster position="top-right" richColors={false} closeButton toastOptions={{
          duration: 3500,
          style: { background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)", color: "#e8eef8", borderRadius: "14px" },
        }} />

        {upgrade && (
          <UpgradeModal
            requiredPlan={upgrade.requiredPlan}
            featurePage={upgrade.page}
            onClose={() => setUpgrade(null)}
            onGoLicense={() => navigate("license")}
          />
        )}

        <Sidebar
          active={activePage}
          onNavigate={navigate}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          role={role}
          plan={plan}
          permittedPages={permitted}
          onUpgrade={(req, page) => setUpgrade({ requiredPlan: req, page })}
          onLogout={logout}
          userName={user.name}
          userInitials={user.initials}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            active={activePage}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            onNavigate={navigate}
            onLogout={logout}
            role={role}
            plan={plan}
            userName={user.name}
            userEmail={user.email}
            userInitials={user.initials}
          />

          <main className={`flex-1 ${isFullHeight ? "app-main-full overflow-hidden" : "app-main-scroll overflow-y-auto"}`}
            style={{ background: "radial-gradient(ellipse at 20% 0%, rgba(30,127,255,0.04) 0%, transparent 60%), #06091a" }}>
            {permitted.includes(activePage) ? <PageComponent /> : <License />}
            {!isFullHeight && <div className="app-main-spacer lg:hidden h-20" />}
          </main>
        </div>

        <MobileNav active={activePage} onNavigate={navigate} permittedPages={permitted} />
        <AIAssistantWidget screen={activePage} />
      </div>
    </NavContext.Provider>
  );
}
