import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { setDb } from './db.js';
import { runMigrations } from './schema.js';
import { uid } from './utils.js';

const DEMO_REST = 'DEMO_REST';

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
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS restaurants;
  `);

  await runMigrations();

  const db = client;

  // ── Demo Restaurant ────────────────────────────────────────────────
  await db.execute({
    sql: `INSERT OR IGNORE INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [DEMO_REST, 'Saint Paris 6e', 'saint-paris-6e', 'growth', 'Europe/Paris'],
  });
  console.log('✓ Restaurant seeded');

  // ── Users ──────────────────────────────────────────────────────────
  const users = [
    { id: uid(), name: 'Mireille Vasseur', initials: 'MV', email: 'mireille@saint.paris', role: 'manager',  status: 'active', start_time: '17:30', password: 'cafyz2026', pin: '1234' },
    { id: uid(), name: 'Thomas Durand',    initials: 'TD', email: 'thomas@saint.paris',   role: 'cashier',  status: 'active', start_time: '18:00', password: 'cafyz2026', pin: '5678' },
    { id: uid(), name: 'Jules Renard',     initials: 'JR', email: 'jules@saint.paris',    role: 'waiter',   status: 'active', start_time: '18:00', password: 'cafyz2026', pin: '9012' },
    { id: uid(), name: 'Inès Moreau',      initials: 'IM', email: 'ines@saint.paris',     role: 'kitchen',  status: 'active', start_time: '16:00', password: 'cafyz2026', pin: '3456' },
    { id: uid(), name: 'Léo Fontaine',     initials: 'LF', email: 'leo@saint.paris',      role: 'waiter',   status: 'break',  start_time: '18:00', password: 'cafyz2026', pin: '7890' },
    { id: uid(), name: 'Amélie Blanc',     initials: 'AB', email: 'amelie@saint.paris',   role: 'waiter',   status: 'active', start_time: '19:00', password: 'cafyz2026', pin: '2345' },
    { id: uid(), name: 'Marc Lecomte',     initials: 'ML', email: 'marc@saint.paris',     role: 'kitchen',  status: 'active', start_time: '15:30', password: 'cafyz2026', pin: '6789' },
    { id: uid(), name: 'Sophie Girard',    initials: 'SG', email: 'sophie@saint.paris',   role: 'cashier',  status: 'off',    start_time: '—',     password: 'cafyz2026', pin: '0123' },
  ];

  for (const u of users) {
    const ph = await bcrypt.hash(u.password, 10);
    const ph2 = await bcrypt.hash(u.pin, 10);
    await db.execute({
      sql: `INSERT OR IGNORE INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time,pin_hash)
            VALUES(?,?,?,?,?,?,?,?,?,?)`,
      args: [u.id, DEMO_REST, u.name, u.initials, u.email, ph, u.role, u.status, u.start_time, ph2],
    });
  }
  console.log('✓ Users seeded');

  // ── Tables ─────────────────────────────────────────────────────────
  const tables = [
    { id:'T01', name:'T·01', zone:'Window Banquette', capacity:2, status:'occupied',  course:'Mains',    covers:2, elapsed_min:22 },
    { id:'T02', name:'T·02', zone:'Window Banquette', capacity:4, status:'paying',    course:'Bill',     covers:4, elapsed_min:71 },
    { id:'T03', name:'T·03', zone:'Window Banquette', capacity:2, status:'occupied',  course:'Starters', covers:2, elapsed_min:14 },
    { id:'T04', name:'T·04', zone:'Window Banquette', capacity:4, status:'occupied',  course:'Order in', covers:4, elapsed_min:9  },
    { id:'T05', name:'T·05', zone:'Central Salon',    capacity:4, status:'empty',     course:'',         covers:0, elapsed_min:0  },
    { id:'T06', name:'T·06', zone:'Central Salon',    capacity:4, status:'reserved',  course:'20:30 Park',covers:0,elapsed_min:0 },
    { id:'T07', name:'T·07', zone:'Central Salon',    capacity:2, status:'occupied',  course:'Mains',    covers:2, elapsed_min:38 },
    { id:'T08', name:'T·08', zone:'Central Salon',    capacity:4, status:'occupied',  course:'Drinks',   covers:4, elapsed_min:18 },
    { id:'T09', name:'T·09', zone:'Round Tables',     capacity:2, status:'occupied',  course:'Dessert',  covers:2, elapsed_min:52 },
    { id:'T10', name:'T·10', zone:'Round Tables',     capacity:2, status:'attention', course:'!',        covers:2, elapsed_min:26 },
    { id:'T11', name:'T·11', zone:'Round Tables',     capacity:2, status:'empty',     course:'',         covers:0, elapsed_min:0  },
    { id:'T12', name:'T·12', zone:'6-Tops Banquette', capacity:6, status:'occupied',  course:'Mains',    covers:6, elapsed_min:41 },
    { id:'T13', name:'T·13', zone:'6-Tops Banquette', capacity:6, status:'occupied',  course:'Bread',    covers:6, elapsed_min:12 },
    { id:'T14', name:'T·14', zone:'6-Tops Banquette', capacity:6, status:'empty',     course:'',         covers:0, elapsed_min:0  },
    { id:'T15', name:'T·15', zone:'6-Tops Banquette', capacity:6, status:'occupied',  course:'Pre-dessert',covers:4,elapsed_min:47},
    { id:'BAR', name:'BAR',  zone:'Bar Private Dining',capacity:8,status:'occupied',  course:'Open',     covers:0, elapsed_min:0  },
    { id:'PDR', name:'PDR',  zone:'Bar Private Dining',capacity:8,status:'occupied',  course:"Tasting 5/7",covers:5,elapsed_min:64},
    { id:'T17', name:'T·17', zone:'Bar Private Dining',capacity:4,status:'occupied',  course:'Order taken',covers:4,elapsed_min:6},
    { id:'T18', name:'T·18', zone:'Bar Private Dining',capacity:4,status:'empty',     course:'',         covers:0, elapsed_min:0  },
  ];

  for (const t of tables) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO restaurant_tables(id,restaurant_id,name,zone,capacity,status,course,covers,elapsed_min)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [t.id, DEMO_REST, t.name, t.zone, t.capacity, t.status, t.course, t.covers, t.elapsed_min],
    });
  }
  console.log('✓ Tables seeded');

  // ── Menu ───────────────────────────────────────────────────────────
  const menu = [
    { id:uid(), name:'Burrata di Andria',   category:'starters', price:18, description:'Heirloom tomato · basil oil',             symbol:'○', is_popular:0 },
    { id:uid(), name:'Tuna Crudo',          category:'starters', price:24, description:'Citrus · radish · togarashi',             symbol:'~', is_popular:0 },
    { id:uid(), name:'Beef Tartare',        category:'starters', price:22, description:'Cured yolk · cornichon',                  symbol:'◑', is_popular:0 },
    { id:uid(), name:'Côte de Bœuf',        category:'mains',    price:64, description:'500g · bone marrow butter',               symbol:'◑', is_popular:0 },
    { id:uid(), name:'Black Cod Miso',      category:'mains',    price:42, description:'Saikyo · pickled ginger',                 symbol:'~', is_popular:1 },
    { id:uid(), name:'Risotto Milanese',    category:'mains',    price:32, description:'Saffron · 24-month parmigiano',           symbol:'✦', is_popular:0 },
    { id:uid(), name:'Wagyu A5 Sando',      category:'mains',    price:58, description:'Japanese A5 · brioche · wasabi mayo',     symbol:'✦', is_popular:1 },
    { id:uid(), name:'Lobster Linguine',    category:'mains',    price:46, description:'Blue lobster · bisque · tarragon',        symbol:'~', is_popular:1 },
    { id:uid(), name:'Soufflé Grand Marnier',category:'desserts',price:18, description:'Together · orange zest',                  symbol:'○', is_popular:1 },
    { id:uid(), name:'Île Flottante',       category:'desserts', price:14, description:'Vanilla · praline',                       symbol:'○', is_popular:0 },
    { id:uid(), name:'Tarte Tatin',         category:'desserts', price:16, description:'Caramel · crème fraîche',                 symbol:'◑', is_popular:0 },
    { id:uid(), name:'Château Margaux 2018',category:'wine',     price:320,description:'Bordeaux · Grand Cru Classé',             symbol:'◑', is_popular:0 },
    { id:uid(), name:'Puligny-Montrachet',  category:'wine',     price:180,description:'Burgundy · Chardonnay',                   symbol:'○', is_popular:0 },
    { id:uid(), name:'Sparkling Water',     category:'drinks',   price:6,  description:'Still or sparkling',                      symbol:'~', is_popular:0 },
  ];

  for (const m of menu) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO menu_items(id,restaurant_id,name,category,price,description,symbol,is_popular)
            VALUES(?,?,?,?,?,?,?,?)`,
      args: [m.id, DEMO_REST, m.name, m.category, m.price, m.description, m.symbol, m.is_popular],
    });
  }
  console.log('✓ Menu seeded');

  // ── Inventory ──────────────────────────────────────────────────────
  const inv = [
    { id:uid(), name:'Wagyu A5 (kg)',      par:4,  current:2.4, unit:'kg',  alert:1 },
    { id:uid(), name:'Burrata (pcs)',       par:20, current:14,  unit:'pcs', alert:0 },
    { id:uid(), name:'Black Cod (kg)',      par:6,  current:5.8, unit:'kg',  alert:0 },
    { id:uid(), name:'Lobster (pcs)',       par:12, current:3,   unit:'pcs', alert:1 },
    { id:uid(), name:'Tuna Crudo (kg)',     par:3,  current:2.1, unit:'kg',  alert:0 },
    { id:uid(), name:'Risotto (kg)',        par:5,  current:4.2, unit:'kg',  alert:0 },
    { id:uid(), name:'Beef Tartare (kg)',   par:4,  current:1.2, unit:'kg',  alert:1 },
    { id:uid(), name:'Champagne (btl)',     par:24, current:18,  unit:'btl', alert:0 },
    { id:uid(), name:'Burgundy (btl)',      par:36, current:22,  unit:'btl', alert:0 },
    { id:uid(), name:'Olive Oil (L)',       par:8,  current:6.5, unit:'L',   alert:0 },
  ];

  for (const i of inv) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO inventory(id,restaurant_id,name,par,current,unit,alert) VALUES(?,?,?,?,?,?,?)`,
      args: [i.id, DEMO_REST, i.name, i.par, i.current, i.unit, i.alert],
    });
  }
  console.log('✓ Inventory seeded');

  // ── Reservations ───────────────────────────────────────────────────
  const res = [
    { id:uid(), table_id:'T05', guest_name:'Dubois',  covers:4, res_time:'19:00', note:'Anniversary',  status:'confirmed' },
    { id:uid(), table_id:'T11', guest_name:'Chen',    covers:2, res_time:'19:30', note:'',             status:'confirmed' },
    { id:uid(), table_id:'PDR', guest_name:'Park',    covers:6, res_time:'20:00', note:"Chef's menu",  status:'confirmed' },
    { id:uid(), table_id:'T08', guest_name:'Vasseur', covers:3, res_time:'20:30', note:'',             status:'confirmed' },
    { id:uid(), table_id:'T02', guest_name:'Lévy',    covers:2, res_time:'21:00', note:'Allergy: nuts',status:'confirmed' },
  ];

  for (const r of res) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO reservations(id,restaurant_id,table_id,guest_name,covers,res_time,note,status)
            VALUES(?,?,?,?,?,?,?,?)`,
      args: [r.id, DEMO_REST, r.table_id, r.guest_name, r.covers, r.res_time, r.note, r.status],
    });
  }
  console.log('✓ Reservations seeded');

  console.log('\n🍽  Cafyz database seeded successfully.');
  await client.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
