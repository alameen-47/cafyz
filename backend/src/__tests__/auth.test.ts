import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
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

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'any' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/pin', () => {
  it('returns 200 + token for valid PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin')
      .send({ pin: MANAGER_PIN });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('manager');
  });

  it('returns 401 for wrong PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin')
      .send({ pin: '0000' });

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
