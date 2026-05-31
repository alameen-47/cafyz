import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { getDb } from '../db.js';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { APP_URL } from '../config/site.js';
import { isEmailConfigured, sendMailReliable, smtpFrom } from '../services/email.js';

const router = Router();

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const PinSchema = z.object({ pin: z.string().length(4) });
const ForgotPasswordSchema = z.object({ email: z.string().email() });
const ResetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8),
});

const GENERIC_RESET_MSG = 'If that account exists, a password-reset link has been sent.';
const RESET_TOKEN_TTL_MINUTES = 30;

function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const emailNorm = email.trim().toLowerCase();
    const passNorm = password.trim();
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE LOWER(u.email)=?
            ORDER BY u.created_at DESC`,
      args: [emailNorm],
    });
    if (!row.rows.length) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    // Same email can exist on multiple trial restaurants — check every account's password.
    let user: Record<string, unknown> | null = null;
    for (const candidate of row.rows) {
      const u = candidate as Record<string, unknown>;
      if (await bcrypt.compare(passNorm, String(u.password_hash))) {
        user = u;
        break;
      }
    }
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }
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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const emailNorm = email.trim().toLowerCase();
    const db = getDb();
    const userRows = await db.execute({
      sql: `SELECT id, name, email
            FROM users
            WHERE LOWER(email)=?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [emailNorm],
    });

    if (!userRows.rows.length) {
      res.json({ ok: true, message: GENERIC_RESET_MSG });
      return;
    }

    const user = userRows.rows[0] as Record<string, unknown>;
    const userId = String(user.id);
    const tokenRaw = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(tokenRaw);

    await db.execute({
      sql: `DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at <= datetime('now')`,
      args: [userId],
    });
    await db.execute({
      sql: `INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at,used_at)
            VALUES(?,?,?,datetime('now', '+30 minutes'),NULL)`,
      args: [randomBytes(16).toString('hex'), userId, tokenHash],
    });

    if (isEmailConfigured()) {
      const resetUrl = `${APP_URL}/login?mode=reset&token=${encodeURIComponent(tokenRaw)}`;
      const recipient = String(user.email ?? emailNorm);
      const name = String(user.name ?? 'there');
      await sendMailReliable({
        from: smtpFrom(false),
        to: recipient,
        subject: 'Cafyz password reset',
        html: `<p>Hello ${name},</p>
               <p>You requested a password reset for your Cafyz account.</p>
               <p><a href="${resetUrl}">Reset password</a></p>
               <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>`,
      });
    }

    res.json({ ok: true, message: GENERIC_RESET_MSG });
  } catch (e) { next(e); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = ResetPasswordSchema.parse(req.body);
    const db = getDb();
    const tokenHash = hashResetToken(token);
    const row = await db.execute({
      sql: `SELECT prt.id, prt.user_id
            FROM password_reset_tokens prt
            WHERE prt.token_hash=?
              AND prt.used_at IS NULL
              AND prt.expires_at > datetime('now')
            ORDER BY prt.created_at DESC
            LIMIT 1`,
      args: [tokenHash],
    });
    if (!row.rows.length) {
      res.status(400).json({ error: 'Reset link is invalid or expired' });
      return;
    }
    const tokenRow = row.rows[0] as Record<string, unknown>;
    const tokenId = String(tokenRow.id);
    const userId = String(tokenRow.user_id);
    const passwordHash = await bcrypt.hash(password, 10);

    await db.execute({ sql: 'UPDATE users SET password_hash=? WHERE id=?', args: [passwordHash, userId] });
    await db.execute({ sql: "UPDATE password_reset_tokens SET used_at=datetime('now') WHERE id=?", args: [tokenId] });
    await db.execute({ sql: "DELETE FROM password_reset_tokens WHERE user_id=? AND id!=?", args: [userId, tokenId] });

    res.json({ ok: true, message: 'Password reset successful. You can now sign in.' });
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
