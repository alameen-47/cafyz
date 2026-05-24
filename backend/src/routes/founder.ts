import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const onlyFounder = [requireAuth, requireRole('founder')] as const;

// GET /api/founder/restaurants — all restaurants with stats
router.get('/restaurants', ...onlyFounder, async (_req: AuthRequest, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT r.*,
        (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id AND u.role != 'founder') as user_count,
        (SELECT key_code FROM license_keys lk WHERE lk.restaurant_id = r.id AND lk.is_active=1 ORDER BY lk.activated_at DESC LIMIT 1) as active_key
      FROM restaurants r
      WHERE r.id != 'CAFYZ_SYSTEM'
      ORDER BY r.created_at DESC
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// PATCH /api/founder/restaurants/:id/plan — override a restaurant's plan directly
router.patch('/restaurants/:id/plan', ...onlyFounder, async (req: AuthRequest, res, next) => {
  try {
    const { plan } = z.object({ plan: z.enum(['basic','pro','premium']) }).parse(req.body);
    const db = getDb();
    await db.execute({ sql: `UPDATE restaurants SET plan=? WHERE id=?`, args: [plan, req.params.id] });
    const row = await db.execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [req.params.id] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/founder/plan-config — get plan feature configuration
router.get('/plan-config', ...onlyFounder, async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`SELECT * FROM plan_config ORDER BY price_monthly ASC`);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// PUT /api/founder/plan-config/:plan — update a plan's feature set
router.put('/plan-config/:plan', ...onlyFounder, async (req: AuthRequest, res, next) => {
  try {
    const planName = z.enum(['basic','pro','premium']).parse(req.params.plan);
    const data = z.object({
      panels_json:   z.string().min(2).optional(),
      label:         z.string().optional(),
      description:   z.string().optional(),
      price_monthly: z.number().optional(),
    }).parse(req.body);

    const sets: string[] = ['updated_at=datetime(\'now\')'];
    const args: unknown[] = [];
    if (data.panels_json   !== undefined) { sets.push('panels_json=?');   args.push(data.panels_json); }
    if (data.label         !== undefined) { sets.push('label=?');         args.push(data.label); }
    if (data.description   !== undefined) { sets.push('description=?');   args.push(data.description); }
    if (data.price_monthly !== undefined) { sets.push('price_monthly=?'); args.push(data.price_monthly); }
    args.push(planName);

    await getDb().execute({ sql: `UPDATE plan_config SET ${sets.join(',')} WHERE plan=?`, args });
    const row = await getDb().execute({ sql: 'SELECT * FROM plan_config WHERE plan=?', args: [planName] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/founder/stats — system-wide stats
router.get('/stats', ...onlyFounder, async (_req, res, next) => {
  try {
    const db = getDb();
    const [rests, keys, users] = await Promise.all([
      db.execute(`SELECT plan, COUNT(*) as count FROM restaurants WHERE id != 'CAFYZ_SYSTEM' GROUP BY plan`),
      db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN restaurant_id IS NOT NULL THEN 1 ELSE 0 END) as activated FROM license_keys WHERE is_active=1`),
      db.execute(`SELECT COUNT(*) as total FROM users WHERE role != 'founder'`),
    ]);
    res.json({
      restaurants_by_plan: rests.rows,
      license_keys:        keys.rows[0],
      total_users:         users.rows[0]?.total ?? 0,
    });
  } catch (e) { next(e); }
});

export default router;
