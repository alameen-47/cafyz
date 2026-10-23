import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb } from './setup.js';
import { ensureStoreDemoAccount } from '../services/ensureStoreDemo.js';

beforeAll(async () => {
  await setupTestDb();
  process.env.STORE_DEMO_EMAIL = 'reviewer@cafyz.com';
  process.env.STORE_DEMO_PASSWORD = 'test-only-demo-password';
});

describe('ensureStoreDemoAccount', () => {
  it('creates a reviewer restaurant with menu and active license', async () => {
    await ensureStoreDemoAccount();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@cafyz.com', password: 'test-only-demo-password' });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('owner');
    expect(login.body.restaurant_name).toBe('Cafyz Demo Restaurant');
    expect(login.body.restaurant_plan).toBe('premium');

    const token = login.body.token as string;
    const menu = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${token}`);

    expect(menu.status).toBe(200);
    expect(menu.body.length).toBeGreaterThanOrEqual(10);
  });

  it('is idempotent on second run', async () => {
    await ensureStoreDemoAccount();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@cafyz.com', password: 'test-only-demo-password' });

    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('reviewer@cafyz.com');
  });

  it('keeps an existing account working when no password is configured', async () => {
    // Deployed without STORE_DEMO_PASSWORD: the reviewer must still be able to
    // sign in with the password already on the account, and the restaurant must
    // still be synced to the premium plan for App Review.
    const configured = process.env.STORE_DEMO_PASSWORD;
    delete process.env.STORE_DEMO_PASSWORD;
    try {
      await ensureStoreDemoAccount();
    } finally {
      process.env.STORE_DEMO_PASSWORD = configured;
    }

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@cafyz.com', password: 'test-only-demo-password' });

    expect(login.status).toBe(200);
    expect(login.body.restaurant_plan).toBe('premium');
  });
});
