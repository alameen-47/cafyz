import { Router } from 'express';
import { getDb } from '../db.js';
import { rowNumber } from '../dbRows.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { RevenueQuerySchema, resolveRevenueWindow, periodLabel } from '../reportPeriod.js';

const router = Router();
router.use(requireAuth, requireRole('owner', 'manager', 'cashier'));

const REVENUE_SELECT = `
  SELECT date(o.created_at) as day,
         COUNT(DISTINCT o.id) as order_count,
         COALESCE(SUM(oi.qty * m.price), 0) as revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m   ON m.id = oi.menu_item_id
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND date(o.created_at) >= date(?)
    AND date(o.created_at) <= date(?)
  GROUP BY date(o.created_at)
  ORDER BY day ASC
`;

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
      orders_today:    rowNumber(orders.rows[0], 'cnt'),
      orders_paid:     rowNumber(orders.rows[0], 'paid'),
      tables_total:    rowNumber(tables.rows[0], 'total'),
      tables_occupied: rowNumber(tables.rows[0], 'occupied'),
      staff_total:     rowNumber(staff.rows[0], 'total'),
      staff_active:    rowNumber(staff.rows[0], 'active'),
      staff_on_break:  rowNumber(staff.rows[0], 'on_break'),
      inventory_low:   rowNumber(inv.rows[0], 'low'),
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/revenue?period=day|week|month|range&date=&month=&from=&to=
router.get('/revenue', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);

    const rows = await getDb().execute({
      sql: REVENUE_SELECT,
      args: [rid, from, to],
    });

    const data = rows.rows.map(r => ({
      day: String(r.day ?? ''),
      order_count: rowNumber(r, 'order_count'),
      revenue: rowNumber(r, 'revenue'),
    }));

    const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
    const totalOrders = data.reduce((s, r) => s + r.order_count, 0);

    res.json({
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      rows: data,
      totalRevenue,
      totalOrders,
      dayCount: data.length,
    });
  } catch (e) { next(e); }
});

export default router;
