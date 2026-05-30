import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth, requireRole('owner', 'manager', 'cashier'));

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const [orders, tables, staff, inv] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) as cnt, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid FROM orders WHERE restaurant_id=? AND date(created_at)=date('now')", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='occupied' OR status='paying' THEN 1 ELSE 0 END) as occupied FROM restaurant_tables WHERE restaurant_id=?", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='break' THEN 1 ELSE 0 END) as on_break FROM users WHERE restaurant_id=?", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as low FROM inventory WHERE restaurant_id=? AND CAST(current AS REAL)/CAST(par AS REAL) < 0.4", args: [rid] }),
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
router.get('/revenue', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const rows = await db.execute({
      sql: `
        SELECT date(o.created_at) as day,
               COUNT(*) as order_count,
               SUM(oi.qty * m.price) as revenue
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu_items m   ON m.id = oi.menu_item_id
        WHERE o.status = 'paid'
          AND o.restaurant_id = ?
          AND o.created_at >= datetime('now', '-30 days')
        GROUP BY date(o.created_at)
        ORDER BY day ASC
      `,
      args: [rid],
    });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;
