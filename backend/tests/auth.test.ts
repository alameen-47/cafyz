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
    const res = await request(app).post('/api/auth/login').send({ login: 'nobody@test.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('returns token for phone + password', async () => {
    const res = await request(app).post('/api/auth/login').send({ login: '+971500000001', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('manager');
  });

  it('validates email format when @ is present', async () => {
    const res = await request(app).post('/api/auth/login').send({ login: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('still accepts legacy email field', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'manager@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('POST /api/auth/pin', () => {
  it('logs in with correct PIN', async () => {
    const res = await request(app).post('/api/auth/pin').send({ email: 'manager@test.com', pin: '1234', device_id: 'device-test-1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong PIN', async () => {
    const res = await request(app).post('/api/auth/pin').send({ email: 'manager@test.com', pin: '0000', device_id: 'device-test-1' });
    expect(res.status).toBe(401);
  });

  it('logs in with phone + PIN', async () => {
    const res = await request(app).post('/api/auth/pin').send({ login: '+971500000001', pin: '1234', device_id: 'device-test-1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.phone).toBe('+971500000001');
  });
});

describe('OTP auth flow', () => {
  it('requests OTP for registered phone', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({ phone: '+971500000001' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.dev_otp).toBe('string');
    expect(String(res.body.dev_otp)).toMatch(/^\d{6}$/);
  });

  it('verifies OTP and returns token', async () => {
    const requestOtp = await request(app).post('/api/auth/request-otp').send({ phone: '+971500000001' });
    const otp = String(requestOtp.body.dev_otp ?? '');
    const verify = await request(app).post('/api/auth/verify-otp').send({ phone: '+971500000001', otp });
    expect(verify.status).toBe(200);
    expect(verify.body).toHaveProperty('token');
    expect(verify.body.user.email).toBe('manager@test.com');
  });

  it('rejects invalid OTP', async () => {
    await request(app).post('/api/auth/request-otp').send({ phone: '+971500000001' });
    const verify = await request(app).post('/api/auth/verify-otp').send({ phone: '+971500000001', otp: '000000' });
    expect(verify.status).toBe(401);
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
