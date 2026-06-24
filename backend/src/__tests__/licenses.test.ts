/**
 * License key tests — generate, list, activate, revoke.
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
import { sha256Token } from '../services/licensePurchaseFulfillment.js';
import { uid } from '../utils.js';

let ownerToken  = '';
let founderToken = '';
let generatedKey = '';
let generatedId  = '';

beforeAll(async () => {
  await setupTestDb();

  const [ownerRes, founderRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS }),
    request(app).post('/api/auth/login').send({ email: FOUNDER_EMAIL, password: FOUNDER_PASS }),
  ]);
  ownerToken   = ownerRes.body.token;
  founderToken = founderRes.body.token;
});

describe('POST /api/licenses — founder generates keys', () => {
  it('returns 403 for non-founder users', async () => {
    const res = await request(app)
      .post('/api/licenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ plan: 'pro' });
    expect(res.status).toBe(403);
  });

  it('generates a single pro key', async () => {
    const res = await request(app)
      .post('/api/licenses')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ plan: 'pro', note: 'Test key' });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('pro');
    expect(res.body.key_code).toMatch(/^CAFYZ-PRO-/);
    generatedKey = res.body.key_code;
    generatedId  = res.body.id;
  });

  it('generates multiple keys with quantity', async () => {
    const res = await request(app)
      .post('/api/licenses')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ plan: 'premium', quantity: 3 });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    res.body.forEach((k: any) => {
      expect(k.key_code).toMatch(/^CAFYZ-PRE-/);
    });
  });
});

describe('GET /api/licenses — founder lists all keys', () => {
  it('returns 403 for non-founder', async () => {
    const res = await request(app)
      .get('/api/licenses')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns all keys for founder', async () => {
    const res = await request(app)
      .get('/api/licenses')
      .set('Authorization', `Bearer ${founderToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/licenses/activate', () => {
  it('activates a valid key and upgrades restaurant plan', async () => {
    const res = await request(app)
      .post('/api/licenses/activate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ key_code: generatedKey });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.plan).toBe('pro');
  });

  it('rejects an already-used key', async () => {
    const res = await request(app)
      .post('/api/licenses/activate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ key_code: generatedKey });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid key', async () => {
    const res = await request(app)
      .post('/api/licenses/activate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ key_code: 'CAFYZ-XXX-00000000' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/licenses/mine', () => {
  it('returns current restaurant plan and license', async () => {
    const res = await request(app)
      .get('/api/licenses/mine')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(res.body).toHaveProperty('license');
  });
});

describe('DELETE /api/licenses/:id — founder revokes', () => {
  it('returns 403 for non-founder', async () => {
    const res = await request(app)
      .delete(`/api/licenses/${generatedId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('revokes a key (204 no content)', async () => {
    // Generate a fresh key to revoke
    const genRes = await request(app)
      .post('/api/licenses')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ plan: 'basic' });
    const id = genRes.body.id;

    const res = await request(app)
      .delete(`/api/licenses/${id}`)
      .set('Authorization', `Bearer ${founderToken}`);
    expect(res.status).toBe(204);
  });
});

describe('Renewal purchase requests', () => {
  it('owner can request renewal with founder plan pricing', async () => {
    const res = await request(app)
      .post('/api/licenses/purchase-request')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ plan: 'premium', note: 'Please renew' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.plan).toBe('premium');
    expect(res.body).toHaveProperty('founder_email');
  });

  it('founder can fulfill renewal and upgrade plan', async () => {
    const pending = await request(app)
      .get('/api/founder/license-requests')
      .set('Authorization', `Bearer ${founderToken}`);
    const req = pending.body.find((r: { status: string }) => r.status === 'pending');
    expect(req).toBeTruthy();

    const fulfill = await request(app)
      .post(`/api/founder/license-requests/${req.id}/fulfill`)
      .set('Authorization', `Bearer ${founderToken}`);
    expect(fulfill.status).toBe(200);
    expect(fulfill.body.status).toBe('fulfilled');
    expect(fulfill.body.plan).toBe('premium');

    const mine = await request(app)
      .get('/api/licenses/mine')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(mine.body.plan).toBe('premium');
    expect(mine.body.trial_expired).toBe(false);
  });

  it('email deny link cancels a pending request', async () => {
    const token = 'test-deny-token-abc';
    const id = uid();
    const owner = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS });
    const ownerId = owner.body.user.id;

    await getDb().execute({
      sql: `INSERT INTO license_purchase_requests(id,restaurant_id,requester_user_id,email,plan,status,token_hash)
            VALUES(?,?,?,?,?,'pending',?)`,
      args: [id, DEMO_REST, ownerId, OWNER_EMAIL, 'pro', sha256Token(token)],
    });

    const deny = await request(app).get(
      `/api/licenses/renewal/action?id=${id}&token=${token}&action=deny`,
    );
    expect(deny.status).toBe(200);
    expect(deny.text).toContain('denied');

    const row = await getDb().execute({
      sql: `SELECT status FROM license_purchase_requests WHERE id=?`,
      args: [id],
    });
    expect(row.rows[0]?.status).toBe('cancelled');
  });
});
