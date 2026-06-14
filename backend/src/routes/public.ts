import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

/**
 * Public, no-auth customer menu. Reached by scanning the restaurant's QR code,
 * which encodes a URL to the web app's /m/:restaurantId page. Returns only the
 * safe, customer-facing fields — branding + available menu items.
 *
 * GET /api/public/menu/:restaurantId
 */
router.get('/menu/:restaurantId', async (req, res, next) => {
  try {
    const param = req.params.restaurantId as string;
    const db = getDb();

    // Accept either the restaurant id or its slug so QR/deep-link URLs can be
    // human-friendly (/m/maison-1968d0) instead of raw UUIDs.
    const restRows = await db.execute({
      sql: `SELECT id, name, logo_url, currency_code, city, country, tagline
            FROM restaurants WHERE id=? OR slug=? LIMIT 1`,
      args: [param, param],
    });
    if (!restRows.rows.length) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    const r = restRows.rows[0] as Record<string, unknown>;
    const rid = String(r.id);

    const [itemRows, catRows] = await Promise.all([
      db.execute({
        sql: `SELECT id, name, category, price, description, image_url, is_popular
              FROM menu_items
              WHERE restaurant_id=? AND is_available=1
              ORDER BY category, is_popular DESC, name`,
        args: [rid],
      }),
      db.execute({
        sql: `SELECT slug, label, sort_order FROM menu_categories
              WHERE restaurant_id=? ORDER BY sort_order, label`,
        args: [rid],
      }),
    ]);
    // Cacheable for a minute — the menu changes rarely and this is hit per scan.
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      restaurant: {
        id: rid,
        name: String(r.name ?? 'Menu'),
        logo_url: r.logo_url ?? null,
        currency_code: String(r.currency_code ?? 'USD'),
        city: r.city ?? null,
        country: r.country ?? null,
        tagline: r.tagline ?? null,
      },
      categories: catRows.rows,
      items: itemRows.rows,
    });
  } catch (e) { next(e); }
});

export default router;
