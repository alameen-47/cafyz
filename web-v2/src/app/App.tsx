import { useState, useEffect, useCallback, Suspense } from "react";
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
import { Inventory } from "./components/Inventory";
import { LoginScreen } from "./components/LoginScreen";
import { KDS } from "./components/KDS";
import { Roles } from "./components/Roles";
import { License } from "./components/License";
import { Reservations } from "./components/Reservations";
import { PublicMenu } from "./components/PublicMenu";
import { UpgradeModal } from "./components/UpgradeModal";
import { TrialExpiredModal } from "./components/TrialExpiredModal";
import { RenewalBanner } from "./components/RenewalBanner";
import { CafyzLogo } from "./components/CafyzLogo";
import { useAuth, type Plan, type Role } from "./auth";
import { NavContext } from "./nav";
import { licensesApi, authApi, TRIAL_EXPIRED_EVENT, ACCESS_CHANGED_EVENT, type ApiSubscriptionStatus } from "../services/api";
import {
  canAccessPage, isFounderRole, permittedPages, planMeetsRequirement, requiredPlanForPage, type PageId,
} from "../config/access";
import { useKitchenPrintWorker } from "../hooks/useKitchenPrintWorker";
import { usePlanConfig } from "./PlanConfigProvider";
import { applyLanguageToDocument, getActiveLanguageCode } from "../i18n";
import { lazyPage, PageLoadingFallback } from "./lazyPage";
import "../styles/fonts.css";

