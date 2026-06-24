import { getDb } from './db.js';
import { rowNumber, rowString } from './dbRows.js';

export async function runMigrations() {
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      plan       TEXT NOT NULL DEFAULT 'basic'
                   CHECK(plan IN ('starter','growth','enterprise','basic','pro','premium')),
      parent_id  TEXT REFERENCES restaurants(id),
      timezone   TEXT NOT NULL DEFAULT 'UTC',
      currency_code     TEXT NOT NULL DEFAULT 'USD',
      language_code     TEXT NOT NULL DEFAULT 'en',
      date_format       TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
      service_charge_pct REAL,
      tax_rate_pct       REAL,
      tax_type           TEXT NOT NULL DEFAULT 'VAT',
      tax_included       INTEGER NOT NULL DEFAULT 0,
      receipt_footer     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      initials      TEXT NOT NULL,
      email         TEXT NOT NULL,
      phone         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('owner','manager','cashier','waiter','kitchen','founder')),
      access_json   TEXT NOT NULL DEFAULT '{}',
      status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','break','off')),
      start_time    TEXT NOT NULL DEFAULT '—',
      pin_hash      TEXT,
      pin_device_id TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(restaurant_id, email)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_otp_codes (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone         TEXT NOT NULL,
      otp_hash      TEXT NOT NULL,
      expires_at    TEXT NOT NULL,
      used_at       TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      zone          TEXT NOT NULL,
      capacity      INTEGER NOT NULL DEFAULT 2,
      status        TEXT NOT NULL DEFAULT 'empty'
                      CHECK(status IN ('empty','reserved','occupied','paying','attention')),
      server_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      course        TEXT,
      covers        INTEGER DEFAULT 0,
      elapsed_min   INTEGER DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL CHECK(category IN ('starters','mains','desserts','wine','drinks')),
      price         REAL NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      symbol        TEXT NOT NULL DEFAULT '○',
      is_popular    INTEGER NOT NULL DEFAULT 0,
      is_available  INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_id      TEXT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      server_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      status        TEXT NOT NULL DEFAULT 'open'
                      CHECK(status IN ('open','sent','paid','voided','comped')),
      covers        INTEGER NOT NULL DEFAULT 1,
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id           TEXT PRIMARY KEY,
      order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
      qty          INTEGER NOT NULL DEFAULT 1,
      mods         TEXT NOT NULL DEFAULT '[]',
      is_done      INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kds_tickets (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      table_name    TEXT NOT NULL,
      server_name   TEXT NOT NULL,
      covers        INTEGER NOT NULL DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'new'
                      CHECK(status IN ('new','prep','ready','delivered')),
      vip           INTEGER NOT NULL DEFAULT 0,
      elapsed_min   INTEGER NOT NULL DEFAULT 0,
      station       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kds_ticket_items (
      id        TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES kds_tickets(id) ON DELETE CASCADE,
      name      TEXT NOT NULL,
      qty       INTEGER NOT NULL DEFAULT 1,
      station   TEXT NOT NULL DEFAULT 'GARDE',
      mods      TEXT NOT NULL DEFAULT '[]',
      alert     INTEGER NOT NULL DEFAULT 0,
      is_done   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kitchen_print_jobs (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      ticket_id     TEXT NOT NULL REFERENCES kds_tickets(id) ON DELETE CASCADE,
      payload_json  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','printing','printed','failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      claimed_by    TEXT,
      claimed_at    TEXT,
      last_error    TEXT,
      printed_at    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      table_id      TEXT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      guest_name    TEXT NOT NULL,
      covers        INTEGER NOT NULL DEFAULT 2,
      res_time      TEXT NOT NULL,
      note          TEXT,
      status        TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK(status IN ('confirmed','seated','cancelled','no-show')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      par           REAL NOT NULL,
      current       REAL NOT NULL,
      unit          TEXT NOT NULL,
      alert         INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_keys (
      id            TEXT PRIMARY KEY,
      key_code      TEXT NOT NULL UNIQUE,
      plan          TEXT NOT NULL CHECK(plan IN ('basic','pro','premium')),
      restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
      activated_at  TEXT,
      expires_at    TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_config (
      plan          TEXT PRIMARY KEY CHECK(plan IN ('basic','pro','premium')),
      panels_json   TEXT NOT NULL,
      label         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      price_monthly REAL NOT NULL DEFAULT 0,
      currency_symbol TEXT NOT NULL DEFAULT '$',
      billing_interval_unit  TEXT NOT NULL DEFAULT 'month',
      billing_interval_count INTEGER NOT NULL DEFAULT 1,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Public inquiries (trial requests) pending founder approval
    CREATE TABLE IF NOT EXISTS inquiries (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      email           TEXT NOT NULL,
      plan            TEXT NOT NULL CHECK(plan IN ('basic','pro','premium')),
      message         TEXT,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
      is_retry        INTEGER NOT NULL DEFAULT 0,
      retry_of_id     TEXT,
      device_hash     TEXT NOT NULL,
      ip_hash         TEXT NOT NULL,
      ua_hash         TEXT NOT NULL,
      token_hash      TEXT NOT NULL,
      approved_at     TEXT,
      denied_at       TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inquiries_device_created ON inquiries(device_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_inquiries_ip_created     ON inquiries(ip_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON inquiries(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_user        ON password_reset_tokens(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_users_restaurant_email   ON users(restaurant_id, email);
    CREATE INDEX IF NOT EXISTS idx_login_otp_phone_created  ON login_otp_codes(phone, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_rest_status_time  ON orders(restaurant_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status ON restaurant_tables(restaurant_id, status);
    CREATE INDEX IF NOT EXISTS idx_menu_rest_cat_available  ON menu_items(restaurant_id, category, is_available);
    CREATE INDEX IF NOT EXISTS idx_kds_rest_status_time     ON kds_tickets(restaurant_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_kitchen_print_jobs_queue ON kitchen_print_jobs(restaurant_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_reservations_rest_time   ON reservations(restaurant_id, res_time);
    CREATE INDEX IF NOT EXISTS idx_inventory_rest_name      ON inventory(restaurant_id, name);

    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_purchase_requests (
      id                  TEXT PRIMARY KEY,
      restaurant_id       TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      requester_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
      email               TEXT NOT NULL,
      plan                TEXT NOT NULL CHECK(plan IN ('basic','pro','premium')),
      status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled','cancelled')),
      note                TEXT,
      token_hash          TEXT,
      license_key_id      TEXT REFERENCES license_keys(id) ON DELETE SET NULL,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      fulfilled_at        TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_license_requests_status ON license_purchase_requests(status, created_at);

    CREATE TABLE IF NOT EXISTS trial_reminder_logs (
      id             TEXT PRIMARY KEY,
      restaurant_id  TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_date  TEXT NOT NULL,
      reminder_slot  TEXT NOT NULL CHECK(reminder_slot IN ('10:00','18:00')),
      sent_at        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(restaurant_id, user_id, reminder_date, reminder_slot)
    );
    CREATE INDEX IF NOT EXISTS idx_trial_reminder_logs_rest_date
      ON trial_reminder_logs(restaurant_id, reminder_date, reminder_slot);
  `);

  // Backward-compatible restaurant profile columns for live DBs
  const cols = await db.execute(`PRAGMA table_info(restaurants)`);
  const existing = new Set(cols.rows.map((r: any) => String(r.name)));
  const addCol = async (sql: string, name: string) => {
    if (existing.has(name)) return;
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (!msg.includes('duplicate column name')) throw e;
    }
  };
  await addCol(`ALTER TABLE license_purchase_requests ADD COLUMN token_hash TEXT`, 'token_hash');
  await addCol(`ALTER TABLE restaurants ADD COLUMN contact_phone TEXT`, 'contact_phone');
  await addCol(`ALTER TABLE restaurants ADD COLUMN contact_email TEXT`, 'contact_email');
  await addCol(`ALTER TABLE restaurants ADD COLUMN address_line1 TEXT`, 'address_line1');
  await addCol(`ALTER TABLE restaurants ADD COLUMN address_line2 TEXT`, 'address_line2');
  await addCol(`ALTER TABLE restaurants ADD COLUMN city TEXT`, 'city');
  await addCol(`ALTER TABLE restaurants ADD COLUMN country TEXT`, 'country');
  await addCol(`ALTER TABLE restaurants ADD COLUMN postal_code TEXT`, 'postal_code');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tax_id TEXT`, 'tax_id');
  await addCol(`ALTER TABLE restaurants ADD COLUMN website_url TEXT`, 'website_url');
  await addCol(`ALTER TABLE restaurants ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'USD'`, 'currency_code');
  await addCol(`ALTER TABLE restaurants ADD COLUMN language_code TEXT NOT NULL DEFAULT 'en'`, 'language_code');
  await addCol(`ALTER TABLE restaurants ADD COLUMN date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY'`, 'date_format');
  await addCol(`ALTER TABLE restaurants ADD COLUMN service_charge_pct REAL`, 'service_charge_pct');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tax_rate_pct REAL`, 'tax_rate_pct');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tax_type TEXT NOT NULL DEFAULT 'VAT'`, 'tax_type');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tax_included INTEGER NOT NULL DEFAULT 0`, 'tax_included');
  await addCol(`ALTER TABLE restaurants ADD COLUMN kitchen_printer_json TEXT`, 'kitchen_printer_json');
  await addCol(`ALTER TABLE restaurants ADD COLUMN cashier_printer_json TEXT`, 'cashier_printer_json');
  await addCol(`ALTER TABLE users ADD COLUMN phone TEXT`, 'phone');
  await addCol(`ALTER TABLE users ADD COLUMN access_json TEXT NOT NULL DEFAULT '{}'`, 'access_json');
  await addCol(`ALTER TABLE users ADD COLUMN pin_device_id TEXT`, 'pin_device_id');
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL`);
  await addCol(`ALTER TABLE restaurants ADD COLUMN receipt_footer TEXT`, 'receipt_footer');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tagline TEXT`, 'tagline');
  await addCol(`ALTER TABLE inquiries ADD COLUMN is_retry INTEGER NOT NULL DEFAULT 0`, 'is_retry');
  await addCol(`ALTER TABLE inquiries ADD COLUMN retry_of_id TEXT`, 'retry_of_id');
  await addCol(`ALTER TABLE inquiries ADD COLUMN restaurant_id TEXT`, 'restaurant_id');
  await addCol(`ALTER TABLE inquiries ADD COLUMN provisioned_user_id TEXT`, 'provisioned_user_id');
  await addCol(`ALTER TABLE plan_config ADD COLUMN currency_symbol TEXT NOT NULL DEFAULT '$'`, 'currency_symbol');
  await addCol(`ALTER TABLE plan_config ADD COLUMN billing_interval_unit TEXT NOT NULL DEFAULT 'month'`, 'billing_interval_unit');
  await addCol(`ALTER TABLE plan_config ADD COLUMN billing_interval_count INTEGER NOT NULL DEFAULT 1`, 'billing_interval_count');

  // Ensure founder plan config always exists (production-safe bootstrap)
  await db.executeMultiple(`
    INSERT OR IGNORE INTO plan_config(
      plan,panels_json,label,description,price_monthly,currency_symbol,billing_interval_unit,billing_interval_count
    ) VALUES
    ('basic','["pos","menu","waiter","license"]','Basic','Core POS, menu, and floor management for small venues.',49,'$','month',1),
    ('pro','["pos","menu","waiter","kds","manager","inventory","staff","reports","roles","license"]','Pro','Everything in Basic plus KDS, full manager dashboard, inventory, staff & reports.',99,'$','month',1),
    ('premium','["pos","menu","waiter","kds","manager","inventory","staff","reports","roles","license"]','Premium','Everything in Pro plus reservations, multi-branch, and priority support.',199,'$','month',1);
  `);

  await migrateMenuItemsFlexibleCategory(db);
  await seedAllMenuCategories(db);
  await addCol(`ALTER TABLE menu_items ADD COLUMN image_url TEXT`, 'image_url');
  // Dine-in vs parcel/takeaway. Used to flag PARCEL on kitchen tickets.
  await addCol(`ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine_in'`, 'order_type');

  await db.execute({
    sql: `INSERT OR IGNORE INTO app_settings(key,value) VALUES('trial_device_guard_enabled','1')`,
    args: [],
  });
}

const DEFAULT_MENU_CATEGORIES = [
  { slug: 'starters', label: 'Starters', sort_order: 0 },
  { slug: 'mains',    label: 'Mains',    sort_order: 1 },
  { slug: 'desserts', label: 'Desserts', sort_order: 2 },
  { slug: 'wine',     label: 'Wine',     sort_order: 3 },
  { slug: 'drinks',   label: 'Drinks',   sort_order: 4 },
];

async function migrateMenuItemsFlexibleCategory(db: ReturnType<typeof getDb>) {
  const flag = await db.execute({
    sql: `SELECT value FROM app_settings WHERE key='menu_category_flex_v1'`,
    args: [],
  });
  if (flag.rows.length && rowString(flag.rows[0], 'value') === '1') return;

  const info = await db.execute({
    sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='menu_items'`,
    args: [],
  });
  const ddl = rowString(info.rows[0], 'sql');
  if (ddl.includes('CHECK(category IN')) {
    await db.executeMultiple(`
      CREATE TABLE menu_items_new (
        id            TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        category      TEXT NOT NULL,
        price         REAL NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        symbol        TEXT NOT NULL DEFAULT '○',
        is_popular    INTEGER NOT NULL DEFAULT 0,
        is_available  INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO menu_items_new(id,restaurant_id,name,category,price,description,symbol,is_popular,is_available,created_at)
        SELECT id,restaurant_id,name,category,price,description,symbol,is_popular,is_available,created_at FROM menu_items;
      DROP TABLE menu_items;
      ALTER TABLE menu_items_new RENAME TO menu_items;
    `);
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO app_settings(key,value) VALUES('menu_category_flex_v1','1')`,
    args: [],
  });
}

async function seedAllMenuCategories(db: ReturnType<typeof getDb>) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      slug          TEXT NOT NULL,
      label         TEXT NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(restaurant_id, slug)
    );

    CREATE TABLE IF NOT EXISTS push_device_tokens (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      token         TEXT NOT NULL,
      platform      TEXT NOT NULL CHECK(platform IN ('android','ios','web')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, token)
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_key TEXT NOT NULL,
      read_at          TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, notification_key)
    );
  `);

  const { randomUUID } = await import('crypto');
  const newId = () => randomUUID();

  const restaurants = await db.execute({ sql: 'SELECT id FROM restaurants', args: [] });
  for (const row of restaurants.rows) {
    const rid = rowString(row, 'id');
    const count = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM menu_categories WHERE restaurant_id=?',
      args: [rid],
    });
    if (rowNumber(count.rows[0], 'c') === 0) {
      for (const cat of DEFAULT_MENU_CATEGORIES) {
        await db.execute({
          sql: `INSERT INTO menu_categories(id, restaurant_id, slug, label, sort_order) VALUES (?,?,?,?,?)`,
          args: [newId(), rid, cat.slug, cat.label, cat.sort_order],
        });
      }
    }

    // Sync any category slugs used on items but missing from menu_categories
    const orphans = await db.execute({
      sql: `SELECT DISTINCT category FROM menu_items WHERE restaurant_id=?`,
      args: [rid],
    });
    for (const o of orphans.rows) {
      const slug = rowString(o, 'category');
      const exists = await db.execute({
        sql: 'SELECT id FROM menu_categories WHERE restaurant_id=? AND slug=?',
        args: [rid, slug],
      });
      if (!exists.rows.length) {
        const label = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        await db.execute({
          sql: `INSERT INTO menu_categories(id, restaurant_id, slug, label, sort_order) VALUES (?,?,?,?,?)`,
          args: [newId(), rid, slug, label, 99],
        });
      }
    }
  }
}
