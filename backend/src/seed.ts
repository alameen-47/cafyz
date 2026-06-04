import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { setDb } from './db.js';
import { runMigrations } from './schema.js';
import { uid } from './utils.js';

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? 'founder@cafyz.io';
const FOUNDER_PASSWORD = process.env.FOUNDER_PASSWORD;

async function seed() {
  // Force HTTPS (HTTP/2) protocol instead of WebSocket to avoid IPv6 timeout
  const rawUrl = process.env.TURSO_URL!;
  const httpUrl = rawUrl.startsWith('libsql://') ? rawUrl.replace('libsql://', 'https://') : rawUrl;
  const client = createClient({
    url: httpUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  setDb(client);

  // Drop all tables in dependency order so we can recreate with new schema
  await client.executeMultiple(`
    DROP TABLE IF EXISTS kds_ticket_items;
    DROP TABLE IF EXISTS kds_tickets;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS reservations;
    DROP TABLE IF EXISTS inventory;
    DROP TABLE IF EXISTS menu_items;
    DROP TABLE IF EXISTS restaurant_tables;
    DROP TABLE IF EXISTS license_keys;
    DROP TABLE IF EXISTS plan_config;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS restaurants;
  `);

  await runMigrations();

  const db = client;
  if (!FOUNDER_PASSWORD || FOUNDER_PASSWORD.length < 8) {
    throw new Error('FOUNDER_PASSWORD must be set to a strong value (min 8 chars).');
  }

  // ── Cafyz System Restaurant (for founder account) ──────────────────
  const SYSTEM_REST = 'CAFYZ_SYSTEM';
  await db.execute({
    sql: `INSERT OR IGNORE INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [SYSTEM_REST, 'Cafyz HQ', 'cafyz-system', 'premium', 'UTC'],
  });

  // ── Founder user ───────────────────────────────────────────────────
  const founderId = uid();
  const founderPw = await bcrypt.hash(FOUNDER_PASSWORD, 10);
  await db.execute({
    sql: `INSERT OR IGNORE INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
          VALUES(?,?,?,?,?,?,?,?,?)`,
    args: [founderId, SYSTEM_REST, 'Cafyz Founder', 'CF', FOUNDER_EMAIL, founderPw, 'founder', 'active', '—'],
  });
  console.log(`✓ Founder account seeded for ${FOUNDER_EMAIL}`);

  // ── Plan Config (founder-defined defaults) ─────────────────────────
  const planConfigs = [
    {
      plan: 'basic',
      label: 'Basic',
      description: 'Core POS, menu, and floor management for small venues.',
      price_monthly: 49,
      currency_symbol: '$',
      panels: ['pos','menu','waiter','license'],
    },
    {
      plan: 'pro',
      label: 'Pro',
      description: 'Everything in Basic plus KDS, full manager dashboard, inventory, staff & reports.',
      price_monthly: 99,
      currency_symbol: '$',
      panels: ['pos','menu','waiter','kds','manager','inventory','staff','reports','roles','license'],
    },
    {
      plan: 'premium',
      label: 'Premium',
      description: 'Everything in Pro plus reservations, multi-branch, and priority support.',
      price_monthly: 199,
      currency_symbol: '$',
      panels: ['pos','menu','waiter','kds','manager','inventory','staff','reports','roles','license'],
    },
  ];

  for (const p of planConfigs) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO plan_config(plan,panels_json,label,description,price_monthly,currency_symbol)
            VALUES(?,?,?,?,?,?)`,
      args: [p.plan, JSON.stringify(p.panels), p.label, p.description, p.price_monthly, p.currency_symbol],
    });
  }
  console.log('✓ Plan config seeded');

  console.log('\n🍽  Cafyz database seeded successfully (production baseline, no demo data).');
  await client.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
