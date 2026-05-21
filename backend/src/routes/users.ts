import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

const UserSchema = z.object({
  name:       z.string().min(2),
  initials:   z.string().max(3).optional(),
  email:      z.string().email(),
  password:   z.string().min(6).optional(),
  role:       z.enum(['manager','cashier','waiter','kitchen']),
  status:     z.enum(['active','break','off']).optional(),
  start_time: z.string().optional(),
  pin:        z.string().length(4).optional(),
});

// GET /api/users
router.get('/', requireRole('manager','cashier'), async (_req, res, next) => {
  try {
    const rows = await getDb().execute('SELECT id,name,initials,email,role,status,start_time,created_at FROM users ORDER BY name');
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/users/:id
router.get('/:id', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT id,name,initials,email,role,status,start_time,created_at FROM users WHERE id=?', args: [(req.params.id as string)] });
    if (!row.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/users
router.post('/', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const data = UserSchema.parse(req.body);
    const id = uid();
    const pw = data.password ? await bcrypt.hash(data.password, 10) : await bcrypt.hash('cafyz2026', 10);
    const ph = data.pin ? await bcrypt.hash(data.pin, 10) : null;
    const initials = data.initials ?? data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    await getDb().execute({
      sql: `INSERT INTO users(id,name,initials,email,password_hash,role,status,start_time,pin_hash) VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [id, data.name, initials, data.email, pw, data.role, data.status??'active', data.start_time??'—', ph],
    });
    const row = await getDb().execute({ sql: 'SELECT id,name,initials,email,role,status,start_time FROM users WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/users/:id
router.put('/:id', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const data = UserSchema.partial().parse(req.body);
    const db = getDb();
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE id=?', args: [(req.params.id as string)] });
    if (!existing.rows.length) { res.status(404).json({ error: 'User not found' }); return; }

    const sets: string[] = [];
    const args: any[] = [];

    if (data.name)       { sets.push('name=?');       args.push(data.name); }
    if (data.email)      { sets.push('email=?');      args.push(data.email); }
    if (data.role)       { sets.push('role=?');       args.push(data.role); }
    if (data.status)     { sets.push('status=?');     args.push(data.status); }
    if (data.start_time) { sets.push('start_time=?'); args.push(data.start_time); }
    if (data.initials)   { sets.push('initials=?');   args.push(data.initials); }
    if (data.password)   { sets.push('password_hash=?'); args.push(await bcrypt.hash(data.password, 10)); }
    if (data.pin)        { sets.push('pin_hash=?');   args.push(await bcrypt.hash(data.pin, 10)); }

    if (!sets.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    args.push((req.params.id as string));
    await db.execute({ sql: `UPDATE users SET ${sets.join(',')} WHERE id=?`, args });
    const row = await db.execute({ sql: 'SELECT id,name,initials,email,role,status,start_time FROM users WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', requireRole('manager','cashier'), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['active','break','off']) }).parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM users WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    await db.execute({ sql: 'UPDATE users SET status=? WHERE id=?', args: [status, (req.params.id as string)] });
    res.json({ id: (req.params.id as string), status });
  } catch (e) { next(e); }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM users WHERE id=?', args: [(req.params.id as string)] });
    if (!ex.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    await db.execute({ sql: 'DELETE FROM users WHERE id=?', args: [(req.params.id as string)] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
