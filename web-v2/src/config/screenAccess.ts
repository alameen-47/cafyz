import type { PageId } from './access';

export type ScreenId =
  | 'manager' | 'pos' | 'waiter' | 'tableSetup' | 'kds' | 'menu'
  | 'inventory' | 'staff' | 'reports' | 'roles' | 'license';

export type AccessLevel = 'none' | 'view' | 'edit';
export type ScreenAccessMap = Partial<Record<ScreenId, AccessLevel>>;

export const ACCESS_MANAGED_SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'manager', label: 'Dashboard' },
  { id: 'pos', label: 'POS' },
  { id: 'waiter', label: 'Tables / Floor' },
  { id: 'tableSetup', label: 'Table Setup' },
  { id: 'kds', label: 'Kitchen Display' },
  { id: 'menu', label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff', label: 'Staff' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'roles', label: 'Roles & Access' },
  { id: 'license', label: 'License' },
];

const SCREEN_IDS = ACCESS_MANAGED_SCREENS.map(s => s.id);
const SCREEN_SET = new Set<string>(SCREEN_IDS);
const LEVELS = new Set<AccessLevel>(['none', 'view', 'edit']);

const ROLE_DEFAULTS: Record<string, ScreenAccessMap> = {
  owner: Object.fromEntries(SCREEN_IDS.map(s => [s, 'edit'])) as ScreenAccessMap,
  manager: Object.fromEntries(SCREEN_IDS.map(s => [s, 'edit'])) as ScreenAccessMap,
  cashier: {
    pos: 'edit', menu: 'edit', inventory: 'edit', reports: 'view', roles: 'view', license: 'view',
  },
  waiter: { waiter: 'edit', license: 'view' },
  kitchen: { kds: 'edit', license: 'view' },
  founder: {},
};

const PAGE_SCREEN_MAP: Partial<Record<PageId, ScreenId[]>> = {
  dashboard: ['manager'],
  pos: ['pos'],
  orders: ['pos', 'waiter'],
  tables: ['waiter', 'tableSetup'],
  menu: ['menu'],
  kds: ['kds'],
  staff: ['staff'],
  analytics: ['reports'],
  inventory: ['inventory'],
  roles: ['roles'],
  profile: ['manager'],
  license: ['license'],
  reservations: ['manager'],
};

export function defaultRoleScreenAccess(role: string): ScreenAccessMap {
  return { ...(ROLE_DEFAULTS[role] ?? {}) };
}

export function sanitizeScreenAccess(input: unknown): ScreenAccessMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: ScreenAccessMap = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!SCREEN_SET.has(key)) continue;
    if (typeof value !== 'string') continue;
    const level = value as AccessLevel;
    if (!LEVELS.has(level)) continue;
    out[key as ScreenId] = level;
  }
  return out;
}

export function parseScreenAccess(raw: unknown): ScreenAccessMap {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return sanitizeScreenAccess(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function effectiveScreenAccess(role: string, accessJson?: string | null): ScreenAccessMap {
  return { ...defaultRoleScreenAccess(role), ...parseScreenAccess(accessJson) };
}

export function hasPageScreenAccess(page: PageId, role: string, accessJson?: string | null): boolean {
  if (page === 'founder') return role === 'founder';
  if (role === 'founder') return false;
  const screens = PAGE_SCREEN_MAP[page];
  if (!screens?.length) return true;
  const access = effectiveScreenAccess(role, accessJson);
  return screens.some(s => (access[s] ?? 'none') !== 'none');
}