const POS = lazyPage(() => import("./components/POS").then(m => ({ default: m.POS })), "POS");
const Analytics = lazyPage(() => import("./components/Analytics").then(m => ({ default: m.Analytics })), "Analytics");
const Profile = lazyPage(() => import("./components/Profile").then(m => ({ default: m.Profile })), "Profile");
const FounderConsole = lazyPage(() => import("./components/FounderConsole").then(m => ({ default: m.FounderConsole })), "Founder Console");

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
  const { user, loading, logout, refreshPlan } = useAuth();
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
    const id = requestAnimationFrame(() => applyLanguageToDocument(getActiveLanguageCode()));
    return () => cancelAnimationFrame(id);
  }, [activePage, user?.id]);

  const loadSubscription = useCallback(async () => {
    if (!user || user.role === "founder") return null;
    try {
      const sub = await licensesApi.mine();
      setSubscription(sub);
      if (sub.plan && sub.plan !== user.plan) await refreshPlan();
      return sub;
    } catch {
      setSubscription(null);
      return null;
    }
  }, [user?.id, user?.role, user?.plan, refreshPlan]);

  const loadAccess = useCallback(async () => {
    if (!user || user.role === "founder") return;
    try {
      const me = await authApi.me();
      setAccessJson(me.access_json ?? null);
      const legacy = me.access_json ? (() => {
        try {
          const parsed = JSON.parse(me.access_json);
          return Array.isArray(parsed) ? parsed as PageId[] : null;
        } catch {
          return null;
        }
      })() : null;
      setAccessPages(legacy);
    } catch {
      setAccessJson(null);
      setAccessPages(null);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role === "founder") return;
    void loadSubscription();
    void loadAccess();
    const iv = setInterval(() => { void loadSubscription(); }, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void loadSubscription(); };
    const onAccessChanged = () => { void loadAccess(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ACCESS_CHANGED_EVENT, onAccessChanged);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ACCESS_CHANGED_EVENT, onAccessChanged);
    };
  }, [user?.id, user?.role, loadSubscription, loadAccess]);

  useEffect(() => {
    const onTrialExpired = () => { void loadSubscription(); };
    window.addEventListener(TRIAL_EXPIRED_EVENT, onTrialExpired);
    return () => window.removeEventListener(TRIAL_EXPIRED_EVENT, onTrialExpired);
  }, [loadSubscription]);

  const role = (user?.role ?? "waiter") as Role;
  const plan = (user?.plan ?? "basic") as Plan;
  const permitted = user ? permittedPages(role, plan, accessJson, accessPages) : [];

  // Founders: founder console only. Tenants: never land on founder routes.
  useEffect(() => {
    if (!user) return;
    if (isFounderRole(user.role)) {
      setActivePage("founder");
      return;
    }
    const page = new URLSearchParams(window.location.search).get("page") as PageId | null;
    if (page === "founder") return;
    if (page && pages[page] && canAccessPage(page, role, plan, accessPages, accessJson)) {
      setActivePage(page);
    }
  }, [user?.id, user?.role, role, plan, accessPages, accessJson]);

  const navigate = useCallback((page: string) => {
    const p = page as PageId;
    if (!user) return;
    if (isFounderRole(role)) {
      if (p === "founder") setActivePage("founder");
      return;
    }
    if (p === "founder") return;
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
      <div className="flex app-screen app-native-inset-top w-full flex-col items-center justify-center gap-4" style={{ background: "#06091a" }}>
        <CafyzLogo size="lg" className="animate-pulse drop-shadow-[0_8px_24px_rgba(30,127,255,0.2)]" />
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#1e7fff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (<><Toaster position="bottom-right" richColors closeButton /><LoginScreen /></>);
  }

  const trialExpired = subscription?.trial_expired && !isFounderRole(user.role);
  const lockedExceptLicense = trialExpired && activePage !== "license";
  const effectivePlan = (subscription?.plan ?? plan) as Plan;
  const showRenewalBanner = user.role === "owner" && subscription
    && (subscription.trial_expired || (subscription.trial_days_left != null && subscription.trial_days_left <= 3));

  if (lockedExceptLicense) {
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        <TrialExpiredModal
          expiresAt={subscription?.trial_expires_at}
          founderEmail={subscription?.founder_email}
          currentPlan={effectivePlan}
          onGoLicense={() => setActivePage("license")}
          onRenewalSubmitted={() => { void loadSubscription(); }}
        />
        <div className="flex app-screen app-native-inset-top w-full overflow-hidden cafyz-app-shell">
          <License />
        </div>
      </>
    );
  }

  const PageComponent = pages[activePage] || (isFounderRole(role) ? FounderConsole : Dashboard);
  const isFullHeight = fullHeightPages.has(activePage);
  const isFounder = isFounderRole(role);

  return (
    <NavContext.Provider value={{ goToTableOrder, goToPos, goToPage: navigate, posTableId, clearPosTable: () => setPosTableId(null) }}>
      <div className="flex app-screen w-full overflow-hidden cafyz-app-shell" style={{ fontFamily: "var(--font-body)" }}>
        <Toaster position="top-right" richColors={false} closeButton toastOptions={{
          duration: 3500,
          style: {
            background: "var(--cafyz-toast-bg)",
            border: "1px solid var(--cafyz-toast-border)",
            color: "var(--cafyz-toast-text)",
            borderRadius: "14px",
          },
        }} />

        {upgrade && (
          <UpgradeModal
            requiredPlan={upgrade.requiredPlan}
            featurePage={upgrade.page}
            onClose={() => setUpgrade(null)}
            onGoLicense={() => navigate("license")}
          />
        )}

        {showRenewalBanner && !subscription?.trial_expired && (
          <RenewalBanner
            subscription={subscription}
            currentPlan={effectivePlan}
            role={role}
            onGoLicense={() => navigate("license")}
            onRenewalSubmitted={() => { void loadSubscription(); }}
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

        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden${showRenewalBanner && !subscription?.trial_expired ? " pt-[4.5rem]" : ""}`}>
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

          <main className={`flex-1 cafyz-main-scroll ${isFullHeight ? "app-main-full overflow-hidden" : "app-main-scroll overflow-y-auto"}`}>
            {permitted.includes(activePage) ? (
              <Suspense fallback={<PageLoadingFallback />}>
                <PageComponent />
              </Suspense>
            ) : (isFounder ? (
              <Suspense fallback={<PageLoadingFallback />}>
                <FounderConsole />
              </Suspense>
            ) : <Dashboard />)}
            {!isFullHeight && !isFounder && <div className="app-main-spacer lg:hidden h-20" />}
          </main>
        </div>

        {!isFounder && <MobileNav active={activePage} onNavigate={navigate} permittedPages={permitted} />}
        {!isFounder && <AIAssistantWidget screen={activePage} onNewBill={goToPos} />}
      </div>
    </NavContext.Provider>
  );
}
