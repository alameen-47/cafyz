import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/search?q=... — cross-entity search scoped to the current restaurant
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim().slice(0, 64);
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const rid = req.user!.restaurant_id;
    const like = `%${q}%`;
    const db = getDb();

    const [menuRows, tableRows, orderRows, staffRows, inventoryRows, reservationRows] = await Promise.all([
      db.execute({
        sql: `SELECT id, name, category, price, is_available
              FROM menu_items
              WHERE restaurant_id=? AND (name LIKE ? OR category LIKE ? OR description LIKE ?)
              LIMIT 6`,
        args: [rid, like, like, like],
      }),
      db.execute({
        sql: `SELECT id, name, zone, status, capacity
              FROM restaurant_tables
              WHERE restaurant_id=? AND (name LIKE ? OR zone LIKE ?)
              LIMIT 4`,
        args: [rid, like, like],
      }),
      db.execute({
        sql: `SELECT o.id, o.status, t.name AS table_name, o.covers, o.note, o.created_at
              FROM orders o
              LEFT JOIN restaurant_tables t ON t.id = o.table_id
              WHERE o.restaurant_id=? AND (o.id LIKE ? OR t.name LIKE ? OR o.note LIKE ?)
              ORDER BY o.created_at DESC LIMIT 5`,
        args: [rid, like, like, like],
      }),
      db.execute({
        sql: `SELECT id, name, email, role, status
              FROM users
              WHERE restaurant_id=? AND (name LIKE ? OR email LIKE ? OR role LIKE ?)
              LIMIT 4`,
        args: [rid, like, like, like],
      }),
      db.execute({
        sql: `SELECT id, name, current, par, unit, alert
              FROM inventory
              WHERE restaurant_id=? AND name LIKE ?
              LIMIT 4`,
        args: [rid, like],
      }),
      db.execute({
        sql: `SELECT id, guest_name, covers, res_time, status
              FROM reservations
              WHERE restaurant_id=? AND (guest_name LIKE ? OR note LIKE ?)
              ORDER BY res_time DESC LIMIT 4`,
        args: [rid, like, like],
      }),
    ]);

    const results = [
      ...menuRows.rows.map(r => ({
        type: 'menu' as const,
        id: String(r.id),
        title: String(r.name),
        subtitle: `${String(r.category)} · ${r.price}`,
        meta: r.is_available ? 'available' : '86\'d',
        page: 'menu',
      })),
      ...tableRows.rows.map(r => ({
        type: 'table' as const,
        id: String(r.id),
        title: String(r.name),
        subtitle: `Zone ${r.zone} · cap ${r.capacity}`,
        meta: String(r.status),
        page: 'tables',
      })),
      ...orderRows.rows.map(r => ({
        type: 'order' as const,
        id: String(r.id),
        title: r.table_name ? String(r.table_name) : 'Takeaway',
        subtitle: `${r.covers} covers · ${r.note ?? ''}`.trim().replace(/·\s*$/, ''),
        meta: String(r.status),
        page: 'orders',
      })),
      ...staffRows.rows.map(r => ({
        type: 'staff' as const,
        id: String(r.id),
        title: String(r.name),
        subtitle: `${r.role} · ${r.email}`,
        meta: String(r.status),
        page: 'staff',
      })),
      ...inventoryRows.rows.map(r => ({
        type: 'inventory' as const,
        id: String(r.id),
        title: String(r.name),
        subtitle: `${r.current}${r.unit} remaining (par ${r.par}${r.unit})`,
        meta: Number(r.current) <= Number(r.par) ? 'low' : 'ok',
        page: 'inventory',
      })),
      ...reservationRows.rows.map(r => ({
        type: 'reservation' as const,
        id: String(r.id),
        title: String(r.guest_name),
        subtitle: `${r.covers} covers · ${new Date(String(r.res_time)).toLocaleString()}`,
        meta: String(r.status),
        page: 'reservations',
      })),
    ];

    res.json({ results, query: q });
  } catch (e) {
    next(e);
  }
});

export default router;
