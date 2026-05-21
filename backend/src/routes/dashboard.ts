import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth, requireRole('manager','cashier'));

// GET /api/dashboard/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const db = getDb();
    const [orders, tables, staff, inv] = await Promise.all([
      db.execute("SELECT COUNT(*) as cnt, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid FROM orders WHERE date(created_at)=date('now')"),
      db.execute("SELECT COUNT(*) as total, SUM(CASE WHEN status='occupied' OR status='paying' THEN 1 ELSE 0 END) as occupied FROM restaurant_tables"),
      db.execute("SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='break' THEN 1 ELSE 0 END) as on_break FROM users"),
      db.execute("SELECT COUNT(*) as low FROM inventory WHERE CAST(current AS REAL)/CAST(par AS REAL) < 0.4"),
    ]);
    res.json({
      orders_today:    Number(orders.rows[0].cnt)     ?? 0,
      orders_paid:     Number(orders.rows[0].paid)    ?? 0,
      tables_total:    Number(tables.rows[0].total)   ?? 0,
      tables_occupied: Number(tables.rows[0].occupied)?? 0,
      staff_total:     Number(staff.rows[0].total)    ?? 0,
      staff_active:    Number(staff.rows[0].active)   ?? 0,
      staff_on_break:  Number(staff.rows[0].on_break) ?? 0,
      inventory_low:   Number(inv.rows[0].low)        ?? 0,
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/revenue
router.get('/revenue', async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.execute(`
      SELECT date(o.created_at) as day,
             COUNT(*) as order_count,
             SUM(oi.qty * m.price) as revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items m   ON m.id = oi.menu_item_id
      WHERE o.status = 'paid'
        AND o.created_at >= datetime('now', '-30 days')
      GROUP BY date(o.created_at)
      ORDER BY day ASC
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;
