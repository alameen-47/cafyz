import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { uid } from '../utils.js';

const SYSTEM_REST = 'CAFYZ_SYSTEM';

/** Create or sync founder user from FOUNDER_EMAIL / FOUNDER_PASSWORD on every boot. */
export async function ensureFounderAccount(): Promise<void> {
  const email = (process.env.FOUNDER_EMAIL ?? 'founder@cafyz.io').trim().toLowerCase();
  const founderPhone = (process.env.FOUNDER_PHONE ?? '').trim() || null;
  const password = process.env.FOUNDER_PASSWORD;
  if (!password || password.length < 8) {
    console.warn('[Founder] FOUNDER_PASSWORD missing or < 8 chars — founder login disabled');
    return;
  }

  const db = getDb();
  const hash = await bcrypt.hash(password, 10);

  await db.execute({
    sql: `INSERT OR IGNORE INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [SYSTEM_REST, 'Cafyz HQ', 'cafyz-system', 'premium', 'UTC'],
  });

  const existing = await db.execute({
    sql: `SELECT id, email FROM users WHERE role='founder' LIMIT 1`,
    args: [],
  });

  if (existing.rows.length) {
    const row = existing.rows[0] as Record<string, unknown>;
    const id = String(row.id);
    await db.execute({
      sql: `UPDATE users SET email=?, phone=COALESCE(?, phone), password_hash=?, restaurant_id=?, status='active' WHERE id=?`,
      args: [email, founderPhone, hash, SYSTEM_REST, id],
    });
    console.log(`[Founder] Synced credentials for ${email}`);
    return;
  }

  const byEmail = await db.execute({
    sql: `SELECT id FROM users WHERE LOWER(email)=? LIMIT 1`,
    args: [email],
  });
  if (byEmail.rows.length) {
    const row = byEmail.rows[0] as Record<string, unknown>;
    const id = String(row.id);
    await db.execute({
      sql: `UPDATE users SET phone=COALESCE(?, phone), password_hash=?, role='founder', restaurant_id=?, status='active' WHERE id=?`,
      args: [founderPhone, hash, SYSTEM_REST, id],
    });
    console.log(`[Founder] Promoted ${email} to founder`);
    return;
  }

  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,phone,password_hash,role,status,start_time)
          VALUES(?,?,?,?,?,?,?,?,?,?)`,
    args: [uid(), SYSTEM_REST, 'Cafyz Founder', 'CF', email, founderPhone, hash, 'founder', 'active', '—'],
  });
  console.log(`[Founder] Created account for ${email}`);
}
