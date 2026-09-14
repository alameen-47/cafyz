import { Router } from 'express';
import { z } from 'zod';
import type { InValue } from '@libsql/client';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { sendRestaurantPush } from '../services/push.js';
import { isDemoDataEnabled } from '../services/demoData.js';

const router = Router();
router.use(requireAuth);

const OrderSchema = z.object({
  table_id: z.string().optional(),
  covers:   z.number().int().positive().default(1),
  note:     z.string().optional(),
  order_type: z.enum(['dine_in', 'parcel']).optional(),
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

const PAYMENT_METHODS = ['cash', 'upi', 'card'] as const;

/** Next running bill number for a restaurant; binds one `restaurant_id` arg. Safe inside a batch transaction. */
const NEXT_BILL_NO_SQL = '(SELECT COALESCE(MAX(bill_no), 0) + 1 FROM orders WHERE restaurant_id=?)';

// ── GET /api/orders/live ──────────────────────────────────────────────────────
// Enriched live board: orders + line items + latest KDS ticket in two queries.
// Lives under /api/orders so waiters on Basic plan can read kitchen progress
// without needing the Pro KDS section.
router.get('/live', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const db = getDb();

    let sql = `
      SELECT o.id, o.restaurant_id, o.table_id, o.server_id, o.status, o.covers, o.note, o.order_type,
             o.payment_method, o.bill_no,
             o.created_at, o.updated_at,
             t.name AS table_name,
             u.name AS server_name,
             kt.id AS ticket_id,
             kt.status AS ticket_status,
             kt.vip AS ticket_vip,
             kt.updated_at AS ticket_updated_at
      FROM orders o
      LEFT JOIN restaurant_tables t ON t.id = o.table_id
      LEFT JOIN users u ON u.id = o.server_id
      LEFT JOIN kds_tickets kt ON kt.id = (
        SELECT id FROM kds_tickets
        WHERE order_id = o.id AND restaurant_id = o.restaurant_id
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE o.restaurant_id = ? AND o.status != 'voided'`;
    const args: InValue[] = [rid];
    if (activeOnly) sql += " AND o.status IN ('open','sent')";
    sql += ' ORDER BY o.created_at DESC LIMIT 100';

    const orderRows = await db.execute({ sql, args });
    const orders = orderRows.rows as Record<string, unknown>[];
    if (!orders.length) { res.json([]); return; }

    const ids = orders.map(o => String(o.id));
    const ph = ids.map(() => '?').join(',');
    const itemRows = await db.execute({
      sql: `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.qty, oi.mods, oi.is_done,
                   m.name, m.price
            FROM order_items oi
            JOIN menu_items m ON m.id = oi.menu_item_id
            WHERE oi.order_id IN (${ph})
            ORDER BY oi.id ASC`,
      args: ids,
    });

    const itemsByOrder = new Map<string, Record<string, unknown>[]>();
    for (const row of itemRows.rows) {
      const r = row as Record<string, unknown>;
      const oid = String(r.order_id);
      if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
      itemsByOrder.get(oid)!.push(r);
    }

    res.json(orders.map(o => {
      const id = String(o.id);
      const items = itemsByOrder.get(id) ?? [];
      const subtotal = items.reduce((s, it) => s + Number(it.price ?? 0) * Number(it.qty ?? 0), 0);
      return {
        id,
        restaurant_id: o.restaurant_id,
        table_id: o.table_id ?? null,
        server_id: o.server_id ?? null,
        status: o.status,
        covers: o.covers,
        note: o.note ?? null,
        order_type: o.order_type ?? 'dine_in',
        payment_method: o.payment_method ?? null,
        bill_no: o.bill_no ?? null,
        table_name: o.table_name ?? null,
        server_name: o.server_name ?? null,
        created_at: o.created_at,
        updated_at: o.updated_at,
        ticket_id: o.ticket_id ?? null,
        ticket_status: o.ticket_status ?? null,
        ticket_vip: o.ticket_vip ?? 0,
        ticket_updated_at: o.ticket_updated_at ?? null,
        subtotal,
        items: items.map(it => ({
          id: it.id,
          order_id: it.order_id,
          menu_item_id: it.menu_item_id,
          qty: it.qty,
          mods: it.mods,
          is_done: it.is_done,
          name: it.name,
          price: it.price,
        })),
      };
    }));
  } catch (e) { next(e); }
});

