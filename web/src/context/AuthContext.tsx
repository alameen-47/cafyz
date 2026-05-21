import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Screen } from '@shared/types';
import { authApi, type ApiUser } from '../services/api';

// ── Role types ────────────────────────────────────────────────────────────────
export type Role = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  restaurant_id: string;
  restaurant_name: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, error: '',
  login: async () => {}, loginWithPin: async () => {},
  logout: () => {}, clearError: () => {},
});

// ── Role metadata ─────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  owner:   'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  waiter:  'Waiter',
  kitchen: 'Kitchen Staff',
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  owner:   '/',
  manager: '/',
  cashier: '/pos',
  waiter:  '/tables',
  kitchen: '/kds',
};

export const ROLE_NAV: Record<Role, Screen[]> = {
  owner:   ['manager', 'pos', 'waiter', 'kds', 'menu', 'inventory', 'staff', 'reports', 'roles'],
  manager: ['manager', 'pos', 'waiter', 'kds', 'menu', 'inventory', 'staff', 'reports', 'roles'],
  cashier: ['pos', 'menu', 'inventory', 'reports', 'roles'],
  waiter:  ['waiter'],
  kitchen: ['kds'],
};

// Demo accounts — quick-login buttons call the real API with these credentials
export const DEMO_ACCOUNTS = [
  { email: 'mireille@saint.paris', password: 'cafyz2026', role: 'manager' as Role, name: 'Mireille Vasseur', initials: 'MV' },
  { email: 'thomas@saint.paris',   password: 'cafyz2026', role: 'cashier' as Role, name: 'Thomas Durand',    initials: 'TD' },
  { email: 'jules@saint.paris',    password: 'cafyz2026', role: 'waiter'  as Role, name: 'Jules Renard',     initials: 'JR' },
  { email: 'ines@saint.paris',     password: 'cafyz2026', role: 'kitchen' as Role, name: 'Inès Moreau',      initials: 'IM' },
];

// PIN map for demo quick access (PIN login goes through the real API)
export const DEMO_PINS: Record<Role, string> = {
  owner: '0000', manager: '1234', cashier: '5678', waiter: '9012', kitchen: '3456',
};

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_TOKEN = 'cafyz_token';
const KEY_USER  = 'cafyz_user';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toAuthUser(u: ApiUser, restaurantName: string): AuthUser {
  return {
    id:              u.id,
    name:            u.name,
    initials:        u.initials || u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    email:           u.email,
    role:            u.role as Role,
    restaurant_id:   u.restaurant_id,
    restaurant_name: restaurantName,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Restore persisted session on mount
  useEffect(() => {
    const stored = localStorage.getItem(KEY_USER);
    const token  = localStorage.getItem(KEY_TOKEN);
    if (stored && token) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem(KEY_USER); localStorage.removeItem(KEY_TOKEN); }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    setError('');
    const data = await authApi.login(email, password);
    localStorage.setItem(KEY_TOKEN, data.token);
    const authUser = toAuthUser(data.user, data.restaurant_name ?? '');
    localStorage.setItem(KEY_USER, JSON.stringify(authUser));
    setUser(authUser);
  }

  async function loginWithPin(pin: string) {
    setError('');
    const data = await authApi.pin(pin);
    localStorage.setItem(KEY_TOKEN, data.token);
    const authUser = toAuthUser(data.user, data.restaurant_name ?? '');
    localStorage.setItem(KEY_USER, JSON.stringify(authUser));
    setUser(authUser);
  }

  function logout() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginWithPin, logout, clearError: () => setError('') }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
