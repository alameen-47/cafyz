import { Router } from 'express';
import { z } from 'zod';
import type { InValue } from '@libsql/client';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

const OrderSchema = z.object({
  table_id: z.string().optional(),
  covers:   z.number().int().positive().default(1),
  note:     z.string().optional(),
});

const OrderItemSchema = z.object({
  menu_item_id: z.string(),
  qty:          z.number().int().positive().default(1),
  mods:         z.array(z.string()).default([]),
});

/** Map menu category → KDS station */
function catToStation(category: string): string {
  const map: Record<string, string> = {
    starters:  'GARDE',
    mains:     'GRILL',
    desserts:  'PATISSERIE',
    wine:      'BAR',
    drinks:    'BAR',
  };
  return map[category] ?? 'GARDE';
}

// ── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, table_id } = req.query;
    let sql = `SELECT o.*, t.name as table_name
               FROM orders o
               LEFT JOIN restaurant_tables t ON t.id = o.table_id
               WHERE o.restaurant_id = ?`;
    const args: any[] = [rid];
    if (status)   { sql += ' AND o.status = ?';   args.push(String(status)); }
    if (table_id) { sql += ' AND o.table_id = ?'; args.push(String(table_id)); }
    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    const rows = await getDb().execute({ sql, args });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db  = getDb();
    const id  = req.params.id as string;
    const order = await db.execute({
      sql:  'SELECT * FROM orders WHERE id = ? AND restaurant_id = ?',
      args: [id, rid],
    });
    if (!order.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const items = await db.execute({
      sql:  `SELECT oi.*, m.name, m.price, m.category
             FROM order_items oi
             JOIN menu_items m ON m.id = oi.menu_item_id
             WHERE oi.order_id = ?`,
      args: [id],
    });
    res.json({ ...order.rows[0], items: items.rows });
  } catch (e) { next(e); }
});

// ── POST /api/orders/quick-send ───────────────────────────────────────────────
// One-shot: create order + items, send to kitchen, build the KDS ticket and
// enqueue the print job — all in TWO round trips (validate, then one batched
// transaction) instead of the old N+3 sequential client calls. This is what
// makes the kitchen print fire within ~1s of tapping "Send" instead of ~15s.
const QuickSendSchema = z.object({
  table_id: z.string(),
  covers:   z.number().int().positive().default(1),
  note:     z.string().optional(),
  // When false, the caller is printing locally on this same device (its
  // Bluetooth/USB kitchen printer), so we skip the cloud print queue entirely
  // — no round trip, no double-print. Defaults true for cross-device setups.
  enqueue_print: z.boolean().default(true),
  items: z.array(z.object({
    menu_item_id: z.string(),
    qty:          z.number().int().positive().default(1),
    mods:         z.array(z.string()).default([]),
  })).min(1),
});

