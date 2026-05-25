import { createClient } from '@libsql/client';
import { setDb, resetDb } from '../src/db.js';
import { runMigrations } from '../src/schema.js';
import bcrypt from 'bcryptjs';
import { uid } from '../src/utils.js';

export let managerToken = '';
export let cashierToken  = '';
export let waiterToken   = '';
export let kitchenToken  = '';
export let managerId     = '';
export let cashierId     = '';

export async function setupTestDb() {
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await runMigrations();

  const db = client;
  const pw = await bcrypt.hash('password123', 10);
  const pin1 = await bcrypt.hash('1234', 10);

  managerId = uid();
  cashierId = uid();
  const waiterId  = uid();
  const kitchenId = uid();

  // Insert test restaurant on premium so all plan-gated routes are accessible
  await db.execute({
    sql: `INSERT INTO restaurants(id,name,slug,plan) VALUES('TEST_REST','Test Restaurant','test-restaurant','premium')`,
    args: [],
  });

  await db.executeMultiple(`
    INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time,pin_hash)
    VALUES('${managerId}','TEST_REST','Test Manager','TM','manager@test.com','${pw}','manager','active','18:00','${pin1}');
    INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
    VALUES('${cashierId}','TEST_REST','Test Cashier','TC','cashier@test.com','${pw}','cashier','active','18:00');
    INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
    VALUES('${waiterId}','TEST_REST','Test Waiter','TW','waiter@test.com','${pw}','waiter','active','18:00');
    INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
    VALUES('${kitchenId}','TEST_REST','Test Kitchen','TK','kitchen@test.com','${pw}','kitchen','active','16:00');
  `);

  // Seed a table and menu item for tests
  await db.execute({ sql: `INSERT INTO restaurant_tables(id,restaurant_id,name,zone,capacity) VALUES('TST1','TEST_REST','T·01','Main',4)`, args: [] });
  await db.execute({
    sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price,description,symbol) VALUES('ITEM1','TEST_REST','Burrata','starters',18,'Test item','○')`,
    args: [],
  });
  // Seed an order so KDS FK constraint (kds_tickets.order_id REFERENCES orders) passes
  await db.execute({
    sql: `INSERT INTO orders(id,restaurant_id,covers,status,server_id) VALUES('test-order-kds','TEST_REST',2,'open','${managerId}')`,
    args: [],
  });

  // Get tokens via login
  const req = await import('supertest');
  const appModule = await import('../src/app.js');
  const s = req.default(appModule.default);

  const m = await s.post('/api/auth/login').send({ email:'manager@test.com', password:'password123' });
  const c = await s.post('/api/auth/login').send({ email:'cashier@test.com', password:'password123' });
  const w = await s.post('/api/auth/login').send({ email:'waiter@test.com',  password:'password123' });
  const k = await s.post('/api/auth/login').send({ email:'kitchen@test.com', password:'password123' });

  managerToken = m.body.token;
  cashierToken  = c.body.token;
  waiterToken   = w.body.token;
  kitchenToken  = k.body.token;
}

export function teardownTestDb() { resetDb(); }
