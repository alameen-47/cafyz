import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb, managerToken, waiterToken } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

let orderId = '';
let itemId  = '';

describe('POST /api/orders', () => {
  it('creates an order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ table_id: 'TST1', covers: 3 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    orderId = res.body.id;
  });
});

describe('GET /api/orders', () => {
  it('manager can list all orders', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/orders?status=open').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    res.body.forEach((o: { status: string }) => expect(o.status).toBe('open'));
  });
});

describe('GET /api/orders/:id', () => {
  it('returns order with items', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns 404 for unknown order', async () => {
    const res = await request(app).get('/api/orders/bad-id').set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/orders/:id/items', () => {
  it('adds an item to the order', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ menu_item_id: 'ITEM1', qty: 2, mods: ['no garlic'] });
    expect(res.status).toBe(201);
    expect(res.body.qty).toBe(2);
    itemId = res.body.id;
  });
});

describe('PUT /api/orders/:id/items/:itemId', () => {
  it('updates item quantity', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${itemId}`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ qty: 3 });
    expect(res.status).toBe(200);
    expect(res.body.qty).toBe(3);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  it('marks order as sent', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'sent' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
  });

  it('marks order as paid', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/orders/:id/items/:itemId', () => {
  it('removes an item', async () => {
    const newOrder = await request(app).post('/api/orders').set('Authorization', `Bearer ${waiterToken}`).send({ covers: 2 });
    const newItem  = await request(app).post(`/api/orders/${newOrder.body.id}/items`).set('Authorization', `Bearer ${waiterToken}`).send({ menu_item_id: 'ITEM1', qty: 1 });
    const res = await request(app)
      .delete(`/api/orders/${newOrder.body.id}/items/${newItem.body.id}`)
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(204);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('only manager can delete an order', async () => {
    const o = await request(app).post('/api/orders').set('Authorization', `Bearer ${waiterToken}`).send({ covers: 1 });
    const denied = await request(app).delete(`/api/orders/${o.body.id}`).set('Authorization', `Bearer ${waiterToken}`);
    expect(denied.status).toBe(403);
    const ok = await request(app).delete(`/api/orders/${o.body.id}`).set('Authorization', `Bearer ${managerToken}`);
    expect(ok.status).toBe(204);
  });
});
