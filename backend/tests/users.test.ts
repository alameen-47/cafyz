import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb, managerToken, cashierToken, waiterToken } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

describe('GET /api/users', () => {
  it('manager can list all users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('cashier cannot list users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it('waiter cannot list users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users', () => {
  it('manager can create a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'New Staff', email: 'new@test.com', role: 'waiter' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@test.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Dup User', email: 'dup@test.com', role: 'waiter' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Dup User 2', email: 'dup@test.com', role: 'cashier' });
    expect(res.status).toBe(409);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'No Email' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/:id', () => {
  it('manager can update user role', async () => {
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${managerToken}`);
    const waiter = list.body.find((u: { role: string }) => u.role === 'waiter');
    const res = await request(app)
      .put(`/api/users/${waiter.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'cashier' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('cashier');
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('manager can change status', async () => {
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${managerToken}`);
    const user = list.body[0];
    const res = await request(app)
      .patch(`/api/users/${user.id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'break' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('break');
  });
});

describe('DELETE /api/users/:id', () => {
  it('manager can delete a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'To Delete', email: 'delete@test.com', role: 'waiter' });
    const res = await request(app)
      .delete(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });

  it('cashier cannot delete a user', async () => {
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${managerToken}`);
    const res = await request(app)
      .delete(`/api/users/${list.body[0].id}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });
});
