import { Router } from 'express';
import { z } from 'zod';
import type { InValue } from '@libsql/client';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { sendRestaurantPush } from '../services/push.js';

const router = Router();
router.use(requireAuth);

const ResSchema = z.object({
  table_id:   z.string().optional().nullable(),
  guest_name: z.string().min(1),
  covers:     z.number().int().positive().default(2),
  res_time:   z.string().min(1),
  note:       z.string().optional().nullable(),
  status:     z.enum(['confirmed', 'seated', 'cancelled', 'no-show']).default('confirmed'),
});

async function fetchReservation(db: ReturnType<typeof getDb>, id: string, rid: string) {
  const row = await db.execute({
    sql: `SELECT r.*, t.name AS table_name
          FROM reservations r
          LEFT JOIN restaurant_tables t ON t.id = r.table_id
          WHERE r.id = ? AND r.restaurant_id = ?`,
    args: [id, rid],
  });
  return row.rows[0] ?? null;
}

async function releaseTableIfReserved(
  db: ReturnType<typeof getDb>,
  rid: string,
  tableId: string | null | undefined,
) {
  if (!tableId) return;
  await db.execute({
    sql: `UPDATE restaurant_tables SET status='empty', covers=0, course=''
          WHERE id=? AND restaurant_id=? AND status='reserved'`,
    args: [tableId, rid],
  });
}

async function syncTableForReservation(
  db: ReturnType<typeof getDb>,
  rid: string,
  tableId: string | null | undefined,
  status: string,
  covers: number,
) {
  if (!tableId) return;
  if (status === 'confirmed') {
    await db.execute({
      sql: `UPDATE restaurant_tables SET status='reserved', covers=?
            WHERE id=? AND restaurant_id=? AND status IN ('empty','reserved')`,
      args: [covers, tableId, rid],
    });
    return;
  }
  if (status === 'seated') {
    await db.execute({
      sql: `UPDATE restaurant_tables SET status='occupied', covers=?
            WHERE id=? AND restaurant_id=?`,
      args: [covers, tableId, rid],
    });
    return;
  }
  if (status === 'cancelled' || status === 'no-show') {
    await releaseTableIfReserved(db, rid, tableId);
  }
}

router.get('/', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, date } = req.query;
    let sql = `SELECT r.*, t.name AS table_name
               FROM reservations r
               LEFT JOIN restaurant_tables t ON t.id = r.table_id
               WHERE r.restaurant_id = ?`;
    const args: InValue[] = [rid];
    if (status) { sql += ' AND r.status=?'; args.push(String(status)); }
    if (date)   { sql += ' AND r.res_time LIKE ?'; args.push(`${String(date)}%`); }
    sql += ' ORDER BY r.res_time ASC';
    const rows = await getDb().execute({ sql, args });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

router.get('/:id', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const row = await fetchReservation(getDb(), req.params.id as string, rid);
    if (!row) { res.status(404).json({ error: 'Reservation not found' }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = ResSchema.parse(req.body);
    const db = getDb();
    const id = uid();
    const tableId = data.table_id ?? null;

    if (tableId) {
      const table = await db.execute({
        sql: 'SELECT id, capacity, status FROM restaurant_tables WHERE id=? AND restaurant_id=?',
        args: [tableId, rid],
      });
      if (!table.rows.length) { res.status(400).json({ error: 'Table not found' }); return; }
      const cap = Number((table.rows[0] as Record<string, unknown>).capacity) || 0;
      if (data.covers > cap) {
        res.status(400).json({ error: `Table only seats ${cap} — reduce covers or pick another table` });
        return;
      }
    }

    await db.execute({
      sql: `INSERT INTO reservations(id,restaurant_id,table_id,guest_name,covers,res_time,note,status)
            VALUES(?,?,?,?,?,?,?,?)`,
      args: [id, rid, tableId, data.guest_name, data.covers, data.res_time, data.note ?? null, data.status],
    });
    await syncTableForReservation(db, rid, tableId, data.status, data.covers);
    sendRestaurantPush(rid, {
      title: `New reservation — ${data.guest_name}`,
      body: `${data.covers} covers · ${data.res_time}`,
      data: { type: 'reservation', reservationId: id, page: 'reservations' },
      roles: ['manager', 'owner'],
      excludeUserId: req.user!.id,
    });
    res.status(201).json(await fetchReservation(db, id, rid));
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = ResSchema.partial().parse(req.body);
    const db = getDb();
    const id = req.params.id as string;

    const existing = await db.execute({
      sql: 'SELECT * FROM reservations WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!existing.rows.length) { res.status(404).json({ error: 'Reservation not found' }); return; }
    const prev = existing.rows[0] as Record<string, unknown>;
    const prevTableId = prev.table_id ? String(prev.table_id) : null;

    if (data.table_id && data.covers !== undefined) {
      const table = await db.execute({
        sql: 'SELECT capacity FROM restaurant_tables WHERE id=? AND restaurant_id=?',
        args: [data.table_id, rid],
      });
      if (!table.rows.length) { res.status(400).json({ error: 'Table not found' }); return; }
      const cap = Number((table.rows[0] as Record<string, unknown>).capacity) || 0;
      if (data.covers > cap) {
        res.status(400).json({ error: `Table only seats ${cap}` });
        return;
      }
    }

    const sets: string[] = [];
    const args: InValue[] = [];
    if (data.guest_name !== undefined) { sets.push('guest_name=?'); args.push(data.guest_name); }
    if (data.covers     !== undefined) { sets.push('covers=?');     args.push(data.covers); }
    if (data.res_time   !== undefined) { sets.push('res_time=?');   args.push(data.res_time); }
    if (data.note       !== undefined) { sets.push('note=?');       args.push(data.note); }
    if (data.status     !== undefined) { sets.push('status=?');     args.push(data.status); }
    if (data.table_id   !== undefined) { sets.push('table_id=?');   args.push(data.table_id); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push(id, rid);
    await db.execute({ sql: `UPDATE reservations SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });

    const nextTableId = data.table_id !== undefined
      ? (data.table_id ?? null)
      : prevTableId;
    const nextStatus = data.status !== undefined ? String(data.status) : String(prev.status);
    const nextCovers = data.covers !== undefined ? Number(data.covers) : Number(prev.covers) || 2;

    if (data.table_id !== undefined && prevTableId && prevTableId !== nextTableId) {
      await releaseTableIfReserved(db, rid, prevTableId);
    }
    await syncTableForReservation(db, rid, nextTableId, nextStatus, nextCovers);

    res.json(await fetchReservation(db, id, rid));
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const id = req.params.id as string;
    const ex = await db.execute({
      sql: 'SELECT table_id FROM reservations WHERE id=? AND restaurant_id=?',
      args: [id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Reservation not found' }); return; }
    const tableId = (ex.rows[0] as Record<string, unknown>).table_id;
    await db.execute({ sql: 'DELETE FROM reservations WHERE id=? AND restaurant_id=?', args: [id, rid] });
    await releaseTableIfReserved(db, rid, tableId ? String(tableId) : null);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
