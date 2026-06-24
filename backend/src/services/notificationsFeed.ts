import type { Row } from '@libsql/client';
import { getDb } from '../db.js';
import { rowNumber, rowString } from '../dbRows.js';

export type NotificationType = 'order' | 'kds' | 'stock' | 'reservation' | 'system';

export interface FeedNotification {
  id: string;
  key: string;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  page?: string;
  meta?: string;
}

async function readKeys(userId: string): Promise<Set<string>> {
  const res = await getDb().execute({
    sql: 'SELECT notification_key FROM notification_reads WHERE user_id=?',
    args: [userId],
  });
  return new Set(res.rows.map(r => rowString(r, 'notification_key')));
}

export async function buildNotificationsFeed(
  restaurantId: string,
  userId: string,
  role: string,
): Promise<{ items: FeedNotification[]; unread: number }> {
  const db = getDb();
  const read = await readKeys(userId);
  const items: FeedNotification[] = [];
  const push = (n: Omit<FeedNotification, 'read'> & { key: string }) => {
    items.push({ ...n, read: read.has(n.key) });
  };

  const [ordersRes, kdsRes, stockRes, resvRes, statsRes] = await Promise.all([
    db.execute({
      sql: `SELECT o.id, o.status, o.covers, o.updated_at, o.created_at, t.name AS table_name,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
            FROM orders o
            LEFT JOIN restaurant_tables t ON t.id = o.table_id
            WHERE o.restaurant_id = ?
              AND o.status IN ('open','sent')
              AND datetime(o.updated_at) >= datetime('now', '-2 day')
            ORDER BY o.updated_at DESC
            LIMIT 10`,
      args: [restaurantId],
    }),
    role === 'kitchen' || role === 'owner' || role === 'manager' || role === 'waiter'
      ? db.execute({
          sql: `SELECT id, table_name, status, covers, updated_at
                FROM kds_tickets
                WHERE restaurant_id = ?
                  AND status IN ('new','prep','ready')
                ORDER BY
                  CASE status WHEN 'new' THEN 0 WHEN 'prep' THEN 1 ELSE 2 END,
                  updated_at DESC
                LIMIT 8`,
          args: [restaurantId],
        })
      : Promise.resolve({ rows: [] as Row[] }),
    role === 'owner' || role === 'manager' || role === 'cashier'
      ? db.execute({
          sql: `SELECT id, name, current, par, unit, updated_at
                FROM inventory
                WHERE restaurant_id = ? AND current <= par
                ORDER BY (current * 1.0 / NULLIF(par, 0)) ASC
                LIMIT 8`,
          args: [restaurantId],
        })
      : Promise.resolve({ rows: [] as Row[] }),
    role === 'owner' || role === 'manager'
      ? db.execute({
          sql: `SELECT id, guest_name, covers, res_time, status
                FROM reservations
                WHERE restaurant_id = ?
                  AND date(res_time) = date('now')
                  AND status IN ('pending','confirmed','seated')
                ORDER BY res_time ASC
                LIMIT 6`,
          args: [restaurantId],
        })
      : Promise.resolve({ rows: [] as Row[] }),
    db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM orders WHERE restaurant_id=? AND date(created_at)=date('now')) AS orders_today,
              (SELECT COUNT(*) FROM orders WHERE restaurant_id=? AND date(created_at)=date('now') AND status='paid') AS orders_paid,
              (SELECT COUNT(*) FROM restaurant_tables WHERE restaurant_id=? AND status IN ('occupied','paying')) AS tables_occupied,
              (SELECT COUNT(*) FROM restaurant_tables WHERE restaurant_id=?) AS tables_total`,
      args: [restaurantId, restaurantId, restaurantId, restaurantId],
    }),
  ]);

  for (const row of ordersRes.rows) {
    const id = rowString(row, 'id');
    const status = rowString(row, 'status');
    const table = rowString(row, 'table_name') || 'Takeaway';
    const itemCount = rowNumber(row, 'item_count');
    const at = rowString(row, 'updated_at') || rowString(row, 'created_at');
    push({
      id: `order-${id}`,
      key: `order-${id}`,
      type: 'order',
      title: `Order ${status} — ${table}`,
      body: `${itemCount} item${itemCount === 1 ? '' : 's'} · ${rowNumber(row, 'covers')} covers`,
      at,
      page: 'orders',
      meta: status,
    });
  }

  for (const row of kdsRes.rows) {
    const id = rowString(row, 'id');
    const status = rowString(row, 'status');
    const table = rowString(row, 'table_name');
    const at = rowString(row, 'updated_at');
    const title =
      status === 'new' ? `Kitchen: new ticket — ${table}`
        : status === 'prep' ? `Kitchen: in prep — ${table}`
          : `Ready to serve — ${table}`;
    push({
      id: `kds-${id}`,
      key: `kds-${id}`,
      type: 'kds',
      title,
      body: `${rowNumber(row, 'covers')} covers · ${status}`,
      at,
      page: role === 'waiter' ? 'orders' : 'kds',
      meta: status,
    });
  }

  for (const row of stockRes.rows) {
    const id = rowString(row, 'id');
    const name = rowString(row, 'name');
    const current = rowNumber(row, 'current');
    const par = rowNumber(row, 'par');
    const unit = rowString(row, 'unit');
    const critical = par > 0 && current <= par * 0.25;
    push({
      id: `stock-${id}`,
      key: `stock-${id}`,
      type: 'stock',
      title: critical ? 'Critical stock' : 'Low stock',
      body: `${name}: ${current}${unit} left (par ${par}${unit})`,
      at: rowString(row, 'updated_at') || new Date().toISOString(),
      page: 'inventory',
      meta: critical ? 'critical' : 'low',
    });
  }

  for (const row of resvRes.rows) {
    const id = rowString(row, 'id');
    const guest = rowString(row, 'guest_name');
    const time = rowString(row, 'res_time');
    const status = rowString(row, 'status');
    push({
      id: `resv-${id}`,
      key: `resv-${id}`,
      type: 'reservation',
      title: `Reservation — ${guest}`,
      body: `${rowNumber(row, 'covers')} covers · ${time.slice(11, 16) || time} · ${status}`,
      at: time,
      page: 'reservations',
      meta: status,
    });
  }

  if (statsRes.rows[0]) {
    const s = statsRes.rows[0];
    push({
      id: 'stats-today',
      key: 'stats-today',
      type: 'system',
      title: "Today's snapshot",
      body: `${rowNumber(s, 'orders_today')} orders · ${rowNumber(s, 'orders_paid')} paid · ${rowNumber(s, 'tables_occupied')}/${rowNumber(s, 'tables_total')} tables busy`,
      at: new Date().toISOString(),
      page: 'dashboard',
      meta: 'snapshot',
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const trimmed = items.slice(0, 20);
  const unread = trimmed.filter(n => !n.read).length;
  return { items: trimmed, unread };
}
