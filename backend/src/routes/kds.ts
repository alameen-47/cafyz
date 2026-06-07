import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

type PrintJobPayload = {
  ticketId: string;
  tableName: string;
  serverName?: string;
  covers?: number;
  station?: string;
  items: { name: string; qty: number; mods?: string[]; alert?: boolean }[];
  note?: string;
  createdAt?: string;
};

// GET /api/kds/tickets?status=new&station=GRILL
router.get('/tickets', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
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
router.get('/tickets/:id', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
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
router.post('/tickets', requireRole('owner', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res, next) => {
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
router.patch('/tickets/:id/fire', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
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
router.patch('/tickets/:id/ready', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
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
router.patch('/tickets/:id/delivered', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
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
router.delete('/tickets/:id', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM kds_tickets WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
    await db.execute({ sql: 'DELETE FROM kds_tickets WHERE id=?', args: [(req.params.id as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

// POST /api/kds/print-jobs/claim
router.post('/print-jobs/claim', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const deviceId = z.object({ device_id: z.string().optional() }).parse(req.body ?? {}).device_id ?? null;
    const db = getDb();
    const row = await db.execute({
      sql: `UPDATE kitchen_print_jobs
            SET status='printing',
                claimed_by=?,
                claimed_at=datetime('now'),
                attempt_count=attempt_count+1,
                updated_at=datetime('now')
            WHERE id = (
              SELECT id FROM kitchen_print_jobs
              WHERE restaurant_id=? AND status='pending'
              ORDER BY created_at ASC
              LIMIT 1
            )
            RETURNING *`,
      args: [deviceId, rid],
    });
    if (!row.rows.length) {
      res.json({ job: null });
      return;
    }
    const job = row.rows[0] as Record<string, unknown>;
    let payload: PrintJobPayload | null = null;
    try {
      payload = JSON.parse(String(job.payload_json ?? '{}')) as PrintJobPayload;
    } catch {
      payload = null;
    }
    res.json({ job: { ...job, payload } });
  } catch (e) { next(e); }
});

// PATCH /api/kds/print-jobs/:id
router.patch('/print-jobs/:id', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const id = req.params.id as string;
    const data = z.object({
      status: z.enum(['printed', 'failed']),
      error: z.string().optional(),
    }).parse(req.body);
    const db = getDb();
    const ex = await db.execute({
      sql: 'SELECT * FROM kitchen_print_jobs WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) {
      res.status(404).json({ error: 'Print job not found' });
      return;
    }

    if (data.status === 'printed') {
      await db.execute({
        sql: `UPDATE kitchen_print_jobs
              SET status='printed',
                  printed_at=datetime('now'),
                  claimed_by=NULL,
                  claimed_at=NULL,
                  last_error=NULL,
                  updated_at=datetime('now')
              WHERE id=? AND restaurant_id=?`,
        args: [id, rid],
      });
    } else {
      const cur = ex.rows[0] as Record<string, unknown>;
      const attempts = Number(cur.attempt_count ?? 0);
      const nextStatus = attempts >= 5 ? 'failed' : 'pending';
      await db.execute({
        sql: `UPDATE kitchen_print_jobs
              SET status=?,
                  claimed_by=NULL,
                  claimed_at=NULL,
                  last_error=?,
                  updated_at=datetime('now')
              WHERE id=? AND restaurant_id=?`,
        args: [nextStatus, data.error ?? 'Print failed', id, rid],
      });
    }
    const out = await db.execute({
      sql: 'SELECT * FROM kitchen_print_jobs WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    res.json(out.rows[0]);
  } catch (e) { next(e); }
});

export default router;
