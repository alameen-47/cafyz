import { Router } from 'express';
import { z } from 'zod';
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
      const itemRows = await db.execute({
        sql:  `SELECT oi.qty, oi.mods, m.name, m.category
               FROM order_items oi
               JOIN menu_items m ON m.id = oi.menu_item_id
               WHERE oi.order_id = ?`,
        args: [id],
      });

      if (itemRows.rows.length > 0) {
        // Resolve table name
        let tableName = 'No Table';
        if (order.table_id) {
          const tbl = await db.execute({
            sql:  'SELECT name FROM restaurant_tables WHERE id=?',
            args: [String(order.table_id)],
          });
          if (tbl.rows.length) {
            tableName = String((tbl.rows[0] as Record<string, unknown>).name);
          }
        }

        // Resolve server name
        let serverName = 'Staff';
        if (order.server_id) {
          const srv = await db.execute({
            sql:  'SELECT name FROM users WHERE id=?',
            args: [String(order.server_id)],
          });
          if (srv.rows.length) {
            serverName = String((srv.rows[0] as Record<string, unknown>).name);
          }
        }

        // Create KDS ticket
        const ticketId = uid();
        await db.execute({
          sql:  `INSERT INTO kds_tickets
                   (id,restaurant_id,order_id,table_name,server_name,covers,status,created_at,updated_at)
                 VALUES(?,?,?,?,?,?,'new',datetime('now'),datetime('now'))`,
          args: [ticketId, rid, id, tableName, serverName, Number(order.covers) || 1],
        });

        // Create KDS ticket items
        for (const row of itemRows.rows) {
          const it = row as Record<string, unknown>;
          await db.execute({
            sql:  `INSERT INTO kds_ticket_items
                     (id,ticket_id,name,qty,station,mods,alert)
                   VALUES(?,?,?,?,?,?,0)`,
            args: [
              uid(), ticketId,
              String(it.name),
              Number(it.qty),
              catToStation(String(it.category)),
              String(it.mods ?? '[]'),
            ],
          });
        }

        // Enqueue cloud print job for kitchen auto-printer consumers.
        const payload = {
          ticketId,
          tableName,
          serverName,
          covers: Number(order.covers) || 1,
          items: itemRows.rows.map((row) => {
            const it = row as Record<string, unknown>;
            let mods: string[] = [];
            try {
              const parsed = JSON.parse(String(it.mods ?? '[]'));
              if (Array.isArray(parsed)) mods = parsed.map((m) => String(m));
            } catch {
              mods = [];
            }
            return {
              name: String(it.name),
              qty: Number(it.qty) || 1,
              mods,
              alert: false,
            };
          }),
          note: order.note ? String(order.note) : undefined,
        };

        await db.execute({
          sql: `INSERT INTO kitchen_print_jobs(id,restaurant_id,ticket_id,payload_json,status)
                VALUES(?,?,?,?, 'pending')`,
          args: [uid(), rid, ticketId, JSON.stringify(payload)],
        });
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
