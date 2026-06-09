import { Router } from 'express';
import { z } from 'zod';
import type { InValue } from '@libsql/client';
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

async function claimNextPrintJob(rid: string, deviceId: string | null) {
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
  if (!row.rows.length) return null;
  const job = row.rows[0] as Record<string, unknown>;
  let payload: PrintJobPayload | null = null;
  try {
    payload = JSON.parse(String(job.payload_json ?? '{}')) as PrintJobPayload;
  } catch {
    payload = null;
  }
  return { ...job, payload };
}

// GET /api/kds/tickets?status=new&station=GRILL
router.get('/tickets', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, station } = req.query;

    // Single JOIN replaces the previous N+1 pattern (1 query per ticket for items).
    let sql = `
      SELECT t.id, t.restaurant_id, t.order_id, t.table_name, t.server_name,
             t.covers, t.vip, t.station, t.status, t.created_at, t.updated_at,
             i.id      AS i_id,
             i.name    AS i_name,
             i.qty     AS i_qty,
             i.station AS i_station,
             i.mods    AS i_mods,
             i.alert   AS i_alert
      FROM kds_tickets t
      LEFT JOIN kds_ticket_items i ON i.ticket_id = t.id
      WHERE t.restaurant_id = ?`;
    const args: InValue[] = [rid];
    if (status)  { sql += ' AND t.status=?';  args.push(String(status)); }
    if (station) { sql += ' AND t.station=?'; args.push(String(station)); }
    sql += ' ORDER BY t.created_at ASC';

    const rows = await getDb().execute({ sql, args });

    // Group item columns back onto their parent ticket.
    const ticketMap = new Map<string, Record<string, unknown> & { items: Record<string, unknown>[] }>();
    for (const row of rows.rows) {
      const r = row as Record<string, unknown>;
      const tid = String(r.id);
      if (!ticketMap.has(tid)) {
        ticketMap.set(tid, {
          id: r.id, restaurant_id: r.restaurant_id, order_id: r.order_id,
          table_name: r.table_name, server_name: r.server_name,
          covers: r.covers, vip: r.vip, station: r.station,
          status: r.status, created_at: r.created_at, updated_at: r.updated_at,
          items: [],
        });
      }
      if (r.i_id != null) {
        ticketMap.get(tid)!.items.push({
          id: r.i_id, name: r.i_name, qty: r.i_qty,
          station: r.i_station, mods: r.i_mods, alert: r.i_alert,
        });
      }
    }
    res.json([...ticketMap.values()]);
  } catch (e) { next(e); }
});

// GET /api/kds/tickets/:id
router.get('/tickets/:id', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const id = req.params.id as string;
    const [ticket, items] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM kds_tickets WHERE id=? AND restaurant_id=?', args: [id, rid] }),
      db.execute({ sql: 'SELECT * FROM kds_ticket_items WHERE ticket_id=?', args: [id] }),
    ]);
    if (!ticket.rows.length) { res.status(404).json({ error: 'Ticket not found' }); return; }
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

    // Batch all inserts + the two reads into one HTTP round trip via db.batch().
    const itemStmts = data.items.map(item => ({
      sql: `INSERT INTO kds_ticket_items(id,ticket_id,name,qty,station,mods,alert) VALUES(?,?,?,?,?,?,?)`,
      args: [uid(), id, item.name, item.qty, item.station, JSON.stringify(item.mods), item.alert?1:0] as InValue[],
    }));
    const batchResults = await db.batch([
      {
        sql: `INSERT INTO kds_tickets(id,restaurant_id,order_id,table_name,server_name,covers,vip,station,status)
              VALUES(?,?,?,?,?,?,?,?,'new')`,
        args: [id, rid, data.order_id, data.table_name, data.server_name, data.covers, data.vip?1:0, data.station??null] as InValue[],
      },
      ...itemStmts,
      { sql: 'SELECT * FROM kds_tickets WHERE id=?', args: [id] as InValue[] },
      { sql: 'SELECT * FROM kds_ticket_items WHERE ticket_id=?', args: [id] as InValue[] },
    ]);
    const ticket = batchResults[1 + data.items.length];
    const items  = batchResults[2 + data.items.length];
    res.status(201).json({ ...ticket.rows[0], items: items.rows });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/fire  (new → prep)
router.patch('/tickets/:id/fire', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const id = req.params.id as string;
    const result = await getDb().execute({
      sql: "UPDATE kds_tickets SET status='prep',updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
      args: [id, rid],
    });
    if (!result.rowsAffected) { res.status(404).json({ error: 'Ticket not found' }); return; }
    res.json({ id, status: 'prep' });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/ready  (prep → ready)
router.patch('/tickets/:id/ready', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const id = req.params.id as string;
    const result = await getDb().execute({
      sql: "UPDATE kds_tickets SET status='ready',updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
      args: [id, rid],
    });
    if (!result.rowsAffected) { res.status(404).json({ error: 'Ticket not found' }); return; }
    res.json({ id, status: 'ready' });
  } catch (e) { next(e); }
});

// PATCH /api/kds/tickets/:id/delivered
router.patch('/tickets/:id/delivered', requireRole('owner', 'manager', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const id = req.params.id as string;
    const result = await getDb().execute({
      sql: "UPDATE kds_tickets SET status='delivered',updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
      args: [id, rid],
    });
    if (!result.rowsAffected) { res.status(404).json({ error: 'Ticket not found' }); return; }
    res.json({ id, status: 'delivered' });
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
// Allow any operational role that can access KDS section to consume jobs.
router.post('/print-jobs/claim', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const deviceId = z.object({ device_id: z.string().optional() }).parse(req.body ?? {}).device_id ?? null;
    const job = await claimNextPrintJob(rid, deviceId);
    if (!job) {
      res.json({ job: null });
      return;
    }
    res.json({ job });
  } catch (e) { next(e); }
});

// POST /api/kds/print-jobs/claim-wait
// Cloud-optimized long-poll claim endpoint: waits briefly for next pending job.
router.post('/print-jobs/claim-wait', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = z.object({
      device_id: z.string().optional(),
      wait_ms: z.number().int().min(0).max(30000).optional(),
    }).parse(req.body ?? {});
    const deviceId = data.device_id ?? null;
    const waitMs = data.wait_ms ?? 15000;
    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    while (Date.now() - startedAt <= waitMs) {
      const job = await claimNextPrintJob(rid, deviceId);
      if (job) {
        res.json({ job });
        return;
      }
      // Short server-side wait keeps clients near real-time without hammering.
      await sleep(250);
    }

    res.json({ job: null });
  } catch (e) { next(e); }
});

// PATCH /api/kds/print-jobs/:id
router.patch('/print-jobs/:id', requireRole('owner', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res, next) => {
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
