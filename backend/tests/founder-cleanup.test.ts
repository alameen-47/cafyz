import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getDb } from '../src/db.js';
import { uid } from '../src/utils.js';
import { setupTestDb } from './setup.js';

let founderToken = '';

beforeAll(async () => {
  await setupTestDb();
  const login = await request(app)
    .post('/api/auth/login')
    .send({ login: 'manager@test.com', password: 'password123' });
  // tests/setup.ts doesn't seed founder - seed one for this file
  if (login.body.user?.role !== 'founder') {
    const db = getDb();
    await db.execute({
      sql: `INSERT OR IGNORE INTO restaurants(id,name,slug,plan) VALUES('CAFYZ_SYSTEM','HQ','hq','premium')`,
      args: [],
    });
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('founderpass123', 10);
    const id = uid();
    await db.execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [id, 'CAFYZ_SYSTEM', 'Founder', 'F', 'founder@test.com', hash, 'founder', 'active', '—'],
    });
    const f = await request(app)
      .post('/api/auth/login')
      .send({ login: 'founder@test.com', password: 'founderpass123' });
    founderToken = f.body.token;
  } else {
    founderToken = login.body.token;
  }
});

describe('founder license key cleanup', () => {
  it('bulk deletes unused keys from DB', async () => {
    const db = getDb();
    const id1 = uid();
    const id2 = uid();
    const id3 = uid();
    const reqId = uid();
    await db.execute({
      sql: `INSERT INTO license_keys(id,key_code,plan,is_active) VALUES(?,?,?,1),(?,?,?,1),(?,?,?,0)`,
      args: [id1, 'CAFYZ-PRO-AAA111', 'pro', id2, 'CAFYZ-PRO-BBB222', 'pro', id3, 'CAFYZ-PRO-CCC333', 'pro'],
    });
    await db.execute({
      sql: `UPDATE license_keys SET restaurant_id='TEST_REST' WHERE id=?`,
      args: [id3],
    });
    await db.execute({
      sql: `INSERT INTO license_purchase_requests(id,restaurant_id,email,plan,status,license_key_id)
            VALUES(?,?,?,?,?,?)`,
      args: [reqId, 'TEST_REST', 'buyer@test.com', 'pro', 'fulfilled', id1],
    });

    const res = await request(app)
      .post('/api/founder/license-keys/bulk-delete')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ unused_only: true });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBeGreaterThanOrEqual(2);

    const remaining = await db.execute({ sql: `SELECT id FROM license_keys`, args: [] });
    const ids = remaining.rows.map(r => String((r as { id: string }).id));
    expect(ids).toContain(id3);
    expect(ids).not.toContain(id1);
    expect(ids).not.toContain(id2);

    const reqRow = await db.execute({
      sql: `SELECT license_key_id FROM license_purchase_requests WHERE id=?`,
      args: [reqId],
    });
    expect(reqRow.rows[0]?.license_key_id ?? null).toBeNull();
  });

  it('deletes single license key by id', async () => {
    const db = getDb();
    const id = uid();
    await db.execute({
      sql: `INSERT INTO license_keys(id,key_code,plan,is_active) VALUES(?,?,?,1)`,
      args: [id, 'CAFYZ-BAS-DEL001', 'basic'],
    });

    const res = await request(app)
      .delete(`/api/founder/license-keys/${id}`)
      .set('Authorization', `Bearer ${founderToken}`);

    expect(res.status).toBe(204);
    const row = await db.execute({ sql: `SELECT id FROM license_keys WHERE id=?`, args: [id] });
    expect(row.rows.length).toBe(0);
  });
});
