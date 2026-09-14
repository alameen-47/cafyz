import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { setupTestDb, OWNER_EMAIL, OWNER_PASS } from './setup.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let ownerToken = '';
let restaurantId = '';

beforeAll(async () => {
  await setupTestDb();
  const res = await request(app)
    .post('/api/restaurants/onboarding')
    .send({
      restaurant_name: 'Sample Diner',
      owner_name: 'Dana Owner',
      email: 'dana@sample-diner.io',
      phone: '+971500004321',
      password: 'danapass123',
    });
  expect(res.status).toBe(201);
  ownerToken = res.body.token;
  restaurantId = res.body.restaurant.id;
});

describe('demo data', () => {
  it('loads demo data into a new restaurant so the first login shows it', async () => {
    const status = await request(app).get('/api/restaurants/demo/status').set(auth(ownerToken));
    expect(status.status).toBe(200);
    expect(status.body.enabled).toBe(true);
    expect(status.body.intro_seen).toBe(false);
    expect(status.body.can_manage).toBe(true);
    expect(status.body.counts.menu_items).toBeGreaterThan(10);
    expect(status.body.counts.orders).toBeGreaterThan(50);
    expect(status.body.counts.staff).toBeGreaterThan(0);

    const [menu, kds, stats] = await Promise.all([
      request(app).get('/api/menu').set(auth(ownerToken)),
      request(app).get('/api/kds/tickets').set(auth(ownerToken)),
      request(app).get('/api/dashboard/stats').set(auth(ownerToken)),
    ]);
    expect(menu.body.length).toBeGreaterThan(10);
    expect(kds.body.length).toBeGreaterThan(0);
    expect(stats.body.tables_total).toBeGreaterThan(5);

    // Whatever the time of day, today already has sales so the dashboard never opens on $0.
    const today = await request(app).get('/api/dashboard/revenue?period=day').set(auth(ownerToken));
    expect(today.status).toBe(200);
    expect(today.body.totalRevenue).toBeGreaterThan(0);
  });

  it('remembers when a user has seen the demo intro', async () => {
    const res = await request(app)
      .put('/api/restaurants/demo/status')
      .set(auth(ownerToken))
      .send({ intro_seen: true });
    expect(res.status).toBe(200);
    expect(res.body.intro_seen).toBe(true);
    expect(res.body.enabled).toBe(true);
  });

  it('only lets owners and managers switch demo data', async () => {
    const email = 'waiter@sample-diner.io';
    await getDb().execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [uid(), restaurantId, 'Wes Waiter', 'WW', email, await bcrypt.hash('waiterpass123', 4), 'waiter', 'active', '—'],
    });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'waiterpass123' });
    expect(login.status).toBe(200);

    const denied = await request(app)
      .put('/api/restaurants/demo/status')
      .set(auth(login.body.token))
      .send({ enabled: false });
    expect(denied.status).toBe(403);

    const status = await request(app).get('/api/restaurants/demo/status').set(auth(login.body.token));
    expect(status.body.enabled).toBe(true);
    expect(status.body.can_manage).toBe(false);
  });

  it('switching off removes demo rows and orders placed during the demo, but keeps real data', async () => {
    const db = getDb();
    const realItemId = uid();
    await db.execute({
      sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price) VALUES(?,?,?,?,?)`,
      args: [realItemId, restaurantId, 'House Special', 'mains', 15],
    });

    const order = await request(app).post('/api/orders').set(auth(ownerToken)).send({ covers: 2 });
    expect(order.status).toBe(201);
    expect(order.body.is_demo).toBe(1);

    const off = await request(app)
      .put('/api/restaurants/demo/status')
      .set(auth(ownerToken))
      .send({ enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);
    expect(Object.values(off.body.counts).every(n => n === 0)).toBe(true);

    const [menu, users, kds] = await Promise.all([
      request(app).get('/api/menu').set(auth(ownerToken)),
      request(app).get('/api/users').set(auth(ownerToken)),
      request(app).get('/api/kds/tickets').set(auth(ownerToken)),
    ]);
    expect(menu.body.map((m: { id: string }) => m.id)).toEqual([realItemId]);
    expect(users.body.map((u: { email: string }) => u.email).sort()).toEqual(['dana@sample-diner.io', 'waiter@sample-diner.io']);
    expect(kds.body).toHaveLength(0);

    const orders = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM orders WHERE restaurant_id=?', args: [restaurantId] });
    expect(Number(orders.rows[0]?.n)).toBe(0);

    const realOrder = await request(app).post('/api/orders').set(auth(ownerToken)).send({ covers: 1 });
    expect(realOrder.body.is_demo).toBe(0);
  });

  it('switching back on reloads the demo data', async () => {
    const on = await request(app)
      .put('/api/restaurants/demo/status')
      .set(auth(ownerToken))
      .send({ enabled: true });
    expect(on.status).toBe(200);
    expect(on.body.enabled).toBe(true);
    expect(on.body.counts.menu_items).toBeGreaterThan(10);
    expect(on.body.counts.orders).toBeGreaterThan(50);
  });

  it('leaves existing restaurants without demo data', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS });
    expect(login.status).toBe(200);
    const status = await request(app).get('/api/restaurants/demo/status').set(auth(login.body.token));
    expect(status.body.enabled).toBe(false);
    expect(Object.values(status.body.counts).every(n => n === 0)).toBe(true);
  });

  it('renames older demo dishes so the name and description match the photo', async () => {
    const { syncDemoMenuCopy } = await import('../services/demoData.js');
    const db = getDb();
    const id = uid();
    await db.execute({
      sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price,description,is_demo) VALUES(?,?,?,?,?,?,1)`,
      args: [id, restaurantId, 'Fresh Lime Soda', 'drinks', 99, 'Sweet or salted'],
    });

    await syncDemoMenuCopy();

    const row = await db.execute({ sql: 'SELECT name, description FROM menu_items WHERE id=?', args: [id] });
    expect(row.rows[0]?.name).toBe('Lemon-Lime Slush');
    expect(row.rows[0]?.description).toBe('Frozen, sweet and tangy');
  });
});
