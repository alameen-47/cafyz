import { getDb } from '../db.js';
import { cacheDel } from '../cache.js';

/** Invalidate all outstanding JWTs for a user (password change, role change, etc.). */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await getDb().execute({
    sql: `UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id=?`,
    args: [userId],
  });
  cacheDel(`user:auth:${userId}`);
  cacheDel(`user:status:${userId}`);
}

export function tokenVersionFromRow(row: Record<string, unknown>): number {
  return Number(row.token_version ?? 0);
}
