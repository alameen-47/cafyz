import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();

const ItemSchema = z.object({
  name:         z.string().min(1),
  category:     z.enum(['starters','mains','desserts','wine','drinks']),
  price:        z.number().positive(),
  description:  z.string().default(''),
  symbol:       z.string().default('○'),
  is_popular:   z.boolean().default(false),
  is_available: z.boolean().default(true),
});

// GET /api/menu  (public — no auth needed for browsing)
// If authenticated, scope by the token's restaurant_id.
// If a ?restaurant_id query param is provided (public), scope to that.
// Otherwise return all available items.
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    // Try to extract token if present (optional auth)
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const { JWT_SECRET } = await import('../middleware/auth.js');
        req.user = jwt.default.verify(header.slice(7), JWT_SECRET) as AuthRequest['user'];
      } catch {
        // Token invalid - proceed without auth
      }
    }

    const { category } = req.query;
    const rid = req.user?.restaurant_id ?? (req.query.restaurant_id as string | undefined);

    let sql = 'SELECT * FROM menu_items WHERE is_available=1';
    const args: any[] = [];
    if (rid) { sql += ' AND restaurant_id=?'; args.push(rid); }
    if (category) { sql += ' AND category=?'; args.push(String(category)); }
    sql += ' ORDER BY category, name';
    const rows = await getDb().execute({ sql, args });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/menu/:id
router.get('/:id', async (req, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT * FROM menu_items WHERE id=?', args: [(req.params.id as string)] });
    if (!row.rows.length) { res.status(404).json({ error: 'Menu item not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/menu
router.post('/', requireAuth, requireRole('manager','cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = ItemSchema.parse(req.body);
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO menu_items(id,restaurant_id,name,category,price,description,symbol,is_popular,is_available)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [id, rid, data.name, data.category, data.price, data.description, data.symbol, data.is_popular?1:0, data.is_available?1:0],
    });
    const row = await getDb().execute({ sql: 'SELECT * FROM menu_items WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/menu/:id
router.put('/:id', requireAuth, requireRole('manager','cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = ItemSchema.partial().parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id FROM menu_items WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Menu item not found' }); return; }

    const sets: string[] = []; const args: any[] = [];
    if (data.name         !== undefined) { sets.push('name=?');         args.push(data.name); }
    if (data.category     !== undefined) { sets.push('category=?');     args.push(data.category); }
    if (data.price        !== undefined) { sets.push('price=?');        args.push(data.price); }
    if (data.description  !== undefined) { sets.push('description=?');  args.push(data.description); }
    if (data.symbol       !== undefined) { sets.push('symbol=?');       args.push(data.symbol); }
    if (data.is_popular   !== undefined) { sets.push('is_popular=?');   args.push(data.is_popular?1:0); }
    if (data.is_available !== undefined) { sets.push('is_available=?'); args.push(data.is_available?1:0); }

    if (!sets.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    args.push((req.params.id as string));
    args.push(rid);
    await db.execute({ sql: `UPDATE menu_items SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/menu/:id
router.delete('/:id', requireAuth, requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const ex = await getDb().execute({ sql: 'SELECT id FROM menu_items WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'Menu item not found' }); return; }
    await getDb().execute({ sql: 'DELETE FROM menu_items WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
