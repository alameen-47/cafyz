import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

const TableSchema = z.object({
  name:     z.string().min(1),
  zone:     z.string().min(1),
  capacity: z.number().int().positive().default(2),
  status:   z.enum(['empty','reserved','occupied','paying','attention']).default('empty'),
});

// GET /api/tables
router.get('/', async (req: AuthRequest, _res, next) => {
  const res = _res;
  try {
    const rid = req.user!.restaurant_id;
    const rows = await getDb().execute({
      sql: 'SELECT * FROM restaurant_tables WHERE restaurant_id=? ORDER BY zone, name',
      args: [rid],
    });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/tables/:id
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const row = await getDb().execute({ sql: 'SELECT * FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!row.rows.length) { res.status(404).json({ error: 'Table not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/tables
router.post('/', requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = TableSchema.parse(req.body);
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO restaurant_tables(id,restaurant_id,name,zone,capacity,status) VALUES(?,?,?,?,?,?)`,
      args: [id, rid, data.name, data.zone, data.capacity, data.status],
    });
    const row = await getDb().execute({ sql: 'SELECT * FROM restaurant_tables WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/tables/:id
router.put('/:id', requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = TableSchema.partial().parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Table not found' }); return; }
    const sets: string[] = []; const args: any[] = [];
    if (data.name     !== undefined) { sets.push('name=?');     args.push(data.name); }
    if (data.zone     !== undefined) { sets.push('zone=?');     args.push(data.zone); }
    if (data.capacity !== undefined) { sets.push('capacity=?'); args.push(data.capacity); }
    if (data.status   !== undefined) { sets.push('status=?');   args.push(data.status); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push((req.params.id as string));
    args.push(rid);
    await db.execute({ sql: `UPDATE restaurant_tables SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM restaurant_tables WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/tables/:id/status
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status, course, covers, elapsed_min } = z.object({
      status:      z.enum(['empty','reserved','occupied','paying','attention']),
      course:      z.string().optional(),
      covers:      z.number().int().optional(),
      elapsed_min: z.number().int().optional(),
    }).parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Table not found' }); return; }
    const sets = ['status=?']; const args: any[] = [status];
    if (course      !== undefined) { sets.push('course=?');      args.push(course); }
    if (covers      !== undefined) { sets.push('covers=?');      args.push(covers); }
    if (elapsed_min !== undefined) { sets.push('elapsed_min=?'); args.push(elapsed_min); }
    args.push((req.params.id as string));
    args.push(rid);
    await db.execute({ sql: `UPDATE restaurant_tables SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM restaurant_tables WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/tables/:id
router.delete('/:id', requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const ex = await getDb().execute({ sql: 'SELECT id FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Table not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM restaurant_tables WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
