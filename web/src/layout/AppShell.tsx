import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { Screen } from '@shared/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MOBILE_NAV_MQ } from './layoutBreakpoints';
import { useAuth } from '../context/AuthContext';
import { licensesApi } from '../services/api';
import { TrialExpiredModal } from '../components/TrialExpiredModal';
import { AISupportWidget } from '../components/AISupportWidget';
import '../components/TrialExpiredModal.css';

const CRUMBS: Partial<Record<Screen, [string, string]>> = {
  manager:   ['Operations', 'Overview'],
  inventory: ['Operations', 'Inventory'],
  staff:     ['Operations', 'Staff'],
  reports:   ['Operations', 'Reports'],
  roles:     ['Operations', 'Role Management'],
  pos:       ['Service', 'Point of Sale'],
  menu:      ['Service', 'Menu'],
  kds:       ['Kitchen', 'Expedite'],
  waiter:      ['Service', 'Floor Plan'],
  tableSetup:  ['Operations', 'Table Setup'],
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
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_NAV_MQ).matches : false,
  );
  const [trialLock, setTrialLock] = useState<{ expired: boolean; purchaseUrl?: string; expiresAt?: string | null }>({
    expired: false,
  });
  const [supportOpen, setSupportOpen] = useState(false);
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

  useEffect(() => {
    if (!user || user.role === 'founder') {
      setTrialLock({ expired: false });
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const status = await licensesApi.mine();
        if (!alive) return;
        setTrialLock({
          expired: Boolean(status.trial_expired),
          purchaseUrl: status.purchase_url ?? '/license',
          expiresAt: status.trial_expires_at ?? null,
        });
      } catch {
        if (!alive) return;
        setTrialLock({ expired: false });
      }
    };
    check();
    const t = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [user?.id, user?.role]);

  return (
    <div
      className={[
        'app-shell',
        mobileNav ? 'app-shell--mobile-nav' : '',
        navOpen && mobileNav ? 'app-shell--nav-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
          onSupportClick={() => setSupportOpen((v) => !v)}
          supportOpen={supportOpen}
        />
        <div className="app-content">{children}</div>
      </div>
      <AISupportWidget open={supportOpen} onClose={() => setSupportOpen(false)} screen={active} />
      {trialLock.expired && !pathname.startsWith('/license') && (
        <TrialExpiredModal purchaseUrl={trialLock.purchaseUrl} expiresAt={trialLock.expiresAt} />
      )}
    </div>
  );
}
