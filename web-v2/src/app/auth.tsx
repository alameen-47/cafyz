import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, restaurantApi, type LoginResponse } from '../services/api';
import { setActiveCurrencyCode } from '../utils/currency';

export type Role = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'founder';
export type Plan = 'basic' | 'pro' | 'premium';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
  restaurant_id: string;
  restaurant_name: string;
  plan: Plan;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginPin: (email: string, pin: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ dev_otp?: string; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

const DEVICE_KEY = 'cafyz_device_id';
function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

function baseUser(d: LoginResponse): Omit<AuthUser, 'plan'> {
  const u = d.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: u.initials || (u.name || '?').slice(0, 2).toUpperCase(),
    role: u.role as Role,
    restaurant_id: d.restaurant_id,
    restaurant_name: d.restaurant_name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cafyz_user');
    const token = localStorage.getItem('cafyz_token');
    if (stored && token) {
      try { setUser(JSON.parse(stored) as AuthUser); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  // Persist token, then enrich with plan + currency from the restaurant record.
  async function complete(d: LoginResponse) {
    localStorage.setItem('cafyz_token', d.token);
    let plan: Plan = ((d as unknown as { restaurant_plan?: string }).restaurant_plan as Plan) || 'basic';
    try {
      const r = await restaurantApi.me();
      if (r.plan) plan = r.plan as Plan;
      setActiveCurrencyCode(r.currency_code);
    } catch { /* keep login-response plan */ }
    const u: AuthUser = { ...baseUser(d), plan };
    localStorage.setItem('cafyz_user', JSON.stringify(u));
    setUser(u);
  }

  const loginEmail = async (email: string, password: string) => {
    const d = await authApi.login(email.trim().toLowerCase(), password, deviceId());
    await complete(d);
  };
  const loginPin = async (email: string, pin: string) => {
    const d = await authApi.pin(email.trim().toLowerCase(), pin, deviceId());
    await complete(d);
  };
  const requestOtp = async (phone: string) => {
    const r = await authApi.requestOtp(phone.trim());
    return { dev_otp: r.dev_otp, message: r.message };
  };
  const verifyOtp = async (phone: string, otp: string) => {
    const d = await authApi.verifyOtp(phone.trim(), otp);
    await complete(d);
  };

  function logout() {
    localStorage.removeItem('cafyz_token');
    localStorage.removeItem('cafyz_user');
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, loginEmail, loginPin, requestOtp, verifyOtp, logout }}>
      {children}
    </Ctx.Provider>
  );
}
