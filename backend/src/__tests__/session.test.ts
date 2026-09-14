import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { setupTestDb } from './setup.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let token = '';

beforeAll(async () => {
  await setupTestDb();
  const res = await request(app)
    .post('/api/restaurants/onboarding')
    .send({
      restaurant_name: 'Stay Signed In Cafe',
      owner_name: 'Sam Owner',
      email: 'sam@signed-in.io',
      phone: '+919800009999',
      password: 'keeppass123',
    });
  expect(res.status).toBe(201);
  token = res.body.token;
});

describe('staying signed in', () => {
  it('issues sign-ins that last a year', () => {
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(exp - iat).toBeGreaterThanOrEqual(365 * 24 * 60 * 60);
  });

  it('renews a valid sign-in', async () => {
    const res = await request(app).post('/api/auth/refresh').set(auth(token));
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');

    const me = await request(app).get('/api/auth/me').set(auth(res.body.token));
    expect(me.status).toBe(200);
  });

  it('tags a rejected sign-in so the app knows to sign out', async () => {
    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('SESSION_INVALID');

    const bad = await request(app).post('/api/auth/refresh').set(auth('not-a-token'));
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('SESSION_INVALID');
  });

  it('treats a wrong current password as a failed check, not a lost sign-in', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ current_password: 'wrong-password-1', new_password: 'another-pass-123' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBeUndefined();

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
  });
});
