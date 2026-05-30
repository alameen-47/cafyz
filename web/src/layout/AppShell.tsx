import { useEffect, useState, type ReactNode } from 'react';
import type { Screen } from '@shared/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const MOBILE_NAV_MQ = '(max-width: 1024px)';

const CRUMBS: Partial<Record<Screen, [string, string]>> = {
  manager:   ['Operations', 'Overview'],
  inventory: ['Operations', 'Inventory'],
  staff:     ['Operations', 'Staff'],
  reports:   ['Operations', 'Reports'],
  roles:     ['Operations', 'Role Management'],
  pos:       ['Service', 'Point of Sale'],
  menu:      ['Service', 'Menu'],
  kds:       ['Kitchen', 'Expedite'],
  waiter:    ['Service', 'Floor Plan'],
};

const COVERS: Partial<Record<Screen, string>> = {
  pos: 'Dinner Service · Cover 84',
  menu: 'Dinner Service · Cover 84',
  kds: 'Line · 14 tickets',
  waiter: 'Dinner · Floor active',
};

export function AppShell({
  active,
  children,
}: {
  active: Screen;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const crumb = CRUMBS[active] ?? ['Cafyz', 'Panel'];
  const cover = COVERS[active] ?? 'Service · Dinner';

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => {
      setMobileNav(mq.matches);
      if (!mq.matches) setNavOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen && mobileNav);
    return () => document.body.classList.remove('nav-open');
  }, [navOpen, mobileNav]);

  useEffect(() => {
    setNavOpen(false);
  }, [active]);

  return (
    <div className={`app-shell${navOpen && mobileNav ? ' app-shell--nav-open' : ''}`}>
      <div
        className={`sidebar-backdrop ${navOpen && mobileNav ? 'open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-hidden={!(navOpen && mobileNav)}
      />
      <Sidebar
        active={active}
        mobileOpen={navOpen}
        drawerMode={mobileNav}
        onNavigate={() => setNavOpen(false)}
      />
      <div className="app-main">
        <TopBar
          crumb={crumb}
          cover={cover}
          onMenuClick={() => setNavOpen(o => !o)}
          menuOpen={navOpen}
        />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
