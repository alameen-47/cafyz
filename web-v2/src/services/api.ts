// ─── Cafyz API Client ────────────────────────────────────────────────────────
// Tenant-scoped HTTP client. JWT is stored in localStorage and attached to
// every request. On 401 the session is cleared and the user is redirected.
import { Capacitor } from '@capacitor/core';
import { toastBus } from './toastBus';
import { setActiveCurrencyCode } from '../utils/currency';
import { tt } from '../i18n/translateToast';

// In dev, relative URLs go through the Vite proxy (→ localhost:4000).
// Native USB/emulator dev uses http://localhost:4000 with `adb reverse tcp:4000 tcp:4000`.
// Production native builds use VITE_NATIVE_API_URL (Render) unless VITE_API_URL is set.
const ENV = (import.meta as any).env ?? {};
const ENV_BASE = String(ENV.VITE_API_URL ?? '').trim();
const IS_DEV = Boolean(ENV.DEV);
const DEFAULT_RENDER_BASE = String(ENV.VITE_NATIVE_API_URL ?? 'https://cafyz.onrender.com').trim();

function resolveApiBase(): string {
  const explicit = ENV_BASE.replace(/\/$/, '');
  if (explicit) return explicit;
  if (IS_DEV && Capacitor.isNativePlatform()) {
    return 'http://localhost:4000';
  }
  if (IS_DEV) return '';
  return DEFAULT_RENDER_BASE.replace(/\/$/, '');
}

const BASE = resolveApiBase();
let sessionToastShown = false;
const REQUEST_TIMEOUT_MS = 30_000;
const inflightGets = new Map<string, Promise<unknown>>();

/** Dispatched when the API returns 402 TRIAL_EXPIRED — App listens to lock the shell. */
export const TRIAL_EXPIRED_EVENT = 'cafyz:trial-expired';

const DEVICE_KEY = 'cafyz_device_id';

