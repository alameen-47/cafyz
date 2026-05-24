import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Screen } from '@shared/types';
import { authApi, type ApiUser } from '../services/api';
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
  owner:   ['manager','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  manager: ['manager','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  cashier: ['pos','menu','inventory','reports','roles','license'],
  waiter:  ['waiter','license'],
  kitchen: ['kds','license'],
  founder: ['founder'],
};

// Demo accounts
export const DEMO_ACCOUNTS = [
  { email: 'mireille@saint.paris', password: 'cafyz2026', role: 'manager' as Role, name: 'Mireille Vasseur', initials: 'MV' },
  { email: 'thomas@saint.paris',   password: 'cafyz2026', role: 'cashier' as Role, name: 'Thomas Durand',    initials: 'TD' },
  { email: 'jules@saint.paris',    password: 'cafyz2026', role: 'waiter'  as Role, name: 'Jules Renard',     initials: 'JR' },
  { email: 'ines@saint.paris',     password: 'cafyz2026', role: 'kitchen' as Role, name: 'Inès Moreau',      initials: 'IM' },
];

export const DEMO_PINS: Record<string, string> = {
  owner: '0000', manager: '1234', cashier: '5678', waiter: '9012', kitchen: '3456',
};

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
        setUser(JSON.parse(stored));
        setLoading(false);
        authApi.me().catch(() => {
          localStorage.removeItem(KEY_TOKEN);
          localStorage.removeItem(KEY_USER);
          setUser(null);
        });
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
  }

  async function loginWithPin(pin: string) {
    setError('');
    const data = await authApi.pin(pin);
    localStorage.setItem(KEY_TOKEN, data.token);
    const plan = (data as any).restaurant_plan ?? 'basic';
    const authUser = buildAuthUser(data.user, data.restaurant_name ?? '', plan);
    localStorage.setItem(KEY_USER, JSON.stringify(authUser));
    setUser(authUser);
  }

  async function refreshPlan() {
    if (!user) return;
    try {
      const rest = await (await fetch('/api/restaurants/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem(KEY_TOKEN)}` },
      })).json();
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
