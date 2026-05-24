// ─── Cafyz API Client ────────────────────────────────────────────────────────
// Tenant-scoped HTTP client. JWT is stored in localStorage and attached to
// every request. On 401 the session is cleared and the user is redirected.

const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000';

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = localStorage.getItem('cafyz_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('cafyz_token');
    localStorage.removeItem('cafyz_user');
    // Only hard-redirect on interactive requests (not background polling /me validation)
    if (!path.includes('/api/auth/me')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired — please sign in again.');
  }

  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

const get  = <T = unknown>(path: string)                    => request<T>('GET',    path);
const post = <T = unknown>(path: string, body: unknown)     => request<T>('POST',   path, body);
const put  = <T = unknown>(path: string, body: unknown)     => request<T>('PUT',    path, body);
const patch= <T = unknown>(path: string, body?: unknown)    => request<T>('PATCH',  path, body);
const del  =               (path: string)                   => request   ('DELETE', path);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    post<LoginResponse>('/api/auth/login', { email, password }),
  pin: (pin: string) =>
    post<LoginResponse>('/api/auth/pin', { pin }),
  me: () => get<ApiUser>('/api/auth/me'),
  onboarding: (data: {
    restaurant_name: string; owner_name: string;
    email: string; password: string; plan?: string; timezone?: string;
  }) => post<{ token: string; user: ApiUser; restaurant: ApiRestaurant }>('/api/restaurants/onboarding', data),
};

// ── Restaurant ────────────────────────────────────────────────────────────────
export const restaurantApi = {
  me:       ()                                              => get<ApiRestaurant>('/api/restaurants/me'),
  update:   (d: Partial<Pick<ApiRestaurant,
    'name' | 'timezone' | 'logo' | 'address_line1' | 'address_line2' |
    'city' | 'postcode' | 'country' | 'phone' | 'website'
  >>)                                                       => put<ApiRestaurant>('/api/restaurants/me', d),
  branches: ()                                             => get<ApiRestaurant[]>('/api/restaurants/branches'),
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
export const menuApi = {
  list:   (category?: string) =>
    get<ApiMenuItem[]>(`/api/menu${category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : ''}`),
  create: (d: CreateMenuItemPayload)                                          => post<ApiMenuItem>('/api/menu', d),
  update: (id: string, d: Partial<CreateMenuItemPayload>)                     => put<ApiMenuItem>(`/api/menu/${id}`, d),
  delete: (id: string)                                                        => del(`/api/menu/${id}`),
};

// ── Tables ────────────────────────────────────────────────────────────────────
export const tablesApi = {
  list:         ()                                                             => get<ApiTable[]>('/api/tables'),
  updateStatus: (id: string, d: { status: string; course?: string; covers?: number; elapsed_min?: number }) =>
    patch<ApiTable>(`/api/tables/${id}/status`, d),
  create:       (d: { name: string; zone: string; capacity: number })          => post<ApiTable>('/api/tables', d),
  delete:       (id: string)                                                   => del(`/api/tables/${id}`),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list:         (p?: { status?: string; table_id?: string })                  =>
    get<ApiOrder[]>(`/api/orders${p ? `?${new URLSearchParams(p as Record<string, string>)}` : ''}`),
  get:          (id: string)                                                  => get<ApiOrder>(`/api/orders/${id}`),
  create:       (d: { table_id?: string; covers?: number; note?: string })    => post<ApiOrder>('/api/orders', d),
  updateStatus: (id: string, status: string)                                  => patch<{ id: string; status: string }>(`/api/orders/${id}/status`, { status }),
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
  delete:    (id: string)                                                     => del(`/api/kds/tickets/${id}`),
};

// ── Reservations ──────────────────────────────────────────────────────────────
export const reservationsApi = {
  list:   (p?: { status?: string })  =>
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
export const dashboardApi = {
  stats:   () => get<ApiDashboardStats>('/api/dashboard/stats'),
  revenue: () => get<ApiRevenueRow[]>('/api/dashboard/revenue'),
};

// ── Response / Entity Types ───────────────────────────────────────────────────
export interface LoginResponse {
  token: string;
  user: ApiUser;
  restaurant_id: string;
  restaurant_name: string;
}

export interface ApiUser {
  id: string; restaurant_id: string; name: string; initials: string; email: string;
  role: 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
  status: 'active' | 'break' | 'off'; start_time: string; created_at?: string;
}

export interface ApiRestaurant {
  id: string; name: string; slug: string; plan: string;
  parent_id?: string; timezone: string; created_at: string;
  logo?: string | null;
  address_line1?: string; address_line2?: string;
  city?: string; postcode?: string; country?: string;
  phone?: string; website?: string;
}

export interface ApiMenuItem {
  id: string; restaurant_id: string; name: string; category: string; price: number;
  description: string; symbol: string; is_popular: number; is_available: number; created_at?: string;
}

export interface ApiTable {
  id: string; restaurant_id: string; name: string; zone: string; capacity: number;
  status: 'empty' | 'reserved' | 'occupied' | 'paying' | 'attention';
  course?: string; covers: number; elapsed_min: number; server_id?: string;
}

export interface ApiOrder {
  id: string; restaurant_id: string; table_id?: string; server_id?: string;
  status: 'open' | 'sent' | 'paid' | 'voided' | 'comped'; covers: number; note?: string;
  table_name?: string; created_at: string; updated_at: string; items?: ApiOrderItem[];
}

export interface ApiOrderItem {
  id: string; order_id: string; menu_item_id: string; qty: number;
  mods: string; is_done: number; name?: string; price?: number;
}

export interface ApiKdsTicket {
  id: string; restaurant_id: string; order_id: string; table_name: string; server_name: string;
  covers: number; status: 'new' | 'prep' | 'ready' | 'delivered'; vip: number;
  elapsed_min: number; station?: string; created_at: string; updated_at: string;
  items?: ApiKdsTicketItem[];
}

export interface ApiKdsTicketItem {
  id: string; ticket_id: string; name: string; qty: number;
  station: string; mods: string; alert: number; is_done: number;
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

// ── Payload Types ─────────────────────────────────────────────────────────────
export interface CreateUserPayload {
  name: string; email: string; role: string; password?: string; pin?: string;
  status?: string; start_time?: string; initials?: string;
}

export interface CreateMenuItemPayload {
  name: string; category: string; price: number;
  description?: string; symbol?: string; is_popular?: boolean; is_available?: boolean;
}

export interface CreateKdsTicketPayload {
  order_id: string; table_name: string; server_name: string; covers?: number; vip?: boolean;
  items: { name: string; qty: number; station?: string; mods?: string[]; alert?: boolean }[];
}
