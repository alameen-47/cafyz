import { Navigate, Route, Routes } from 'react-router-dom';
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
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPanel />} />

      <Route element={<RequireAuth><ShellLayout /></RequireAuth>}>
        <Route path="/"          element={<ManagerPanel section="manager" />} />
        <Route path="/inventory" element={<ManagerPanel section="inventory" />} />
        <Route path="/staff"     element={<ManagerPanel section="staff" />} />
        <Route path="/reports"   element={<ManagerPanel section="reports" />} />
        <Route path="/pos"       element={<POSPanel />} />
        <Route path="/menu"      element={<MenuPanel />} />
        <Route path="/kds"       element={<KDSPanel />} />
        <Route path="/tables"    element={<WaiterPanel />} />
        <Route path="/roles"     element={<RolesPanel />} />
      </Route>

      <Route path="/mobile/orders"   element={<RequireAuth><MobileOrdersPanel /></RequireAuth>} />
      <Route path="/mobile/table"    element={<RequireAuth><MobileTablePanel /></RequireAuth>} />
      <Route path="/mobile/add-item" element={<RequireAuth><MobileTablePanel addItemMode /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
