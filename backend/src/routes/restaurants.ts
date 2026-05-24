import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { uid } from '../utils.js';

const router = Router();

const OnboardingSchema = z.object({
  restaurant_name: z.string().min(1),
  owner_name:      z.string().min(1),
  email:           z.string().email(),
  password:        z.string().min(8),
  plan:            z.enum(['starter','growth','enterprise']).optional(),
  timezone:        z.string().optional(),
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
      args: [restId, data.restaurant_name, `${slug}-${restId.slice(0,6)}`, data.plan??'starter', data.timezone??'UTC'],
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

// PUT /api/restaurants/me — requireAuth, updates name/timezone/profile
router.put('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = z.object({
      name:          z.string().min(1).optional(),
      timezone:      z.string().optional(),
      logo:          z.string().optional().nullable(),
      address_line1: z.string().optional(),
      address_line2: z.string().optional(),
      city:          z.string().optional(),
      postcode:      z.string().optional(),
      country:       z.string().optional(),
      phone:         z.string().optional(),
      website:       z.string().optional(),
    }).parse(req.body);

    const sets: string[] = []; const args: any[] = [];
    const add = (col: string, val: any) => { sets.push(`${col}=?`); args.push(val); };

    if (data.name          !== undefined) add('name',          data.name);
    if (data.timezone      !== undefined) add('timezone',      data.timezone);
    if (data.logo          !== undefined) add('logo',          data.logo);
    if (data.address_line1 !== undefined) add('address_line1', data.address_line1);
    if (data.address_line2 !== undefined) add('address_line2', data.address_line2);
    if (data.city          !== undefined) add('city',          data.city);
    if (data.postcode      !== undefined) add('postcode',      data.postcode);
    if (data.country       !== undefined) add('country',       data.country);
    if (data.phone         !== undefined) add('phone',         data.phone);
    if (data.website       !== undefined) add('website',       data.website);

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
