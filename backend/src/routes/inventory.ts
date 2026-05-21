import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

const InvSchema = z.object({
  name:    z.string().min(1),
  par:     z.number().positive(),
  current: z.number().min(0),
  unit:    z.string().min(1),
  alert:   z.boolean().default(false),
});

router.get('/', async (_req, res, next) => {
  try {
    const rows = await getDb().execute('SELECT * FROM inventory ORDER BY name');
    res.json(rows.rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT * FROM inventory WHERE id=?', args: [(req.params.id as string)] });
    if (!row.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

router.post('/', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const data = InvSchema.parse(req.body);
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO inventory(id,name,par,current,unit,alert) VALUES(?,?,?,?,?,?)`,
      args: [id, data.name, data.par, data.current, data.unit, data.alert?1:0],
    });
    const row = await getDb().execute({ sql: 'SELECT * FROM inventory WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const data = InvSchema.partial().parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM inventory WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
    const sets: string[] = []; const args: any[] = [];
    if (data.name    !== undefined) { sets.push('name=?');    args.push(data.name); }
    if (data.par     !== undefined) { sets.push('par=?');     args.push(data.par); }
    if (data.current !== undefined) { sets.push('current=?'); args.push(data.current); }
    if (data.unit    !== undefined) { sets.push('unit=?');    args.push(data.unit); }
    if (data.alert   !== undefined) { sets.push('alert=?');   args.push(data.alert?1:0); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    sets.push("updated_at=datetime('now')");
    args.push((req.params.id as string));
    await db.execute({ sql: `UPDATE inventory SET ${sets.join(',')} WHERE id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM inventory WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const ex = await getDb().execute({ sql: 'SELECT id FROM inventory WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM inventory WHERE id=?', args: [(req.params.id as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
