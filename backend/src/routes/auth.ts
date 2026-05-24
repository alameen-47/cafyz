import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const PinSchema = z.object({ pin: z.string().length(4) });

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE u.email=?`,
      args: [email],
    });
    if (!row.rows.length) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const user = row.rows[0] as Record<string, unknown>;
    const ok = await bcrypt.compare(password, String(user.password_hash));
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const token = signToken({
      id: String(user.id),
      role: String(user.role),
      email: String(user.email),
      restaurant_id: String(user.restaurant_id),
    });
    res.json({
      token,
      restaurant_id: user.restaurant_id,
      restaurant_name: user.restaurant_name,
      restaurant_plan: user.restaurant_plan,
      user: { id: user.id, name: user.name, initials: user.initials, email: user.email, role: user.role, status: user.status },
    });
  } catch (e) { next(e); }
});

// POST /api/auth/pin  (mobile PIN login)
router.post('/pin', async (req, res, next) => {
  try {
    const { pin } = PinSchema.parse(req.body);
    const db = getDb();
    const rows = await db.execute(`
      SELECT u.*, r.name as restaurant_name
      FROM users u
      JOIN restaurants r ON r.id = u.restaurant_id
      WHERE u.pin_hash IS NOT NULL AND u.status != 'off'
    `);
    for (const row of rows.rows) {
      const u = row as Record<string, unknown>;
      if (u.pin_hash && await bcrypt.compare(pin, String(u.pin_hash))) {
        const token = signToken({
          id: String(u.id),
          role: String(u.role),
          email: String(u.email),
          restaurant_id: String(u.restaurant_id),
        });
        const restRow = await db.execute({ sql: 'SELECT plan FROM restaurants WHERE id=?', args: [String(u.restaurant_id)] });
        const restaurantPlan = restRow.rows[0]?.plan ?? 'basic';
        res.json({
          token,
          restaurant_id: u.restaurant_id,
          restaurant_name: u.restaurant_name,
          restaurant_plan: restaurantPlan,
          user: { id: u.id, name: u.name, initials: u.initials, email: u.email, role: u.role, status: u.status },
        });
        return;
      }
    }
    res.status(401).json({ error: 'Invalid PIN' });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT id,name,initials,email,role,status FROM users WHERE id=?', args: [req.user!.id] });
    if (!row.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

export default router;
