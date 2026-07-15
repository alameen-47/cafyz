import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { uid } from '../utils.js';

const DEMO_REST_SLUG = 'cafyz-demo-review';
const DEMO_EMAIL = (process.env.STORE_DEMO_EMAIL ?? 'reviewer@cafyz.com').trim().toLowerCase();
const DEMO_PASSWORD = process.env.STORE_DEMO_PASSWORD ?? 'CafyzReview2026!';
const DEMO_PHONE = process.env.STORE_DEMO_PHONE ?? '+971500000099';
const DEMO_OWNER = process.env.STORE_DEMO_OWNER_NAME ?? 'App Reviewer';
const DEMO_RESTAURANT = process.env.STORE_DEMO_RESTAURANT_NAME ?? 'Cafyz Demo Restaurant';

const MENU_ITEMS: Array<{
  name: string;
  category: 'starters' | 'mains' | 'desserts' | 'wine' | 'drinks';
  price: number;
  description: string;
  is_popular?: boolean;
}> = [
  { name: 'Tomato Soup', category: 'starters', price: 8.5, description: 'Fresh basil and cream' },
  { name: 'Caesar Salad', category: 'starters', price: 9.0, description: 'Romaine, parmesan, croutons', is_popular: true },
  { name: 'Bruschetta', category: 'starters', price: 7.5, description: 'Tomato, garlic, olive oil' },
  { name: 'Classic Burger', category: 'mains', price: 14.0, description: 'Angus beef, cheddar, fries', is_popular: true },
  { name: 'Grilled Salmon', category: 'mains', price: 18.5, description: 'Lemon butter, seasonal veg' },
  { name: 'Margherita Pizza', category: 'mains', price: 12.0, description: 'Mozzarella, tomato, basil' },
  { name: 'Pasta Carbonara', category: 'mains', price: 13.5, description: 'Guanciale, egg, pecorino' },
  { name: 'Chocolate Cake', category: 'desserts', price: 6.5, description: 'Warm, with vanilla ice cream' },
  { name: 'Tiramisu', category: 'desserts', price: 7.0, description: 'Espresso-soaked ladyfingers' },
  { name: 'Espresso', category: 'drinks', price: 3.0, description: 'Double shot' },
  { name: 'Fresh Orange Juice', category: 'drinks', price: 4.5, description: 'Pressed to order' },
  { name: 'Sparkling Water', category: 'drinks', price: 3.5, description: '500ml' },
];

const TABLES = [
  { name: 'T1', zone: 'Main', capacity: 2 },
  { name: 'T2', zone: 'Main', capacity: 4 },
  { name: 'T3', zone: 'Patio', capacity: 4 },
  { name: 'T4', zone: 'Bar', capacity: 2 },
];

function licenseExpiresAt(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 2);
  return d.toISOString();
}

