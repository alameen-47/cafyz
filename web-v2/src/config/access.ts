import type { Plan, Role } from '../app/auth';
import { hasPageScreenAccess } from './screenAccess';
import {
  getDynamicPlanPanels,
  getCachedPlanConfigs,
  requiredPlanForPageDynamic,
} from '../services/planConfigStore';

export type PageId =
  | 'dashboard' | 'pos' | 'orders' | 'tables' | 'menu' | 'kds'
  | 'staff' | 'analytics' | 'inventory' | 'reservations' | 'roles'
  | 'profile' | 'license' | 'founder';

export const PLAN_ORDER: Plan[] = ['basic', 'pro', 'premium'];

export const PLAN_PANELS: Record<Plan, PageId[]> = {
  basic: ['dashboard', 'pos', 'orders', 'tables', 'menu', 'profile', 'license'],
  pro: ['dashboard', 'pos', 'orders', 'tables', 'menu', 'kds', 'staff', 'analytics', 'inventory', 'roles', 'profile', 'license'],
  premium: ['dashboard', 'pos', 'orders', 'tables', 'menu', 'kds', 'staff', 'analytics', 'inventory', 'reservations', 'roles', 'profile', 'license'],
};

export const ROLE_PAGES: Record<Role, PageId[]> = {
  owner: ['dashboard', 'pos', 'orders', 'tables', 'menu', 'kds', 'staff', 'analytics', 'inventory', 'reservations', 'roles', 'profile', 'license'],
  manager: ['dashboard', 'pos', 'orders', 'tables', 'menu', 'kds', 'staff', 'analytics', 'inventory', 'reservations', 'roles', 'profile', 'license'],
  cashier: ['pos', 'orders', 'tables', 'menu'],
  waiter: ['orders', 'tables', 'menu'],
  kitchen: ['kds'],
  founder: ['founder'],
};

export const FOUNDER_ONLY_PAGES: PageId[] = ['founder'];

export const RESTAURANT_PAGES: PageId[] = [
  'dashboard', 'pos', 'orders', 'tables', 'menu', 'kds', 'staff', 'analytics', 'inventory', 'reservations', 'roles', 'profile', 'license',
];

export function isFounderRole(role: Role | string): boolean {
  return role === 'founder';
}

/** Owners and managers — plan, license, restaurant settings, staff management. */
export function canManagePlan(role: Role | string): boolean {
  return role === 'owner' || role === 'manager';
}

export const PAGE_PLAN_MIN: Partial<Record<PageId, Plan>> = {
  kds: 'pro',
  analytics: 'pro',
  inventory: 'pro',
  staff: 'pro',
  roles: 'pro',
  reservations: 'premium',
};

export const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  pos: 'Point of Sale',
  orders: 'Live Orders',
  tables: 'Table Map',
  menu: 'Menu',
  kds: 'Kitchen Display',
  staff: 'Staff',
  analytics: 'Analytics',
  inventory: 'Inventory',
  reservations: 'Reservations',
  roles: 'Roles & Access',
  profile: 'Restaurant',
  license: 'License',
  founder: 'Founder Console',
};

export function parseAccessJson(raw: string | null | undefined): PageId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PageId[] : null;
  } catch {
    return null;
  }
}

export function allowedPages(
  role: Role,
  plan: Plan,
  accessOverride?: PageId[] | null,
): PageId[] {
  if (isFounderRole(role)) return ROLE_PAGES.founder;
  const planPages = getDynamicPlanPanels(plan);
  const rolePages = ROLE_PAGES[role] ?? ROLE_PAGES.waiter;
  const base = planPages.filter(p => rolePages.includes(p));
  if (!accessOverride?.length) return base;
  return base.filter(p => accessOverride.includes(p));
}

/** Pages visible in nav + renderable — role, plan, legacy page list, and screen access map. */
export function permittedPages(
  role: Role,
  plan: Plan,
  accessJson?: string | null,
  accessOverride?: PageId[] | null,
): PageId[] {
  return allowedPages(role, plan, accessOverride).filter(p =>
    hasPageScreenAccess(p, role, accessJson),
  );
}

export function canAccessPage(
  page: PageId,
  role: Role,
  plan: Plan,
  accessOverride?: PageId[] | null,
  accessJson?: string | null,
): boolean {
  if (page === 'founder') return isFounderRole(role);
  if (isFounderRole(role)) return false;
  if (!allowedPages(role, plan, accessOverride).includes(page)) return false;
  return hasPageScreenAccess(page, role, accessJson);
}

export function requiredPlanForPage(page: PageId): Plan | null {
  const dynamic = requiredPlanForPageDynamic(page);
  if (dynamic) return dynamic;
  if (getCachedPlanConfigs()?.length) return null;
  return PAGE_PLAN_MIN[page] ?? null;
}

export function planMeetsRequirement(current: Plan, required: Plan): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required);
}