router.post('/quick-send', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid  = req.user!.restaurant_id;
    const data = QuickSendSchema.parse(req.body);
    const db   = getDb();

    const ids = data.items.map(i => i.menu_item_id);
    const ph  = ids.map(() => '?').join(',');

    // Round trip 1: validate menu items + resolve table & server names in parallel.
    const [menuRes, tableRes, userRes] = await Promise.all([
      db.execute({ sql: `SELECT id,name,category FROM menu_items WHERE restaurant_id=? AND id IN (${ph})`, args: [rid, ...ids] }),
      db.execute({ sql: 'SELECT name FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [data.table_id, rid] }),
      db.execute({ sql: 'SELECT name FROM users WHERE id=?', args: [req.user!.id] }),
    ]);

    const menuMap = new Map(menuRes.rows.map(r => [String((r as Record<string, unknown>).id), r as Record<string, unknown>]));
    const missing = data.items.find(it => !menuMap.has(it.menu_item_id));
    if (missing) { res.status(400).json({ error: `Menu item not found: ${missing.menu_item_id}` }); return; }
    if (!tableRes.rows.length) { res.status(400).json({ error: 'Table not found' }); return; }

    const tableName  = String((tableRes.rows[0] as Record<string, unknown>).name);
    const serverName = userRes.rows.length ? String((userRes.rows[0] as Record<string, unknown>).name) : 'Staff';

    const orderId  = uid();
    const ticketId = uid();
    const covers   = data.covers;

    const payload = {
      ticketId, tableName, serverName, covers,
      items: data.items.map(it => ({
        name: String(menuMap.get(it.menu_item_id)!.name),
        qty:  it.qty,
        mods: it.mods,
        alert: false,
      })),
      note: data.note || undefined,
    };

    // Round trip 2: one batched transaction for the entire send.
    const stmts: { sql: string; args: InValue[] }[] = [
      {
        sql: `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note,status) VALUES(?,?,?,?,?,?,'sent')`,
        args: [orderId, rid, data.table_id, req.user!.id, covers, data.note ?? null],
      },
      ...data.items.map(it => ({
        sql:  `INSERT INTO order_items(id,order_id,menu_item_id,qty,mods) VALUES(?,?,?,?,?)`,
        args: [uid(), orderId, it.menu_item_id, it.qty, JSON.stringify(it.mods)] as InValue[],
      })),
      {
        sql: `INSERT INTO kds_tickets(id,restaurant_id,order_id,table_name,server_name,covers,status,created_at,updated_at)
              VALUES(?,?,?,?,?,?,'new',datetime('now'),datetime('now'))`,
        args: [ticketId, rid, orderId, tableName, serverName, covers],
      },
      ...data.items.map(it => {
        const m = menuMap.get(it.menu_item_id)!;
        return {
          sql:  `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert) VALUES(?,?,?,?,?,?,0)`,
          args: [uid(), ticketId, String(m.name), it.qty, catToStation(String(m.category)), JSON.stringify(it.mods)] as InValue[],
        };
      }),
    ];
    // Only enqueue a cloud print job for cross-device setups. When the sending
    // device prints locally we skip it, so nothing double-prints.
    if (data.enqueue_print) {
      stmts.push({
        sql: `INSERT INTO kitchen_print_jobs(id,restaurant_id,ticket_id,payload_json,status) VALUES(?,?,?,?,'pending')`,
        args: [uid(), rid, ticketId, JSON.stringify(payload)],
      });
    }
    stmts.push({
      sql: `UPDATE restaurant_tables SET status='occupied' WHERE id=? AND restaurant_id=?`,
      args: [data.table_id, rid],
    });
    await db.batch(stmts);

    res.status(201).json({ id: orderId, ticket_id: ticketId, status: 'sent' });
  } catch (e) { next(e); }
});

