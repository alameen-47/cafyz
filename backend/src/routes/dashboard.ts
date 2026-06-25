import { Router } from 'express';
import { getDb } from '../db.js';
import { rowNumber } from '../dbRows.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { requirePlan } from '../middleware/planGuard.js';
import {
  RevenueQuerySchema, resolveRevenueWindow, previousRevenueWindow, periodLabel, sqlCreatedBetween,
} from '../reportPeriod.js';
import { cacheGet, cacheSet } from '../cache.js';

const CREATED_BETWEEN = sqlCreatedBetween('o.created_at');

const router = Router();
router.use(requireAuth, requireRole('owner', 'manager', 'cashier'));

const proAnalytics = requirePlan('pro');

const REVENUE_SELECT = `
  SELECT date(o.created_at) as day,
         COUNT(DISTINCT o.id) as order_count,
         COALESCE(SUM(oi.qty * m.price), 0) as revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m   ON m.id = oi.menu_item_id
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND ${CREATED_BETWEEN}
  GROUP BY date(o.created_at)
  ORDER BY day ASC
`;

const SOLD_ITEMS_SELECT = `
  SELECT date(o.created_at) as day,
         m.id as menu_item_id,
         m.name as item_name,
         SUM(oi.qty) as qty_sold,
         COALESCE(SUM(oi.qty * m.price), 0) as revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m   ON m.id = oi.menu_item_id
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND ${CREATED_BETWEEN}
  GROUP BY date(o.created_at), m.id, m.name
  ORDER BY day ASC, qty_sold DESC, item_name ASC
`;

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const cacheKey = `dash:stats:${rid}`;
    const cached = cacheGet<Record<string, number>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const db = getDb();
    const [orders, tables, staff, inv] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) as cnt, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid FROM orders WHERE restaurant_id=? AND date(created_at)=date('now')", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='occupied' OR status='paying' THEN 1 ELSE 0 END) as occupied FROM restaurant_tables WHERE restaurant_id=?", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='break' THEN 1 ELSE 0 END) as on_break FROM users WHERE restaurant_id=?", args: [rid] }),
      db.execute({ sql: "SELECT COUNT(*) as low FROM inventory WHERE restaurant_id=? AND CAST(current AS REAL)/CAST(par AS REAL) < 0.4", args: [rid] }),
    ]);
    const payload = {
      orders_today:    rowNumber(orders.rows[0], 'cnt'),
      orders_paid:     rowNumber(orders.rows[0], 'paid'),
      tables_total:    rowNumber(tables.rows[0], 'total'),
      tables_occupied: rowNumber(tables.rows[0], 'occupied'),
      staff_total:     rowNumber(staff.rows[0], 'total'),
      staff_active:    rowNumber(staff.rows[0], 'active'),
      staff_on_break:  rowNumber(staff.rows[0], 'on_break'),
      inventory_low:   rowNumber(inv.rows[0], 'low'),
    };
    cacheSet(cacheKey, payload, 15_000);
    res.json(payload);
  } catch (e) { next(e); }
});

