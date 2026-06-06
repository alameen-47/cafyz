import type { Screen } from '@shared/types';

export type AccessLevel = 'none' | 'view' | 'edit';
export type ScreenAccessMap = Partial<Record<Screen, AccessLevel>>;

export const ACCESS_MANAGED_SCREENS: Screen[] = [
  'manager',
  'pos',
  'waiter',
  'tableSetup',
  'kds',
  'menu',
  'inventory',
  'staff',
  'reports',
  'roles',
  'license',
];

const ROLE_DEFAULTS: Record<string, ScreenAccessMap> = {
  owner: Object.fromEntries(ACCESS_MANAGED_SCREENS.map((s) => [s, 'edit'])) as ScreenAccessMap,
  manager: Object.fromEntries(ACCESS_MANAGED_SCREENS.map((s) => [s, 'edit'])) as ScreenAccessMap,
  cashier: {
    pos: 'edit',
    menu: 'edit',
    inventory: 'edit',
    reports: 'view',
    roles: 'view',
    license: 'view',
  },
  waiter: {
    waiter: 'edit',
    license: 'view',
  },
  kitchen: {
    kds: 'edit',
    license: 'view',
  },
  founder: {},
};

const LEVELS = new Set<AccessLevel>(['none', 'view', 'edit']);
const SCREEN_SET = new Set<string>(ACCESS_MANAGED_SCREENS);

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
    out[key as Screen] = level;
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

export function serializeScreenAccess(map: ScreenAccessMap): string {
  return JSON.stringify(sanitizeScreenAccess(map));
}

export function effectiveScreenAccess(role: string, accessJson?: string): ScreenAccessMap {
  return {
    ...defaultRoleScreenAccess(role),
    ...parseScreenAccess(accessJson),
  };
}

