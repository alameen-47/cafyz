import { NavLink, useNavigate } from 'react-router-dom';
import type { Screen } from '@shared/types';
import { pathForScreen } from '../routes';
import { useAuth, ROLE_LABELS, ROLE_NAV } from '../context/AuthContext';
import './Sidebar.css';

const ALL_NAV: { id: Screen; label: string; badge?: string }[] = [
  { id: 'manager',   label: 'Overview' },
  { id: 'pos',       label: 'Point of Sale' },
  { id: 'waiter',    label: 'Tables' },
  { id: 'kds',       label: 'Kitchen' },
  { id: 'menu',      label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff',     label: 'Staff' },
  { id: 'reports',   label: 'Reports' },
  { id: 'roles',     label: 'Role Management' },
];

export function Sidebar({ active }: { active: Screen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const allowed  = user ? ROLE_NAV[user.role] : ALL_NAV.map(n => n.id);
  const navItems = ALL_NAV.filter(n => allowed.includes(n.id));

  // Use real restaurant name from auth context, fall back gracefully
  const restaurantName = user?.restaurant_name || 'Cafyz';
  const restaurantSub  = restaurantName.toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        <div>
          <p className="sidebar-brand-name serif">{restaurantName}</p>
          <p className="sidebar-brand-sub mono">{restaurantSub}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
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
        <div className="sidebar-avatar serif">
          {user ? user.initials : 'C'}
        </div>
        <div className="sidebar-footer-info">
          <p className="sidebar-footer-name">{user ? user.name : 'Guest'}</p>
          <p className="sidebar-footer-role">{user ? ROLE_LABELS[user.role] : '—'}</p>
        </div>
        {user && (
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out">⏏</button>
        )}
      </div>
    </aside>
  );
}
