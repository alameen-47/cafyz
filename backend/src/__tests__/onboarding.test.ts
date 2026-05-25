/**
 * Restaurant onboarding tests — self-registration creates restaurant + owner user.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb } from './setup.js';

beforeAll(async () => {
  await setupTestDb();
});

describe('POST /api/restaurants/onboarding', () => {
  it('creates a restaurant and owner, returns token', async () => {
    const res = await request(app)
      .post('/api/restaurants/onboarding')
      .send({
        restaurant_name: 'Bistro Test',
        owner_name: 'Alice Dupont',
        email: 'alice@bistro-test.com',
        password: 'securepass123',
        timezone: 'Europe/Paris',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.restaurant.name).toBe('Bistro Test');
    expect(res.body.user.role).toBe('owner');
    expect(res.body.restaurant.plan).toBe('basic');
    expect(res.body.restaurant.timezone).toBe('Europe/Paris');
  });

  it('allows same email across different restaurants (multi-tenant)', async () => {
    // email uniqueness is scoped to (restaurant_id, email) — same email can
    // own separate restaurants
    const res = await request(app)
      .post('/api/restaurants/onboarding')
      .send({
        restaurant_name: 'Second Bistro',
        owner_name: 'Alice Dupont',
        email: 'alice@bistro-test.com',
        password: 'securepass123',
      });

    // 201 because it's a *new* restaurant with a different restaurant_id
    expect(res.status).toBe(201);
    expect(res.body.restaurant.name).toBe('Second Bistro');
  });

  it('rejects password shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/restaurants/onboarding')
      .send({
        restaurant_name: 'Short Pass',
        owner_name: 'Bob',
        email: 'bob@short.com',
        password: '1234567', // 7 chars
      });

    expect(res.status).toBe(400);
  });

  it('rejects missing restaurant_name', async () => {
    const res = await request(app)
      .post('/api/restaurants/onboarding')
      .send({
        owner_name: 'Bob',
        email: 'bob2@test.com',
        password: 'validpass123',
      });

    expect(res.status).toBe(400);
  });

  it('new restaurant defaults to basic plan', async () => {
    const res = await request(app)
      .post('/api/restaurants/onboarding')
      .send({
        restaurant_name: 'New Place',
        owner_name: 'Charlie',
        email: 'charlie@new-place.com',
        password: 'charliepw123',
      });

    expect(res.status).toBe(201);
    expect(res.body.restaurant.plan).toBe('basic');
  });
});
