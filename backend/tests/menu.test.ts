import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb, managerToken, cashierToken } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

const newItem = { name: 'Duck Confit', category: 'mains', price: 38, description: 'Crispy skin · cherry jus', symbol: '◑' };

describe('GET /api/menu', () => {
  it('returns menu items (no auth required)', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/menu?category=starters');
    expect(res.status).toBe(200);
    res.body.forEach((item: { category: string }) => expect(item.category).toBe('starters'));
  });
});

describe('POST /api/menu', () => {
  it('manager can create a menu item', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(newItem);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Duck Confit');
    expect(res.body.price).toBe(38);
  });

  it('cashier can create a menu item', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ ...newItem, name: 'Duck Confit 2' });
    expect(res.status).toBe(201);
  });

  it('rejects negative price', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...newItem, price: -10 });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/menu/:id', () => {
  it('manager can set image_url', async () => {
    const created = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...newItem, name: 'Photo Item' });
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';
    const res = await request(app)
      .put(`/api/menu/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ image_url: url });
    expect(res.status).toBe(200);
    expect(res.body.image_url).toBe(url);
  });

  it('manager can update price', async () => {
    const created = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...newItem, name: 'Update Test Item' });
    const res = await request(app)
      .put(`/api/menu/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ price: 45 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(45);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .put('/api/menu/non-existent-id')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ price: 99 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/menu/:id', () => {
  it('manager can delete a menu item', async () => {
    const created = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...newItem, name: 'Delete Me' });
    const res = await request(app)
      .delete(`/api/menu/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });
});
