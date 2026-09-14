import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { InValue } from '@libsql/client';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { cacheDel, cacheDelPrefix, cacheGet, cacheSet } from '../cache.js';

/**
 * Demo data — a realistic sample restaurant loaded into every new tenant so the
 * first login shows what each screen does. Every sample row is tagged
 * is_demo=1, so the owner can remove all of it in one go from Settings without
 * touching anything they created themselves.
 */

type Stmt = { sql: string; args: InValue[] };
type Category = 'starters' | 'mains' | 'desserts' | 'wine' | 'drinks';
type StaffKey = 'manager' | 'cashier' | 'waiter1' | 'waiter2' | 'waiter3' | 'kitchen';

export type DemoCounts = {
  menu_items: number;
  tables: number;
  orders: number;
  reservations: number;
  inventory: number;
  staff: number;
};

export type DemoStatus = {
  enabled: boolean;
  intro_seen: boolean;
  can_manage: boolean;
  counts: DemoCounts;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const CATEGORIES: { slug: Category; label: string; sort: number }[] = [
  { slug: 'starters', label: 'Starters', sort: 0 },
  { slug: 'mains',    label: 'Mains',    sort: 1 },
  { slug: 'desserts', label: 'Desserts', sort: 2 },
  { slug: 'wine',     label: 'Wine',     sort: 3 },
  { slug: 'drinks',   label: 'Drinks',   sort: 4 },
];

/** Mirrors the category → KDS station mapping used when orders are sent. */
const STATION: Record<Category, string> = {
  starters: 'GARDE',
  mains:    'GRILL',
  desserts: 'PATISSERIE',
  wine:     'BAR',
  drinks:   'BAR',
};

const MENU: {
  key: string; name: string; category: Category; price: number; description: string;
  popular?: boolean; available?: boolean;
}[] = [
  // Prices are in rupees — INR is the default currency for new restaurants.
  { key: 'garlic_bread', name: 'Garlic Bread',           category: 'starters', price: 149, description: 'Toasted sourdough, herb butter' },
  { key: 'wings',        name: 'Crispy Chicken Wings',   category: 'starters', price: 299, description: 'Six wings, smoky BBQ glaze', popular: true },
  { key: 'caesar',       name: 'Caesar Salad',           category: 'starters', price: 249, description: 'Romaine, parmesan, croutons' },
  { key: 'soup',         name: 'Tomato Basil Soup',      category: 'starters', price: 179, description: 'Slow-roasted tomatoes, fresh basil' },
  { key: 'burger',       name: 'Classic Cheeseburger',   category: 'mains',    price: 349, description: 'Beef patty, cheddar, fries', popular: true },
  { key: 'chicken',      name: 'Grilled Chicken',        category: 'mains',    price: 399, description: 'Lemon herb chicken, mash, greens' },
  { key: 'pizza',        name: 'Margherita Pizza',       category: 'mains',    price: 329, description: 'Mozzarella, tomato, basil', popular: true },
  { key: 'pasta',        name: 'Penne Arrabbiata',       category: 'mains',    price: 299, description: 'Spicy tomato sauce, parsley' },
  { key: 'salmon',       name: 'Grilled Salmon',         category: 'mains',    price: 649, description: 'Lemon butter, seasonal vegetables' },
  { key: 'bowl',         name: 'Veggie Buddha Bowl',     category: 'mains',    price: 329, description: 'Quinoa, chickpeas, avocado, tahini' },
  { key: 'lamb',         name: 'Slow-cooked Lamb Shank', category: 'mains',    price: 599, description: 'Weekend special — currently sold out', available: false },
  { key: 'lava',         name: 'Chocolate Lava Cake',    category: 'desserts', price: 199, description: 'Warm centre, vanilla ice cream', popular: true },
  { key: 'cheesecake',   name: 'New York Cheesecake',    category: 'desserts', price: 229, description: 'Berry compote' },
  { key: 'icecream',     name: 'Ice Cream Trio',         category: 'desserts', price: 149, description: 'Vanilla, chocolate, strawberry' },
  { key: 'house_red',    name: 'House Red (Glass)',      category: 'wine',     price: 450, description: 'Smooth Merlot' },
  { key: 'lime_soda',    name: 'Fresh Lime Soda',        category: 'drinks',   price: 99,  description: 'Sweet or salted' },
  { key: 'latte',        name: 'Iced Latte',             category: 'drinks',   price: 179, description: 'Double shot, cold milk', popular: true },
  { key: 'smoothie',     name: 'Mango Smoothie',         category: 'drinks',   price: 159, description: 'Alphonso mango, yoghurt' },
  { key: 'water',        name: 'Sparkling Water',        category: 'drinks',   price: 99,  description: '500ml bottle' },
];
const MENU_BY_KEY = new Map(MENU.map(m => [m.key, m]));

/**
 * Sample dishes loaded before prices moved to rupees still carry dollar-scale prices
 * (e.g. 12.5). Once a restaurant is on INR, bring those demo rows to their rupee prices.
 */
export async function repriceDemoMenuForInr(): Promise<void> {
  await runInChunks(MENU.map(m => ({
    sql: `UPDATE menu_items SET price=?
          WHERE is_demo=1 AND name=? AND price < 100
            AND restaurant_id IN (SELECT id FROM restaurants WHERE currency_code='INR')`,
    args: [m.price, m.name],
  })));
}

const STAFF: { key: StaffKey; name: string; role: string; status: 'active' | 'break' | 'off'; start: string }[] = [
  { key: 'manager', name: 'Sarah Mitchell', role: 'manager', status: 'active', start: '09:00' },
  { key: 'cashier', name: 'David Chen',     role: 'cashier', status: 'active', start: '10:00' },
  { key: 'waiter1', name: 'Priya Sharma',   role: 'waiter',  status: 'active', start: '11:00' },
  { key: 'waiter2', name: 'Omar Haddad',    role: 'waiter',  status: 'break',  start: '11:00' },
  { key: 'waiter3', name: 'Lina Park',      role: 'waiter',  status: 'off',    start: '17:00' },
  { key: 'kitchen', name: 'Marco Rossi',    role: 'kitchen', status: 'active', start: '08:00' },
];
const STAFF_BY_KEY = new Map(STAFF.map(s => [s.key, s]));

const TABLES: {
  name: string; zone: string; capacity: number;
  status?: 'occupied' | 'reserved' | 'paying'; covers?: number; course?: string; elapsed?: number; server?: StaffKey;
}[] = [
  { name: 'T1',  zone: 'Main Hall',    capacity: 2 },
  { name: 'T2',  zone: 'Main Hall',    capacity: 4, status: 'occupied', covers: 3, course: 'Mains',    elapsed: 34, server: 'waiter1' },
  { name: 'T3',  zone: 'Main Hall',    capacity: 4, status: 'occupied', covers: 2, course: 'Starters', elapsed: 6,  server: 'waiter1' },
  { name: 'T4',  zone: 'Main Hall',    capacity: 6, status: 'reserved', covers: 5 },
  { name: 'P1',  zone: 'Patio',        capacity: 2 },
  { name: 'P2',  zone: 'Patio',        capacity: 4, status: 'paying',   covers: 4, course: 'Dessert',  elapsed: 58, server: 'waiter2' },
  { name: 'B1',  zone: 'Bar',          capacity: 2, status: 'occupied', covers: 2, course: 'Drinks',   elapsed: 15, server: 'waiter1' },
  { name: 'B2',  zone: 'Bar',          capacity: 2 },
  { name: 'VIP', zone: 'Private Room', capacity: 8 },
];

/** Tonight's service in progress: orders at every stage of the POS → kitchen flow. */
const LIVE_ORDERS: {
  table: string | null; server: StaffKey; minutes: number; status: 'open' | 'sent'; covers: number;
  note?: string; parcel?: boolean;
  items: [menuKey: string, qty: number, mods?: string[]][];
  ticket?: { status: 'new' | 'prep' | 'ready' | 'delivered'; minutes: number; updatedMinutes: number; vip?: boolean };
}[] = [
  {
    table: 'T2', server: 'waiter1', minutes: 34, status: 'sent', covers: 3,
    items: [['burger', 2], ['chicken', 1], ['latte', 3]],
    ticket: { status: 'prep', minutes: 12, updatedMinutes: 8 },
  },
  {
    table: 'T3', server: 'waiter1', minutes: 6, status: 'sent', covers: 2, note: 'Nut allergy at this table',
    items: [['wings', 1, ['No peanuts']], ['caesar', 1], ['lime_soda', 2]],
    ticket: { status: 'new', minutes: 4, updatedMinutes: 4, vip: true },
  },
  {
    table: 'P2', server: 'waiter2', minutes: 58, status: 'sent', covers: 4,
    items: [['pizza', 2], ['pasta', 1], ['lava', 2], ['smoothie', 2]],
    ticket: { status: 'delivered', minutes: 40, updatedMinutes: 25 },
  },
  {
    table: 'B1', server: 'waiter1', minutes: 15, status: 'open', covers: 2,
    items: [['house_red', 2], ['garlic_bread', 1]],
  },
  {
    table: null, server: 'cashier', minutes: 18, status: 'sent', covers: 1, parcel: true, note: 'Takeaway — Ahmed, pickup in 10 min',
    items: [['burger', 1], ['icecream', 1]],
    ticket: { status: 'ready', minutes: 18, updatedMinutes: 2 },
  },
];

const RESERVATIONS: {
  guest: string; covers: number; day: number; time: string; table?: string;
  status: 'confirmed' | 'seated' | 'cancelled' | 'no-show'; note?: string;
}[] = [
  { guest: 'Johnson Family',        covers: 5, day: 0,  time: '20:00', table: 'T4',  status: 'confirmed', note: 'Birthday — bring out the cake at dessert' },
  { guest: 'Aisha Khan',            covers: 2, day: 0,  time: '21:15',               status: 'confirmed', note: 'Prefers a quiet corner' },
  { guest: 'Nexa Ltd — team lunch', covers: 8, day: 1,  time: '13:00', table: 'VIP', status: 'confirmed', note: 'Set menu, invoice to company' },
  { guest: 'Daniel Moore',          covers: 2, day: 1,  time: '19:30',               status: 'confirmed' },
  { guest: 'Sofia Garcia',          covers: 6, day: 2,  time: '18:30',               status: 'cancelled', note: 'Moved to next week' },
  { guest: 'Emma Wilson',           covers: 4, day: -1, time: '20:00', table: 'T2',  status: 'seated' },
  { guest: 'Ravi Patel',            covers: 3, day: -1, time: '19:00',               status: 'no-show' },
];

const INVENTORY: { name: string; par: number; current: number; unit: string }[] = [
  { name: 'Burger Buns',    par: 100, current: 22,  unit: 'pcs' },
  { name: 'Chicken Breast', par: 20,  current: 6.5, unit: 'kg' },
  { name: 'Coffee Beans',   par: 5,   current: 1.5, unit: 'kg' },
  { name: 'Mozzarella',     par: 10,  current: 7,   unit: 'kg' },
  { name: 'Tomatoes',       par: 15,  current: 12,  unit: 'kg' },
  { name: 'Salmon Fillet',  par: 8,   current: 5,   unit: 'kg' },
  { name: 'Whole Milk',     par: 30,  current: 24,  unit: 'L' },
  { name: 'Cooking Oil',    par: 20,  current: 16,  unit: 'L' },
];

const ORDER_INSERT = `INSERT INTO orders(id,restaurant_id,table_id,server_id,status,covers,note,order_type,is_demo,created_at,updated_at)
                      VALUES(?,?,?,?,?,?,?,?,1,?,?)`;
const ORDER_ITEM_INSERT = `INSERT INTO order_items(id,order_id,menu_item_id,qty,mods,is_done,created_at) VALUES(?,?,?,?,?,?,?)`;

/** Deterministic PRNG so every restaurant gets the same believable sales history. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SQLite datetime('now') format, which the report queries compare against. */
function sqlTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function reservationTime(now: number, dayOffset: number, hhmm: string): string {
  return `${new Date(now + dayOffset * DAY).toISOString().slice(0, 10)}T${hhmm}:00`;
}

async function runInChunks(stmts: Stmt[], size = 200): Promise<void> {
  const db = getDb();
  for (let i = 0; i < stmts.length; i += size) {
    await db.batch(stmts.slice(i, i + size), 'write');
  }
}

async function seedDemoData(restaurantId: string): Promise<void> {
  const rng = mulberry32(20260914);
  const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length)]!;
  const now = Date.now();
  const stmts: Stmt[] = [];

  for (const c of CATEGORIES) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO menu_categories(id,restaurant_id,slug,label,sort_order) VALUES(?,?,?,?,?)`,
      args: [uid(), restaurantId, c.slug, c.label, c.sort],
    });
  }

  const menuIds = new Map<string, string>();
  for (const m of MENU) {
    const id = uid();
    menuIds.set(m.key, id);
    stmts.push({
      sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price,description,is_popular,is_available,is_demo)
            VALUES(?,?,?,?,?,?,?,?,1)`,
      args: [id, restaurantId, m.name, m.category, m.price, m.description, m.popular ? 1 : 0, m.available === false ? 0 : 1],
    });
  }

  // Demo staff can never sign in: unique non-routable emails and a random password nobody knows.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
  const emailTag = restaurantId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
  const staffIds = new Map<StaffKey, string>();
  for (const s of STAFF) {
    const id = uid();
    staffIds.set(s.key, id);
    const initials = s.name.split(' ').map(w => w[0]).join('').toUpperCase();
    const email = `${s.name.split(' ')[0]!.toLowerCase()}.${emailTag}@demo.cafyz.app`;
    stmts.push({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time,is_demo)
            VALUES(?,?,?,?,?,?,?,?,?,1)`,
      args: [id, restaurantId, s.name, initials, email, passwordHash, s.role, s.status, s.start],
    });
  }

  const tableIds = new Map<string, string>();
  for (const t of TABLES) {
    const id = uid();
    tableIds.set(t.name, id);
    stmts.push({
      sql: `INSERT INTO restaurant_tables(id,restaurant_id,name,zone,capacity,status,server_id,course,covers,elapsed_min,is_demo)
            VALUES(?,?,?,?,?,?,?,?,?,?,1)`,
      args: [
        id, restaurantId, t.name, t.zone, t.capacity, t.status ?? 'empty',
        t.server ? staffIds.get(t.server)! : null, t.course ?? '', t.covers ?? 0, t.elapsed ?? 0,
      ],
    });
  }

  // 30 days of finished service so Dashboard and Reports have something to chart.
  const sellable = MENU.filter(m => m.available !== false);
  const weighted = sellable.flatMap(m => (m.popular ? [m, m, m] : [m]));
  const historyServers: StaffKey[] = ['waiter1', 'waiter2', 'waiter3', 'cashier'];
  const historyTables = TABLES.map(t => t.name);
  const startOfToday = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());

  const pushFinishedOrder = (at: number, status: 'paid' | 'voided' | 'comped') => {
    const parcel = rng() < 0.12;
    const orderId = uid();
    stmts.push({
      sql: ORDER_INSERT,
      args: [
        orderId, restaurantId, parcel ? null : tableIds.get(pick(historyTables))!, staffIds.get(pick(historyServers))!,
        status, parcel ? 1 : 1 + Math.floor(rng() * 5), null, parcel ? 'parcel' : 'dine_in',
        sqlTime(at), sqlTime(Math.min(at + 45 * MINUTE, now)),
      ],
    });

    const chosen = new Set<string>();
    const lineCount = 1 + Math.floor(rng() * 4);
    while (chosen.size < lineCount) chosen.add(pick(weighted).key);
    for (const key of chosen) {
      stmts.push({
        sql: ORDER_ITEM_INSERT,
        args: [uid(), orderId, menuIds.get(key)!, rng() < 0.8 ? 1 : 2, '[]', 1, sqlTime(at)],
      });
    }
  };

  for (let day = 29; day >= 0; day--) {
    const dayStart = startOfToday - day * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const busy = weekday === 5 || weekday === 6;
    const orderCount = Math.round((busy ? 13 : 8) + rng() * 4);

    for (let i = 0; i < orderCount; i++) {
      const lunch = rng() < 0.4;
      const minuteOfDay = lunch ? 12 * 60 + Math.floor(rng() * 150) : 18 * 60 + 30 + Math.floor(rng() * 210);
      const at = dayStart + minuteOfDay * MINUTE;
      if (at > now - 60 * MINUTE) continue;

      const roll = rng();
      pushFinishedOrder(at, roll < 0.04 ? 'voided' : roll < 0.07 ? 'comped' : 'paid');
    }
  }

  // Before lunch the history above has nothing for today, so Today's Revenue and a Monday's
  // week-to-date charts would read $0. A few paid orders over the hours already gone fix that.
  const earlierTodayEnd = Math.max(startOfToday, now - 20 * MINUTE);
  const earlierTodayCount = 6;
  for (let i = 1; i <= earlierTodayCount; i++) {
    pushFinishedOrder(startOfToday + (i / (earlierTodayCount + 1)) * (earlierTodayEnd - startOfToday), 'paid');
  }

  for (const o of LIVE_ORDERS) {
    const orderId = uid();
    const createdAt = sqlTime(now - o.minutes * MINUTE);
    stmts.push({
      sql: ORDER_INSERT,
      args: [
        orderId, restaurantId, o.table ? tableIds.get(o.table)! : null, staffIds.get(o.server)!,
        o.status, o.covers, o.note ?? null, o.parcel ? 'parcel' : 'dine_in', createdAt, createdAt,
      ],
    });
    const itemsDone = o.ticket?.status === 'ready' || o.ticket?.status === 'delivered' ? 1 : 0;
    for (const [key, qty, mods = []] of o.items) {
      stmts.push({
        sql: ORDER_ITEM_INSERT,
        args: [uid(), orderId, menuIds.get(key)!, qty, JSON.stringify(mods), itemsDone, createdAt],
      });
    }
    if (!o.ticket) continue;

    const ticketId = uid();
    stmts.push({
      sql: `INSERT INTO kds_tickets(id,restaurant_id,order_id,table_name,server_name,covers,status,vip,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?)`,
      args: [
        ticketId, restaurantId, orderId, o.table ?? 'Takeaway', STAFF_BY_KEY.get(o.server)!.name, o.covers,
        o.ticket.status, o.ticket.vip ? 1 : 0, sqlTime(now - o.ticket.minutes * MINUTE), sqlTime(now - o.ticket.updatedMinutes * MINUTE),
      ],
    });
    for (const [key, qty, mods = []] of o.items) {
      const item = MENU_BY_KEY.get(key)!;
      stmts.push({
        sql: `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert,is_done) VALUES(?,?,?,?,?,?,?,?)`,
        args: [uid(), ticketId, item.name, qty, STATION[item.category], JSON.stringify(mods), mods.length ? 1 : 0, itemsDone],
      });
    }
  }

  for (const r of RESERVATIONS) {
    stmts.push({
      sql: `INSERT INTO reservations(id,restaurant_id,table_id,guest_name,covers,res_time,note,status,is_demo)
            VALUES(?,?,?,?,?,?,?,?,1)`,
      args: [
        uid(), restaurantId, r.table ? tableIds.get(r.table)! : null, r.guest, r.covers,
        reservationTime(now, r.day, r.time), r.note ?? null, r.status,
      ],
    });
  }

  for (const item of INVENTORY) {
    stmts.push({
      sql: `INSERT INTO inventory(id,restaurant_id,name,par,current,unit,alert,is_demo) VALUES(?,?,?,?,?,?,?,1)`,
      args: [uid(), restaurantId, item.name, item.par, item.current, item.unit, item.current / item.par < 0.4 ? 1 : 0],
    });
  }

  await runInChunks(stmts);
}

async function clearDemoData(restaurantId: string): Promise<void> {
  const rid = restaurantId;
  const demoOrders = `SELECT id FROM orders WHERE restaurant_id=? AND is_demo=1`;
  const demoTickets = `SELECT id FROM kds_tickets WHERE restaurant_id=? AND order_id IN (${demoOrders})`;
  const demoTables = `SELECT id FROM restaurant_tables WHERE restaurant_id=? AND is_demo=1`;
  const demoUsers = `SELECT id FROM users WHERE restaurant_id=? AND is_demo=1`;

  await getDb().batch([
    // Orders placed while demo mode was on are samples too — remove them with their kitchen trail.
    { sql: `DELETE FROM kitchen_print_jobs WHERE restaurant_id=? AND ticket_id IN (${demoTickets})`, args: [rid, rid, rid] },
    { sql: `DELETE FROM kds_ticket_items WHERE ticket_id IN (${demoTickets})`, args: [rid, rid] },
    { sql: `DELETE FROM kds_tickets WHERE restaurant_id=? AND order_id IN (${demoOrders})`, args: [rid, rid] },
    { sql: `DELETE FROM order_items WHERE order_id IN (${demoOrders})`, args: [rid] },
    { sql: `DELETE FROM orders WHERE restaurant_id=? AND is_demo=1`, args: [rid] },

    // Detach the restaurant's own records from sample tables and staff before those go.
    { sql: `UPDATE orders SET table_id=NULL WHERE restaurant_id=? AND table_id IN (${demoTables})`, args: [rid, rid] },
    { sql: `UPDATE reservations SET table_id=NULL WHERE restaurant_id=? AND is_demo=0 AND table_id IN (${demoTables})`, args: [rid, rid] },
    { sql: `UPDATE orders SET server_id=NULL WHERE restaurant_id=? AND server_id IN (${demoUsers})`, args: [rid, rid] },
    { sql: `UPDATE restaurant_tables SET server_id=NULL WHERE restaurant_id=? AND is_demo=0 AND server_id IN (${demoUsers})`, args: [rid, rid] },
    // A sample dish still on one of the restaurant's own orders is kept, so that order stays intact.
    {
      sql: `UPDATE menu_items SET is_demo=0 WHERE restaurant_id=? AND is_demo=1 AND id IN (
              SELECT oi.menu_item_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.restaurant_id=?)`,
      args: [rid, rid],
    },

    { sql: `DELETE FROM reservations WHERE restaurant_id=? AND is_demo=1`, args: [rid] },
    { sql: `DELETE FROM inventory WHERE restaurant_id=? AND is_demo=1`, args: [rid] },
    { sql: `DELETE FROM restaurant_tables WHERE restaurant_id=? AND is_demo=1`, args: [rid] },
    { sql: `DELETE FROM menu_items WHERE restaurant_id=? AND is_demo=1`, args: [rid] },
    { sql: `DELETE FROM push_device_tokens WHERE user_id IN (${demoUsers})`, args: [rid] },
    { sql: `DELETE FROM notification_reads WHERE user_id IN (${demoUsers})`, args: [rid] },
    { sql: `DELETE FROM users WHERE restaurant_id=? AND is_demo=1`, args: [rid] },

    // The restaurant's own tables that only held sample orders are free again.
    {
      sql: `UPDATE restaurant_tables SET status='empty', covers=0, course='', elapsed_min=0
            WHERE restaurant_id=? AND status IN ('occupied','paying')
              AND id NOT IN (SELECT table_id FROM orders WHERE restaurant_id=? AND table_id IS NOT NULL AND status IN ('open','sent'))`,
      args: [rid, rid],
    },
    { sql: `UPDATE restaurants SET demo_data_enabled=0 WHERE id=?`, args: [rid] },
  ], 'write');
}

async function demoCounts(restaurantId: string): Promise<DemoCounts> {
  const rid = restaurantId;
  const row = await getDb().execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM menu_items        WHERE restaurant_id=? AND is_demo=1) AS menu_items,
            (SELECT COUNT(*) FROM restaurant_tables WHERE restaurant_id=? AND is_demo=1) AS tables,
            (SELECT COUNT(*) FROM orders            WHERE restaurant_id=? AND is_demo=1) AS orders,
            (SELECT COUNT(*) FROM reservations      WHERE restaurant_id=? AND is_demo=1) AS reservations,
            (SELECT COUNT(*) FROM inventory         WHERE restaurant_id=? AND is_demo=1) AS inventory,
            (SELECT COUNT(*) FROM users             WHERE restaurant_id=? AND is_demo=1) AS staff`,
    args: [rid, rid, rid, rid, rid, rid],
  });
  const r = (row.rows[0] ?? {}) as Record<string, unknown>;
  return {
    menu_items:   Number(r.menu_items ?? 0),
    tables:       Number(r.tables ?? 0),
    orders:       Number(r.orders ?? 0),
    reservations: Number(r.reservations ?? 0),
    inventory:    Number(r.inventory ?? 0),
    staff:        Number(r.staff ?? 0),
  };
}

