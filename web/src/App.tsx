import { Navigate, Route, Routes } from 'react-router-dom';
import { ShellLayout } from './layout/ShellLayout';
import { LoginPanel } from './panels/LoginPanel';
import { ManagerPanel } from './panels/ManagerPanel';
import { POSPanel } from './panels/POSPanel';
import { KDSPanel } from './panels/KDSPanel';
import { WaiterPanel } from './panels/WaiterPanel';
import { MobileOrdersPanel } from './panels/MobileOrdersPanel';
import { MobileTablePanel } from './panels/MobileTablePanel';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPanel />} />

      <Route element={<ShellLayout />}>
        <Route path="/" element={<ManagerPanel section="manager" />} />
        <Route path="/inventory" element={<ManagerPanel section="inventory" />} />
        <Route path="/staff" element={<ManagerPanel section="staff" />} />
        <Route path="/reports" element={<ManagerPanel section="reports" />} />
        <Route path="/pos" element={<POSPanel />} />
        <Route path="/menu" element={<POSPanel />} />
        <Route path="/kds" element={<KDSPanel />} />
        <Route path="/tables" element={<WaiterPanel />} />
      </Route>

      <Route path="/mobile/orders" element={<MobileOrdersPanel />} />
      <Route path="/mobile/table" element={<MobileTablePanel />} />
      <Route path="/mobile/add-item" element={<MobileTablePanel addItemMode />} />

      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
