import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import app from '../app.js';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import {
  setupTestDb,
  OWNER_EMAIL, OWNER_PASS,
  MANAGER_EMAIL, MANAGER_PASS, MANAGER_PIN,
  FOUNDER_EMAIL, FOUNDER_PASS,
} from './setup.js';

beforeAll(async () => {
  await setupTestDb();
});

describe('POST /api/auth/login', () => {
  it('returns 200 + token for valid owner credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASS });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('owner');
    expect(res.body).toHaveProperty('restaurant_plan');
  });

  it('returns 200 + token for valid founder credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: FOUNDER_EMAIL, password: FOUNDER_PASS });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('founder');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'any' });

    expect(res.status).toBe(404);
  });

});

describe('POST /api/auth/pin', () => {
  it('returns 200 + token for valid PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin')
      .send({ email: MANAGER_EMAIL, pin: MANAGER_PIN, device_id: 'device-auth-suite-1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('manager');
  });

  it('returns 401 for wrong PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin')
      .send({ email: MANAGER_EMAIL, pin: '0000', device_id: 'device-auth-suite-1' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user info with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGER_EMAIL, password: MANAGER_PASS });

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(MANAGER_EMAIL);
    expect(res.body.role).toBe('manager');
  });

  it('returns 401 with tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });
});

describe('password reset flow', () => {
  it('creates a password reset token for existing account', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: MANAGER_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const db = getDb();
    const manager = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(email)=? LIMIT 1`,
      args: [MANAGER_EMAIL.toLowerCase()],
    });
    const managerId = String((manager.rows[0] as Record<string, unknown>).id);
    const tokens = await db.execute({
      sql: `SELECT id FROM password_reset_tokens WHERE user_id=?`,
      args: [managerId],
    });
    expect(tokens.rows.length).toBeGreaterThan(0);
  });

  it('resets password with a valid token and allows login', async () => {
    const db = getDb();
    const manager = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(email)=? LIMIT 1`,
      args: [MANAGER_EMAIL.toLowerCase()],
    });
    const managerId = String((manager.rows[0] as Record<string, unknown>).id);
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await db.execute({
      sql: `INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at,used_at)
            VALUES(?,?,?,datetime('now','+30 minutes'),NULL)`,
      args: [uid(), managerId, tokenHash],
    });

    const newPassword = 'new-secure-password-1';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: newPassword });

    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGER_EMAIL, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });
});
