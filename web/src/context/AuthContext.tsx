import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Screen } from '@shared/types';

export type Role = 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen: 'Kitchen Staff',
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  manager: '/',
  cashier: '/pos',
  waiter: '/tables',
  kitchen: '/kds',
};

export const ROLE_NAV: Record<Role, Screen[]> = {
  manager: ['manager', 'pos', 'waiter', 'kds', 'menu', 'inventory', 'staff', 'reports', 'roles'],
  cashier: ['pos', 'menu', 'inventory', 'reports', 'roles'],
  waiter: ['waiter'],
  kitchen: ['kds'],
};

export const DEMO_ACCOUNTS: AuthUser[] = [
  { id: '1', name: 'Mireille Vasseur', initials: 'MV', email: 'mireille@saint.paris', role: 'manager' },
  { id: '2', name: 'Thomas Durand',    initials: 'TD', email: 'thomas@saint.paris',   role: 'cashier' },
  { id: '3', name: 'Jules Renard',     initials: 'JR', email: 'jules@saint.paris',    role: 'waiter' },
  { id: '4', name: 'Inès Moreau',      initials: 'IM', email: 'ines@saint.paris',     role: 'kitchen' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  return (
    <AuthContext.Provider value={{ user, login: setUser, logout: () => setUser(null) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
