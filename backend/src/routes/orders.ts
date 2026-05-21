import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
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

// GET /api/orders
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, table_id } = req.query;
    let sql = `SELECT o.*, t.name as table_name FROM orders o LEFT JOIN restaurant_tables t ON t.id=o.table_id WHERE o.restaurant_id=?`;
    const args: any[] = [rid];
    if (status)   { sql += ' AND o.status=?';   args.push(String(status)); }
    if (table_id) { sql += ' AND o.table_id=?'; args.push(String(table_id)); }
    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    const rows = await getDb().execute({ sql, args });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/orders/:id
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const order = await db.execute({ sql: 'SELECT * FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!order.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const items = await db.execute({
      sql: `SELECT oi.*, m.name, m.price, m.category FROM order_items oi
            JOIN menu_items m ON m.id=oi.menu_item_id WHERE oi.order_id=?`,
      args: [(req.params.id as string)],
    });
    res.json({ ...order.rows[0], items: items.rows });
  } catch (e) { next(e); }
});

// POST /api/orders
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = OrderSchema.parse(req.body);
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO orders(id,restaurant_id,table_id,server_id,covers,note) VALUES(?,?,?,?,?,?)`,
      args: [id, rid, data.table_id??null, req.user!.id, data.covers, data.note??null],
    });
    if (data.table_id) {
      await getDb().execute({ sql: `UPDATE restaurant_tables SET status='occupied' WHERE id=? AND restaurant_id=?`, args: [data.table_id, rid] });
    }
    const row = await getDb().execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/orders/:id
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = OrderSchema.partial().parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const sets: string[] = []; const args: any[] = [];
    if (data.covers !== undefined) { sets.push('covers=?'); args.push(data.covers); }
    if (data.note   !== undefined) { sets.push('note=?');   args.push(data.note); }
    sets.push("updated_at=datetime('now')");
    args.push((req.params.id as string));
    args.push(rid);
    await db.execute({ sql: `UPDATE orders SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status } = z.object({ status: z.enum(['open','sent','paid','voided','comped']) }).parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT * FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    await db.execute({ sql: "UPDATE orders SET status=?,updated_at=datetime('now') WHERE id=? AND restaurant_id=?", args: [status, (req.params.id as string), rid] });
    const order = ex.rows[0] as Record<string,unknown>;
    if ((status === 'paid' || status === 'voided') && order.table_id) {
      await db.execute({ sql: `UPDATE restaurant_tables SET status='empty',course='',covers=0 WHERE id=? AND restaurant_id=?`, args: [order.table_id as string, rid] });
    }
    res.json({ id: (req.params.id as string), status });
  } catch (e) { next(e); }
});

// POST /api/orders/:id/items
router.post('/:id/items', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = OrderItemSchema.parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const id = uid();
    await db.execute({
      sql: `INSERT INTO order_items(id,order_id,menu_item_id,qty,mods) VALUES(?,?,?,?,?)`,
      args: [id, (req.params.id as string), data.menu_item_id, data.qty, JSON.stringify(data.mods)],
    });
    const row = await db.execute({ sql: `SELECT oi.*,m.name,m.price FROM order_items oi JOIN menu_items m ON m.id=oi.menu_item_id WHERE oi.id=?`, args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/orders/:id/items/:itemId
router.put('/:id/items/:itemId', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = z.object({ qty: z.number().int().positive().optional(), mods: z.array(z.string()).optional(), is_done: z.boolean().optional() }).parse(req.body);
    const db = getDb();
    // Verify the order belongs to this restaurant
    const orderEx = await db.execute({ sql: 'SELECT id FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!orderEx.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const ex = await db.execute({ sql: 'SELECT id FROM order_items WHERE id=? AND order_id=?', args: [(req.params.itemId as string), (req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
    const sets: string[] = []; const args: any[] = [];
    if (data.qty     !== undefined) { sets.push('qty=?');     args.push(data.qty); }
    if (data.mods    !== undefined) { sets.push('mods=?');    args.push(JSON.stringify(data.mods)); }
    if (data.is_done !== undefined) { sets.push('is_done=?'); args.push(data.is_done?1:0); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push((req.params.itemId as string));
    await db.execute({ sql: `UPDATE order_items SET ${sets.join(',')} WHERE id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM order_items WHERE id=?', args: [(req.params.itemId as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/orders/:id/items/:itemId
router.delete('/:id/items/:itemId', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    // Verify the order belongs to this restaurant
    const orderEx = await db.execute({ sql: 'SELECT id FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!orderEx.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    const ex = await db.execute({ sql: 'SELECT id FROM order_items WHERE id=? AND order_id=?', args: [(req.params.itemId as string), (req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM order_items WHERE id=?', args: [(req.params.itemId as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    if (req.user!.role !== 'manager') { res.status(403).json({ error: 'Manager only' }); return; }
    const ex = await getDb().execute({ sql: 'SELECT id FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM orders WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
