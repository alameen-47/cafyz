import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Screen } from '@shared/types';
import { authApi, restaurantApi, type ApiUser } from '../services/api';
import { syncRestaurantLogoCache } from '../services/restaurantLogoStorage';
import { getAllowedScreens, type Plan } from '../config/planAccess';

// ── Role & Plan types ─────────────────────────────────────────────────────────
export type Role = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'founder';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  restaurant_id: string;
  restaurant_name: string;
  plan: Plan;
  allowedScreens: Screen[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshPlan: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, error: '',
  login: async () => {}, loginWithPin: async () => {},
  logout: () => {}, clearError: () => {}, refreshPlan: async () => {},
});

// ── Role metadata ─────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  owner:   'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  waiter:  'Waiter',
  kitchen: 'Kitchen Staff',
  founder: 'Founder',
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  owner:   '/',
  manager: '/',
  cashier: '/pos',
  waiter:  '/tables',
  kitchen: '/kds',
  founder: '/founder',
};

// Legacy nav (used in places that haven't migrated to plan-aware yet)
export const ROLE_NAV: Record<Role, Screen[]> = {
  owner:   ['manager','tableSetup','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  manager: ['manager','tableSetup','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  cashier: ['pos','menu','inventory','reports','roles','license'],
  waiter:  ['waiter','license'],
  kitchen: ['kds','license'],
  founder: ['founder'],
};

// Demo accounts intentionally removed for production data flow.
export const DEMO_ACCOUNTS: Array<{ email: string; password: string; role: Role; name: string; initials: string }> = [];
export const DEMO_PINS: Record<string, string> = {};

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_TOKEN = 'cafyz_token';
const KEY_USER  = 'cafyz_user';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAuthUser(u: ApiUser, restaurantName: string, plan: string): AuthUser {
  const safePlan = (['basic','pro','premium'].includes(plan) ? plan : 'basic') as Plan;
  const role = u.role as Role;
  return {
    id:              u.id,
    name:            u.name,
    initials:        u.initials || u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    email:           u.email,
    role,
    restaurant_id:   u.restaurant_id,
    restaurant_name: restaurantName,
    plan:            safePlan,
    allowedScreens:  getAllowedScreens(safePlan, role),
  };
}

async function syncLogoForStaff(user: AuthUser) {
  if (user.role === 'founder' || !user.restaurant_id) return;
  try {
    const rest = await restaurantApi.me();
    syncRestaurantLogoCache(rest);
  } catch {
    // non-fatal — logo falls back on next restaurant fetch
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(KEY_USER);
    const token  = localStorage.getItem(KEY_TOKEN);
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(buildAuthUser(
          {
            id: parsed.id,
            name: parsed.name,
            initials: parsed.initials,
            email: parsed.email,
            role: parsed.role as ApiUser['role'],
            status: 'active',
            restaurant_id: parsed.restaurant_id,
            start_time: '—',
          },
          parsed.restaurant_name ?? '',
          parsed.plan ?? 'basic',
        ));
        setLoading(false);
        authApi.me().catch(() => {
          localStorage.removeItem(KEY_TOKEN);
          localStorage.removeItem(KEY_USER);
          setUser(null);
        });
        restaurantApi.me()
          .then(rest => syncRestaurantLogoCache(rest))
          .catch(() => {});
      } catch {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_TOKEN);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    setError('');
    const data = await authApi.login(email, password);
    localStorage.setItem(KEY_TOKEN, data.token);
    const plan = (data as any).restaurant_plan ?? 'basic';
    const authUser = buildAuthUser(data.user, data.restaurant_name ?? '', plan);
    localStorage.setItem(KEY_USER, JSON.stringify(authUser));
    setUser(authUser);
    await syncLogoForStaff(authUser);
  }

  async function loginWithPin(pin: string) {
    setError('');
    const data = await authApi.pin(pin);
    localStorage.setItem(KEY_TOKEN, data.token);
    const plan = (data as any).restaurant_plan ?? 'basic';
    const authUser = buildAuthUser(data.user, data.restaurant_name ?? '', plan);
    localStorage.setItem(KEY_USER, JSON.stringify(authUser));
    setUser(authUser);
    await syncLogoForStaff(authUser);
  }

  async function refreshPlan() {
    if (!user) return;
    try {
      const rest = await restaurantApi.me();
      syncRestaurantLogoCache(rest);
      const updated = buildAuthUser(
        { id: user.id, name: user.name, initials: user.initials, email: user.email,
          role: user.role as any, status: 'active', restaurant_id: user.restaurant_id, start_time: '—' },
        user.restaurant_name,
        rest.plan ?? 'basic',
      );
      localStorage.setItem(KEY_USER, JSON.stringify(updated));
      setUser(updated);
    } catch {}
  }

  function logout() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginWithPin, logout, clearError: () => setError(''), refreshPlan }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