// ── PATCH /api/orders/:id/kitchen-progress ────────────────────────────────────
// Advance kitchen ticket without requiring the Pro KDS API (waiters/cashiers).
router.patch('/:id/kitchen-progress', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const orderId = req.params.id as string;
    const { action } = z.object({
      action: z.enum(['fire', 'ready', 'delivered']),
    }).parse(req.body);

    const statusMap = { fire: 'prep', ready: 'ready', delivered: 'delivered' } as const;
    const nextStatus = statusMap[action];
    const db = getDb();

    const ticketRes = await db.execute({
      sql: `SELECT id, status FROM kds_tickets
            WHERE order_id = ? AND restaurant_id = ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [orderId, rid],
    });
    if (!ticketRes.rows.length) {
      res.status(404).json({ error: 'No kitchen ticket for this order' });
      return;
    }
    const ticket = ticketRes.rows[0] as Record<string, unknown>;
    const ticketId = String(ticket.id);

    const result = await db.execute({
      sql: `UPDATE kds_tickets SET status=?, updated_at=datetime('now')
            WHERE id=? AND restaurant_id=?`,
      args: [nextStatus, ticketId, rid],
    });
    if (!result.rowsAffected) { res.status(404).json({ error: 'Ticket not found' }); return; }
    res.json({ order_id: orderId, ticket_id: ticketId, status: nextStatus });
  } catch (e) { next(e); }
});

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
  // Parcel / takeaway order — flagged on the kitchen ticket.
  parcel:   z.boolean().default(false),
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
      parcel: data.parcel,
    };

    // Round trip 2: one batched transaction for the entire send.
    const stmts: { sql: string; args: InValue[] }[] = [
      {
        sql: `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note,status,order_type,is_demo) VALUES(?,?,?,?,?,?,'sent',?,?)`,
        args: [
          orderId, rid, data.table_id, req.user!.id, covers, data.note ?? null, data.parcel ? 'parcel' : 'dine_in',
          // Orders placed while exploring demo data are removed along with it.
          (await isDemoDataEnabled(rid)) ? 1 : 0,
        ],
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

    sendRestaurantPush(rid, {
      title: `New order — ${tableName}`,
      body: `${data.items.length} item${data.items.length === 1 ? '' : 's'} · ${covers} covers`,
      data: { type: 'order', orderId, page: 'kds' },
      roles: ['kitchen', 'manager', 'owner'],
      excludeUserId: req.user!.id,
    });

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

    const [itemsRes, dupRes, orderRes] = await Promise.all([
      db.execute({ sql: 'SELECT name,qty,mods FROM kds_ticket_items WHERE ticket_id=?', args: [ticketId] }),
      db.execute({ sql: "SELECT id FROM kitchen_print_jobs WHERE ticket_id=? AND status IN ('pending','printing') LIMIT 1", args: [ticketId] }),
      db.execute({ sql: 'SELECT order_type FROM orders WHERE id=? AND restaurant_id=?', args: [orderId, rid] }),
    ]);
    if (dupRes.rows.length) { res.status(200).json({ ok: true, deduped: true }); return; }
    const isParcel = String((orderRes.rows[0] as Record<string, unknown> | undefined)?.order_type) === 'parcel';

    const payload = {
      ticketId,
      tableName: String(ticket.table_name ?? ''),
      serverName: String(ticket.server_name ?? 'Staff'),
      covers: Number(ticket.covers) || 1,
      parcel: isParcel,
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
      sql:  `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note,is_demo)
             VALUES(?,?,?,?,?,?,?)`,
      args: [id, rid, data.table_id ?? null, req.user!.id, data.covers, data.note ?? null, (await isDemoDataEnabled(rid)) ? 1 : 0],
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
    if (data.order_type !== undefined) { sets.push('order_type=?'); args.push(data.order_type); }
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
          parcel: String(order.order_type) === 'parcel',
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

// ── POST /api/orders/settle-table ─────────────────────────────────────────────
// Atomically close out a table: mark EVERY still-active order (open/sent) on it
// as paid AND clear the table — in one transaction. This guarantees a paid table
// can never show leftover items (the "table empty but order still sent" bug).
router.post('/settle-table', requireRole('owner', 'manager', 'cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { table_id, payment_method } = z.object({
      table_id: z.string().min(1),
      payment_method: z.enum(PAYMENT_METHODS).optional(),
    }).parse(req.body);
    const db = getDb();
    const tableRes = await db.execute({
      sql: 'SELECT name FROM restaurant_tables WHERE id=? AND restaurant_id=?',
      args: [table_id, rid],
    });
    const tableName = tableRes.rows.length ? String((tableRes.rows[0] as Record<string, unknown>).name) : 'Table';

    const result = await db.batch([
      {
        // One bill number for the whole table, stamped on its oldest open order.
        sql: `UPDATE orders SET bill_no=${NEXT_BILL_NO_SQL}
              WHERE id=(SELECT id FROM orders WHERE restaurant_id=? AND table_id=? AND status IN ('open','sent')
                        ORDER BY created_at ASC LIMIT 1)`,
        args: [rid, rid, table_id],
      },
      {
        sql: `UPDATE orders SET status='paid', payment_method=COALESCE(?, payment_method), updated_at=datetime('now')
              WHERE restaurant_id=? AND table_id=? AND status IN ('open','sent')`,
        args: [payment_method ?? null, rid, table_id],
      },
      {
        sql: `UPDATE kds_tickets SET status='delivered', updated_at=datetime('now')
              WHERE restaurant_id=? AND order_id IN (
                SELECT id FROM orders WHERE restaurant_id=? AND table_id=? AND status='paid'
              ) AND status != 'delivered'`,
        args: [rid, rid, table_id],
      },
      {
        sql: `UPDATE restaurant_tables SET status='empty', course='', covers=0
              WHERE id=? AND restaurant_id=?`,
        args: [table_id, rid],
      },
      // Read back inside the same transaction, so this is the number stamped above.
      { sql: 'SELECT MAX(bill_no) AS bill_no FROM orders WHERE restaurant_id=?', args: [rid] },
    ]);
    const settled = result[1]?.rowsAffected ?? 0;
    const billNo = settled > 0 ? Number((result[4]?.rows[0] as Record<string, unknown> | undefined)?.bill_no) || null : null;
    if (settled > 0) {
      sendRestaurantPush(rid, {
        title: `Payment received — ${tableName}`,
        body: `${settled} order${settled === 1 ? '' : 's'} settled`,
        data: { type: 'order', page: 'orders', tableId: table_id },
        roles: ['manager', 'owner', 'cashier'],
        excludeUserId: req.user!.id,
      });
    }
    res.json({ ok: true, settled, bill_no: billNo });
  } catch (e) { next(e); }
});

// ── POST /api/orders/instant-bill ─────────────────────────────────────────────
// The quick counter path: selected menu items → a PAID bill in one batched round
// trip. A table is optional (walk-in or takeaway at the counter). The kitchen still
// gets its ticket so the food is made.
const InstantBillSchema = z.object({
  table_id:        z.string().min(1).nullish(),
  parcel:          z.boolean().default(false),
  payment_method:  z.enum(PAYMENT_METHODS).default('cash'),
  note:            z.string().max(500).optional(),
  send_to_kitchen: z.boolean().default(true),
  items: z.array(z.object({
    menu_item_id: z.string(),
    qty:          z.number().int().positive().max(999).default(1),
    mods:         z.array(z.string()).default([]),
  })).min(1).max(200),
});

router.post('/instant-bill', requireRole('owner', 'manager', 'cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid  = req.user!.restaurant_id;
    const data = InstantBillSchema.parse(req.body);
    const db   = getDb();
    const tableId = data.table_id ?? null;

    const ids = [...new Set(data.items.map(i => i.menu_item_id))];
    const ph  = ids.map(() => '?').join(',');
    const [menuRes, tableRes, userRes, isDemo] = await Promise.all([
      db.execute({ sql: `SELECT id,name,price,category FROM menu_items WHERE restaurant_id=? AND id IN (${ph})`, args: [rid, ...ids] }),
      tableId
        ? db.execute({
          sql: `SELECT t.name,
                       (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id=t.restaurant_id AND o.table_id=t.id
                          AND o.status IN ('open','sent')) AS open_orders
                FROM restaurant_tables t WHERE t.id=? AND t.restaurant_id=?`,
          args: [tableId, rid],
        })
        : Promise.resolve(null),
      db.execute({ sql: 'SELECT name FROM users WHERE id=?', args: [req.user!.id] }),
      isDemoDataEnabled(rid),
    ]);

    const menuMap = new Map(menuRes.rows.map(r => [String((r as Record<string, unknown>).id), r as Record<string, unknown>]));
    const missing = data.items.find(it => !menuMap.has(it.menu_item_id));
    if (missing) { res.status(400).json({ error: `Menu item not found: ${missing.menu_item_id}` }); return; }
    const tableRow = tableRes?.rows[0] as Record<string, unknown> | undefined;
    if (tableId && !tableRow) { res.status(400).json({ error: 'Table not found' }); return; }
    if (tableRow && Number(tableRow.open_orders) > 0) {
      // Paying here would leave the table's running bill off this receipt.
      res.status(409).json({ error: 'This table already has an open bill. Open it to add items and take payment.', code: 'TABLE_HAS_OPEN_BILL' });
      return;
    }

    const tableName   = tableRow ? String(tableRow.name) : null;
    const ticketLabel = tableName ?? (data.parcel ? 'Parcel' : 'Counter');
    const serverName  = userRes.rows.length ? String((userRes.rows[0] as Record<string, unknown>).name) : 'Staff';
    const orderId  = uid();
    const ticketId = uid();
    const subtotal = data.items.reduce((s, it) => s + Number(menuMap.get(it.menu_item_id)!.price ?? 0) * it.qty, 0);

    const stmts: { sql: string; args: InValue[] }[] = [
      {
        sql: `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note,status,order_type,payment_method,bill_no,is_demo)
              VALUES(?,?,?,?,1,?,'paid',?,?,${NEXT_BILL_NO_SQL},?)`,
        args: [
          orderId, rid, tableId, req.user!.id, data.note ?? null, data.parcel ? 'parcel' : 'dine_in',
          data.payment_method, rid, isDemo ? 1 : 0,
        ],
      },
      ...data.items.map(it => ({
        sql:  `INSERT INTO order_items(id,order_id,menu_item_id,qty,mods) VALUES(?,?,?,?,?)`,
        args: [uid(), orderId, it.menu_item_id, it.qty, JSON.stringify(it.mods)] as InValue[],
      })),
    ];
    if (tableId) {
      stmts.push({
        sql: `UPDATE restaurant_tables SET status='empty', course='', covers=0 WHERE id=? AND restaurant_id=?`,
        args: [tableId, rid],
      });
    }
    if (data.send_to_kitchen) {
      const payload = {
        ticketId, tableName: ticketLabel, serverName, covers: 1,
        items: data.items.map(it => ({ name: String(menuMap.get(it.menu_item_id)!.name), qty: it.qty, mods: it.mods, alert: false })),
        note: data.note || undefined,
        parcel: data.parcel,
      };
      stmts.push(
        {
          sql: `INSERT INTO kds_tickets(id,restaurant_id,order_id,table_name,server_name,covers,status,created_at,updated_at)
                VALUES(?,?,?,?,?,1,'new',datetime('now'),datetime('now'))`,
          args: [ticketId, rid, orderId, ticketLabel, serverName],
        },
        ...data.items.map(it => {
          const m = menuMap.get(it.menu_item_id)!;
          return {
            sql:  `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert) VALUES(?,?,?,?,?,?,0)`,
            args: [uid(), ticketId, String(m.name), it.qty, catToStation(String(m.category)), JSON.stringify(it.mods)] as InValue[],
          };
        }),
        {
          sql: `INSERT INTO kitchen_print_jobs(id,restaurant_id,ticket_id,payload_json,status) VALUES(?,?,?,?,'pending')`,
          args: [uid(), rid, ticketId, JSON.stringify(payload)],
        },
      );
    }
    stmts.push({ sql: 'SELECT bill_no, created_at FROM orders WHERE id=?', args: [orderId] });

    const results = await db.batch(stmts);
    const saved = results[results.length - 1]?.rows[0] as Record<string, unknown> | undefined;

    if (data.send_to_kitchen) {
      sendRestaurantPush(rid, {
        title: `New order — ${ticketLabel}`,
        body: `${data.items.length} item${data.items.length === 1 ? '' : 's'} · paid`,
        data: { type: 'order', orderId, page: 'kds' },
        roles: ['kitchen', 'manager', 'owner'],
        excludeUserId: req.user!.id,
      });
    }

    res.status(201).json({
      id: orderId,
      bill_no: Number(saved?.bill_no) || null,
      status: 'paid',
      payment_method: data.payment_method,
      order_type: data.parcel ? 'parcel' : 'dine_in',
      table_id: tableId,
      table_name: tableName,
      subtotal,
      ticket_id: data.send_to_kitchen ? ticketId : null,
      created_at: saved?.created_at ?? null,
    });
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
