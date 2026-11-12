import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../src/db.js';
import { setupTestDb } from './setup.js';
import { createTrialRestaurant } from '../src/services/trialSignup.js';
import { applyTesterAccess, syncTesters, testerHash, TESTER_DAYS } from '../src/services/testerAccess.js';

const DAY = 86_400_000;
const TESTER = 'tester.one@example.com';
const EARLY = 'tester.early@example.com';

async function trialDaysLeft(restaurantId: string): Promise<number> {
  const r = await getDb().execute({ sql: `SELECT expires_at FROM license_keys WHERE restaurant_id=? AND is_active=1`, args: [restaurantId] });
  return (new Date(String(r.rows[0]!.expires_at)).getTime() - Date.now()) / DAY;
}

async function addTester(email: string) {
  await getDb().execute({ sql: `INSERT OR IGNORE INTO tester_access(email_hash, days) VALUES(?, ?)`, args: [testerHash(email), TESTER_DAYS] });
}

describe('closed-test tester trials', () => {
  beforeAll(async () => { await setupTestDb(); });

  it('puts the built-in list in the database once', async () => {
    await syncTesters();
    await syncTesters();
    const n = await getDb().execute(`SELECT COUNT(*) AS n FROM tester_access`);
    expect(Number(n.rows[0]!.n)).toBe(19);
    const one = await getDb().execute({ sql: `SELECT days FROM tester_access WHERE email_hash=?`, args: [testerHash('ALAMEENKHAN1431@gmail.com ')] });
    expect(Number(one.rows[0]!.days)).toBe(30);
  });

  it('gives a tester who signs up a 30-day trial, and everyone else the normal one', async () => {
    await addTester(TESTER);
    const t = await createTrialRestaurant({ restaurantName: 'Tester Cafe', ownerName: 'Tester One', email: TESTER, phone: '+919000000001' });
    const p = await createTrialRestaurant({ restaurantName: 'Public Cafe', ownerName: 'Public One', email: 'public@example.com', phone: '+919000000002' });
    expect(await trialDaysLeft(t.restaurantId)).toBeGreaterThan(29.9);
    expect(await trialDaysLeft(t.restaurantId)).toBeLessThan(30.1);
    expect(await trialDaysLeft(p.restaurantId)).toBeLessThan(3.1);
  });

  it('gives it only once', async () => {
    const r = await getDb().execute({ sql: `SELECT restaurant_id FROM users WHERE email=?`, args: [TESTER] });
    expect(await applyTesterAccess(TESTER, String(r.rows[0]!.restaurant_id))).toBeNull();
  });

  it('extends a tester who signed up before being listed, on the next boot', async () => {
    const e = await createTrialRestaurant({ restaurantName: 'Early Cafe', ownerName: 'Early Bird', email: EARLY, phone: '+919000000003' });
    expect(await trialDaysLeft(e.restaurantId)).toBeLessThan(3.1);
    await addTester(EARLY);
    await syncTesters();
    expect(await trialDaysLeft(e.restaurantId)).toBeGreaterThan(29.9);
  });

  it('leaves a paid licence alone', async () => {
    const paid = await createTrialRestaurant({ restaurantName: 'Paid Cafe', ownerName: 'Paid One', email: 'paid@example.com', phone: '+919000000004' });
    await getDb().execute({ sql: `UPDATE license_keys SET key_code='CAFYZ-PAID-1', note='Annual', expires_at=? WHERE restaurant_id=?`, args: [new Date(Date.now() + 5 * DAY).toISOString(), paid.restaurantId] });
    await addTester('paid@example.com');
    expect(await applyTesterAccess('paid@example.com', paid.restaurantId)).toBeNull();
    expect(await trialDaysLeft(paid.restaurantId)).toBeLessThan(5.1);
  });
});
