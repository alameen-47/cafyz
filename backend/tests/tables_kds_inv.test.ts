import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb, managerToken, cashierToken, waiterToken } from './setup.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

// ── Tables ────────────────────────────────────────────────────────────────────
describe('Tables CRUD', () => {
  let tableId = '';

  it('GET /api/tables returns list', async () => {
    const res = await request(app).get('/api/tables').set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /api/tables — manager creates table', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'T·99', zone: 'Test Zone', capacity: 4 });
    expect(res.status).toBe(201);
    tableId = res.body.id;
  });

  it('waiter cannot create table', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'T·88', zone: 'Test Zone', capacity: 2 });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/tables/:id/status — waiter updates status', async () => {
    const res = await request(app)
      .patch(`/api/tables/${tableId}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'occupied', course: 'Starters', covers: 4 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('occupied');
  });

  it('DELETE /api/tables/:id — manager deletes table', async () => {
    const res = await request(app)
      .delete(`/api/tables/${tableId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });
});

// ── KDS ───────────────────────────────────────────────────────────────────────
describe('KDS Ticket Flow', () => {
  let ticketId = '';
  const payload = {
    order_id: 'test-order-kds',
    table_name: 'T·07',
    server_name: 'Jules',
    covers: 2,
    items: [{ name: 'Duck Confit', qty: 1, station: 'GRILL', mods: [] }],
  };

  it('POST /api/kds/tickets creates a ticket', async () => {
    const res = await request(app)
      .post('/api/kds/tickets')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('new');
    expect(res.body.items.length).toBe(1);
    ticketId = res.body.id;
  });

  it('GET /api/kds/tickets lists tickets', async () => {
    const res = await request(app).get('/api/kds/tickets').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH fire: new → prep', async () => {
    const res = await request(app).patch(`/api/kds/tickets/${ticketId}/fire`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('prep');
  });

  it('PATCH ready: prep → ready', async () => {
    const res = await request(app).patch(`/api/kds/tickets/${ticketId}/ready`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('PATCH delivered: ready → delivered', async () => {
    const res = await request(app).patch(`/api/kds/tickets/${ticketId}/delivered`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });

  it('DELETE /api/kds/tickets/:id', async () => {
    const res = await request(app).delete(`/api/kds/tickets/${ticketId}`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });
});

// ── Inventory ─────────────────────────────────────────────────────────────────
describe('Inventory CRUD', () => {
  let invId = '';

  it('GET /api/inventory lists items', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/inventory cashier creates item', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Test Item', par: 10, current: 8, unit: 'kg' });
    expect(res.status).toBe(201);
    invId = res.body.id;
  });

  it('PUT /api/inventory/:id updates current level', async () => {
    const res = await request(app)
      .put(`/api/inventory/${invId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ current: 3 });
    expect(res.status).toBe(200);
    expect(res.body.current).toBe(3);
  });

  it('DELETE /api/inventory/:id — manager only', async () => {
    const deny = await request(app).delete(`/api/inventory/${invId}`).set('Authorization', `Bearer ${cashierToken}`);
    expect(deny.status).toBe(403);
    const ok = await request(app).delete(`/api/inventory/${invId}`).set('Authorization', `Bearer ${managerToken}`);
    expect(ok.status).toBe(204);
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
describe('Dashboard', () => {
  it('GET /api/dashboard/stats returns metrics', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders_today');
    expect(res.body).toHaveProperty('tables_total');
    expect(res.body).toHaveProperty('staff_active');
  });

  it('waiter cannot access dashboard', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Reservations ──────────────────────────────────────────────────────────────
describe('Reservations CRUD', () => {
  let resId = '';

  it('POST creates reservation', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ guest_name: 'Dupont', covers: 4, res_time: '20:00', note: 'Anniversary' });
    expect(res.status).toBe(201);
    resId = res.body.id;
  });

  it('GET lists reservations', async () => {
    const res = await request(app).get('/api/reservations').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT updates reservation', async () => {
    const res = await request(app)
      .put(`/api/reservations/${resId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'seated', covers: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('seated');
  });

  it('DELETE removes reservation', async () => {
    const res = await request(app).delete(`/api/reservations/${resId}`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });
});
