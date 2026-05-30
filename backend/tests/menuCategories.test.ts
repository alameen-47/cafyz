import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb, managerToken } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

describe('GET /api/menu/categories', () => {
  it('returns categories for authenticated manager', async () => {
    const res = await request(app)
      .get('/api/menu/categories')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('slug');
    expect(res.body[0]).toHaveProperty('label');
  });
});

describe('POST /api/menu/categories', () => {
  it('manager can create a custom category', async () => {
    const res = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ label: 'Small Plates' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Small Plates');
    expect(res.body.slug).toBe('small_plates');
  });

  it('can assign menu items to the new category', async () => {
    const cat = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ label: 'Brunch Specials' });
    const item = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Avocado Toast',
        category: cat.body.slug,
        price: 14,
        description: 'Sourdough · poached egg',
        symbol: '◎',
      });
    expect(item.status).toBe(201);
    expect(item.body.category).toBe('brunch_specials');
  });
});

describe('DELETE /api/menu/categories/:id', () => {
  it('blocks delete when items use the category', async () => {
    const cat = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ label: 'Temp Category' });
    await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Temp Item', category: cat.body.slug, price: 5 });
    const res = await request(app)
      .delete(`/api/menu/categories/${cat.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(409);
  });
});