/** Whether new orders for this restaurant should be tagged as demo data. */
export async function isDemoDataEnabled(restaurantId: string): Promise<boolean> {
  const key = `demo:${restaurantId}`;
  const cached = cacheGet<boolean>(key);
  if (cached !== undefined) return cached;
  const row = await getDb().execute({
    sql: 'SELECT demo_data_enabled FROM restaurants WHERE id=?',
    args: [restaurantId],
  });
  const enabled = Number(row.rows[0]?.demo_data_enabled ?? 0) === 1;
  cacheSet(key, enabled, 30_000);
  return enabled;
}

const inFlight = new Set<string>();

/** Switch demo data on (loads the sample restaurant) or off (removes every demo row). */
export async function setDemoDataEnabled(restaurantId: string, enabled: boolean): Promise<void> {
  if (inFlight.has(restaurantId)) {
    throw Object.assign(new Error('Demo data is already being updated — try again in a moment.'), { status: 409, expose: true });
  }
  inFlight.add(restaurantId);
  try {
    if (enabled) {
      const counts = await demoCounts(restaurantId);
      if (Object.values(counts).every(n => n === 0)) await seedDemoData(restaurantId);
      await getDb().execute({ sql: 'UPDATE restaurants SET demo_data_enabled=1 WHERE id=?', args: [restaurantId] });
    } else {
      await clearDemoData(restaurantId);
    }
  } finally {
    inFlight.delete(restaurantId);
    cacheDel(`demo:${restaurantId}`);
    cacheDelPrefix('dash:');
  }
}

