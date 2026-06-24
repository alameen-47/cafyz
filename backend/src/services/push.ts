import { getDb } from '../db.js';

export type StaffRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  roles?: StaffRole[];
  excludeUserId?: string;
};

function fcmConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVER_KEY?.trim());
}

async function tokensForRestaurant(
  restaurantId: string,
  roles?: StaffRole[],
  excludeUserId?: string,
): Promise<string[]> {
  const db = getDb();
  let sql = `
    SELECT DISTINCT p.token
    FROM push_device_tokens p
    JOIN users u ON u.id = p.user_id
    WHERE p.restaurant_id = ?
  `;
  const args: (string | number)[] = [restaurantId];
  if (roles?.length) {
    sql += ` AND u.role IN (${roles.map(() => '?').join(',')})`;
    args.push(...roles);
  }
  if (excludeUserId) {
    sql += ' AND p.user_id != ?';
    args.push(excludeUserId);
  }
  const res = await db.execute({ sql, args });
  return res.rows.map(r => String((r as Record<string, unknown>).token ?? '')).filter(Boolean);
}

async function sendFcm(tokens: string[], payload: PushPayload): Promise<void> {
  const key = process.env.FIREBASE_SERVER_KEY?.trim();
  if (!key || !tokens.length) return;

  const chunkSize = 500;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const batch = tokens.slice(i, i + chunkSize);
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: batch,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        priority: 'high',
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('[FCM] send failed:', res.status, txt.slice(0, 240));
    }
  }
}

/** Fire-and-forget push to restaurant staff (no-op when FCM is not configured). */
export function sendRestaurantPush(restaurantId: string, payload: PushPayload): void {
  if (process.env.NODE_ENV === 'test' || !fcmConfigured()) return;
  void (async () => {
    const tokens = await tokensForRestaurant(restaurantId, payload.roles, payload.excludeUserId);
    if (!tokens.length) return;
    await sendFcm(tokens, payload);
  })().catch(err => console.error('[push]', (err as Error).message));
}

export function pushConfigured(): boolean {
  return fcmConfigured();
}
