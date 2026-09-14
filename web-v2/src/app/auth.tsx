import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { authApi, restaurantApi, licensesApi, SESSION_EXPIRED_EVENT, SessionExpiredError, type LoginResponse, type GoogleAccountChoice } from '../services/api';
import { applyRestaurantCurrency } from '../utils/currency';
import { syncRestaurantLogoCacheAsync } from '../services/restaurantLogoStorage';
import { storageGet, storageRemove, storageSet } from '../utils/safeStorage';

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

export interface SignupData {
  restaurant_name: string;
  owner_name: string;
  email: string;
  phone: string;
  password: string;
  plan?: string;
  timezone?: string;
}

export interface GoogleChoice {
  selectionToken: string;
  accounts: GoogleAccountChoice[];
}

/** A Google user new to Cafyz: they add their restaurant details, then the trial starts. */
export interface GoogleSignup {
  signupToken: string;
  email: string;
  name: string;
  trialDays: number;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginPin: (login: string, pin: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ dev_otp?: string; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  /** Resolves with a chooser (email in several restaurants) or signup payload (new to Cafyz). */
  loginGoogle: (idToken: string) => Promise<{ choose: GoogleChoice } | { signup: GoogleSignup } | null>;
  signupGoogle: (signupToken: string, details: { restaurant_name: string; phone: string; owner_name?: string }) => Promise<void>;

  loginGoogleSelect: (selectionToken: string, restaurantId: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  /** Sync plan (and restaurant name) from API after founder approves renewal. */
  refreshPlan: () => Promise<Plan | null>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

const DEVICE_KEY = 'cafyz_device_id';
function deviceId(): string {
  let id = storageGet(DEVICE_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `dev-${crypto.randomUUID()}`
      : `dev-${Date.now().toString(36)}`;
    storageSet(DEVICE_KEY, id);
  }
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds since the saved token was issued, or null when it can't be read. */
function tokenAgeMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const iat = (JSON.parse(atob(b64)) as { iat?: unknown }).iat;
    return typeof iat === 'number' ? Date.now() - iat * 1000 : null;
  } catch {
    return null;
  }
}

let renewing = false;
/** Sliding sign-in: at most once a day, trade the saved token for a fresh year-long one. */
async function renewSessionIfStale(): Promise<void> {
  const current = storageGet('cafyz_token');
  const age = current ? tokenAgeMs(current) : null;
  if (!current || age === null || age < DAY_MS || renewing) return;
  renewing = true;
  try {
    const { token } = await authApi.refresh();
    // Skip if the user signed out or switched accounts in the meantime.
    if (token && storageGet('cafyz_token') === current) storageSet('cafyz_token', token);
  } catch {
    /* try again the next time the app opens */
  } finally {
    renewing = false;
  }
}

function readCachedUser(): AuthUser | null {
  try {
    const token = storageGet('cafyz_token');
    const stored = storageGet('cafyz_user');
    if (!token || !stored) return null;
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readCachedUser);
  const [loading, setLoading] = useState(() => {
    const token = storageGet('cafyz_token');
    if (!token) return false;
    return !readCachedUser();
  });

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  // Renew a day-old sign-in whenever the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void renewSessionIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const token = storageGet('cafyz_token');
    if (!token) {
      setLoading(false);
      return;
    }

    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    void (async () => {
      try {
        const me = await authApi.me();
        let plan: Plan = cached?.plan ?? 'basic';
        let restaurant_name = cached?.restaurant_name ?? '';
        try {
          const r = await restaurantApi.me();
          applyRestaurantCurrency(r);
          void syncRestaurantLogoCacheAsync(r);
          plan = (r.plan as Plan) ?? plan;
          restaurant_name = String(r.name ?? restaurant_name);
        } catch { /* slow or offline: keep the saved plan and name */ }

        const u: AuthUser = {
          id: String(me.id),
          name: String(me.name),
          email: String(me.email),
          initials: String(me.initials || (me.name || '?').slice(0, 2).toUpperCase()),
          role: me.role as Role,
          restaurant_id: String(me.restaurant_id),
          restaurant_name,
          plan,
        };
        storageSet('cafyz_user', JSON.stringify(u));
        setUser(u);
        void renewSessionIfStale();
      } catch (e) {
        // Only a rejected sign-in clears the device. No signal, a timeout or a server hiccup
        // keeps the saved session, so the app opens straight back in next time.
        if (e instanceof SessionExpiredError) {
          storageRemove('cafyz_token');
          storageRemove('cafyz_user');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist token, then enrich with plan + currency from the restaurant record.
  async function complete(d: LoginResponse) {
    storageSet('cafyz_token', d.token);
    let plan: Plan = ((d as unknown as { restaurant_plan?: string }).restaurant_plan as Plan) || 'basic';
    try {
      const r = await restaurantApi.me();
      if (r.plan) plan = r.plan as Plan;
      applyRestaurantCurrency(r);
      void syncRestaurantLogoCacheAsync(r);
    } catch { /* keep login-response plan */ }
    const u: AuthUser = { ...baseUser(d), plan };
    storageSet('cafyz_user', JSON.stringify(u));
    setUser(u);
  }

  const loginEmail = async (login: string, password: string) => {
    const d = await authApi.login(login.trim(), password, deviceId());
    await complete(d);
  };
  const loginPin = async (login: string, pin: string) => {
    const d = await authApi.pin(login.trim(), pin, deviceId());
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

  // Google sign-in. A 409 is not an error: the address matches accounts in more
  // than one restaurant, so the caller shows a picker and finishes via select().
  const loginGoogle = async (idToken: string) => {
    const d = await authApi.google(idToken);
    if (d.status === 'choose_account') {
      return { choose: { selectionToken: d.selection_token, accounts: d.accounts } };
    }
    if (d.status === 'signup_required') {
      return { signup: { signupToken: d.signup_token, email: d.email, name: d.name, trialDays: d.trial_days } };
    }
    await complete(d);
    return null;
  };
  const signupGoogle = async (signupToken: string, details: { restaurant_name: string; phone: string; owner_name?: string }) => {
    let timezone: string | undefined;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* server defaults to UTC */ }
    const d = await authApi.googleSignup({ signup_token: signupToken, ...details, timezone });
    await complete(d);
  };
  const loginGoogleSelect = async (selectionToken: string, restaurantId: string) => {
    const d = await authApi.googleSelect(selectionToken, restaurantId);
    await complete(d);
  };

  // Free-trial / new-account signup: create the restaurant + owner, then sign in.
  const signup = async (data: SignupData) => {
    const email = data.email.trim().toLowerCase();
    const created = await authApi.onboarding({
      restaurant_name: data.restaurant_name.trim(),
      owner_name: data.owner_name.trim(),
      email,
      phone: data.phone.trim(),
      password: data.password,
      plan: data.plan,
      timezone: data.timezone,
    });
    await complete({
      token: created.token,
      restaurant_id: String(created.restaurant.id),
      restaurant_name: String(created.restaurant.name),
      restaurant_plan: String(created.restaurant.plan),
      user: {
        id: String(created.user.id),
        name: String(created.user.name),
        initials: String(created.user.initials ?? ''),
        email: String(created.user.email),
        role: String(created.user.role),
      },
    } as LoginResponse);
  };

  function logout() {
    storageRemove('cafyz_token');
    storageRemove('cafyz_user');
    setUser(null);
  }

  const refreshPlan = useCallback(async (): Promise<Plan | null> => {
    let next: Plan | null = null;
    try {
      const [r, sub] = await Promise.all([
        restaurantApi.me(),
        licensesApi.mine().catch(() => null),
      ]);
      setUser(prev => {
        if (!prev) return prev;
        const plan = (sub?.plan ?? r.plan ?? prev.plan) as Plan;
        next = plan;
        const u: AuthUser = {
          ...prev,
          plan,
          restaurant_name: String(r.name ?? prev.restaurant_name),
        };
        storageSet('cafyz_user', JSON.stringify(u));
        return u;
      });
      if (r.currency_code || r.currency_symbol) applyRestaurantCurrency(r);
      return next;
    } catch {
      return null;
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, loginEmail, loginPin, requestOtp, verifyOtp, loginGoogle, loginGoogleSelect, signupGoogle, signup, logout, refreshPlan }}>
      {children}
    </Ctx.Provider>
  );
}