// GET /api/dashboard/revenue?period=day|week|month|range&date=&month=&from=&to=
router.get('/revenue', proAnalytics, async (req: AuthRequest, res, next) => {
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

// GET /api/dashboard/sold-items?period=day|week|month|range&date=&month=&from=&to=
router.get('/sold-items', proAnalytics, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);

    const rows = await getDb().execute({
      sql: SOLD_ITEMS_SELECT,
      args: [rid, from, to],
    });

    const byDay = new Map<string, {
      day: string;
      totalQty: number;
      totalRevenue: number;
      items: { menu_item_id: string; item_name: string; qty_sold: number; revenue: number }[];
    }>();

    for (const r of rows.rows) {
      const day = String(r.day ?? '');
      const entry = byDay.get(day) ?? {
        day,
        totalQty: 0,
        totalRevenue: 0,
        items: [],
      };
      const item = {
        menu_item_id: String(r.menu_item_id ?? ''),
        item_name: String(r.item_name ?? 'Unknown item'),
        qty_sold: rowNumber(r, 'qty_sold'),
        revenue: rowNumber(r, 'revenue'),
      };
      entry.items.push(item);
      entry.totalQty += item.qty_sold;
      entry.totalRevenue += item.revenue;
      byDay.set(day, entry);
    }

    const days = Array.from(byDay.values()).map(d => ({
      ...d,
      // Keep list compact and high-signal in UI by default.
      items: d.items.slice(0, 30),
    }));
    const totalQty = days.reduce((sum, d) => sum + d.totalQty, 0);
    const totalRevenue = days.reduce((sum, d) => sum + d.totalRevenue, 0);

    res.json({
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      days,
      totalQty,
      totalRevenue,
      dayCount: days.length,
    });
  } catch (e) { next(e); }
});

const COVERS_BY_HOUR_SELECT = `
  SELECT CAST(strftime('%H', o.created_at) AS INTEGER) as hour,
         COALESCE(SUM(o.covers), 0) as covers,
         COUNT(*) as order_count
  FROM orders o
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND ${CREATED_BETWEEN}
  GROUP BY hour
  ORDER BY hour ASC
`;

const CATEGORY_MIX_SELECT = `
  SELECT m.category as category,
         SUM(oi.qty) as qty_sold,
         COALESCE(SUM(oi.qty * m.price), 0) as revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m   ON m.id = oi.menu_item_id
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND ${CREATED_BETWEEN}
  GROUP BY m.category
  ORDER BY qty_sold DESC
`;

const TOP_ITEMS_SELECT = `
  SELECT m.id as menu_item_id,
         m.name as item_name,
         SUM(oi.qty) as qty_sold,
         COALESCE(SUM(oi.qty * m.price), 0) as revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items m   ON m.id = oi.menu_item_id
  WHERE o.status = 'paid'
    AND o.restaurant_id = ?
    AND ${CREATED_BETWEEN}
  GROUP BY m.id, m.name
  ORDER BY revenue DESC, qty_sold DESC
  LIMIT 12
`;

async function revenueTotals(rid: string, from: string, to: string) {
  const rows = await getDb().execute({
    sql: REVENUE_SELECT,
    args: [rid, from, to],
  });
  const data = rows.rows.map(r => ({
    day: String(r.day ?? ''),
    order_count: rowNumber(r, 'order_count'),
    revenue: rowNumber(r, 'revenue'),
  }));
  return {
    rows: data,
    totalRevenue: data.reduce((s, r) => s + r.revenue, 0),
    totalOrders: data.reduce((s, r) => s + r.order_count, 0),
    dayCount: data.length,
  };
}

