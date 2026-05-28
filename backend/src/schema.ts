import { getDb } from './db.js';

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      initials      TEXT NOT NULL,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('owner','manager','cashier','waiter','kitchen','founder')),
      status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','break','off')),
      start_time    TEXT NOT NULL DEFAULT '—',
      pin_hash      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(restaurant_id, email)
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

    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
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
  await addCol(`ALTER TABLE restaurants ADD COLUMN logo_url TEXT`, 'logo_url');
  await addCol(`ALTER TABLE restaurants ADD COLUMN contact_phone TEXT`, 'contact_phone');
  await addCol(`ALTER TABLE restaurants ADD COLUMN contact_email TEXT`, 'contact_email');
  await addCol(`ALTER TABLE restaurants ADD COLUMN address_line1 TEXT`, 'address_line1');
  await addCol(`ALTER TABLE restaurants ADD COLUMN address_line2 TEXT`, 'address_line2');
  await addCol(`ALTER TABLE restaurants ADD COLUMN city TEXT`, 'city');
  await addCol(`ALTER TABLE restaurants ADD COLUMN country TEXT`, 'country');
  await addCol(`ALTER TABLE restaurants ADD COLUMN postal_code TEXT`, 'postal_code');
  await addCol(`ALTER TABLE restaurants ADD COLUMN tax_id TEXT`, 'tax_id');
  await addCol(`ALTER TABLE restaurants ADD COLUMN website_url TEXT`, 'website_url');
  await addCol(`ALTER TABLE inquiries ADD COLUMN is_retry INTEGER NOT NULL DEFAULT 0`, 'is_retry');
  await addCol(`ALTER TABLE inquiries ADD COLUMN retry_of_id TEXT`, 'retry_of_id');

  await db.execute({
    sql: `INSERT OR IGNORE INTO app_settings(key,value) VALUES('trial_device_guard_enabled','1')`,
    args: [],
  });
}
