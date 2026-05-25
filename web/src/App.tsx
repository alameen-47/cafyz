import { Navigate, Route, Routes } from 'react-router-dom';
import { type ReactNode } from 'react';
import { ShellLayout } from './layout/ShellLayout';
import { LoginPanel } from './panels/LoginPanel';
import { ManagerPanel } from './panels/ManagerPanel';
import { POSPanel } from './panels/POSPanel';
import { KDSPanel } from './panels/KDSPanel';
import { WaiterPanel } from './panels/WaiterPanel';
import { MenuPanel } from './panels/MenuPanel';
import { MobileOrdersPanel } from './panels/MobileOrdersPanel';
import { MobileTablePanel } from './panels/MobileTablePanel';
import { RolesPanel } from './panels/RolesPanel';
import { LicensePanel } from './panels/LicensePanel';
import { FounderPanel } from './panels/FounderPanel';
import { useAuth } from './context/AuthContext';
import type { Screen } from '@shared/types';

// ── Auth guards ───────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireFounder({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'founder') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Guard that checks allowedScreens for the current user's plan+role
function RequireScreen({ screen, children }: { screen: Screen; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'founder') return <Navigate to="/founder" replace />;
  if (!user.allowedScreens.includes(screen)) return <Navigate to="/license" replace />;
  return <>{children}</>;
}

// Smart home route — owner/manager render the dashboard directly; others redirect
function SmartHomeRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'founder') return <Navigate to="/founder" replace />;
  if (user.role === 'owner' || user.role === 'manager') {
    return <RequireScreen screen="manager"><ManagerPanel section="manager" /></RequireScreen>;
  }
  const paths: Record<string, string> = { cashier: '/pos', waiter: '/tables', kitchen: '/kds' };
  return <Navigate to={paths[user.role] ?? '/license'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPanel />} />

      {/* Founder shell — outside normal ShellLayout */}
      <Route path="/founder" element={
        <RequireFounder>
          <ShellLayout founderMode />
        </RequireFounder>
      }>
        <Route index element={<FounderPanel />} />
      </Route>

      {/* Restaurant shell */}
      <Route element={<RequireAuth><ShellLayout /></RequireAuth>}>
        <Route path="/"          element={<SmartHomeRoute />} />
        <Route path="/pos"       element={<RequireScreen screen="pos"><POSPanel /></RequireScreen>} />
        <Route path="/menu"      element={<RequireScreen screen="menu"><MenuPanel /></RequireScreen>} />
        <Route path="/tables"    element={<RequireScreen screen="waiter"><WaiterPanel /></RequireScreen>} />
        <Route path="/kds"       element={<RequireScreen screen="kds"><KDSPanel /></RequireScreen>} />
        <Route path="/inventory" element={<RequireScreen screen="inventory"><ManagerPanel section="inventory" /></RequireScreen>} />
        <Route path="/staff"     element={<RequireScreen screen="staff"><ManagerPanel section="staff" /></RequireScreen>} />
        <Route path="/reports"   element={<RequireScreen screen="reports"><ManagerPanel section="reports" /></RequireScreen>} />
        <Route path="/roles"     element={<RequireScreen screen="roles"><RolesPanel /></RequireScreen>} />
        <Route path="/license"   element={<LicensePanel />} />
      </Route>

      <Route path="/mobile/orders"   element={<RequireAuth><MobileOrdersPanel /></RequireAuth>} />
      <Route path="/mobile/table"    element={<RequireAuth><MobileTablePanel /></RequireAuth>} />
      <Route path="/mobile/add-item" element={<RequireAuth><MobileTablePanel addItemMode /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
