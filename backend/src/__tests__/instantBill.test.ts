import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { setupTestDb } from './setup.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let ownerToken = '';
let restaurantId = '';
let menuIds: string[] = [];

async function freshTable(name: string): Promise<string> {
  const res = await request(app).post('/api/tables').set(auth(ownerToken)).send({ name, zone: 'Main', capacity: 4 });
  expect(res.status).toBe(201);
  return res.body.id;
}

beforeAll(async () => {
  await setupTestDb();
  const res = await request(app)
    .post('/api/restaurants/onboarding')
    .send({
      restaurant_name: 'Counter Cafe',
      owner_name: 'Cara Owner',
      email: 'cara@counter-cafe.io',
      phone: '+919800001234',
      password: 'carapass123',
    });
  expect(res.status).toBe(201);
  ownerToken = res.body.token;
  restaurantId = res.body.restaurant.id;
  const me = await request(app).get('/api/restaurants/me').set(auth(ownerToken));
  expect(me.body.service_charge_pct).toBe(0);
  expect(me.body.tax_rate_pct).toBe(0);
  expect(me.body.tax_type).toBe('GST');
  const menu = await request(app).get('/api/menu').set(auth(ownerToken));
  menuIds = menu.body.map((m: { id: string }) => m.id);
  expect(menuIds.length).toBeGreaterThan(2);
});

describe('instant bill (POS without a table)', () => {
  it('turns selected items into a paid, numbered counter bill in one request', async () => {
    const before = await request(app).get('/api/dashboard/revenue?period=day').set(auth(ownerToken));

    const res = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken)).send({
      payment_method: 'upi',
      items: [{ menu_item_id: menuIds[0], qty: 2 }, { menu_item_id: menuIds[1], qty: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.table_id).toBeNull();
    expect(res.body.payment_method).toBe('upi');
    expect(res.body.bill_no).toBeGreaterThan(0);
    expect(res.body.subtotal).toBeGreaterThan(0);

    const order = await request(app).get(`/api/orders/${res.body.id}`).set(auth(ownerToken));
    expect(order.body.status).toBe('paid');
    expect(order.body.payment_method).toBe('upi');
    expect(order.body.items).toHaveLength(2);

    // The kitchen still gets a ticket, labelled for the counter.
    const kds = await request(app).get('/api/kds/tickets').set(auth(ownerToken));
    const ticket = kds.body.find((t: { id: string }) => t.id === res.body.ticket_id);
    expect(ticket.table_name).toBe('Counter');

    const after = await request(app).get('/api/dashboard/revenue?period=day').set(auth(ownerToken));
    expect(after.body.totalRevenue).toBeGreaterThan(before.body.totalRevenue);
  });

  it('numbers bills one after another and labels takeaway tickets', async () => {
    const first = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ payment_method: 'cash', items: [{ menu_item_id: menuIds[2], qty: 1 }] });
    const second = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ payment_method: 'card', parcel: true, items: [{ menu_item_id: menuIds[0], qty: 1 }] });
    expect(second.body.bill_no).toBe(first.body.bill_no + 1);
    expect(second.body.order_type).toBe('parcel');

    const kds = await request(app).get('/api/kds/tickets').set(auth(ownerToken));
    expect(kds.body.find((t: { id: string }) => t.id === second.body.ticket_id).table_name).toBe('Parcel');
  });

  it('can skip the kitchen ticket entirely', async () => {
    const res = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ payment_method: 'cash', send_to_kitchen: false, items: [{ menu_item_id: menuIds[0], qty: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.ticket_id).toBeNull();
  });

  it('bills a free table and leaves it empty', async () => {
    const tableId = await freshTable('T-Instant');
    const res = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ table_id: tableId, payment_method: 'cash', items: [{ menu_item_id: menuIds[1], qty: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.table_name).toBe('T-Instant');

    const tables = await request(app).get('/api/tables').set(auth(ownerToken));
    expect(tables.body.find((t: { id: string }) => t.id === tableId).status).toBe('empty');
  });

  it('refuses to bill over a table that already has an open bill, which settle-table closes with a number', async () => {
    const tableId = await freshTable('T-Open');
    const sent = await request(app).post('/api/orders/quick-send').set(auth(ownerToken))
      .send({ table_id: tableId, items: [{ menu_item_id: menuIds[0], qty: 1 }] });
    expect(sent.status).toBe(201);

    const clash = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ table_id: tableId, payment_method: 'cash', items: [{ menu_item_id: menuIds[1], qty: 1 }] });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('TABLE_HAS_OPEN_BILL');

    const latest = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ payment_method: 'cash', send_to_kitchen: false, items: [{ menu_item_id: menuIds[0], qty: 1 }] });

    const settle = await request(app).post('/api/orders/settle-table').set(auth(ownerToken))
      .send({ table_id: tableId, payment_method: 'card' });
    expect(settle.status).toBe(200);
    expect(settle.body.settled).toBe(1);
    expect(settle.body.bill_no).toBe(latest.body.bill_no + 1);

    const order = await request(app).get(`/api/orders/${sent.body.id}`).set(auth(ownerToken));
    expect(order.body.status).toBe('paid');
    expect(order.body.payment_method).toBe('card');
    expect(order.body.bill_no).toBe(settle.body.bill_no);
  });

  it('rejects unknown items and staff who cannot take payments', async () => {
    const bad = await request(app).post('/api/orders/instant-bill').set(auth(ownerToken))
      .send({ payment_method: 'cash', items: [{ menu_item_id: 'nope', qty: 1 }] });
    expect(bad.status).toBe(400);

    const email = 'waiter@counter-cafe.io';
    await getDb().execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [uid(), restaurantId, 'Wren Waiter', 'WW', email, await bcrypt.hash('waiterpass123', 4), 'waiter', 'active', '—'],
    });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'waiterpass123' });
    const denied = await request(app).post('/api/orders/instant-bill').set(auth(login.body.token))
      .send({ payment_method: 'cash', items: [{ menu_item_id: menuIds[0], qty: 1 }] });
    expect(denied.status).toBe(403);
  });
});
