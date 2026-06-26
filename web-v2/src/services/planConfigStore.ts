import type { Plan } from '../app/auth';
import type { PageId } from '../config/access';
import { PLAN_PANELS, PLAN_ORDER } from '../config/access';
import { plansApi, type ApiPlanConfig } from './api';

export const PLAN_CONFIG_UPDATED = 'cafyz:plan-config-updated';

/** Legacy backend panel ids → web-v2 page routes. */
const PANEL_TO_PAGES: Record<string, PageId[]> = {
  pos: ['pos', 'orders'],
  menu: ['menu'],
  waiter: ['orders', 'tables'],
  kds: ['kds'],
  manager: ['dashboard', 'profile'],
  inventory: ['inventory'],
  staff: ['staff'],
  reports: ['analytics'],
  roles: ['roles'],
  reservations: ['reservations'],
  license: ['license'],
};

const PANEL_LABELS: Record<string, string> = {
  pos: 'Point of Sale',
  menu: 'Menu Management',
  waiter: 'Tables & Floor',
  kds: 'Kitchen Display (KDS)',
  manager: 'Manager Dashboard',
  inventory: 'Inventory',
  staff: 'Staff Management',
  reports: 'Analytics & Reports',
  roles: 'Roles & Access',
  reservations: 'Reservations',
  license: 'License & Billing',
};

let cached: ApiPlanConfig[] | null = null;
let inflight: Promise<ApiPlanConfig[]> | null = null;

export function getCachedPlanConfigs(): ApiPlanConfig[] | null {
  return cached;
}

export function getPlanConfig(plan: string): ApiPlanConfig | undefined {
  return cached?.find(c => c.plan === plan);
}

export function parsePanelsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

export function panelsToPages(panelsJson: string, plan?: Plan): PageId[] {
  const panels = parsePanelsJson(panelsJson);
  const pages = new Set<PageId>();
  for (const panel of panels) {
    for (const page of PANEL_TO_PAGES[panel] ?? []) pages.add(page);
  }
  // Premium keeps reservations even when older DB rows omit the panel id.
  if (plan === 'premium') pages.add('reservations');
  if (pages.size === 0) return [];
  return [...pages];
}

export function getDynamicPlanPanels(plan: Plan): PageId[] {
  const cfg = getPlanConfig(plan);
  if (cfg?.panels_json) {
    const pages = panelsToPages(cfg.panels_json, plan);
    if (pages.length) return pages;
  }
  return PLAN_PANELS[plan] ?? PLAN_PANELS.basic;
}

export function requiredPlanForPageDynamic(page: PageId): Plan | null {
  if (cached?.length) {
    for (const plan of PLAN_ORDER) {
      if (getDynamicPlanPanels(plan).includes(page)) return plan;
    }
    return null;
  }
  return null;
}

export function formatPlanPrice(cfg: ApiPlanConfig): string {
  const sym = cfg.currency_symbol ?? '$';
  const amount = Number(cfg.price_monthly ?? 0);
  const formatted = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(2);
  return `${sym}${formatted}`;
}

export function formatBillingSuffix(cfg: ApiPlanConfig): string {
  const count = cfg.billing_interval_count ?? 1;
  const unit = cfg.billing_interval_unit ?? 'month';
  if (count === 1) return unit === 'year' ? '/yr' : '/mo';
  if (unit === 'year') return count === 1 ? '/yr' : `/${count} yrs`;
  return `/${count} mo`;
}

/** Human-readable billing period for admin copy and emails. */
export function formatBillingPeriod(cfg: ApiPlanConfig): string {
  const count = cfg.billing_interval_count ?? 1;
  const unit = cfg.billing_interval_unit ?? 'month';
  const label = unit === 'year' ? 'year' : 'month';
  return count === 1 ? label : `${count} ${label}s`;
}

export function panelLabelsFromConfig(cfg: ApiPlanConfig): string[] {
  return parsePanelsJson(cfg.panels_json)
    .map(id => PANEL_LABELS[id] ?? id)
    .filter(Boolean);
}

export function notifyPlanConfigUpdated(): void {
  window.dispatchEvent(new Event(PLAN_CONFIG_UPDATED));
}

export async function refreshPlanConfigs(force = false): Promise<ApiPlanConfig[]> {
  if (!force && cached) return cached;
  if (inflight) return inflight;
  inflight = plansApi.list()
    .then(rows => {
      cached = rows.slice().sort((a, b) => (a.price_monthly ?? 0) - (b.price_monthly ?? 0));
      notifyPlanConfigUpdated();
      return cached;
    })
    .catch(() => cached ?? [])
    .finally(() => { inflight = null; });
  return inflight;
}
