import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Screen } from '@shared/types';
import { Sidebar } from './Sidebar';
import { TopBar, type TopBarNotification } from './TopBar';
import { MOBILE_NAV_MQ } from './layoutBreakpoints';
import { useAuth } from '../context/AuthContext';
import {
  authApi,
  dashboardApi,
  founderApi,
  inventoryApi,
  kdsApi,
  licensesApi,
  menuApi,
  ordersApi,
  restaurantApi,
  tablesApi,
  usersApi,
} from '../services/api';
import { TrialExpiredModal } from '../components/TrialExpiredModal';
import { AISupportWidget } from '../components/AISupportWidget';
import { Modal } from '../components/Modal';
import { PasswordVisibilityIcon } from '../components/PasswordVisibilityIcon';
import { toastBus } from '../services/toastBus';
import { applyLanguageToDocument, getActiveLanguageCode, setActiveLanguageCode } from '../utils/language';
import { printKitchenTicket, printerStatus } from '../services/PrintService';
import '../components/TrialExpiredModal.css';
import './ProfileModal.css';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_NAV_MQ).matches : false,
  );
  const [trialLock, setTrialLock] = useState<{ expired: boolean; purchaseUrl?: string; expiresAt?: string | null }>({
    expired: false,
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '' });
  const [pwdData, setPwdData] = useState({ current: '', next: '' });
  const [pinData, setPinData] = useState({ current: '', next: '' });
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNext, setShowPwdNext] = useState(false);
  const [showPinCurrent, setShowPinCurrent] = useState(false);
  const [showPinNext, setShowPinNext] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState(() => getActiveLanguageCode('en'));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TopBarNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const crumb = CRUMBS[active] ?? ['Cafyz', 'Panel'];
  const cover = COVERS[active] ?? 'Service · Dinner';
  const notifStorageKey = useMemo(
    () => `cafyz:topbar-read-notifications:${user?.id ?? 'guest'}`,
    [user?.id],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.includes(n.id)).length,
    [notifications, readIds],
  );

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
    setNotificationsOpen(false);
  }, [active, pathname]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const syncLang = () => {
      restaurantApi.me().then((r) => {
        if (!alive) return;
        const lang = String(r.language_code ?? 'en').toLowerCase();
        setActiveLanguageCode(lang);
        setActiveLanguage(lang);
      }).catch(() => {});
    };
    syncLang();
    const t = window.setInterval(syncLang, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [user?.id]);

  useEffect(() => {
    const run = () => applyLanguageToDocument(
      activeLanguage,
      document.querySelector('.app-shell') as HTMLElement | null,
    );
    run();
    const t = window.setTimeout(run, 50);
    return () => window.clearTimeout(t);
  }, [active, pathname, notificationsOpen, supportOpen, profileOpen, user?.id, activeLanguage]);

  useEffect(() => {
    if (!profileOpen) return;
    authApi.me().then((u) => {
      setProfileData({
        name: String(u.name ?? ''),
        email: String(u.email ?? ''),
        phone: String(u.phone ?? ''),
      });
    }).catch(() => {});
  }, [profileOpen]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const next = getActiveLanguageCode('en');
      setActiveLanguage((prev) => (prev === next ? prev : next));
    }, 2000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) {
      setReadIds([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(notifStorageKey);
      if (!raw) {
        setReadIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadIds(parsed.filter((x): x is string => typeof x === 'string'));
        return;
      }
      setReadIds([]);
    } catch {
      setReadIds([]);
    }
  }, [notifStorageKey, user?.id]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(notifStorageKey, JSON.stringify(readIds.slice(-300)));
  }, [notifStorageKey, readIds, user]);

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

  useEffect(() => {
    if (!user || user.role === 'founder') return;
    if (!user.allowedScreens.includes('kds')) return;

    let alive = true;
    let assignedKitchen: { channel: 'bluetooth' | 'usb'; name: string } | null = null;
    let restaurantName = user.restaurant_name || 'Restaurant';
    let restaurantId = user.restaurant_id;

    const syncRestaurantPrinter = async () => {
      try {
        const r = await restaurantApi.me();
        if (!alive) return;
        restaurantName = r.name || restaurantName;
        restaurantId = r.id || restaurantId;
        assignedKitchen = r.kitchen_printer ? { channel: r.kitchen_printer.channel, name: r.kitchen_printer.name } : null;
      } catch {
        // keep last-known config on transient failures
      }
    };

    const consumeOne = async () => {
      if (!alive) return;
      if (localStorage.getItem('cafyz_kds_auto_print') === '0') return;
      if (!assignedKitchen) return;
      if (printerStatus().type === 'none') return;
      try {
        const claimed = await kdsApi.claimPrintJobWait(
          `appshell:${navigator.userAgent.slice(0, 40)}:${Date.now()}`,
          15000,
        );
        const job = claimed.job;
        if (!job) return;
        if (!job.payload || !Array.isArray(job.payload.items) || job.payload.items.length === 0) {
          await kdsApi.completePrintJob(job.id, 'failed', 'Invalid print payload');
          return;
        }
        try {
          await printKitchenTicket({
            restaurantName,
            ticketId: job.payload.ticketId,
            tableName: job.payload.tableName,
            serverName: job.payload.serverName,
            covers: job.payload.covers,
            station: job.payload.station,
            createdAt: job.payload.createdAt,
            items: job.payload.items,
            note: job.payload.note,
            parcel: job.payload.parcel,
          }, restaurantId, {
            allowDialog: false,
            channel: assignedKitchen.channel,
          });
          await kdsApi.completePrintJob(job.id, 'printed');
        } catch (e) {
          await kdsApi.completePrintJob(job.id, 'failed', (e as Error).message || 'Cloud print failed');
        }
      } catch {
        // silent background retry loop
      }
    };

    const runCloudQueue = async () => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      while (alive) {
        await consumeOne();
        await sleep(300);
      }
    };

    void syncRestaurantPrinter();
    void runCloudQueue();
    const syncTimer = window.setInterval(() => { void syncRestaurantPrinter(); }, 6000);
    const onOrderSent = () => { void consumeOne(); };
    window.addEventListener('CAFYZ_ORDER_SENT', onOrderSent as EventListener);

    return () => {
      alive = false;
      window.clearInterval(syncTimer);
      window.removeEventListener('CAFYZ_ORDER_SENT', onOrderSent as EventListener);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let alive = true;
    const normalize = (items: TopBarNotification[]) =>
      items
        .slice()
        .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
        .slice(0, 12);

    const push = (list: TopBarNotification[], item: TopBarNotification | null) => {
      if (item) list.push(item);
    };

    const build = async () => {
      const next: TopBarNotification[] = [];
      const nowTs = Date.now();

      if (user.role !== 'founder') {
        try {
          const license = await licensesApi.mine();
          const daysLeft = Number.isFinite(license.trial_days_left) ? license.trial_days_left : null;
          if (license.trial_expired) {
            push(next, {
              id: 'license:trial-expired',
              title: 'Trial expired',
              message: 'Upgrade plan now to continue all operations without interruption.',
              tone: 'danger',
              href: '/license',
              ts: nowTs,
            });
          } else if (typeof daysLeft === 'number' && daysLeft <= 2) {
            push(next, {
              id: `license:trial-ending:${daysLeft}`,
              title: 'Trial ending soon',
              message: `${daysLeft} day(s) left. Renew early to avoid service lock.`,
              tone: 'warning',
              href: '/license',
              ts: nowTs - 1_000,
            });
          }
        } catch {
          // Fail quietly for polling; avoid noisy errors from blocked endpoints.
        }
      }

      try {
        if (active === 'manager' || active === 'reports') {
          const stats = await dashboardApi.stats();
          push(
            next,
            Number(stats.orders_today - stats.orders_paid) > 0
              ? {
                  id: `dash:pending-orders:${stats.orders_today - stats.orders_paid}`,
                  title: 'Orders waiting',
                  message: `${stats.orders_today - stats.orders_paid} order(s) are not paid yet today.`,
                  tone: 'warning',
                  href: '/pos',
                  ts: nowTs - 2_000,
                }
              : null,
          );
          push(
            next,
            Number(stats.inventory_low) > 0
              ? {
                  id: `dash:low-stock:${stats.inventory_low}`,
                  title: 'Low stock alert',
                  message: `${stats.inventory_low} inventory item(s) are below par.`,
                  tone: 'danger',
                  href: '/inventory',
                  ts: nowTs - 3_000,
                }
              : null,
          );
        }

        if (active === 'inventory') {
          const rows = await inventoryApi.list();
          const low = rows.filter((r) => r.current <= r.par).length;
          if (low > 0) {
            push(next, {
              id: `inventory:low:${low}`,
              title: 'Restock required',
              message: `${low} item(s) need immediate restocking.`,
              tone: 'danger',
              ts: nowTs - 2_200,
            });
          }
        }

        if (active === 'staff' || active === 'roles') {
          const rows = await usersApi.list();
          const inactive = rows.filter((u) => u.status !== 'active').length;
          if (inactive > 0) {
            push(next, {
              id: `users:inactive:${inactive}`,
              title: 'Staff status updates',
              message: `${inactive} staff member(s) are not active right now.`,
              tone: 'info',
              ts: nowTs - 2_500,
            });
          }
        }

        if (active === 'menu') {
          const items = await menuApi.list();
          const unavailable = items.filter((m) => Number(m.is_available) !== 1).length;
          if (unavailable > 0) {
            push(next, {
              id: `menu:unavailable:${unavailable}`,
              title: 'Menu availability',
              message: `${unavailable} item(s) are hidden from ordering.`,
              tone: 'warning',
              ts: nowTs - 2_700,
            });
          }
        }

        if (active === 'pos') {
          const sent = await ordersApi.list({ status: 'sent' });
          if (sent.length > 0) {
            push(next, {
              id: `pos:sent:${sent.length}`,
              title: 'Orders sent to kitchen',
              message: `${sent.length} ticket(s) are currently in kitchen flow.`,
              tone: 'info',
              href: '/kds',
              ts: nowTs - 2_900,
            });
          }
        }

        if (active === 'kds') {
          const fresh = await kdsApi.list({ status: 'new' });
          if (fresh.length > 0) {
            push(next, {
              id: `kds:new:${fresh.length}`,
              title: 'New kitchen tickets',
              message: `${fresh.length} ticket(s) need preparation.`,
              tone: 'warning',
              ts: nowTs - 3_100,
            });
          }
        }

        if (active === 'waiter' || active === 'tableSetup') {
          const tables = await tablesApi.list();
          const attention = tables.filter((t) => t.status === 'reserved' || t.status === 'occupied').length;
          if (attention > 0) {
            push(next, {
              id: `tables:attention:${attention}`,
              title: 'Table activity',
              message: `${attention} table(s) are currently active or reserved.`,
              tone: 'info',
              ts: nowTs - 3_400,
            });
          }
        }

        if (active === 'founder') {
          const stats = await founderApi.stats();
          const requests = await founderApi.licenseRequests();
          const pendingRequests = requests.filter((r) => r.status === 'pending').length;
          push(
            next,
            Number(pendingRequests) > 0
              ? {
                  id: `founder:purchases:${pendingRequests}`,
                  title: 'Pending purchase requests',
                  message: `${pendingRequests} request(s) are waiting for follow-up.`,
                  tone: 'warning',
                  ts: nowTs - 1_000,
                }
              : null,
          );
          push(
            next,
            Number(stats.pending_license_requests ?? 0) > 0
              ? {
                  id: `founder:license-queue:${stats.pending_license_requests}`,
                  title: 'License queue',
                  message: `${stats.pending_license_requests} license request(s) need action.`,
                  tone: 'info',
                  ts: nowTs - 1_500,
                }
              : null,
          );
        }
      } catch {
        // Keep notifications smooth; never break panel render due to polling.
      }

      if (alive) setNotifications(normalize(next));
    };

    build();
    const poll = window.setInterval(build, 45_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [active, user]);

  const openNotification = (n: TopBarNotification) => {
    setReadIds((prev) => (prev.includes(n.id) ? prev : [...prev, n.id]));
    setNotificationsOpen(false);
    if (n.href) navigate(n.href);
  };

  const markAllRead = () => {
    setReadIds((prev) => Array.from(new Set([...prev, ...notifications.map((n) => n.id)])));
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    try {
      await authApi.updateProfile({
        name: profileData.name.trim(),
        email: profileData.email.trim().toLowerCase(),
        phone: profileData.phone.trim(),
      });
      toastBus.success('Profile updated.');
    } catch (e) {
      toastBus.error((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async () => {
    if (!pwdData.current || !pwdData.next) return;
    setProfileBusy(true);
    try {
      await authApi.changePassword(pwdData.current, pwdData.next);
      setPwdData({ current: '', next: '' });
      toastBus.success('Password changed successfully.');
    } catch (e) {
      toastBus.error((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  };

  const savePin = async () => {
    if (!pinData.current || !pinData.next) return;
    setProfileBusy(true);
    try {
      await authApi.changePin(pinData.current, pinData.next);
      setPinData({ current: '', next: '' });
      toastBus.success('PIN changed successfully.');
    } catch (e) {
      toastBus.error((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  };

  const profileInitials = (profileData.name || user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
          onProfileClick={() => setProfileOpen((v) => !v)}
          profileOpen={profileOpen}
          notifications={notifications}
          notificationsOpen={notificationsOpen}
          unreadCount={unreadCount}
          onToggleNotifications={() => setNotificationsOpen((v) => !v)}
          onCloseNotifications={() => setNotificationsOpen(false)}
          onOpenNotification={openNotification}
          onMarkAllNotificationsRead={markAllRead}
        />
        <div className="app-content">{children}</div>
      </div>
      <AISupportWidget open={supportOpen} onClose={() => setSupportOpen(false)} screen={active} />
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="My Profile"
        subtitle="Manage account identity and security from one place."
        size="lg"
      >
        <div className="profile-modal">
          <section className="profile-hero card">
            <div className="profile-avatar mono">{profileInitials || 'U'}</div>
            <div className="profile-hero-copy">
              <p className="profile-eyebrow">Account Identity</p>
              <h3>{profileData.name || user?.name || 'Team Member'}</h3>
              <p>{profileData.email || user?.email}</p>
            </div>
            <span className={`profile-role-badge role-${user?.role ?? 'staff'}`}>
              {(user?.role ?? 'staff').toUpperCase()}
            </span>
          </section>

          <div className="profile-grid">
            <section className="profile-card card">
              <div className="profile-card-head">
                <h4>Profile Details</h4>
                <p>Update personal details used across the platform.</p>
              </div>
              <label className="profile-field">
                <span>Full Name</span>
                <input
                  value={profileData.name}
                  onChange={(e) => setProfileData((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Your full name"
                />
              </label>
              <label className="profile-field">
                <span>Work Email</span>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData((s) => ({ ...s, email: e.target.value }))}
                  placeholder="name@restaurant.com"
                />
              </label>
              <label className="profile-field">
                <span>Phone Number</span>
                <input
                  value={profileData.phone}
                  onChange={(e) => setProfileData((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="+971500000000"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary profile-action"
                onClick={saveProfile}
                disabled={profileBusy || !profileData.name.trim() || !profileData.email.trim()}
              >
                {profileBusy ? 'Saving…' : 'Save Profile'}
              </button>
            </section>

            <section className="profile-card card">
              <div className="profile-card-head">
                <h4>Password Security</h4>
                <p>Use a strong password with at least 8 characters.</p>
              </div>
              <label className="profile-field">
                <span>Current Password</span>
                <div className="profile-secret-wrap">
                  <input
                    type={showPwdCurrent ? 'text' : 'password'}
                    value={pwdData.current}
                    onChange={(e) => setPwdData((s) => ({ ...s, current: e.target.value }))}
                    placeholder="Current password"
                  />
                  <button
                    type="button"
                    className="profile-secret-toggle"
                    onClick={() => setShowPwdCurrent((v) => !v)}
                    aria-label={showPwdCurrent ? 'Hide current password' : 'Show current password'}
                  >
                    <PasswordVisibilityIcon visible={showPwdCurrent} />
                  </button>
                </div>
              </label>
              <label className="profile-field">
                <span>New Password</span>
                <div className="profile-secret-wrap">
                  <input
                    type={showPwdNext ? 'text' : 'password'}
                    value={pwdData.next}
                    onChange={(e) => setPwdData((s) => ({ ...s, next: e.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    className="profile-secret-toggle"
                    onClick={() => setShowPwdNext((v) => !v)}
                    aria-label={showPwdNext ? 'Hide new password' : 'Show new password'}
                  >
                    <PasswordVisibilityIcon visible={showPwdNext} />
                  </button>
                </div>
              </label>
              <button
                type="button"
                className="btn btn-soft profile-action"
                onClick={savePassword}
                disabled={profileBusy || !pwdData.current || pwdData.next.length < 8}
              >
                {profileBusy ? 'Saving…' : 'Change Password'}
              </button>
            </section>

            <section className="profile-card card">
              <div className="profile-card-head">
                <h4>PIN Security</h4>
                <p>Keep your 4-digit staff PIN secure for fast login.</p>
              </div>
              <label className="profile-field">
                <span>Current PIN</span>
                <div className="profile-secret-wrap">
                  <input
                    type={showPinCurrent ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={pinData.current}
                    onChange={(e) => setPinData((s) => ({ ...s, current: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="Current 4-digit PIN"
                  />
                  <button
                    type="button"
                    className="profile-secret-toggle"
                    onClick={() => setShowPinCurrent((v) => !v)}
                    aria-label={showPinCurrent ? 'Hide current PIN' : 'Show current PIN'}
                  >
                    <PasswordVisibilityIcon visible={showPinCurrent} />
                  </button>
                </div>
              </label>
              <label className="profile-field">
                <span>New PIN</span>
                <div className="profile-secret-wrap">
                  <input
                    type={showPinNext ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={pinData.next}
                    onChange={(e) => setPinData((s) => ({ ...s, next: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="New 4-digit PIN"
                  />
                  <button
                    type="button"
                    className="profile-secret-toggle"
                    onClick={() => setShowPinNext((v) => !v)}
                    aria-label={showPinNext ? 'Hide new PIN' : 'Show new PIN'}
                  >
                    <PasswordVisibilityIcon visible={showPinNext} />
                  </button>
                </div>
              </label>
              <button
                type="button"
                className="btn btn-soft profile-action"
                onClick={savePin}
                disabled={profileBusy || pinData.current.length !== 4 || pinData.next.length !== 4}
              >
                {profileBusy ? 'Saving…' : 'Change PIN'}
              </button>
            </section>
          </div>
        </div>
      </Modal>
      {trialLock.expired && !pathname.startsWith('/license') && (
        <TrialExpiredModal purchaseUrl={trialLock.purchaseUrl} expiresAt={trialLock.expiresAt} />
      )}
    </div>
  );
}
