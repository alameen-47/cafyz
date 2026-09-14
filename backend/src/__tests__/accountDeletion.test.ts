import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { getDb } from '../db.js';
import { setupTestDb, MANAGER_EMAIL, MANAGER_PASS, DEMO_REST } from './setup.js';
import { processDueAccountDeletions } from '../services/accountDeletion.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const EIGHT_DAYS = 8 * 86_400_000;
const OWNER = { email: 'leaving@owner.io', password: 'leavingpass123' };

let ownerToken = '';
let restaurantId = '';

const count = async (sql: string, args: string[]) =>
  Number((await getDb().execute({ sql, args })).rows[0]?.n ?? 0);

beforeAll(async () => {
  await setupTestDb();
  const res = await request(app)
    .post('/api/restaurants/onboarding')
    .send({ restaurant_name: 'Closing Cafe', owner_name: 'Lee Owner', email: OWNER.email, phone: '+971500009911', password: OWNER.password });
  expect(res.status).toBe(201);
  ownerToken = res.body.token;
  restaurantId = res.body.restaurant.id;
});

describe('account deletion', () => {
  it('needs the typed confirmation and the right password', async () => {
    const noConfirm = await request(app).delete('/api/auth/account').set(auth(ownerToken)).send({ password: OWNER.password });
    expect(noConfirm.status).toBe(400);

    const wrongPassword = await request(app).delete('/api/auth/account').set(auth(ownerToken))
      .send({ password: 'not-my-password', confirm: 'DELETE' });
    expect(wrongPassword.status).toBe(401);
  });

  it('schedules deletion 7 days out instead of deleting now', async () => {
    const res = await request(app).delete('/api/auth/account').set(auth(ownerToken))
      .send({ password: OWNER.password, confirm: 'DELETE' });
    expect(res.status).toBe(200);
    const days = (new Date(res.body.scheduled_for).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    expect(await processDueAccountDeletions()).toBe(0);
    const me = await request(app).get('/api/auth/me').set(auth(ownerToken));
    expect(me.body.deletion_scheduled_at).toBe(res.body.scheduled_for);
  });

  it('signing in again cancels the scheduled deletion', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: OWNER.email, password: OWNER.password });
    expect(login.status).toBe(200);
    ownerToken = login.body.token;

    const me = await request(app).get('/api/auth/me').set(auth(ownerToken));
    expect(me.body.deletion_scheduled_at).toBeNull();
  });

  it('removes the restaurant and all of its data once the grace period ends', async () => {
    await request(app).delete('/api/auth/account').set(auth(ownerToken)).send({ password: OWNER.password, confirm: 'DELETE' });

    expect(await processDueAccountDeletions(new Date(Date.now() + EIGHT_DAYS))).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM restaurants WHERE id=?', [restaurantId])).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE restaurant_id=?', [restaurantId])).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM menu_items WHERE restaurant_id=?', [restaurantId])).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM orders WHERE restaurant_id=?', [restaurantId])).toBe(0);
  });

  it('a staff member deleting their account leaves the restaurant in place', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: MANAGER_EMAIL, password: MANAGER_PASS });
    const res = await request(app).delete('/api/auth/account').set(auth(login.body.token))
      .send({ password: MANAGER_PASS, confirm: 'DELETE' });
    expect(res.status).toBe(200);

    await processDueAccountDeletions(new Date(Date.now() + EIGHT_DAYS));
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE LOWER(email)=?', [MANAGER_EMAIL])).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM restaurants WHERE id=?', [DEMO_REST])).toBe(1);
  });
});
