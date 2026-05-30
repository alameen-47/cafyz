import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';

const router = Router();

/** data:image/… (dithered logo) or https URL */
const LogoUrlSchema = z.union([
  z.literal(''),
  z.string().url(),
  z.string().regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, 'Invalid logo data URL'),
]);

const OnboardingSchema = z.object({
  restaurant_name: z.string().min(1),
  owner_name:      z.string().min(1),
  email:           z.string().email(),
  password:        z.string().min(8),
  plan:            z.enum(['basic','pro','premium']).optional(),
  timezone:        z.string().optional(),
});

const UpdateRestaurantSchema = z.object({
  name:          z.string().min(1).optional(),
  timezone:      z.string().optional(),
  logo_url:      LogoUrlSchema.optional(),
  contact_phone: z.string().max(40).optional(),
  contact_email: z.string().email().or(z.literal('')).optional(),
  address_line1: z.string().max(160).optional(),
  address_line2: z.string().max(160).optional(),
  city:          z.string().max(80).optional(),
  country:       z.string().max(80).optional(),
  postal_code:   z.string().max(24).optional(),
  tax_id:        z.string().max(80).optional(),
  website_url:   z.string().url().or(z.literal('')).optional(),
});

// POST /api/restaurants/onboarding — public, creates restaurant + owner user
router.post('/onboarding', async (req, res, next) => {
  try {
    const data = OnboardingSchema.parse(req.body);
    const db = getDb();

    const restId = uid();
    const slug = data.restaurant_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.execute({
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
      args: [restId, data.restaurant_name, `${slug}-${restId.slice(0,6)}`, data.plan??'basic', data.timezone??'UTC'],
    });

    const ownerId = uid();
    const pwHash = await bcrypt.hash(data.password, 10);
    const initials = data.owner_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    await db.execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time) VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [ownerId, restId, data.owner_name, initials, data.email, pwHash, 'owner', 'active', '—'],
    });

    const restaurant = await db.execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [restId] });
    const user = await db.execute({ sql: 'SELECT id,name,initials,email,role,status FROM users WHERE id=?', args: [ownerId] });

    const token = signToken({ id: ownerId, role: 'owner', email: data.email, restaurant_id: restId });

    res.status(201).json({
      token,
      restaurant: restaurant.rows[0],
      user: user.rows[0],
    });
  } catch (e) { next(e); }
});

// GET /api/restaurants/me — requireAuth, returns current restaurant
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const row = await getDb().execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [rid] });
    if (!row.rows.length) { res.status(404).json({ error: 'Restaurant not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/restaurants/me — requireAuth, updates name/timezone
router.put('/me', requireAuth, requireRole('owner', 'manager', 'cashier'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = UpdateRestaurantSchema.parse(req.body);

    const sets: string[] = []; const args: any[] = [];
    if (data.name          !== undefined) { sets.push('name=?');          args.push(data.name); }
    if (data.timezone      !== undefined) { sets.push('timezone=?');      args.push(data.timezone); }
    if (data.logo_url      !== undefined) { sets.push('logo_url=?');      args.push(data.logo_url || null); }
    if (data.contact_phone !== undefined) { sets.push('contact_phone=?'); args.push(data.contact_phone || null); }
    if (data.contact_email !== undefined) { sets.push('contact_email=?'); args.push(data.contact_email || null); }
    if (data.address_line1 !== undefined) { sets.push('address_line1=?'); args.push(data.address_line1 || null); }
    if (data.address_line2 !== undefined) { sets.push('address_line2=?'); args.push(data.address_line2 || null); }
    if (data.city          !== undefined) { sets.push('city=?');          args.push(data.city || null); }
    if (data.country       !== undefined) { sets.push('country=?');       args.push(data.country || null); }
    if (data.postal_code   !== undefined) { sets.push('postal_code=?');   args.push(data.postal_code || null); }
    if (data.tax_id        !== undefined) { sets.push('tax_id=?');        args.push(data.tax_id || null); }
    if (data.website_url   !== undefined) { sets.push('website_url=?');   args.push(data.website_url || null); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push(rid);
    await getDb().execute({ sql: `UPDATE restaurants SET ${sets.join(',')} WHERE id=?`, args });
    const row = await getDb().execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [rid] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/restaurants/branches — requireAuth, sub-restaurants where parent_id = current restaurant
router.get('/branches', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const rows = await getDb().execute({ sql: 'SELECT * FROM restaurants WHERE parent_id=?', args: [rid] });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;