async function ensureDemoMenu(restaurantId: string): Promise<void> {
  const db = getDb();
  const count = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM menu_items WHERE restaurant_id=?',
    args: [restaurantId],
  });
  if (Number(count.rows[0]?.n ?? 0) > 0) return;

  for (const item of MENU_ITEMS) {
    await db.execute({
      sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price,description,is_popular,is_available)
            VALUES(?,?,?,?,?,?,?,1)`,
      args: [
        uid(),
        restaurantId,
        item.name,
        item.category,
        item.price,
        item.description,
        item.is_popular ? 1 : 0,
      ],
    });
  }
}

async function ensureDemoTables(restaurantId: string): Promise<void> {
  const db = getDb();
  const count = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM restaurant_tables WHERE restaurant_id=?',
    args: [restaurantId],
  });
  if (Number(count.rows[0]?.n ?? 0) > 0) return;

  for (const table of TABLES) {
    await db.execute({
      sql: `INSERT INTO restaurant_tables(id,restaurant_id,name,zone,capacity,status)
            VALUES(?,?,?,?,?,'empty')`,
      args: [uid(), restaurantId, table.name, table.zone, table.capacity],
    });
  }
}

async function ensureDemoLicense(restaurantId: string): Promise<void> {
  const db = getDb();
  const expiresAt = licenseExpiresAt();
  const now = new Date().toISOString();

  const lic = await db.execute({
    sql: `SELECT id, expires_at FROM license_keys
          WHERE restaurant_id=? AND is_active=1
          ORDER BY activated_at DESC, created_at DESC
          LIMIT 1`,
    args: [restaurantId],
  });

  if (lic.rows.length) {
    const expiry = new Date(String(lic.rows[0]?.expires_at ?? ''));
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now()) return;
    await db.execute({
      sql: `UPDATE license_keys SET expires_at=?, activated_at=COALESCE(activated_at, ?), plan='pro', is_active=1 WHERE id=?`,
      args: [expiresAt, now, String(lic.rows[0]?.id)],
    });
    return;
  }

  await db.execute({
    sql: `INSERT INTO license_keys(id,key_code,plan,restaurant_id,activated_at,expires_at,note,is_active)
          VALUES(?,?,?,?,?,?,?,1)`,
    args: [uid(), 'CAFYZ-PRO-STORE-DEMO', 'pro', restaurantId, now, expiresAt, 'App Store / Play Store reviewer account'],
  });
}

/** Idempotent store-review demo restaurant for Apple / Google reviewers. */
export async function ensureStoreDemoAccount(): Promise<void> {
  if (process.env.STORE_DEMO_ENABLED === 'false') {
    return;
  }
  if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
    console.warn('[StoreDemo] STORE_DEMO_PASSWORD missing or < 8 chars — demo account disabled');
    return;
  }

  const db = getDb();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const initials = DEMO_OWNER.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AR';

  const byEmail = await db.execute({
    sql: `SELECT id, restaurant_id FROM users WHERE LOWER(email)=? LIMIT 1`,
    args: [DEMO_EMAIL],
  });

  if (byEmail.rows.length) {
    const row = byEmail.rows[0] as Record<string, unknown>;
    const userId = String(row.id);
    const restaurantId = String(row.restaurant_id);
    await db.execute({
      sql: `UPDATE users SET password_hash=?, phone=?, role='owner', status='active', name=? WHERE id=?`,
      args: [hash, DEMO_PHONE, DEMO_OWNER, userId],
    });
    await db.execute({
      sql: `UPDATE restaurants SET name=?, plan='pro', access_paused=0 WHERE id=?`,
      args: [DEMO_RESTAURANT, restaurantId],
    });
    await ensureDemoLicense(restaurantId);
    await ensureDemoMenu(restaurantId);
    await ensureDemoTables(restaurantId);
    console.log(`[StoreDemo] Synced reviewer account ${DEMO_EMAIL}`);
    return;
  }

  const bySlug = await db.execute({
    sql: `SELECT id FROM restaurants WHERE slug=? LIMIT 1`,
    args: [DEMO_REST_SLUG],
  });

  let restaurantId: string;
  if (bySlug.rows.length) {
    restaurantId = String(bySlug.rows[0]?.id);
    await db.execute({
      sql: `UPDATE restaurants SET name=?, plan='pro', access_paused=0 WHERE id=?`,
      args: [DEMO_RESTAURANT, restaurantId],
    });
  } else {
    restaurantId = uid();
    await db.execute({
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
      args: [restaurantId, DEMO_RESTAURANT, DEMO_REST_SLUG, 'pro', 'UTC'],
    });
  }

  const ownerId = uid();
  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,phone,password_hash,role,status,start_time)
          VALUES(?,?,?,?,?,?,?,?,?,?)`,
    args: [ownerId, restaurantId, DEMO_OWNER, initials, DEMO_EMAIL, DEMO_PHONE, hash, 'owner', 'active', '—'],
  });

  await ensureDemoLicense(restaurantId);
  await ensureDemoMenu(restaurantId);
  await ensureDemoTables(restaurantId);
  console.log(`[StoreDemo] Created reviewer account ${DEMO_EMAIL} (${DEMO_RESTAURANT})`);
}
