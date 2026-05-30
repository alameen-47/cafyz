import { NavLink, useNavigate } from 'react-router-dom';
import type { Screen } from '@shared/types';
import { pathForScreen } from '../routes';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PLAN_LABELS, PLAN_COLOR, DEFAULT_PLAN_PANELS, type Plan } from '../config/planAccess';
import './Sidebar.css';

const ALL_NAV: { id: Screen; label: string }[] = [
  { id: 'manager',   label: 'Overview' },
  { id: 'pos',       label: 'Point of Sale' },
  { id: 'waiter',    label: 'Tables' },
  { id: 'kds',       label: 'Kitchen' },
  { id: 'menu',      label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff',     label: 'Staff' },
  { id: 'reports',   label: 'Reports' },
  { id: 'roles',     label: 'Role Mgmt' },
  { id: 'license',   label: 'License' },
];

const FOUNDER_NAV: { id: Screen; label: string }[] = [
  { id: 'founder', label: 'Control Center' },
];

export function Sidebar({
  active,
  mobileOpen = false,
  drawerMode = false,
  onNavigate,
}: {
  active: Screen;
  mobileOpen?: boolean;
  drawerMode?: boolean;
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isFounder = user?.role === 'founder';
  const plan = user?.plan ?? 'basic';

  let navItems: { id: Screen; label: string }[];
  let lockedItems: Screen[] = [];

  if (isFounder) {
    navItems = FOUNDER_NAV;
  } else {
    const allowed = user?.allowedScreens ?? [];
    navItems = ALL_NAV.filter(n => allowed.includes(n.id));

    // Show locked items (in plan but locked for this role's plan tier) — grayed out
    const planPanels = DEFAULT_PLAN_PANELS[plan as Plan] ?? DEFAULT_PLAN_PANELS.basic;
    lockedItems = ALL_NAV
      .filter(n => !allowed.includes(n.id) && !planPanels.includes(n.id))
      .map(n => n.id);
  }

  const restaurantName = user?.restaurant_name || 'Cafyz';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}
      aria-hidden={drawerMode && !mobileOpen ? true : undefined}
      aria-label="Main navigation"
    >
      {drawerMode && (
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onNavigate}
          aria-label="Close navigation menu"
        >
          ✕
        </button>
      )}
      <div className="sidebar-brand">
        <div className="sidebar-logo">{isFounder ? '★' : 'C'}</div>
        <div>
          <p className="sidebar-brand-name serif">{isFounder ? 'Cafyz HQ' : restaurantName}</p>
          <p className="sidebar-brand-sub mono">{isFounder ? 'FOUNDER' : restaurantName.toUpperCase()}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            to={pathForScreen(item.id)}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive || active === item.id ? 'active' : ''}`
            }
          >
            <span className="sidebar-nav-label">{item.label}</span>
          </NavLink>
        ))}

        {/* Plan-locked items — shown grayed with upgrade hint */}
        {lockedItems.length > 0 && (
          <div className="sidebar-locked-group">
            <p className="sidebar-locked-label">Requires upgrade</p>
            {ALL_NAV.filter(n => lockedItems.includes(n.id)).map(item => (
              <div key={item.id} className="sidebar-nav-item locked"
                onClick={() => navigate('/license')} title="Upgrade plan to unlock">
                <span className="sidebar-nav-label">{item.label}</span>
                <span className="sidebar-lock">🔒</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar serif">
          {user ? user.initials : 'C'}
        </div>
        <div className="sidebar-footer-info">
          <p className="sidebar-footer-name">{user ? user.name : 'Guest'}</p>
          <p className="sidebar-footer-role">{user ? ROLE_LABELS[user.role] : '—'}</p>
          {!isFounder && user && (
            <span className="sidebar-plan-badge"
              style={{ color: PLAN_COLOR[plan as Plan] ?? 'var(--text3)', background: (PLAN_COLOR[plan as Plan] ?? '#888') + '22' }}>
              {PLAN_LABELS[plan as Plan] ?? plan}
            </span>
          )}
        </div>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀︎' : '◗'}
        </button>
        {user && (
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out">⏏</button>
        )}
      </div>
    </aside>
  );
}
