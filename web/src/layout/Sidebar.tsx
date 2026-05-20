import { NavLink } from 'react-router-dom';
import type { Screen } from '@shared/types';
import { pathForScreen } from '../routes';
import './Sidebar.css';

const NAV_ITEMS: { id: Screen; label: string; badge?: string }[] = [
  { id: 'manager', label: 'Overview' },
  { id: 'pos', label: 'Point of Sale' },
  { id: 'waiter', label: 'Tables' },
  { id: 'kds', label: 'Kitchen', badge: '14' },
  { id: 'menu', label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff', label: 'Staff' },
  { id: 'reports', label: 'Reports' },
];

export function Sidebar({ active }: { active: Screen }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        <div>
          <p className="sidebar-brand-name serif">Cafyz</p>
          <p className="sidebar-brand-sub mono">SAINT · PARIS 6e</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.id}
            to={pathForScreen(item.id)}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive || active === item.id ? 'active' : ''}`
            }
          >
            <span className="sidebar-nav-label">{item.label}</span>
            {item.badge && <span className="sidebar-nav-badge mono">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar serif">MV</div>
        <div>
          <p className="sidebar-footer-name">Mireille Vasseur</p>
          <p className="sidebar-footer-role">Maître d&apos;hôtel</p>
        </div>
      </div>
    </aside>
  );
}
