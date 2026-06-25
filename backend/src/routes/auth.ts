import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { getDb } from '../db.js';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { resetPasswordUrl } from '../config/site.js';
import { isEmailConfigured, sendMailReliable, smtpFrom } from '../services/email.js';
import { isValidPhoneE164, normalizePhone, sendOtpSms } from '../services/sms.js';

const router = Router();

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  device_id: z.string().min(8).max(128).optional(),
});
const RequestOtpSchema = z.object({ phone: z.string().min(8) });
const VerifyOtpSchema = z.object({ phone: z.string().min(8), otp: z.string().regex(/^\d{6}$/) });

const PinSchema = z.object({
  email: z.string().email(),
  pin: z.string().length(4),
  device_id: z.string().min(8).max(128),
});
const ForgotPasswordSchema = z.object({ email: z.string().email() });
const ResetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8),
});
const ProfileUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(8).max(40).optional(),
  email: z.string().email().optional(),
});
const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});
const ChangePinSchema = z.object({
  current_pin: z.string().length(4),
  new_pin: z.string().length(4),
});

const GENERIC_RESET_MSG = 'If that account exists, a password-reset link has been sent.';
const RESET_TOKEN_TTL_MINUTES = 30;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function hashOtp(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, device_id } = LoginSchema.parse(req.body);
    const emailNorm = email.trim().toLowerCase();
    const passNorm = password;
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE LOWER(u.email)=?
            ORDER BY u.created_at DESC`,
      args: [emailNorm],
    });
    if (!row.rows.length) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

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
    if (String(user.status) === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }
    if (device_id) {
      await db.execute({
        sql: 'UPDATE users SET pin_device_id=? WHERE id=?',
        args: [device_id.trim(), String(user.id)],
      });
      user.pin_device_id = device_id.trim();
    }
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
      user: { id: user.id, name: user.name, initials: user.initials, email: user.email, phone: user.phone, role: user.role, access_json: user.access_json, status: user.status, restaurant_id: user.restaurant_id },
    });
  } catch (e) { next(e); }
});

// POST /api/auth/request-otp
router.post('/request-otp', async (req, res, next) => {
  try {
    const { phone } = RequestOtpSchema.parse(req.body);
    const phoneNorm = normalizePhone(phone);
    if (!isValidPhoneE164(phoneNorm)) {
      res.status(400).json({ error: 'Enter a valid phone number in international format (e.g. +971500000000).' });
      return;
    }

    const db = getDb();
    const userRows = await db.execute({
      sql: `SELECT id, phone, status FROM users WHERE phone=? ORDER BY created_at DESC LIMIT 1`,
      args: [phoneNorm],
    });
    if (!userRows.rows.length) {
      res.status(400).json({ error: 'If that phone number is registered, an OTP has been sent.' });
      return;
    }
    if (String(userRows.rows[0].status) === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }

    const user = userRows.rows[0] as Record<string, unknown>;
    const userId = String(user.id);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashOtp(otp);

    await db.execute({
      sql: `DELETE FROM login_otp_codes
            WHERE user_id=?
               OR expires_at <= datetime('now')
               OR used_at IS NOT NULL`,
      args: [userId],
    });
    await db.execute({
      sql: `INSERT INTO login_otp_codes(id,user_id,phone,otp_hash,expires_at,used_at,attempt_count)
            VALUES(?,?,?,?,datetime('now', '+10 minutes'),NULL,0)`,
      args: [randomBytes(16).toString('hex'), userId, phoneNorm, otpHash],
    });

    const sms = await sendOtpSms(phoneNorm, otp, { context: 'login', ttlMinutes: OTP_TTL_MINUTES });
    if (!sms.ok) {
      res.status(500).json({ error: `Could not send OTP: ${sms.error}` });
      return;
    }

    res.json({
      ok: true,
      message: `OTP sent to ${phoneNorm}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      ...(sms.details ? { delivery_id: sms.details } : {}),
      ...(process.env.NODE_ENV !== 'production' && sms.provider === 'dev-log' ? { dev_otp: otp } : {}),
    });
  } catch (e) { next(e); }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp } = VerifyOtpSchema.parse(req.body);
    const phoneNorm = normalizePhone(phone);
    if (!isValidPhoneE164(phoneNorm)) {
      res.status(400).json({ error: 'Invalid phone number format.' });
      return;
    }

    const db = getDb();
    const row = await db.execute({
      sql: `SELECT id,user_id,otp_hash,attempt_count
            FROM login_otp_codes
            WHERE phone=?
              AND used_at IS NULL
              AND expires_at > datetime('now')
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [phoneNorm],
    });
    if (!row.rows.length) {
      res.status(400).json({ error: 'OTP expired or not found. Request a new code.' });
      return;
    }
    const otpRow = row.rows[0] as Record<string, unknown>;
    const codeId = String(otpRow.id);
    const attempts = Number(otpRow.attempt_count ?? 0);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: 'Too many invalid attempts. Request a new OTP.' });
      return;
    }

    const isMatch = hashOtp(otp) === String(otpRow.otp_hash);
    if (!isMatch) {
      await db.execute({
        sql: `UPDATE login_otp_codes SET attempt_count=attempt_count+1 WHERE id=?`,
        args: [codeId],
      });
      res.status(401).json({ error: 'Invalid OTP code' });
      return;
    }

    await db.execute({ sql: `UPDATE login_otp_codes SET used_at=datetime('now') WHERE id=?`, args: [codeId] });

    const userId = String(otpRow.user_id);
    const userRow = await db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE u.id=?
            LIMIT 1`,
      args: [userId],
    });
    if (!userRow.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = userRow.rows[0] as Record<string, unknown>;
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
      user: {
        id: user.id, name: user.name, initials: user.initials, email: user.email, role: user.role, access_json: user.access_json, status: user.status, phone: user.phone, restaurant_id: user.restaurant_id,
      },
    });
  } catch (e) { next(e); }
});

