/**
 * Plan model: every plan carries every module; plans differ only by licence
 * term. The lifetime plan must produce a NULL expiry, which is the codebase's
 * established "never expires" signal (requireActiveSubscription treats a
 * missing expiry as active, and the reminder query skips NULL rows).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, DEMO_REST } from './setup.js';
import { getDb } from '../db.js';
import {
  activateLicenseForRestaurant,
  licenseExpiresAtForPlan,
} from '../services/licensePurchaseFulfillment.js';

const EXPECTED = {
  basic:   { price: 5999,  unit: 'year',     count: 1 },
  pro:     { price: 12999, unit: 'year',     count: 2 },
  premium: { price: 29999, unit: 'lifetime', count: 1 },
} as const;

const ALL_MODULES = [
  'pos', 'menu', 'waiter', 'kds', 'manager',
  'inventory', 'staff', 'reports', 'roles', 'reservations', 'license',
];

beforeAll(async () => { await setupTestDb(); });

describe('plan_config', () => {
  it('prices each plan by term, in rupees', async () => {
    const rows = await getDb().execute('SELECT * FROM plan_config');
    expect(rows.rows).toHaveLength(3);
    for (const row of rows.rows) {
      const r = row as Record<string, unknown>;
      const want = EXPECTED[String(r.plan) as keyof typeof EXPECTED];
      expect(Number(r.price_monthly)).toBe(want.price);
      expect(String(r.billing_interval_unit)).toBe(want.unit);
      expect(Number(r.billing_interval_count)).toBe(want.count);
      expect(String(r.currency_symbol)).toBe('₹');
    }
  });

  it('gives every plan every module', async () => {
    const rows = await getDb().execute('SELECT plan, panels_json FROM plan_config');
    for (const row of rows.rows) {
      const panels = JSON.parse(String((row as Record<string, unknown>).panels_json)) as string[];
      expect([...panels].sort()).toEqual([...ALL_MODULES].sort());
    }
  });
});

describe('licence expiry by plan', () => {
  it('expires the 1-year plan about a year out', async () => {
    const iso = await licenseExpiresAtForPlan('basic');
    expect(iso).not.toBeNull();
    const years = (new Date(iso as string).getTime() - Date.now()) / (365.25 * 86_400_000);
    expect(years).toBeGreaterThan(0.95);
    expect(years).toBeLessThan(1.05);
  });

  it('expires the 2-year plan about two years out', async () => {
    const iso = await licenseExpiresAtForPlan('pro');
    const years = (new Date(iso as string).getTime() - Date.now()) / (365.25 * 86_400_000);
    expect(years).toBeGreaterThan(1.95);
    expect(years).toBeLessThan(2.05);
  });

  it('never expires the lifetime plan', async () => {
    expect(await licenseExpiresAtForPlan('premium')).toBeNull();
  });
});

describe('activating a lifetime licence', () => {
  it('stores a NULL expiry, so it is skipped by expiry-driven logic', async () => {
    const { licenseId, expiresAt } = await activateLicenseForRestaurant(
      DEMO_REST, 'premium', 'lifetime test',
    );
    expect(expiresAt).toBeNull();

    const row = await getDb().execute({
      sql: 'SELECT expires_at FROM license_keys WHERE id=?',
      args: [licenseId],
    });
    expect((row.rows[0] as Record<string, unknown>).expires_at).toBeNull();

    // The trial reminder scheduler selects `WHERE lk.expires_at IS NOT NULL`,
    // so a lifetime licence can never trigger an expiry email.
    const reminded = await getDb().execute({
      sql: `SELECT COUNT(*) AS n FROM license_keys
            WHERE id=? AND expires_at IS NOT NULL`,
      args: [licenseId],
    });
    expect(Number((reminded.rows[0] as Record<string, unknown>).n)).toBe(0);
  });
});
