import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

// GET /api/kds/tickets?status=new&station=GRILL
router.get('/tickets', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, station } = req.query;
    let sql = 'SELECT * FROM kds_tickets WHERE restaurant_id=?';
    const args: any[] = [rid];
    if (status)  { sql += ' AND status=?';  args.push(String(status)); }
    if (station) { sql += ' AND station=?'; args.push(String(station)); }
    sql += ' ORDER BY created_at ASC';
    const tickets = await getDb().execute({ sql, args });

    // Attach items
    const result = await Promise.all(tickets.rows.map(async (t) => {
      const tMap = t as Record<string,unknown>;
      const items = await getDb().execute({ sql: 'SELECT * FROM kds_ticket_items WHERE ticket_id=?', args: [tMap.id as string] });
      return { ...tMap, items: items.rows };
    }));
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/kds/tickets/:id
router.get('/tickets/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ticket = await db.execute({ sql: 'SELECT * FROM kds_tickets WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ticket.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    const items = await db.execute({ sql: 'SELECT * FROM kds_ticket_items WHERE ticket_id=?', args: [(req.params.id as string)] });
    res.json({ ...ticket.rows[0], items: items.rows });
  } catch (e) { next(e); }
});

// POST /api/kds/tickets  (create ticket from order)
router.post('/tickets', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = z.object({
      order_id:    z.string(),
      table_name:  z.string(),
      server_name: z.string(),
      covers:      z.number().int().default(1),
      vip:         z.boolean().default(false),
      station:     z.string().optional(),
      items: z.array(z.object({
        name:    z.string(),
        qty:     z.number().int().default(1),
        station: z.string().default('GARDE'),
        mods:    z.array(z.string()).default([]),
        alert:   z.boolean().default(false),
      })).default([]),
    }).parse(req.body);

    const db = getDb();
    const id = uid();
    await db.execute({
      sql: `INSERT INTO kds_tickets(id,restaurant_id,order_id,table_name,server_name,covers,vip,station,status)
            VALUES(?,?,?,?,?,?,?,?,'new')`,
      args: [id, rid, data.order_id, data.table_name, data.server_name, data.covers, data.vip?1:0, data.station??null],
    });
    for (const item of data.items) {
      await db.execute({
        sql: `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert) VALUES(?,?,?,?,?,?,?)`,
        args: [uid(), id, item.name, item.qty, item.station, JSON.stringify(item.mods), item.alert?1:0],
      });
    }
    const ticket = await db.execute({ sql: 'SELECT * FROM kds_tickets WHERE id=?', args: [id] });
    const items  = await db.execute({ sql: 'SELECT * FROM kds_ticket_items WHERE ticket_id=?', args: [id] });
    res.status(201).json({ ...ticket.rows[0], items: items.rows });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/fire  (new → prep)
router.patch('/tickets/:id/fire', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: "SELECT id,status FROM kds_tickets WHERE id=? AND restaurant_id=?", args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    await db.execute({ sql: "UPDATE kds_tickets SET status='prep',updated_at=datetime('now') WHERE id=?", args: [(req.params.id as string)] });
    res.json({ id: (req.params.id as string), status: 'prep' });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/ready  (prep → ready)
router.patch('/tickets/:id/ready', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: "SELECT id FROM kds_tickets WHERE id=? AND restaurant_id=?", args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    await db.execute({ sql: "UPDATE kds_tickets SET status='ready',updated_at=datetime('now') WHERE id=?", args: [(req.params.id as string)] });
    res.json({ id: (req.params.id as string), status: 'ready' });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/delivered
router.patch('/tickets/:id/delivered', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: "SELECT id FROM kds_tickets WHERE id=? AND restaurant_id=?", args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    await db.execute({ sql: "UPDATE kds_tickets SET status='delivered',updated_at=datetime('now') WHERE id=?", args: [(req.params.id as string)] });
    res.json({ id: (req.params.id as string), status: 'delivered' });
  } catch (e) { next(e); }
});

// DELETE /api/kds/tickets/:id
router.delete('/tickets/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM kds_tickets WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    await db.execute({ sql: 'DELETE FROM kds_tickets WHERE id=?', args: [(req.params.id as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