// POST /api/auth/pin  (mobile PIN login)
router.post('/pin', async (req, res, next) => {
  try {
    const { email, pin, device_id } = PinSchema.parse(req.body);
    const emailNorm = email.trim().toLowerCase();
    const deviceIdNorm = device_id.trim();
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE LOWER(u.email)=?
            ORDER BY u.created_at DESC
            LIMIT 1`,
      args: [emailNorm],
    });
    if (!row.rows.length) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const u = row.rows[0] as Record<string, unknown>;
    if (String(u.status) === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }
    if (!u.pin_hash || !(await bcrypt.compare(pin, String(u.pin_hash)))) {
      res.status(401).json({ error: 'Invalid PIN for this account' });
      return;
    }

    const pinnedDevice = String(u.pin_device_id ?? '').trim();
    if (pinnedDevice && pinnedDevice !== deviceIdNorm) {
      res.status(403).json({ error: 'PIN login is restricted to your registered device. Use email login to register this device.' });
      return;
    }
    if (!pinnedDevice) {
      await db.execute({ sql: 'UPDATE users SET pin_device_id=? WHERE id=?', args: [deviceIdNorm, String(u.id)] });
      u.pin_device_id = deviceIdNorm;
    }

    const token = signToken({
      id: String(u.id),
      role: String(u.role),
      email: String(u.email),
      restaurant_id: String(u.restaurant_id),
    });
    res.json({
      token,
      restaurant_id: u.restaurant_id,
      restaurant_name: u.restaurant_name,
      restaurant_plan: u.restaurant_plan ?? 'basic',
      user: { id: u.id, name: u.name, initials: u.initials, email: u.email, phone: u.phone, role: u.role, access_json: u.access_json, status: u.status, restaurant_id: u.restaurant_id },
    });
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
      const resetUrl = resetPasswordUrl(tokenRaw);
      const recipient = String(user.email ?? emailNorm);
      const name = String(user.name ?? 'there');
      await sendMailReliable({
        from: smtpFrom(false),
        to: recipient,
        subject: 'Cafyz password reset',
        html: `<p>Hello ${name},</p>
               <p>You requested a password reset for your Cafyz account.</p>
               <p><a href="${resetUrl}">Reset password</a></p>
               <p>Or copy this link: ${resetUrl}</p>
               <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>`,
      });
    }

    const resetUrl = resetPasswordUrl(tokenRaw);
    const exposeDevLink = process.env.NODE_ENV !== 'production' && !isEmailConfigured();
    res.json({
      ok: true,
      message: GENERIC_RESET_MSG,
      ...(exposeDevLink ? { dev_reset_url: resetUrl } : {}),
    });
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
    const row = await getDb().execute({ sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status FROM users WHERE id=?', args: [req.user!.id] });
    if (!row.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = ProfileUpdateSchema.parse(req.body);
    const db = getDb();
    const me = await db.execute({
      sql: 'SELECT * FROM users WHERE id=?',
      args: [req.user!.id],
    });
    if (!me.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const current = me.rows[0] as Record<string, unknown>;

    const sets: string[] = [];
    const args: any[] = [];

    if (data.name !== undefined) {
      sets.push('name=?');
      args.push(data.name.trim());
      sets.push('initials=?');
      args.push(data.name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2));
    }
    if (data.phone !== undefined) {
      const phoneNorm = normalizePhone(data.phone);
      if (!isValidPhoneE164(phoneNorm)) {
        res.status(400).json({ error: 'Phone must be in international format (e.g. +971500000000)' });
        return;
      }
      const exists = await db.execute({
        sql: 'SELECT id FROM users WHERE phone=? AND id!=?',
        args: [phoneNorm, req.user!.id],
      });
      if (exists.rows.length) {
        res.status(409).json({ error: 'Phone number already used by another account' });
        return;
      }
      sets.push('phone=?');
      args.push(phoneNorm);
    }
    if (data.email !== undefined) {
      const emailNorm = data.email.trim().toLowerCase();
      const exists = await db.execute({
        sql: 'SELECT id FROM users WHERE restaurant_id=? AND LOWER(email)=? AND id!=?',
        args: [String(current.restaurant_id), emailNorm, req.user!.id],
      });
      if (exists.rows.length) {
        res.status(409).json({ error: 'Email already exists in this restaurant' });
        return;
      }
      sets.push('email=?');
      args.push(emailNorm);
    }

    if (!sets.length) {
      res.status(400).json({ error: 'Nothing to update' });
      return;
    }

    args.push(req.user!.id);
    await db.execute({
      sql: `UPDATE users SET ${sets.join(',')} WHERE id=?`,
      args,
    });
    const out = await db.execute({
      sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status FROM users WHERE id=?',
      args: [req.user!.id],
    });
    res.json(out.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = ChangePasswordSchema.parse(req.body);
    const db = getDb();
    const row = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id=?',
      args: [req.user!.id],
    });
    if (!row.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const currentHash = String((row.rows[0] as Record<string, unknown>).password_hash ?? '');
    const ok = await bcrypt.compare(data.current_password, currentHash);
    if (!ok) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    const nextHash = await bcrypt.hash(data.new_password, 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash=? WHERE id=?',
      args: [nextHash, req.user!.id],
    });
    res.json({ ok: true, message: 'Password updated successfully' });
  } catch (e) { next(e); }
});

// POST /api/auth/change-pin
router.post('/change-pin', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = ChangePinSchema.parse(req.body);
    const db = getDb();
    const row = await db.execute({
      sql: 'SELECT pin_hash FROM users WHERE id=?',
      args: [req.user!.id],
    });
    if (!row.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const currentHash = String((row.rows[0] as Record<string, unknown>).pin_hash ?? '');
    if (!currentHash) {
      res.status(400).json({ error: 'PIN is not set for this account' });
      return;
    }
    const ok = await bcrypt.compare(data.current_pin, currentHash);
    if (!ok) {
      res.status(401).json({ error: 'Current PIN is incorrect' });
      return;
    }
    const nextHash = await bcrypt.hash(data.new_pin, 10);
    await db.execute({
      sql: 'UPDATE users SET pin_hash=? WHERE id=?',
      args: [nextHash, req.user!.id],
    });
    res.json({ ok: true, message: 'PIN updated successfully' });
  } catch (e) { next(e); }
});

export default router;
