import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../src/db.js';
import { setupTestDb } from './setup.js';
import { createTrialRestaurant } from '../src/services/trialSignup.js';
import { applyTesterAccess, syncTesters, testerHash, TESTER_DAYS } from '../src/services/testerAccess.js';
import { requireActiveSubscription } from '../src/middleware/subscriptionGuard.js';

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

  it('extends a tester whose restaurant is run by a manager', async () => {
    const m = await createTrialRestaurant({ restaurantName: 'Manager Cafe', ownerName: 'Manager One', email: 'tester.manager@example.com', phone: '+919000000005' });
    await getDb().execute({ sql: `UPDATE users SET role='manager' WHERE restaurant_id=?`, args: [m.restaurantId] });
    await getDb().execute({ sql: `UPDATE license_keys SET expires_at=? WHERE restaurant_id=?`, args: [new Date(Date.now() - DAY).toISOString(), m.restaurantId] });
    await addTester('tester.manager@example.com');
    await syncTesters();
    expect(await trialDaysLeft(m.restaurantId)).toBeGreaterThan(29.9);
  });

  it('reopens a tester whose licence of any kind has run out', async () => {
    const x = await createTrialRestaurant({ restaurantName: 'Lapsed Cafe', ownerName: 'Lapsed One', email: 'tester.lapsed@example.com', phone: '+919000000006' });
    await getDb().execute({ sql: `UPDATE license_keys SET key_code='CAFYZ-OLD-1', note='Issued by founder', expires_at=? WHERE restaurant_id=?`, args: [new Date(Date.now() - 40 * DAY).toISOString(), x.restaurantId] });
    await addTester('tester.lapsed@example.com');
    expect(await applyTesterAccess('tester.lapsed@example.com', x.restaurantId)).not.toBeNull();
    expect(await trialDaysLeft(x.restaurantId)).toBeGreaterThan(29.9);
  });

  it('lets a locked-out tester back in on their next request, and keeps others locked', async () => {
    const run = async (email: string, restaurantId: string) => {
      let status = 200; let passed = false;
      const res = { status(c: number) { status = c; return this; }, json() { return this; } };
      await requireActiveSubscription({ user: { id: 'u', role: 'manager', email, restaurant_id: restaurantId } } as never, res as never, () => { passed = true; });
      return { status, passed };
    };
    const lapse = (rid: string) => getDb().execute({ sql: `UPDATE license_keys SET expires_at=? WHERE restaurant_id=?`, args: [new Date(Date.now() - DAY).toISOString(), rid] });
    const t = await createTrialRestaurant({ restaurantName: 'Guard Cafe', ownerName: 'Guard One', email: 'tester.guard@example.com', phone: '+919000000007' });
    const p = await createTrialRestaurant({ restaurantName: 'Guard Public', ownerName: 'Guard Two', email: 'public.guard@example.com', phone: '+919000000008' });
    await lapse(t.restaurantId); await lapse(p.restaurantId);
    await addTester('tester.guard@example.com');
    expect(await run('tester.guard@example.com', t.restaurantId)).toEqual({ status: 200, passed: true });
    expect(await trialDaysLeft(t.restaurantId)).toBeGreaterThan(29.9);
    expect(await run('public.guard@example.com', p.restaurantId)).toEqual({ status: 402, passed: false });
  });

  it('leaves a paid licence alone', async () => {
    const paid = await createTrialRestaurant({ restaurantName: 'Paid Cafe', ownerName: 'Paid One', email: 'paid@example.com', phone: '+919000000004' });
    await getDb().execute({ sql: `UPDATE license_keys SET key_code='CAFYZ-PAID-1', note='Annual', expires_at=? WHERE restaurant_id=?`, args: [new Date(Date.now() + 5 * DAY).toISOString(), paid.restaurantId] });
    await addTester('paid@example.com');
    expect(await applyTesterAccess('paid@example.com', paid.restaurantId)).toBeNull();
    expect(await trialDaysLeft(paid.restaurantId)).toBeLessThan(5.1);
  });
});
