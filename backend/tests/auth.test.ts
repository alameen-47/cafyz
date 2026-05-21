import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'manager@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('manager');
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'manager@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('validates email format', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/pin', () => {
  it('logs in with correct PIN', async () => {
    const res = await request(app).post('/api/auth/pin').send({ pin: '1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong PIN', async () => {
    const res = await request(app).post('/api/auth/pin').send({ pin: '0000' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'manager@test.com', password: 'password123' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('manager@test.com');
  });

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
