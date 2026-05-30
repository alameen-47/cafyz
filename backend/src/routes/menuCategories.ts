import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid, slugifyCategory } from '../utils.js';

const router = Router();

export const DEFAULT_MENU_CATEGORIES = [
  { slug: 'starters', label: 'Starters', sort_order: 0 },
  { slug: 'mains',    label: 'Mains',    sort_order: 1 },
  { slug: 'desserts', label: 'Desserts', sort_order: 2 },
  { slug: 'wine',     label: 'Wine',     sort_order: 3 },
  { slug: 'drinks',   label: 'Drinks',   sort_order: 4 },
] as const;

const CreateSchema = z.object({
  label:      z.string().min(1).max(64),
  slug:       z.string().min(1).max(48).regex(/^[a-z0-9_]+$/).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const UpdateSchema = z.object({
  label:      z.string().min(1).max(64).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

/** Ensure every restaurant has default categories (idempotent). */
export async function ensureRestaurantCategories(restaurantId: string) {
  const db = getDb();
  const count = await db.execute({
    sql: 'SELECT COUNT(*) AS c FROM menu_categories WHERE restaurant_id=?',
    args: [restaurantId],
  });
  if (Number((count.rows[0] as { c: number }).c) > 0) return;

  for (const cat of DEFAULT_MENU_CATEGORIES) {
    await db.execute({
      sql: `INSERT INTO menu_categories(id, restaurant_id, slug, label, sort_order)
            VALUES (?,?,?,?,?)`,
      args: [uid(), restaurantId, cat.slug, cat.label, cat.sort_order],
    });
  }
}

export async function categoryExists(restaurantId: string, slug: string): Promise<boolean> {
  const row = await getDb().execute({
    sql: 'SELECT id FROM menu_categories WHERE restaurant_id=? AND slug=?',
    args: [restaurantId, slug],
  });
  return row.rows.length > 0;
}

async function uniqueSlug(restaurantId: string, base: string): Promise<string> {
  const db = getDb();
  let slug = base;
  let n = 2;
  while (true) {
    const ex = await db.execute({
      sql: 'SELECT id FROM menu_categories WHERE restaurant_id=? AND slug=?',
      args: [restaurantId, slug],
    });
    if (!ex.rows.length) return slug;
    slug = `${base}_${n}`;
    n += 1;
  }
}

// GET /api/menu/categories
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const { JWT_SECRET } = await import('../middleware/auth.js');
        req.user = jwt.default.verify(header.slice(7), JWT_SECRET) as AuthRequest['user'];
      } catch {
        // optional auth
      }
    }

    const rid = req.user?.restaurant_id ?? (req.query.restaurant_id as string | undefined);
    if (!rid) {
      res.json(DEFAULT_MENU_CATEGORIES.map(c => ({ ...c, id: c.slug, restaurant_id: null })));
      return;
    }

    await ensureRestaurantCategories(rid);
    const rows = await getDb().execute({
      sql: `SELECT id, restaurant_id, slug, label, sort_order, created_at
            FROM menu_categories WHERE restaurant_id=? ORDER BY sort_order, label`,
      args: [rid],
    });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/menu/categories
router.post('/', requireAuth, requireRole('owner', 'manager', 'cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = CreateSchema.parse(req.body);
    const baseSlug = data.slug ?? slugifyCategory(data.label);
    const slug = await uniqueSlug(rid, baseSlug);
    const sortRow = await getDb().execute({
      sql: 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM menu_categories WHERE restaurant_id=?',
      args: [rid],
    });
    const nextSort = data.sort_order ?? Number((sortRow.rows[0] as { next: number }).next);

    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO menu_categories(id, restaurant_id, slug, label, sort_order)
            VALUES (?,?,?,?,?)`,
      args: [id, rid, slug, data.label.trim(), nextSort],
    });
    const row = await getDb().execute({ sql: 'SELECT * FROM menu_categories WHERE id=?', args: [id] });
    res.status(201).json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/menu/categories/:id
router.put('/:id', requireAuth, requireRole('owner', 'manager', 'cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = UpdateSchema.parse(req.body);
    const db = getDb();
    const ex = await db.execute({
      sql: 'SELECT * FROM menu_categories WHERE id=? AND restaurant_id=?',
      args: [req.params.id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Category not found' }); return; }

    const sets: string[] = [];
    const args: unknown[] = [];
    if (data.label !== undefined) { sets.push('label=?'); args.push(data.label.trim()); }
    if (data.sort_order !== undefined) { sets.push('sort_order=?'); args.push(data.sort_order); }
    if (!sets.length) { res.status(400).json({ error: 'No fields to update' }); return; }

    args.push(req.params.id, rid);
    await db.execute({
      sql: `UPDATE menu_categories SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`,
      args,
    });
    const row = await db.execute({ sql: 'SELECT * FROM menu_categories WHERE id=?', args: [req.params.id] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/menu/categories/:id
router.delete('/:id', requireAuth, requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({
      sql: 'SELECT slug FROM menu_categories WHERE id=? AND restaurant_id=?',
      args: [req.params.id, rid],
    });
    if (!ex.rows.length) { res.status(404).json({ error: 'Category not found' }); return; }

    const slug = String((ex.rows[0] as { slug: string }).slug);
    const used = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM menu_items WHERE restaurant_id=? AND category=?',
      args: [rid, slug],
    });
    const count = Number((used.rows[0] as { c: number }).c);
    if (count > 0) {
      res.status(409).json({
        error: `Cannot delete — ${count} menu item${count === 1 ? '' : 's'} use this category. Move or delete them first.`,
      });
      return;
    }

    const total = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM menu_categories WHERE restaurant_id=?',
      args: [rid],
    });
    if (Number((total.rows[0] as { c: number }).c) <= 1) {
      res.status(400).json({ error: 'At least one category is required.' });
      return;
    }

    await db.execute({
      sql: 'DELETE FROM menu_categories WHERE id=? AND restaurant_id=?',
      args: [req.params.id, rid],
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
