import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

const ResSchema = z.object({
  table_id:   z.string().optional(),
  guest_name: z.string().min(1),
  covers:     z.number().int().positive().default(2),
  res_time:   z.string().min(1),
  note:       z.string().optional(),
  status:     z.enum(['confirmed','seated','cancelled','no-show']).default('confirmed'),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, date } = req.query;
    let sql = `SELECT r.*, t.name as table_name FROM reservations r LEFT JOIN restaurant_tables t ON t.id=r.table_id WHERE 1=1`;
    const args: any[] = [];
    if (status) { sql += ' AND r.status=?'; args.push(String(status)); }
    if (date)   { sql += ' AND r.res_time LIKE ?'; args.push(`${String(date)}%`); }
    sql += ' ORDER BY r.res_time';
    const rows = await getDb().execute({ sql, args });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT * FROM reservations WHERE id=?', args: [(req.params.id as string)] });
    if (!row.rows.length) { res.status(404).json({ error: 'Reservation not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = ResSchema.parse(req.body);
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO reservations(id,table_id,guest_name,covers,res_time,note,status) VALUES(?,?,?,?,?,?,?)`,
      args: [id, data.table_id??null, data.guest_name, data.covers, data.res_time, data.note??null, data.status],
    });
    const row = await getDb().execute({ sql: 'SELECT * FROM reservations WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = ResSchema.partial().parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM reservations WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Reservation not found' }); return; }
    const sets: string[] = []; const args: any[] = [];
    if (data.guest_name !== undefined) { sets.push('guest_name=?'); args.push(data.guest_name); }
    if (data.covers     !== undefined) { sets.push('covers=?');     args.push(data.covers); }
    if (data.res_time   !== undefined) { sets.push('res_time=?');   args.push(data.res_time); }
    if (data.note       !== undefined) { sets.push('note=?');       args.push(data.note); }
    if (data.status     !== undefined) { sets.push('status=?');     args.push(data.status); }
    if (data.table_id   !== undefined) { sets.push('table_id=?');   args.push(data.table_id); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push((req.params.id as string));
    await db.execute({ sql: `UPDATE reservations SET ${sets.join(',')} WHERE id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM reservations WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ex = await getDb().execute({ sql: 'SELECT id FROM reservations WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Reservation not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM reservations WHERE id=?', args: [(req.params.id as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