/** Stable id for trial-request cooldown + auth device binding. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || id.length < 10) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const bodyObj = body && typeof body === 'object'
    ? (body as Record<string, unknown>)
    : null;
  const isPrinterAssignmentSync =
    method === 'PUT'
    && path.startsWith('/api/restaurants/me')
    && !!bodyObj
    && ('kitchen_printer' in bodyObj || 'cashier_printer' in bodyObj);

  const token = localStorage.getItem('cafyz_token');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Request timed out — check your connection and try again.');
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    localStorage.removeItem('cafyz_token');
    localStorage.removeItem('cafyz_user');
    // Only hard-redirect on interactive requests (not background polling /me validation)
    if (!path.includes('/api/auth/me')) {
      window.location.href = '/login';
      if (!sessionToastShown) {
        sessionToastShown = true;
        const sessionMsg = 'Session expired — please sign in again.';
        toastBus.error(sessionMsg);
      }
      throw new Error('Session expired — please sign in again.');
    }
    throw new Error('Session expired — please sign in again.');
  }

  if (res.status === 402) {
    const trialPayload = await res.json().catch(() => ({} as { code?: string; error?: string }));
    if (trialPayload.code === 'TRIAL_EXPIRED') {
      window.dispatchEvent(new CustomEvent(TRIAL_EXPIRED_EVENT, { detail: trialPayload }));
    }
    throw new Error(trialPayload.error ?? 'Subscription expired — renew to continue.');
  }

  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    const message = data.error ?? res.statusText;
    const shouldToastError =
      method !== 'GET'
      && !isPrinterAssignmentSync
      && !path.startsWith('/api/kds/print-jobs/claim')
      && !path.startsWith('/api/kds/print-jobs/')
      && !path.startsWith('/api/notifications/');
    if (shouldToastError) toastBus.error(String(message));
    throw new Error(message);
  }
  const shouldToastSuccess =
    method !== 'GET'
    && !isPrinterAssignmentSync
    && !path.startsWith('/api/auth/')
    && !path.includes('/status')
    // Background KDS print queue calls are polled frequently.
    // Never show automatic success toasts for these non-interactive operations.
    && !path.startsWith('/api/kds/print-jobs/claim')
    && !path.startsWith('/api/kds/print-jobs/')
    && !path.startsWith('/api/notifications/');
  if (shouldToastSuccess) {
    const successMessage = method === 'DELETE'
      ? tt('Removed successfully')
      : method === 'POST'
      ? tt('Saved successfully')
      : tt('Updated successfully');
    toastBus.success(successMessage);
  }
  if (path.startsWith('/api/restaurants/me') && data && typeof data === 'object') {
    const maybeCode = (data as { currency_code?: unknown }).currency_code;
    if (typeof maybeCode === 'string') setActiveCurrencyCode(maybeCode);
    // UI language is chosen by the user (login/header); do not override from restaurant settings.
  }
  return data as T;
}

const get = <T = unknown>(path: string) => {
  const existing = inflightGets.get(path);
  if (existing) return existing as Promise<T>;
  const promise = request<T>('GET', path).finally(() => inflightGets.delete(path));
  inflightGets.set(path, promise);
  return promise;
};
const post = <T = unknown>(path: string, body: unknown)     => request<T>('POST',   path, body);
const put  = <T = unknown>(path: string, body: unknown)     => request<T>('PUT',    path, body);
const patch= <T = unknown>(path: string, body?: unknown)    => request<T>('PATCH',  path, body);
const del  = <T = unknown>(path: string, body?: unknown)     => request<T>('DELETE', path, body);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (login: string, password: string, device_id?: string) =>
    post<LoginResponse>('/api/auth/login', { login, password, device_id }),
  requestOtp: (phone: string) =>
    post<{ ok: boolean; message: string; dev_otp?: string }>('/api/auth/request-otp', { phone }),
  verifyOtp: (phone: string, otp: string) =>
    post<LoginResponse>('/api/auth/verify-otp', { phone, otp }),
  pin: (email: string, pin: string, device_id: string) =>
    post<LoginResponse>('/api/auth/pin', { email, pin, device_id }),
  forgotPassword: (email: string) =>
    post<{ ok: boolean; message: string; dev_reset_url?: string }>('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    post<{ ok: boolean; message: string }>('/api/auth/reset-password', { token, password }),
  me: () => get<ApiUser>('/api/auth/me'),
  updateProfile: (d: { name?: string; phone?: string; email?: string }) =>
    put<ApiUser>('/api/auth/profile', d),
  changePassword: (current_password: string, new_password: string) =>
    post<{ ok: boolean; message: string }>('/api/auth/change-password', { current_password, new_password }),
  changePin: (current_pin: string, new_pin: string) =>
    post<{ ok: boolean; message: string }>('/api/auth/change-pin', { current_pin, new_pin }),
  onboarding: (data: {
    restaurant_name: string; owner_name: string;
    email: string; phone: string; password: string; plan?: string; timezone?: string;
  }) => post<{ token: string; user: ApiUser; restaurant: ApiRestaurant }>('/api/restaurants/onboarding', data),
};

// ── Restaurant ────────────────────────────────────────────────────────────────
export const restaurantApi = {
  me:       ()                                              => get<ApiRestaurant>('/api/restaurants/me'),
  update:   (d: {
    name?: string; tagline?: string; timezone?: string; logo_url?: string;
    contact_phone?: string; contact_email?: string;
    address_line1?: string; address_line2?: string;
    city?: string; country?: string; postal_code?: string;
    tax_id?: string; website_url?: string;
    currency_code?: string; language_code?: string; date_format?: string;
    service_charge_pct?: number | null; tax_rate_pct?: number | null;
    tax_type?: string; tax_included?: boolean;
    receipt_footer?: string;
    kitchen_printer?: { role?: 'kitchen'; channel: 'bluetooth' | 'usb'; name: string } | null;
    cashier_printer?: { role?: 'cashier'; channel: 'bluetooth' | 'usb'; name: string } | null;
  }) => put<ApiRestaurant>('/api/restaurants/me', d),
  branches: ()                                             => get<ApiRestaurant[]>('/api/restaurants/branches'),
  // Logo upload reuses the tenant-scoped Cloudinary endpoint; the returned URL
  // is stored on the restaurant via update({ logo_url }).
  uploadLogo: (file: File) => menuApi.uploadImage(file),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:         ()                                                            => get<ApiUser[]>('/api/users'),
  create:       (d: CreateUserPayload)                                        => post<ApiUser>('/api/users', d),
  update:       (id: string, d: Partial<CreateUserPayload>)                   => put<ApiUser>(`/api/users/${id}`, d),
  updateStatus: (id: string, status: 'active' | 'break' | 'off')             => patch<{ id: string; status: string }>(`/api/users/${id}/status`, { status }),
  delete:       (id: string)                                                  => del(`/api/users/${id}`),
};

// ── Menu ──────────────────────────────────────────────────────────────────────
// ── Public customer menu (no auth) ─────────────────────────────────────────────
export interface PublicMenuItem {
  id: string; name: string; category: string; price: number;
  description: string; image_url?: string | null; is_popular: number;
}
export interface PublicMenuResponse {
  restaurant: {
    id: string; name: string; logo_url?: string | null; currency_code: string;
    city?: string | null; country?: string | null; tagline?: string | null;
  };
  categories: { slug: string; label: string; sort_order: number }[];
  items: PublicMenuItem[];
}

export const publicApi = {
  // Fetched by the public /m/:restaurantId page — never attaches a token.
  menu: async (restaurantId: string, opts?: { fresh?: boolean }): Promise<PublicMenuResponse> => {
    const bust = opts?.fresh ? `?_=${Date.now()}` : '';
    const res = await fetch(`${BASE}/api/public/menu/${encodeURIComponent(restaurantId)}${bust}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || 'This menu is unavailable.');
    }
    return res.json() as Promise<PublicMenuResponse>;
  },
};

export const menuApi = {
  list:   (category?: string, opts?: { all?: boolean }) => {
    const qs = new URLSearchParams();
    if (category && category !== 'all') qs.set('category', category);
    if (opts?.all) qs.set('all', '1');
    const q = qs.toString();
    return get<ApiMenuItem[]>(`/api/menu${q ? `?${q}` : ''}`);
  },
  create: (d: CreateMenuItemPayload)                                          => post<ApiMenuItem>('/api/menu', d),
  update: (id: string, d: Partial<CreateMenuItemPayload>)                     => put<ApiMenuItem>(`/api/menu/${id}`, d),
  delete: (id: string)                                                        => del(`/api/menu/${id}`),
  uploadImage: async (file: File): Promise<{ url: string; public_id: string }> => {
    const token = localStorage.getItem('cafyz_token');
    const form = new FormData();
    form.append('image', file, file.name || 'menu-item.jpg');
    const res = await fetch(`${BASE}/api/menu/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (res.status === 401) {
      localStorage.removeItem('cafyz_token');
      localStorage.removeItem('cafyz_user');
      window.location.href = '/login';
      throw new Error('Session expired — please sign in again.');
    }
    let data: { error?: string; url?: string; public_id?: string } = {};
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || res.statusText || 'Upload failed');
    }
    if (!res.ok) {
      throw new Error(data.error ?? res.statusText ?? 'Upload failed');
    }
    if (!data.url) throw new Error('Upload succeeded but no image URL was returned.');
    return { url: data.url, public_id: data.public_id ?? '' };
  },
};

export const menuCategoriesApi = {
  list:   () => get<ApiMenuCategory[]>('/api/menu/categories'),
  create: (d: { label: string; slug?: string; sort_order?: number }) =>
    post<ApiMenuCategory>('/api/menu/categories', d),
  update: (id: string, d: { label?: string; sort_order?: number }) =>
    put<ApiMenuCategory>(`/api/menu/categories/${id}`, d),
  delete: (id: string) => del(`/api/menu/categories/${id}`),
};

// ── Tables ────────────────────────────────────────────────────────────────────
export const tablesApi = {
  list:         ()                                                             => get<ApiTable[]>('/api/tables'),
  update:       (id: string, d: Partial<{ name: string; zone: string; capacity: number; status: string }>) =>
    put<ApiTable>(`/api/tables/${id}`, d),
  updateStatus: (id: string, d: { status: string; course?: string; covers?: number; elapsed_min?: number }) =>
    patch<ApiTable>(`/api/tables/${id}/status`, d),
  create:       (d: { name: string; zone: string; capacity: number })          => post<ApiTable>('/api/tables', d),
  delete:       (id: string)                                                   => del(`/api/tables/${id}`),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list:         (p?: { status?: string; table_id?: string })                  =>
    get<ApiOrder[]>(`/api/orders${p ? `?${new URLSearchParams(p as Record<string, string>)}` : ''}`),
  live:         (p?: { active?: boolean })                                      =>
    get<ApiLiveOrder[]>(`/api/orders/live${p?.active ? '?active=1' : ''}`),
  get:          (id: string)                                                  => get<ApiOrder>(`/api/orders/${id}`),
  create:       (d: { table_id?: string; covers?: number; note?: string })    => post<ApiOrder>('/api/orders', d),
  update:       (id: string, d: { covers?: number; note?: string; order_type?: 'dine_in' | 'parcel' }) =>
    put<ApiOrder>(`/api/orders/${id}`, d),
  // One-shot create + send to kitchen in a single batched request (fast print).
  // Pass enqueue_print:false when printing locally on this device to skip the cloud queue.
  quickSend:    (d: { table_id: string; covers?: number; note?: string; parcel?: boolean; enqueue_print?: boolean; items: { menu_item_id: string; qty: number; mods?: string[] }[] }) =>
    post<{ id: string; ticket_id: string; status: string }>('/api/orders/quick-send', d),
  // Cloud-print fallback if a local same-device print fails.
  enqueuePrint: (orderId: string) => post<{ ok: boolean }>(`/api/orders/${orderId}/enqueue-print`, {}),
  // Atomically settle ALL active orders on a table + clear it (prevents leftover bills).
  settleTable:  (tableId: string) => post<{ ok: boolean; settled: number }>('/api/orders/settle-table', { table_id: tableId }),
  updateStatus: (id: string, status: string)                                  => patch<{ id: string; status: string }>(`/api/orders/${id}/status`, { status }),
  advanceKitchen: (id: string, action: 'fire' | 'ready' | 'delivered')         =>
    patch<{ order_id: string; ticket_id: string; status: string }>(`/api/orders/${id}/kitchen-progress`, { action }),
  addItem:      (orderId: string, d: { menu_item_id: string; qty: number; mods?: string[] }) =>
    post<ApiOrderItem>(`/api/orders/${orderId}/items`, d),
  updateItem:   (orderId: string, itemId: string, d: { qty?: number; mods?: string[] }) =>
    put<ApiOrderItem>(`/api/orders/${orderId}/items/${itemId}`, d),
  deleteItem:   (orderId: string, itemId: string)                             => del(`/api/orders/${orderId}/items/${itemId}`),
  delete:       (id: string)                                                  => del(`/api/orders/${id}`),
};

// ── KDS ───────────────────────────────────────────────────────────────────────
export const kdsApi = {
  list:      (p?: { status?: string; station?: string })                      =>
    get<ApiKdsTicket[]>(`/api/kds/tickets${p ? `?${new URLSearchParams(p as Record<string, string>)}` : ''}`),
  create:    (d: CreateKdsTicketPayload)                                      => post<ApiKdsTicket>('/api/kds/tickets', d),
  fire:      (id: string)                                                     => patch<{ id: string; status: string }>(`/api/kds/tickets/${id}/fire`),
  ready:     (id: string)                                                     => patch<{ id: string; status: string }>(`/api/kds/tickets/${id}/ready`),
  delivered: (id: string)                                                     => patch<{ id: string; status: string }>(`/api/kds/tickets/${id}/delivered`),
  setVip:    (id: string, vip: boolean)                                       => patch<{ id: string; vip: number }>(`/api/kds/tickets/${id}/vip`, { vip }),
  claimPrintJob: (device_id?: string)                                         =>
    post<{ job: ApiKitchenPrintJob | null }>('/api/kds/print-jobs/claim', { device_id }),
  claimPrintJobWait: (device_id?: string, wait_ms = 15000)                    =>
    post<{ job: ApiKitchenPrintJob | null }>('/api/kds/print-jobs/claim-wait', { device_id, wait_ms }),
  completePrintJob: (id: string, status: 'printed' | 'failed', error?: string) =>
    patch<{ id: string; status: string }>(`/api/kds/print-jobs/${id}`, { status, error }),
  delete:    (id: string)                                                     => del(`/api/kds/tickets/${id}`),
};

// ── Reservations ──────────────────────────────────────────────────────────────
export const reservationsApi = {
  list:   (p?: { status?: string; date?: string })  =>
    get<ApiReservation[]>(`/api/reservations${p ? `?${new URLSearchParams(p as Record<string, string>)}` : ''}`),
  create: (d: { guest_name: string; covers: number; res_time: string; note?: string; table_id?: string }) =>
    post<ApiReservation>('/api/reservations', d),
  update: (id: string, d: Partial<{ guest_name: string; status: string; covers: number; res_time: string; note: string; table_id: string }>) =>
    put<ApiReservation>(`/api/reservations/${id}`, d),
  delete: (id: string) => del(`/api/reservations/${id}`),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list:   ()                                                                  => get<ApiInventoryItem[]>('/api/inventory'),
  create: (d: { name: string; par: number; current: number; unit: string })   => post<ApiInventoryItem>('/api/inventory', d),
  update: (id: string, d: Partial<{ name: string; par: number; current: number; unit: string; alert: boolean }>) =>
    put<ApiInventoryItem>(`/api/inventory/${id}`, d),
  delete: (id: string)                                                        => del(`/api/inventory/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export type RevenuePeriod = 'day' | 'week' | 'month' | 'range';

export interface RevenueQueryParams {
  period?: RevenuePeriod;
  date?:  string;
  month?: string;
  from?:  string;
  to?:    string;
}

function revenueQueryString(q?: RevenueQueryParams): string {
  if (!q) return '';
  const p = new URLSearchParams();
  if (q.period) p.set('period', q.period);
  if (q.date)   p.set('date', q.date);
  if (q.month)  p.set('month', q.month);
  if (q.from)   p.set('from', q.from);
  if (q.to)     p.set('to', q.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const dashboardApi = {
  stats:   () => get<ApiDashboardStats>('/api/dashboard/stats'),
  revenue: (q?: RevenueQueryParams) =>
    get<ApiRevenueResponse>(`/api/dashboard/revenue${revenueQueryString(q)}`),
  soldItems: (q?: RevenueQueryParams) =>
    get<ApiSoldItemsResponse>(`/api/dashboard/sold-items${revenueQueryString(q)}`),
  analytics: (q?: RevenueQueryParams) =>
    get<ApiAnalyticsResponse>(`/api/dashboard/analytics${revenueQueryString(q)}`),
};

export type ApiNotificationType = 'order' | 'kds' | 'stock' | 'reservation' | 'system';

export interface ApiNotification {
  id: string;
  key: string;
  type: ApiNotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  page?: string;
  meta?: string;
}

export interface ApiNotificationsResponse {
  items: ApiNotification[];
  unread: number;
  pushEnabled: boolean;
}

export const notificationsApi = {
  list: () => get<ApiNotificationsResponse>('/api/notifications'),
  markRead: (keys: string[]) => post<{ ok: boolean }>('/api/notifications/read', { keys }),
  markAllRead: () => post<{ ok: boolean }>('/api/notifications/read-all', {}),
  registerPushToken: (token: string, platform: 'android' | 'ios' | 'web') =>
    put<{ ok: boolean; registered: boolean; pushEnabled: boolean }>('/api/notifications/push-token', { token, platform }),
  unregisterPushToken: (token: string) =>
    del('/api/notifications/push-token', { token }),
};

// ── Public plans (founder-controlled pricing + feature gates) ─────────────────
export const plansApi = {
  list: () => get<ApiPlanConfig[]>('/api/public/plans'),
};

// ── Licenses ──────────────────────────────────────────────────────────────────
export const licensesApi = {
  mine:     ()                                                             => get<ApiSubscriptionStatus>('/api/licenses/mine'),
  list:     ()                                                             => get<ApiLicenseKey[]>('/api/licenses'),
  generate: (d: { plan: string; note?: string; expires_at?: string; quantity?: number; trial?: boolean; recipient_email?: string }) =>
    post<ApiLicenseKey | ApiLicenseKey[]>('/api/licenses', d),
  activate: (key_code: string)                                            => post<{ success: boolean; plan: string; activated_at: string }>('/api/licenses/activate', { key_code }),
  revoke:   (id: string)                                                  => del(`/api/licenses/${id}`),
  requestPurchase: (d: { plan: string; email?: string; note?: string })   =>
    post<{ id: string; status: string; plan: string; email: string }>('/api/licenses/purchase-request', d),
  myPurchaseRequests: ()                                                   =>
    get<ApiLicensePurchaseRequest[]>('/api/licenses/purchase-requests/mine'),
};

// ── Inquiries (public — no auth) ──────────────────────────────────────────────
export const inquiryApi = {
  submit: (d: { name: string; restaurant_name: string; email: string; phone: string; plan: string; message?: string }) =>
    post<{ ok: boolean; message: string; trial_days?: number }>('/api/inquiries', { ...d, device_id: getDeviceId() }),
};

// ── Founder ───────────────────────────────────────────────────────────────────
export const founderApi = {
  restaurants:    ()                                                                    => get<ApiFounderRestaurant[]>('/api/founder/restaurants'),
  stats:          ()                                                                    => get<ApiFounderStats>('/api/founder/stats'),
  inquiries:      ()                                                                    => get<ApiFounderInquiry[]>('/api/founder/inquiries'),
  setInquiryStatus: (id: string, status: 'approved'|'denied')                          =>
    patch<{
      id: string;
      status: string;
      provisioned?: boolean;
      alreadyProvisioned?: boolean;
      emailSent?: boolean;
      userEmail?: string;
      licenseKey?: string;
    }>(`/api/founder/inquiries/${id}`, { status }),
  licenseRequests: ()                                                                   => get<ApiLicensePurchaseRequest[]>('/api/founder/license-requests'),
  fulfillLicenseRequest: (id: string)                                                 =>
    post<{ id: string; status: string; key_code: string }>(`/api/founder/license-requests/${id}/fulfill`, {}),
  cancelLicenseRequest: (id: string)                                                   =>
    patch<{ id: string; status: string }>(`/api/founder/license-requests/${id}`, { status: 'cancelled' }),
  setPlan:        (restaurantId: string, plan: string)                                 => patch<ApiRestaurant>(`/api/founder/restaurants/${restaurantId}/plan`, { plan }),
  deleteRestaurant: (restaurantId: string)                                              => del(`/api/founder/restaurants/${restaurantId}`),
  setRestaurantAccess: (restaurantId: string, paused: boolean)                          =>
    patch<{ id: string; name: string; access_paused: number }>(`/api/founder/restaurants/${restaurantId}/access`, { paused }),
  users:          (restaurantId?: string)                                                =>
    get<ApiFounderUser[]>(`/api/founder/users${restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : ''}`),
  setUserStatus:  (userId: string, status: ApiUser['status'])                           =>
    patch<{ id: string; status: string; restaurant_id: string }>(`/api/founder/users/${userId}/status`, { status }),
  deleteUser:     (userId: string)                                                      => del(`/api/founder/users/${userId}`),
  planConfig:     ()                                                                    => get<ApiPlanConfig[]>('/api/founder/plan-config'),
  updatePlanConfig: (plan: string, d: Partial<{
    panels_json: string; label: string; description: string; price_monthly: number; currency_symbol: string;
    billing_interval_unit: 'month' | 'year'; billing_interval_count: number;
  }>) =>
    put<ApiPlanConfig>(`/api/founder/plan-config/${plan}`, d),
};

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string) => get<ApiSearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
};

// ── AI Support ────────────────────────────────────────────────────────────────
export const supportApi = {
  ask: (d: { message: string; screen?: string; history?: { role: 'user' | 'assistant'; text: string }[] }) =>
    post<ApiSupportResponse>('/api/support/ask', d),
};

// ── Response / Entity Types ───────────────────────────────────────────────────
export interface LoginResponse {
  token: string;
  user: ApiUser;
  restaurant_id: string;
  restaurant_name: string;
}

export interface ApiUser {
  id: string; restaurant_id: string; name: string; initials: string; email: string; phone?: string;
  role: 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'founder';
  access_json?: string;
  status: 'active' | 'break' | 'off'; start_time: string; created_at?: string;
}

export interface ApiRestaurant {
  id: string; name: string; slug: string; plan: string; tagline?: string;
  parent_id?: string; timezone: string; created_at: string;
  logo_url?: string; contact_phone?: string; contact_email?: string;
  address_line1?: string; address_line2?: string; city?: string;
  country?: string; postal_code?: string; tax_id?: string; website_url?: string;
  currency_code?: string; language_code?: string; date_format?: string;
  service_charge_pct?: number | null; tax_rate_pct?: number | null;
  tax_type?: string; tax_included?: number | boolean;
  receipt_footer?: string;
  kitchen_printer?: { role: 'kitchen'; channel: 'bluetooth' | 'usb'; name: string } | null;
  cashier_printer?: { role: 'cashier'; channel: 'bluetooth' | 'usb'; name: string } | null;
}

export interface ApiMenuItem {
  id: string; restaurant_id: string; name: string; category: string; price: number;
  description: string; symbol: string; image_url?: string | null;
  is_popular: number; is_available: number; created_at?: string;
}

export interface ApiMenuCategory {
  id: string;
  restaurant_id: string;
  slug: string;
  label: string;
  sort_order: number;
  created_at?: string;
}

export interface ApiTable {
  id: string; restaurant_id: string; name: string; zone: string; capacity: number;
  status: 'empty' | 'reserved' | 'occupied' | 'paying' | 'attention';
  course?: string; covers: number; elapsed_min: number; server_id?: string;
}

export interface ApiOrder {
  id: string; restaurant_id: string; table_id?: string; server_id?: string;
  status: 'open' | 'sent' | 'paid' | 'voided' | 'comped'; covers: number; note?: string;
  order_type?: 'dine_in' | 'parcel';
  table_name?: string; created_at: string; updated_at: string; items?: ApiOrderItem[];
}

export interface ApiLiveOrder extends ApiOrder {
  server_name?: string | null;
  ticket_id?: string | null;
  ticket_status?: 'new' | 'prep' | 'ready' | 'delivered' | null;
  ticket_vip?: number;
  ticket_updated_at?: string | null;
  subtotal?: number;
  items: ApiOrderItem[];
}

export interface ApiOrderItem {
  id: string; order_id: string; menu_item_id: string; qty: number;
  mods: string; is_done: number; name?: string; price?: number;
}

export interface ApiKdsTicket {
  id: string; restaurant_id: string; order_id: string; table_name: string; server_name: string;
  covers: number; status: 'new' | 'prep' | 'ready' | 'delivered'; vip: number;
  elapsed_min: number; station?: string; created_at: string; updated_at: string;
  order_note?: string | null;
  order_type?: 'dine_in' | 'parcel';
  items?: ApiKdsTicketItem[];
}

export interface ApiKdsTicketItem {
  id: string; ticket_id: string; name: string; qty: number;
  station: string; mods: string; alert: number; is_done: number;
}

export interface ApiKitchenPrintJob {
  id: string;
  restaurant_id: string;
  ticket_id: string;
  status: 'pending' | 'printing' | 'printed' | 'failed';
  attempt_count: number;
  payload: {
    ticketId: string;
    tableName: string;
    serverName?: string;
    covers?: number;
    station?: string;
    items: { name: string; qty: number; mods?: string[]; alert?: boolean }[];
    note?: string;
    createdAt?: string;
    parcel?: boolean;
  } | null;
}

export interface ApiReservation {
  id: string; restaurant_id: string; table_id?: string; table_name?: string;
  guest_name: string; covers: number; res_time: string; note?: string;
  status: string; created_at: string;
}

export interface ApiInventoryItem {
  id: string; restaurant_id: string; name: string; par: number;
  current: number; unit: string; alert: number; created_at: string; updated_at: string;
}

export interface ApiDashboardStats {
  orders_today: number; orders_paid: number; tables_total: number; tables_occupied: number;
  staff_total: number; staff_active: number; staff_on_break: number; inventory_low: number;
}

export interface ApiRevenueRow { day: string; order_count: number; revenue: number; }

export interface ApiRevenueResponse {
  period: RevenuePeriod;
  from: string;
  to: string;
  periodLabel: string;
  rows: ApiRevenueRow[];
  totalRevenue: number;
  totalOrders: number;
  dayCount: number;
}

export interface ApiSoldItemRow {
  menu_item_id: string;
  item_name: string;
  qty_sold: number;
  revenue: number;
}

export interface ApiSoldItemsDay {
  day: string;
  totalQty: number;
  totalRevenue: number;
  items: ApiSoldItemRow[];
}

export interface ApiSoldItemsResponse {
  period: RevenuePeriod;
  from: string;
  to: string;
  periodLabel: string;
  days: ApiSoldItemsDay[];
  totalQty: number;
  totalRevenue: number;
  dayCount: number;
}

export interface ApiAnalyticsCategory {
  category: string;
  qty_sold: number;
  revenue: number;
}

export interface ApiAnalyticsHour {
  hour: number;
  label: string;
  covers: number;
}

export interface ApiAnalyticsResponse {
  period: RevenuePeriod;
  from: string;
  to: string;
  periodLabel: string;
  previous: { from: string; to: string; totalRevenue: number; totalOrders: number };
  revenue: {
    rows: ApiRevenueRow[];
    totalRevenue: number;
    totalOrders: number;
    dayCount: number;
  };
  topItems: ApiSoldItemRow[];
  categories: ApiAnalyticsCategory[];
  totalQty: number;
  hours: ApiAnalyticsHour[];
  tables_total: number;
  tables_occupied: number;
  deltas: { revenuePct: number; ordersPct: number };
}

// ── Payload Types ─────────────────────────────────────────────────────────────
export interface CreateUserPayload {
  name: string; email: string; phone?: string; role: string; password?: string; pin?: string;
  access_json?: string | Record<string, 'none' | 'view' | 'edit'>;
  status?: string; start_time?: string; initials?: string;
}

export interface CreateMenuItemPayload {
  name: string; category: string; price: number;
  description?: string; symbol?: string; image_url?: string | null;
  is_popular?: boolean; is_available?: boolean;
}

export interface CreateKdsTicketPayload {
  order_id: string; table_name: string; server_name: string; covers?: number; vip?: boolean;
  items: { name: string; qty: number; station?: string; mods?: string[]; alert?: boolean }[];
}

export interface ApiLicenseKey {
  id: string; key_code: string; plan: string; restaurant_id?: string; restaurant_name?: string;
  activated_at?: string; expires_at?: string; is_active: number; note?: string; created_at: string;
}

export interface ApiSubscriptionStatus {
  plan: string;
  license: ApiLicenseKey | null;
  trial_expires_at?: string | null;
  trial_expired?: boolean;
  trial_days_left?: number | null;
  purchase_url?: string;
  founder_email?: string;
}

export interface ApiFounderRestaurant {
  id: string; name: string; slug: string; plan: string; timezone: string; created_at: string;
  user_count: number; active_key?: string; access_paused?: number;
}

export interface ApiFounderUser {
  id: string; restaurant_id: string; name: string; initials: string; email: string; phone?: string;
  role: ApiUser['role']; status: ApiUser['status']; start_time: string; created_at?: string;
  restaurant_name: string; restaurant_slug: string; restaurant_plan: string; access_paused?: number;
}

export interface ApiFounderStats {
  restaurants_by_plan: { plan: string; count: number }[];
  license_keys: { total: number; activated: number };
  total_users: number;
  pending_license_requests?: number;
}

export interface ApiLicensePurchaseRequest {
  id: string;
  restaurant_id: string;
  restaurant_name?: string;
  requester_user_id?: string;
  email: string;
  plan: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  note?: string;
  license_key_id?: string;
  created_at: string;
  fulfilled_at?: string;
}

export interface ApiFounderInquiry {
  id: string;
  name: string;
  restaurant_name: string;
  email: string;
  phone?: string;
  plan: string;
  message?: string;
  status: 'pending' | 'approved' | 'denied';
  is_retry: number;
  retry_of_id?: string;
  created_at: string;
  approved_at?: string;
  denied_at?: string;
}

export interface ApiPlanConfig {
  plan: string; panels_json: string; label: string; description: string;
  price_monthly: number;
  currency_symbol?: string;
  billing_interval_unit?: 'month' | 'year';
  billing_interval_count?: number;
  updated_at: string;
}

export interface ApiSearchResult {
  type: 'menu' | 'table' | 'order' | 'staff' | 'inventory' | 'reservation';
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  page: string;
}

export interface ApiSearchResponse {
  results: ApiSearchResult[];
  query: string;
}

export interface ApiSupportAction {
  label: string;
  path: string;
}

export interface ApiSupportResponse {
  category: 'printer' | 'billing' | 'login' | 'permissions' | 'orders' | 'menu' | 'reports' | 'general';
  reply: string;
  suggestions: string[];
  quick_actions: ApiSupportAction[];
  meta: {
    escalations_email: string;
    response_mode: string;
  };
}
