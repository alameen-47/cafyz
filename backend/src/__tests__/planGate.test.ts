/**
 * Plan gate tests — verify that pro/premium routes return 403 for basic plans
 * and 200 for correctly-entitled plans.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  setupTestDb,
  OWNER_EMAIL, OWNER_PASS,
  FOUNDER_EMAIL, FOUNDER_PASS,
  DEMO_REST,
} from './setup.js';
import { getDb } from '../db.js';

let basicToken  = '';
let founderToken = '';

beforeAll(async () => {
  await setupTestDb();

  const [ownerRes, founderRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS }),
    request(app).post('/api/auth/login').send({ email: FOUNDER_EMAIL, password: FOUNDER_PASS }),
  ]);
  basicToken   = ownerRes.body.token;
  founderToken = founderRes.body.token;
});

describe('Plan gates — basic plan', () => {
  it('GET /api/kds/tickets returns 403 for basic plan', async () => {
    const res = await request(app)
      .get('/api/kds/tickets')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
    expect(res.body.required_plan).toBe('pro');
  });

  it('GET /api/dashboard/stats returns 200 for basic plan (overview KPIs)', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders_today');
  });

  it('GET /api/dashboard/revenue returns 403 for basic plan', async () => {
    const res = await request(app)
      .get('/api/dashboard/revenue?period=week')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
    expect(res.body.required_plan).toBe('pro');
  });

  it('GET /api/dashboard/analytics returns 403 for basic plan', async () => {
    const res = await request(app)
      .get('/api/dashboard/analytics?period=week')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
    expect(res.body.required_plan).toBe('pro');
  });

  it('GET /api/inventory returns 403 for basic plan', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/reservations returns 403 for basic plan', async () => {
    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
    expect(res.body.required_plan).toBe('premium');
  });
});

describe('Plan gates — plan upgrade', () => {
  it('GET /api/kds/tickets returns 200 after upgrading to pro', async () => {
    // Upgrade demo restaurant to pro
    await getDb().execute({
      sql: `UPDATE restaurants SET plan='pro' WHERE id=?`,
      args: [DEMO_REST],
    });

    // Re-login to get a fresh token (plan is in the restaurant, not the token,
    // but the guard reads from the DB so same token works)
    const res = await request(app)
      .get('/api/kds/tickets')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/reservations still returns 403 on pro (needs premium)', async () => {
    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(403);
    expect(res.body.required_plan).toBe('premium');
  });

  it('GET /api/reservations returns 200 after upgrading to premium', async () => {
    await getDb().execute({
      sql: `UPDATE restaurants SET plan='premium' WHERE id=?`,
      args: [DEMO_REST],
    });

    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Plan gates — founder scope isolation', () => {
  it('founder cannot access restaurant KDS routes', async () => {
    const res = await request(app)
      .get('/api/kds/tickets')
      .set('Authorization', `Bearer ${founderToken}`);
    expect(res.status).toBe(403);
  });
});
