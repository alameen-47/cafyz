import type { Client } from '@libsql/client';
import { getDb } from '../db.js';

/** Keys generated but not yet activated on a restaurant. */
export const UNUSED_LICENSE_KEY_WHERE = `(restaurant_id IS NULL OR TRIM(COALESCE(restaurant_id, '')) = '')`;

export const REVOKED_LICENSE_KEY_WHERE = `is_active = 0`;

async function detachLicenseKeyReferences(db: Client, ids: string[]): Promise<void> {
  if (!ids.length) return;
  for (const id of ids) {
    await db.execute({
      sql: `UPDATE license_purchase_requests SET license_key_id=NULL WHERE license_key_id=?`,
      args: [id],
    });
  }
}

async function selectIds(db: Client, where: string, args: (string | number)[] = []): Promise<string[]> {
  const rows = await db.execute({
    sql: `SELECT id FROM license_keys WHERE ${where}`,
    args,
  });
  return rows.rows.map(r => String((r as { id: string }).id));
}

export async function deleteLicenseKeysByIds(db: Client, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  await detachLicenseKeyReferences(db, ids);
  let deleted = 0;
  for (const id of ids) {
    const r = await db.execute({ sql: `DELETE FROM license_keys WHERE id=?`, args: [id] });
    deleted += Number(r.rowsAffected ?? 1);
  }
  return deleted;
}

export async function deleteUnusedLicenseKeys(db: Client = getDb()): Promise<number> {
  const ids = await selectIds(db, UNUSED_LICENSE_KEY_WHERE);
  return deleteLicenseKeysByIds(db, ids);
}

export async function deleteRevokedLicenseKeys(db: Client = getDb()): Promise<number> {
  const ids = await selectIds(db, REVOKED_LICENSE_KEY_WHERE);
  return deleteLicenseKeysByIds(db, ids);
}

export async function deleteLicenseKeyById(db: Client, id: string): Promise<boolean> {
  const ids = await selectIds(db, 'id=?', [id]);
  if (!ids.length) return false;
  await deleteLicenseKeysByIds(db, ids);
  return true;
}
