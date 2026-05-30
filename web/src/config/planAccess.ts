import type { Screen } from '@shared/types';

export type Plan = 'basic' | 'pro' | 'premium';

// Founder is a special super-admin role not tied to a restaurant plan
export const FOUNDER_SCREENS: Screen[] = ['founder'];

// What each plan unlocks — matches the backend plan_config seed
export const DEFAULT_PLAN_PANELS: Record<Plan, Screen[]> = {
  basic:   ['pos', 'menu', 'waiter', 'tableSetup', 'license'],
  pro:     ['pos', 'menu', 'waiter', 'tableSetup', 'kds', 'manager', 'inventory', 'staff', 'reports', 'roles', 'license'],
  premium: ['pos', 'menu', 'waiter', 'tableSetup', 'kds', 'manager', 'inventory', 'staff', 'reports', 'roles', 'license'],
};

// Whether a plan gets the reservations section inside manager
export const PLAN_HAS_RESERVATIONS: Record<Plan, boolean> = {
  basic: false, pro: false, premium: true,
};

// Per-role allowed screens (maximum ceiling — intersected with plan panels)
export const ROLE_SCREENS: Record<string, Screen[]> = {
  owner:   ['manager','tableSetup','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  manager: ['manager','tableSetup','pos','waiter','kds','menu','inventory','staff','reports','roles','license'],
  cashier: ['pos','menu','inventory','reports','roles','license'],
  waiter:  ['waiter','license'],
  kitchen: ['kds','license'],
  founder: FOUNDER_SCREENS,
};

export function getAllowedScreens(plan: Plan | string, role: string, overridePanels?: Screen[]): Screen[] {
  if (role === 'founder') return FOUNDER_SCREENS;
  const planPanels: Screen[] = overridePanels ?? DEFAULT_PLAN_PANELS[plan as Plan] ?? DEFAULT_PLAN_PANELS.basic;
  const roleScreens = ROLE_SCREENS[role] ?? [];
  return planPanels.filter(s => roleScreens.includes(s));
}

export const PLAN_LABELS: Record<Plan, string> = { basic: 'Basic', pro: 'Pro', premium: 'Premium' };

export const PLAN_COLOR: Record<Plan, string> = {
  basic:   '#64748b',
  pro:     '#f59e0b',
  premium: '#8b5cf6',
};

export const ALL_PLAN_FEATURES: { id: Screen; label: string; plans: Plan[] }[] = [
  { id: 'pos',       label: 'Point of Sale',      plans: ['basic','pro','premium'] },
  { id: 'menu',      label: 'Menu Management',     plans: ['basic','pro','premium'] },
  { id: 'waiter',      label: 'Tables & Floor Plan', plans: ['basic','pro','premium'] },
  { id: 'tableSetup',  label: 'Table Setup (add/edit)', plans: ['basic','pro','premium'] },
  { id: 'kds',         label: 'Kitchen Display',     plans: ['pro','premium'] },
  { id: 'manager',   label: 'Manager Dashboard',   plans: ['pro','premium'] },
  { id: 'inventory', label: 'Inventory',           plans: ['pro','premium'] },
  { id: 'staff',     label: 'Staff Management',    plans: ['pro','premium'] },
  { id: 'reports',   label: 'Reports & Analytics', plans: ['pro','premium'] },
  { id: 'roles',     label: 'Role Management',     plans: ['pro','premium'] },
  { id: 'license',   label: 'License Management',  plans: ['basic','pro','premium'] },
];
