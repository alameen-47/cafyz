/**
 * Test setup — spins up an in-memory libSQL database, runs all migrations,
 * and seeds the minimum data needed for every test suite.
 *
 * Import this file at the top of every test (or via vitest globalSetup).
 */
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { setDb } from '../db.js';
import { runMigrations } from '../schema.js';
import { uid } from '../utils.js';

export const SYSTEM_REST  = 'CAFYZ_SYSTEM';
export const DEMO_REST    = 'TEST_REST_01';
export const FOUNDER_EMAIL   = 'founder@cafyz.io';
export const FOUNDER_PASS    = 'cafyz-founder-2026';
export const OWNER_EMAIL  = 'owner@test.io';
export const OWNER_PASS   = 'ownerpass123';
export const MANAGER_EMAIL = 'manager@test.io';
export const MANAGER_PASS  = 'managerpass123';
export const MANAGER_PIN   = '1234';

export async function setupTestDb() {
  // In-memory SQLite — isolated per test run
  const client = createClient({ url: ':memory:' });
  setDb(client as any);
  await runMigrations();

  const db = client;
  const [founderPw, ownerPw, managerPw, managerPinHash] = await Promise.all([
    bcrypt.hash(FOUNDER_PASS, 4),
    bcrypt.hash(OWNER_PASS, 4),
    bcrypt.hash(MANAGER_PASS, 4),
    bcrypt.hash(MANAGER_PIN, 4),
  ]);

  // System restaurant + founder
  await db.execute({
    sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [SYSTEM_REST, 'Cafyz HQ', 'cafyz-system', 'premium', 'UTC'],
  });
  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
          VALUES(?,?,?,?,?,?,?,?,?)`,
    args: [uid(), SYSTEM_REST, 'Cafyz Founder', 'CF', FOUNDER_EMAIL, founderPw, 'founder', 'active', '—'],
  });

  // Demo restaurant (basic plan) + owner + manager
  await db.execute({
    sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [DEMO_REST, 'Test Bistro', 'test-bistro', 'basic', 'UTC'],
  });
  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
          VALUES(?,?,?,?,?,?,?,?,?)`,
    args: [uid(), DEMO_REST, 'Test Owner', 'TO', OWNER_EMAIL, ownerPw, 'owner', 'active', '—'],
  });
  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time,pin_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?)`,
    args: [uid(), DEMO_REST, 'Test Manager', 'TM', MANAGER_EMAIL, managerPw, 'manager', 'active', '17:00', managerPinHash],
  });

  // Plan config (required for license key tests)
  const plans = [
    { plan: 'basic',   label: 'Basic',   price: 49,  panels: JSON.stringify(['pos','menu','waiter','license']) },
    { plan: 'pro',     label: 'Pro',     price: 99,  panels: JSON.stringify(['pos','menu','waiter','kds','manager','inventory','staff','reports','roles','license']) },
    { plan: 'premium', label: 'Premium', price: 199, panels: JSON.stringify(['pos','menu','waiter','kds','manager','inventory','staff','reports','roles','license']) },
  ];
  for (const p of plans) {
    // runMigrations() already seeds plan_config (INSERT OR IGNORE), so use
    // OR REPLACE here to set the exact panel config these tests expect without
    // colliding on the plan primary key.
    await db.execute({
      sql: `INSERT OR REPLACE INTO plan_config(plan,panels_json,label,description,price_monthly) VALUES(?,?,?,?,?)`,
      args: [p.plan, p.panels, p.label, '', p.price],
    });
  }

  return client;
}