/** Loads demo data into a brand-new restaurant. A failure must never block account creation. */
export async function enableDemoDataForNewRestaurant(restaurantId: string): Promise<void> {
  try {
    await setDemoDataEnabled(restaurantId, true);
  } catch (e) {
    console.warn(`[DemoData] Could not load demo data for restaurant ${restaurantId}:`, (e as Error).message);
  }
}

export async function markDemoIntroSeen(userId: string): Promise<void> {
  await getDb().execute({ sql: 'UPDATE users SET demo_intro_seen=1 WHERE id=?', args: [userId] });
}

export async function getDemoStatus(restaurantId: string, userId: string, role: string): Promise<DemoStatus> {
  const db = getDb();
  const [rest, user, counts] = await Promise.all([
    db.execute({ sql: 'SELECT demo_data_enabled FROM restaurants WHERE id=?', args: [restaurantId] }),
    db.execute({ sql: 'SELECT demo_intro_seen FROM users WHERE id=?', args: [userId] }),
    demoCounts(restaurantId),
  ]);
  return {
    enabled: Number(rest.rows[0]?.demo_data_enabled ?? 0) === 1,
    intro_seen: Number(user.rows[0]?.demo_intro_seen ?? 0) === 1,
    can_manage: role === 'owner' || role === 'manager',
    counts,
  };
}
