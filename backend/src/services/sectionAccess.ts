const SCREEN_IDS = [
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
] as const;

export type ScreenId = typeof SCREEN_IDS[number];
export type AccessLevel = 'none' | 'view' | 'edit';
export type ScreenAccessMap = Partial<Record<ScreenId, AccessLevel>>;

const SCREEN_ID_SET = new Set<string>(SCREEN_IDS);
const EDITABLE_LEVELS = new Set<AccessLevel>(['none', 'view', 'edit']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ROLE_DEFAULTS: Record<string, ScreenAccessMap> = {
  owner: Object.fromEntries(SCREEN_IDS.map((s) => [s, 'edit'])) as ScreenAccessMap,
  manager: Object.fromEntries(SCREEN_IDS.map((s) => [s, 'edit'])) as ScreenAccessMap,
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

export function defaultAccessForRole(role: string): ScreenAccessMap {
  return { ...(ROLE_DEFAULTS[role] ?? {}) };
}

export function sanitizeAccessMap(input: unknown): ScreenAccessMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: ScreenAccessMap = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (!SCREEN_ID_SET.has(rawKey)) continue;
    if (typeof rawValue !== 'string') continue;
    const level = rawValue as AccessLevel;
    if (!EDITABLE_LEVELS.has(level)) continue;
    out[rawKey as ScreenId] = level;
  }
  return out;
}

export function parseAccessJson(raw: unknown): ScreenAccessMap {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return sanitizeAccessMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function serializeAccessMap(access: ScreenAccessMap): string {
  return JSON.stringify(sanitizeAccessMap(access));
}

export function mergeRoleAccess(role: string, userAccess: ScreenAccessMap): ScreenAccessMap {
  const base = defaultAccessForRole(role);
  return { ...base, ...sanitizeAccessMap(userAccess) };
}

export function hasScreenAccess(
  method: string,
  effectiveAccess: ScreenAccessMap,
  screen: ScreenId,
): boolean {
  const level = effectiveAccess[screen] ?? 'none';
  if (level === 'none') return false;
  if (SAFE_METHODS.has(method.toUpperCase())) return level === 'view' || level === 'edit';
  return level === 'edit';
}