// GET /api/dashboard/covers-by-hour?period=...
router.get('/covers-by-hour', proAnalytics, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);

    const rows = await getDb().execute({
      sql: COVERS_BY_HOUR_SELECT,
      args: [rid, from, to],
    });

    const byHour = new Map<number, { covers: number; order_count: number }>();
    for (const r of rows.rows) {
      const hour = rowNumber(r, 'hour');
      byHour.set(hour, {
        covers: rowNumber(r, 'covers'),
        order_count: rowNumber(r, 'order_count'),
      });
    }

    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h}:00`,
      covers: byHour.get(h)?.covers ?? 0,
      order_count: byHour.get(h)?.order_count ?? 0,
    }));

    res.json({
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      hours,
      totalCovers: hours.reduce((s, h) => s + h.covers, 0),
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/category-mix?period=...
router.get('/category-mix', proAnalytics, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);

    const rows = await getDb().execute({
      sql: CATEGORY_MIX_SELECT,
      args: [rid, from, to],
    });

    const categories = rows.rows.map(r => ({
      category: String(r.category ?? 'other'),
      qty_sold: rowNumber(r, 'qty_sold'),
      revenue: rowNumber(r, 'revenue'),
    }));
    const totalQty = categories.reduce((s, c) => s + c.qty_sold, 0);

    res.json({
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      categories,
      totalQty,
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/top-items?period=...
router.get('/top-items', proAnalytics, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);

    const rows = await getDb().execute({
      sql: TOP_ITEMS_SELECT,
      args: [rid, from, to],
    });

    const items = rows.rows.map(r => ({
      menu_item_id: String(r.menu_item_id ?? ''),
      item_name: String(r.item_name ?? 'Item'),
      qty_sold: rowNumber(r, 'qty_sold'),
      revenue: rowNumber(r, 'revenue'),
    }));

    res.json({
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      items,
    });
  } catch (e) { next(e); }
});

// GET /api/dashboard/analytics?period=... — one call for the Analytics screen
router.get('/analytics', proAnalytics, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const query = RevenueQuerySchema.parse(req.query);
    const { from, to, period } = resolveRevenueWindow(query);
    const cacheKey = `dash:analytics:${rid}:${period}:${from}:${to}`;
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const prev = previousRevenueWindow(query, from, to);

    const db = getDb();
    const [
      statsRes,
      current,
      previous,
      topRows,
      catRows,
      coverRows,
    ] = await Promise.all([
      db.execute({
        sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='occupied' OR status='paying' THEN 1 ELSE 0 END) as occupied FROM restaurant_tables WHERE restaurant_id=?",
        args: [rid],
      }),
      revenueTotals(rid, from, to),
      revenueTotals(rid, prev.from, prev.to),
      db.execute({ sql: TOP_ITEMS_SELECT, args: [rid, from, to] }),
      db.execute({ sql: CATEGORY_MIX_SELECT, args: [rid, from, to] }),
      db.execute({ sql: COVERS_BY_HOUR_SELECT, args: [rid, from, to] }),
    ]);

    const tables_total = rowNumber(statsRes.rows[0], 'total');
    const tables_occupied = rowNumber(statsRes.rows[0], 'occupied');

    const topItems = topRows.rows.map(r => ({
      menu_item_id: String(r.menu_item_id ?? ''),
      item_name: String(r.item_name ?? 'Item'),
      qty_sold: rowNumber(r, 'qty_sold'),
      revenue: rowNumber(r, 'revenue'),
    }));

    const categories = catRows.rows.map(r => ({
      category: String(r.category ?? 'other'),
      qty_sold: rowNumber(r, 'qty_sold'),
      revenue: rowNumber(r, 'revenue'),
    }));
    const totalQty = categories.reduce((s, c) => s + c.qty_sold, 0);

    const byHour = new Map<number, number>();
    for (const r of coverRows.rows) {
      byHour.set(rowNumber(r, 'hour'), rowNumber(r, 'covers'));
    }
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h}:00`,
      covers: byHour.get(h) ?? 0,
    }));

    const pct = (cur: number, prevVal: number) => {
      if (prevVal <= 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prevVal) / prevVal) * 100);
    };

    const payload = {
      period,
      from,
      to,
      periodLabel: periodLabel(query, from, to),
      previous: {
        from: prev.from,
        to: prev.to,
        totalRevenue: previous.totalRevenue,
        totalOrders: previous.totalOrders,
      },
      revenue: {
        rows: current.rows,
        totalRevenue: current.totalRevenue,
        totalOrders: current.totalOrders,
        dayCount: current.dayCount,
      },
      topItems,
      categories,
      totalQty,
      hours,
      tables_total,
      tables_occupied,
      deltas: {
        revenuePct: pct(current.totalRevenue, previous.totalRevenue),
        ordersPct: pct(current.totalOrders, previous.totalOrders),
      },
    };
    cacheSet(cacheKey, payload, 60_000);
    res.json(payload);
  } catch (e) { next(e); }
});

export default router;
