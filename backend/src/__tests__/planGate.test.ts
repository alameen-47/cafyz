/**
 * Module access by plan.
 *
 * Plans no longer differ by feature: every plan (1 Year / 2 Years / Lifetime)
 * includes every module, and differs only by licence term and support window.
 * These tests pin that — a restaurant on the cheapest plan must reach the
 * modules that used to be pro/premium-only, so a plan-rank gate can never be
 * reintroduced by accident.
 *
 * Access is still governed by section and role permissions; only the
 * plan-rank dimension is gone.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  setupTestDb,
  OWNER_EMAIL, OWNER_PASS,
  DEMO_REST,
} from './setup.js';
import { getDb } from '../db.js';

let ownerToken = '';

async function setRestaurantPlan(plan: string) {
  await getDb().execute({ sql: 'UPDATE restaurants SET plan=? WHERE id=?', args: [plan, DEMO_REST] });
  // requirePlan cached plan for 60s; the cache is bypassed under NODE_ENV=test.
}

beforeAll(async () => {
  await setupTestDb();
  const res = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS });
  ownerToken = res.body.token;
});

// Modules that were previously gated behind pro or premium.
const FORMERLY_GATED = [
  '/api/kds/tickets',
  '/api/inventory',
  '/api/reservations',
  '/api/dashboard/revenue?period=week',
  '/api/dashboard/analytics',
];

describe.each(['basic', 'pro', 'premium'])('plan %s reaches every module', (plan) => {
  beforeAll(async () => { await setRestaurantPlan(plan); });

  it.each(FORMERLY_GATED)('%s is not blocked by plan', async (path) => {
    const res = await request(app).get(path).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).not.toBe(403);
    expect(res.body.required_plan).toBeUndefined();
  });
});

describe('overview KPIs stay available', () => {
  beforeAll(async () => { await setRestaurantPlan('basic'); });

  it('GET /api/dashboard/stats returns 200', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });
});