// ── POST /api/orders/:id/enqueue-print ────────────────────────────────────────
// Cloud-print fallback: only called when a local same-device print FAILS. Builds
// a pending print job from the order's existing KDS ticket so another device (or
// a retry) can still print it. Idempotency: skips if a live job already exists.
router.post('/:id/enqueue-print', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const orderId = req.params.id as string;
    const db = getDb();

    const ticketRes = await db.execute({
      sql: 'SELECT id,table_name,server_name,covers FROM kds_tickets WHERE order_id=? AND restaurant_id=? ORDER BY created_at DESC LIMIT 1',
      args: [orderId, rid],
    });
    if (!ticketRes.rows.length) { res.status(404).json({ error: 'No kitchen ticket for this order' }); return; }
    const ticket = ticketRes.rows[0] as Record<string, unknown>;
    const ticketId = String(ticket.id);

    const [itemsRes, dupRes] = await Promise.all([
      db.execute({ sql: 'SELECT name,qty,mods FROM kds_ticket_items WHERE ticket_id=?', args: [ticketId] }),
      db.execute({ sql: "SELECT id FROM kitchen_print_jobs WHERE ticket_id=? AND status IN ('pending','printing') LIMIT 1", args: [ticketId] }),
    ]);
    if (dupRes.rows.length) { res.status(200).json({ ok: true, deduped: true }); return; }

    const payload = {
      ticketId,
      tableName: String(ticket.table_name ?? ''),
      serverName: String(ticket.server_name ?? 'Staff'),
      covers: Number(ticket.covers) || 1,
      items: itemsRes.rows.map(r => {
        const it = r as Record<string, unknown>;
        let mods: string[] = [];
        try { const p = JSON.parse(String(it.mods ?? '[]')); if (Array.isArray(p)) mods = p.map(String); } catch { mods = []; }
        return { name: String(it.name), qty: Number(it.qty) || 1, mods, alert: false };
      }),
    };

    await db.execute({
      sql: `INSERT INTO kitchen_print_jobs(id,restaurant_id,ticket_id,payload_json,status) VALUES(?,?,?,?,'pending')`,
      args: [uid(), rid, ticketId, JSON.stringify(payload)],
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post('/', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid  = req.user!.restaurant_id;
    const data = OrderSchema.parse(req.body);
    const id   = uid();
    const db   = getDb();
    await db.execute({
      sql:  `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note)
             VALUES(?,?,?,?,?,?)`,
      args: [id, rid, data.table_id ?? null, req.user!.id, data.covers, data.note ?? null],
    });
    if (data.table_id) {
      await db.execute({
        sql:  `UPDATE restaurant_tables SET status='occupied' WHERE id=? AND restaurant_id=?`,
        args: [data.table_id, rid],
      });
    }
    const row = await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// ── PUT /api/orders/:id ───────────────────────────────────────────────────────
router.put('/:id', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid  = req.user!.restaurant_id;
    const data = OrderSchema.partial().parse(req.body);
    const db   = getDb();
    const id   = req.params.id as string;
    const ex   = await db.execute({
      sql:  'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const sets: string[] = [];
    const args: any[]   = [];
    if (data.covers !== undefined) { sets.push('covers=?'); args.push(data.covers); }
    if (data.note   !== undefined) { sets.push('note=?');   args.push(data.note); }
    sets.push("updated_at=datetime('now')");
    args.push(id, rid);
    await db.execute({ sql: `UPDATE orders SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// ── PATCH /api/orders/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status } = z.object({
      status: z.enum(['open', 'sent', 'paid', 'voided', 'comped']),
    }).parse(req.body);
    const db = getDb();
    const id = req.params.id as string;

    const ex = await db.execute({
      sql:  'SELECT * FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const order = ex.rows[0] as Record<string, unknown>;

    await db.execute({
      sql:  "UPDATE orders SET status=?,updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
      args: [status, id, rid],
    });

    // ── Auto-create KDS ticket when order is sent to kitchen ──────────────
    if (status === 'sent') {
      // Fetch order items + resolve table/server names in parallel.
      const [itemRows, tblRow, srvRow] = await Promise.all([
        db.execute({
          sql:  `SELECT oi.qty, oi.mods, m.name, m.category
                 FROM order_items oi
                 JOIN menu_items m ON m.id = oi.menu_item_id
                 WHERE oi.order_id = ?`,
          args: [id],
        }),
        order.table_id
          ? db.execute({ sql: 'SELECT name FROM restaurant_tables WHERE id=?', args: [String(order.table_id)] })
          : Promise.resolve(null),
        order.server_id
          ? db.execute({ sql: 'SELECT name FROM users WHERE id=?', args: [String(order.server_id)] })
          : Promise.resolve(null),
      ]);

      if (itemRows.rows.length > 0) {
        const tableName  = tblRow?.rows.length  ? String((tblRow.rows[0]  as Record<string, unknown>).name) : 'No Table';
        const serverName = srvRow?.rows.length  ? String((srvRow.rows[0]  as Record<string, unknown>).name) : 'Staff';

        const ticketId = uid();
        const covers   = Number(order.covers) || 1;

        // Build print payload before the batch so we can include it in the same round trip.
        const payload = {
          ticketId, tableName, serverName, covers,
          items: itemRows.rows.map((row) => {
            const it = row as Record<string, unknown>;
            let mods: string[] = [];
            try {
              const parsed = JSON.parse(String(it.mods ?? '[]'));
              if (Array.isArray(parsed)) mods = parsed.map((m) => String(m));
            } catch { mods = []; }
            return { name: String(it.name), qty: Number(it.qty) || 1, mods, alert: false };
          }),
          note: order.note ? String(order.note) : undefined,
        };

        // Batch the ticket header + all item rows + print job into one HTTP round trip.
        await db.batch([
          {
            sql:  `INSERT INTO kds_tickets
                     (id,restaurant_id,order_id,table_name,server_name,covers,status,created_at,updated_at)
                   VALUES(?,?,?,?,?,?,'new',datetime('now'),datetime('now'))`,
            args: [ticketId, rid, id, tableName, serverName, covers] as InValue[],
          },
          ...itemRows.rows.map((row) => {
            const it = row as Record<string, unknown>;
            return {
              sql:  `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert) VALUES(?,?,?,?,?,?,0)`,
              args: [uid(), ticketId, String(it.name), Number(it.qty), catToStation(String(it.category)), String(it.mods ?? '[]')] as InValue[],
            };
          }),
          {
            sql:  `INSERT INTO kitchen_print_jobs(id,restaurant_id,ticket_id,payload_json,status) VALUES(?,?,?,?,'pending')`,
            args: [uid(), rid, ticketId, JSON.stringify(payload)] as InValue[],
          },
        ]);
      }
    }

    // ── Clear table on final statuses ─────────────────────────────────────
    if ((status === 'paid' || status === 'voided' || status === 'comped') && order.table_id) {
      await db.execute({
        sql:  `UPDATE restaurant_tables SET status='empty',course='',covers=0
               WHERE id=? AND restaurant_id=?`,
        args: [String(order.table_id), rid],
      });
    }

    res.json({ id, status });
  } catch (e) { next(e); }
});

// ── POST /api/orders/:id/items ────────────────────────────────────────────────
router.post('/:id/items', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid  = req.user!.restaurant_id;
    const data = OrderItemSchema.parse(req.body);
    const db   = getDb();
    const id   = req.params.id as string;

    const ex = await db.execute({
      sql:  'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }

    // Validate menu item belongs to this restaurant
    const menuCheck = await db.execute({
      sql:  'SELECT id FROM menu_items WHERE id=? AND restaurant_id=?',
      args: [data.menu_item_id, rid],
    });
    if (!menuCheck.rows.length) { res.status(400).json({ error: 'Menu item not found' }); return; }

    const itemId = uid();
    await db.execute({
      sql:  `INSERT INTO order_items(id,order_id,menu_item_id,qty,mods) VALUES(?,?,?,?,?)`,
      args: [itemId, id, data.menu_item_id, data.qty, JSON.stringify(data.mods)],
    });
    const row = await db.execute({
      sql:  `SELECT oi.*,m.name,m.price
             FROM order_items oi
             JOIN menu_items m ON m.id = oi.menu_item_id
             WHERE oi.id=?`,
      args: [itemId],
    });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// ── PUT /api/orders/:id/items/:itemId ─────────────────────────────────────────
router.put('/:id/items/:itemId', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid    = req.user!.restaurant_id;
    const data   = z.object({
      qty:     z.number().int().positive().optional(),
      mods:    z.array(z.string()).optional(),
      is_done: z.boolean().optional(),
    }).parse(req.body);
    const db     = getDb();
    const id     = req.params.id as string;
    const itemId = req.params.itemId as string;

    const orderEx = await db.execute({
      sql:  'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!orderEx.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }

    const ex = await db.execute({
      sql:  'SELECT id FROM order_items WHERE id=? AND order_id=?',
      args: [itemId, id],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }

    const sets: string[] = [];
    const args: any[]   = [];
    if (data.qty     !== undefined) { sets.push('qty=?');     args.push(data.qty); }
    if (data.mods    !== undefined) { sets.push('mods=?');    args.push(JSON.stringify(data.mods)); }
    if (data.is_done !== undefined) { sets.push('is_done=?'); args.push(data.is_done ? 1 : 0); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push(itemId);
    await db.execute({ sql: `UPDATE order_items SET ${sets.join(',')} WHERE id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM order_items WHERE id=?', args: [itemId] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// ── DELETE /api/orders/:id/items/:itemId ──────────────────────────────────────
router.delete('/:id/items/:itemId', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
  try {
    const rid    = req.user!.restaurant_id;
    const db     = getDb();
    const id     = req.params.id as string;
    const itemId = req.params.itemId as string;

    const orderEx = await db.execute({
      sql:  'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!orderEx.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }

    const ex = await db.execute({
      sql:  'SELECT id FROM order_items WHERE id=? AND order_id=?',
      args: [itemId, id],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }

    await db.execute({ sql: 'DELETE FROM order_items WHERE id=?', args: [itemId] });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
router.delete('/:id', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const id = req.params.id as string;

    const ex = await db.execute({
      sql:  'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }

    // Cascade: remove KDS ticket items → tickets → order items → order
    await db.execute({
      sql:  `DELETE FROM kds_ticket_items WHERE ticket_id IN
             (SELECT id FROM kds_tickets WHERE order_id=?)`,
      args: [id],
    });
    await db.execute({ sql: 'DELETE FROM kds_tickets  WHERE order_id=?', args: [id] });
    await db.execute({ sql: 'DELETE FROM order_items  WHERE order_id=?', args: [id] });
    await db.execute({ sql: 'DELETE FROM orders WHERE id=? AND restaurant_id=?', args: [id, rid] });

    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
