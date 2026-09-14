import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getDb } from '../db.js';
import { signToken, requireAuth, signTokenForUser, type AuthRequest, JWT_SECRET } from '../middleware/auth.js';
import { bumpTokenVersion } from '../services/tokenVersion.js';
import { BCRYPT_ROUNDS } from '../constants/security.js';
import { secureOtp6 } from '../utils/secureRandom.js';
import {
  isPasswordTooLong,
  passwordChangeField,
  passwordField,
  passwordLoginField,
} from '../utils/security.js';
import { resetPasswordUrl, TRIAL_DAYS } from '../config/site.js';
import { isEmailConfigured, sendMailReliable, smtpFrom } from '../services/email.js';
import { isValidPhoneE164, normalizePhone, sendOtpSms } from '../services/sms.js';
import { googleIosClientId, googleWebClientId, isGoogleAuthConfigured, verifyGoogleIdToken } from '../services/googleAuth.js';
import { createTrialRestaurant, TOP_PLAN } from '../services/trialSignup.js';
import { accountDeletionDate, formatDeletionDate } from '../services/accountDeletion.js';
import jwt from 'jsonwebtoken';

const router = Router();

const LoginSchema = z.object({
  login: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: passwordLoginField,
  device_id: z.string().min(8).max(128).optional(),
}).refine((d) => Boolean(d.login?.trim() || d.email?.trim()), {
  message: 'Email or mobile number is required',
});

function resolveLoginIdentifier(raw: string): { kind: 'email'; value: string } | { kind: 'phone'; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const parsed = z.string().email().safeParse(trimmed.toLowerCase());
    if (!parsed.success) return null;
    return { kind: 'email', value: parsed.data };
  }
  const phoneNorm = normalizePhone(trimmed);
  if (!isValidPhoneE164(phoneNorm)) return null;
  return { kind: 'phone', value: phoneNorm };
}

async function findUsersForLogin(identifier: { kind: 'email' | 'phone'; value: string }) {
  const db = getDb();
  if (identifier.kind === 'email') {
    return db.execute({
      sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
            FROM users u
            JOIN restaurants r ON r.id = u.restaurant_id
            WHERE LOWER(u.email)=?
            ORDER BY u.created_at DESC`,
      args: [identifier.value],
    });
  }
  return db.execute({
    sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
          FROM users u
          JOIN restaurants r ON r.id = u.restaurant_id
          WHERE u.phone=?
          ORDER BY u.created_at DESC`,
    args: [identifier.value],
  });
}
const RequestOtpSchema = z.object({ phone: z.string().min(8) });
const VerifyOtpSchema = z.object({ phone: z.string().min(8), otp: z.string().regex(/^\d{6}$/) });

const PinSchema = z.object({
  login: z.string().min(3).optional(),
  email: z.string().optional(),
  pin: z.string().length(4),
  device_id: z.string().min(8).max(128),
}).refine((d) => Boolean(d.login?.trim() || d.email?.trim()), {
  message: 'Email or mobile number is required',
});
const ForgotPasswordSchema = z.object({ email: z.string().email() });
const ResetPasswordSchema = z.object({
  token: z.string().min(24),
  password: passwordField,
});
const ProfileUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(8).max(40).optional(),
  email: z.string().email().optional(),
});
const ChangePasswordSchema = z.object({
  current_password: passwordChangeField,
  new_password: passwordField,
});
const ChangePinSchema = z.object({
  current_pin: z.string().length(4),
  new_pin: z.string().length(4),
});
const DeleteAccountSchema = z.object({
  /** Required when the account signs in with a password; Google-only owners confirm by typing only. */
  password: passwordLoginField.optional(),
  confirm: z.literal('DELETE'),
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

function otpHashMatches(rawOtp: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(rawOtp), 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function issueLoginSession(db: ReturnType<typeof getDb>, userId: string) {
  await bumpTokenVersion(userId);
  // Signing in again during the grace period cancels a pending account deletion.
  await db.execute({
    sql: 'UPDATE users SET deletion_scheduled_at=NULL WHERE id=? AND deletion_scheduled_at IS NOT NULL',
    args: [userId],
  });
  const row = await db.execute({
    sql: `SELECT u.*, r.name as restaurant_name, r.plan as restaurant_plan
          FROM users u
          JOIN restaurants r ON r.id = u.restaurant_id
          WHERE u.id=?
          LIMIT 1`,
    args: [userId],
  });
  return row.rows[0] as Record<string, unknown>;
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const body = LoginSchema.parse(req.body);
    const { password, device_id } = body;
    const rawLogin = (body.login ?? body.email ?? '').trim();
    const identifier = resolveLoginIdentifier(rawLogin);
    if (!identifier) {
      if (rawLogin.includes('@')) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passNorm = password;
    const row = await findUsersForLogin(identifier);
    if (!row.rows.length) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (isPasswordTooLong(password)) {
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
      await getDb().execute({
        sql: 'UPDATE users SET pin_device_id=? WHERE id=?',
        args: [device_id.trim(), String(user.id)],
      });
      user.pin_device_id = device_id.trim();
    }
    const liveUser = await issueLoginSession(getDb(), String(user.id));
    const token = signTokenForUser(liveUser);
    res.json({
      token,
      restaurant_id: liveUser.restaurant_id,
      restaurant_name: liveUser.restaurant_name,
      restaurant_plan: liveUser.restaurant_plan,
      user: { id: liveUser.id, name: liveUser.name, initials: liveUser.initials, email: liveUser.email, phone: liveUser.phone, role: liveUser.role, access_json: liveUser.access_json, status: liveUser.status, restaurant_id: liveUser.restaurant_id },
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
    const otp = secureOtp6();
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

    const isMatch = otpHashMatches(otp, String(otpRow.otp_hash));
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
    const user = await issueLoginSession(db, userId);
    const token = signTokenForUser(user);
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

// POST /api/auth/pin  (mobile PIN login — email or phone + 4-digit PIN)
router.post('/pin', async (req, res, next) => {
  try {
    const body = PinSchema.parse(req.body);
    const { pin, device_id } = body;
    const rawLogin = (body.login ?? body.email ?? '').trim();
    const identifier = resolveLoginIdentifier(rawLogin);
    if (!identifier) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const deviceIdNorm = device_id.trim();
    const db = getDb();
    const row = await findUsersForLogin(identifier);
    if (!row.rows.length) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    let u: Record<string, unknown> | null = null;
    for (const candidate of row.rows) {
      const rowUser = candidate as Record<string, unknown>;
      if (rowUser.pin_hash && await bcrypt.compare(pin, String(rowUser.pin_hash))) {
        u = rowUser;
        break;
      }
    }
    if (!u) {
      res.status(401).json({ error: 'Invalid PIN for this account' });
      return;
    }
    if (String(u.status) === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }

    const pinnedDevice = String(u.pin_device_id ?? '').trim();
    if (pinnedDevice && pinnedDevice !== deviceIdNorm) {
      res.status(403).json({ error: 'PIN login is restricted to your registered device. Use email or mobile login to register this device.' });
      return;
    }
    if (!pinnedDevice) {
      await db.execute({ sql: 'UPDATE users SET pin_device_id=? WHERE id=?', args: [deviceIdNorm, String(u.id)] });
    }

    const liveUser = await issueLoginSession(db, String(u.id));
    const token = signTokenForUser(liveUser);
    res.json({
      token,
      restaurant_id: liveUser.restaurant_id,
      restaurant_name: liveUser.restaurant_name,
      restaurant_plan: liveUser.restaurant_plan ?? 'basic',
      user: { id: liveUser.id, name: liveUser.name, initials: liveUser.initials, email: liveUser.email, phone: liveUser.phone, role: liveUser.role, access_json: liveUser.access_json, status: liveUser.status, restaurant_id: liveUser.restaurant_id },
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await db.execute({ sql: 'UPDATE users SET password_hash=?, password_login=1 WHERE id=?', args: [passwordHash, userId] });
    await db.execute({ sql: "UPDATE password_reset_tokens SET used_at=datetime('now') WHERE id=?", args: [tokenId] });
    await db.execute({ sql: "DELETE FROM password_reset_tokens WHERE user_id=? AND id!=?", args: [userId, tokenId] });
    await bumpTokenVersion(userId);

    res.json({ ok: true, message: 'Password reset successful. You can now sign in.' });
  } catch (e) { next(e); }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Sliding sign-in: the apps trade a still-valid token for a fresh one (at most once a
// day), so anyone who opens the app within a year stays signed in. Revoked sessions
// never get here — requireAuth checks token_version and account status first.
router.post('/refresh', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const row = await getDb().execute({
      sql: 'SELECT id, role, email, restaurant_id, token_version FROM users WHERE id=? LIMIT 1',
      args: [req.user!.id],
    });
    if (!row.rows.length) {
      res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_INVALID' });
      return;
    }
    res.json({ token: signTokenForUser(row.rows[0] as Record<string, unknown>) });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const row = await getDb().execute({ sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,deletion_scheduled_at,password_login FROM users WHERE id=?', args: [req.user!.id] });
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
      sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,deletion_scheduled_at,password_login FROM users WHERE id=?',
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
    const nextHash = await bcrypt.hash(data.new_password, BCRYPT_ROUNDS);
    await db.execute({
      sql: 'UPDATE users SET password_hash=? WHERE id=?',
      args: [nextHash, req.user!.id],
    });
    await bumpTokenVersion(req.user!.id);
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
    const nextHash = await bcrypt.hash(data.new_pin, BCRYPT_ROUNDS);
    await db.execute({
      sql: 'UPDATE users SET pin_hash=? WHERE id=?',
      args: [nextHash, req.user!.id],
    });
    await bumpTokenVersion(req.user!.id);
    res.json({ ok: true, message: 'PIN updated successfully' });
  } catch (e) { next(e); }
});

// DELETE /api/auth/account — request account deletion (App Store Guideline 5.1.1).
// Nothing is removed straight away: the account is scheduled for deletion after a grace period
// (services/accountDeletion.ts) and signing in again before then cancels it.
router.delete('/account', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = DeleteAccountSchema.parse(req.body ?? {});
    const db = getDb();
    const userId = req.user!.id;
    const row = await db.execute({
      sql: 'SELECT id, role, password_hash, password_login FROM users WHERE id=?',
      args: [userId],
    });
    if (!row.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const u = row.rows[0] as Record<string, unknown>;
    const role = String(u.role ?? '');

    if (role === 'founder') {
      res.status(403).json({ error: 'Founder accounts cannot be deleted from the app. Contact platform support.' });
      return;
    }

    if (Number(u.password_login ?? 1) === 1) {
      const ok = data.password ? await bcrypt.compare(data.password, String(u.password_hash ?? '')) : false;
      if (!ok) {
        res.status(401).json({ error: 'Password is incorrect' });
        return;
      }
    }

    const scheduledFor = accountDeletionDate();
    await db.execute({ sql: 'UPDATE users SET deletion_scheduled_at=? WHERE id=?', args: [scheduledFor, userId] });
    const when = formatDeletionDate(scheduledFor);
    res.json({
      ok: true,
      scheduled_for: scheduledFor,
      message: role === 'owner'
        ? `Your restaurant and all its data will be deleted on ${when}. Sign in again before then to cancel.`
        : `Your account will be deleted on ${when}. Sign in again before then to cancel.`,
    });
  } catch (e) { next(e); }
});

// POST /api/auth/account/cancel-deletion — keep the account after all
router.post('/account/cancel-deletion', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await getDb().execute({ sql: 'UPDATE users SET deletion_scheduled_at=NULL WHERE id=?', args: [req.user!.id] });
    res.json({ ok: true, message: 'Account deletion cancelled. Your account stays active.' });
  } catch (e) { next(e); }
});


// ── Google Sign-In ─────────────────────────────────────────────────────────────
// The client proves an email with a Google ID token; we map it to an existing
// Cafyz account. A new Google user gets a short-lived signup token instead and
// finishes with /google/signup, which starts a trial restaurant on the top plan.

const GOOGLE_SELECT_TTL_SEC = 300;

interface GoogleSelectClaims { email: string; purpose: 'google_select' }

function signGoogleSelectToken(email: string): string {
  return jwt.sign(
    { email, purpose: 'google_select' } satisfies GoogleSelectClaims,
    JWT_SECRET,
    { expiresIn: GOOGLE_SELECT_TTL_SEC },
  );
}

const GOOGLE_SIGNUP_TTL_SEC = 15 * 60;

interface GoogleSignupClaims { email: string; name?: string; purpose: 'google_signup' }

function signGoogleSignupToken(email: string, name?: string): string {
  return jwt.sign(
    { email, name, purpose: 'google_signup' } satisfies GoogleSignupClaims,
    JWT_SECRET,
    { expiresIn: GOOGLE_SIGNUP_TTL_SEC },
  );
}

function sessionResponse(user: Record<string, unknown>) {
  return {
    status: 'ok' as const,
    token: signTokenForUser(user),
    restaurant_id: user.restaurant_id,
    restaurant_name: user.restaurant_name,
    restaurant_plan: user.restaurant_plan,
    user: {
      id: user.id, name: user.name, initials: user.initials, email: user.email,
      phone: user.phone, role: user.role, access_json: user.access_json,
      status: user.status, restaurant_id: user.restaurant_id,
    },
  };
}

// GET /api/auth/google/config — lets clients discover the mode without a rebuild.
router.get('/google/config', (_req, res) => {
  res.json({
    enabled: isGoogleAuthConfigured(),
    client_id: googleWebClientId(),
    ios_client_id: googleIosClientId(),
    trial_days: TRIAL_DAYS,
  });
});

// POST /api/auth/google — exchange a verified Google ID token for a session.
router.post('/google', async (req, res, next) => {
  try {
    if (!isGoogleAuthConfigured()) {
      res.status(503).json({ error: 'Google sign-in is not enabled.', code: 'GOOGLE_DISABLED' });
      return;
    }
    const { id_token } = z.object({ id_token: z.string().min(16).max(8192) }).parse(req.body);

    let identity;
    try {
      identity = await verifyGoogleIdToken(id_token);
    } catch {
      // Never echo the verifier's reason — it distinguishes "bad signature" from
      // "wrong audience" and helps an attacker probe the configuration.
      res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
      return;
    }

    const rows = await findUsersForLogin({ kind: 'email', value: identity.email });
    const active = rows.rows.filter((r) => String((r as Record<string, unknown>).status) !== 'off');

    if (!active.length) {
      if (rows.rows.length) {
        res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
        return;
      }
      // A new Google user can start a trial right away. Google proved the address, but the
      // restaurant details are unknown, so hand back a short-lived signup token and let the
      // client ask for them (POST /google/signup). Nothing is created yet.
      res.json({
        status: 'signup_required' as const,
        signup_token: signGoogleSignupToken(identity.email, identity.name),
        email: identity.email,
        name: identity.name ?? '',
        trial_days: TRIAL_DAYS,
      });
      return;
    }

    if (active.length > 1) {
      // The same email can belong to accounts in several restaurants, and Google
      // proves only the address — so the user picks which one to enter. This is
      // a normal outcome, not an error, so it is a 200 with a discriminator.
      res.json({
        status: 'choose_account' as const,
        selection_token: signGoogleSelectToken(identity.email),
        accounts: active.map((r) => {
          const u = r as Record<string, unknown>;
          return {
            restaurant_id: u.restaurant_id,
            restaurant_name: u.restaurant_name,
            role: u.role,
            name: u.name,
          };
        }),
      });
      return;
    }

    const user = await issueLoginSession(getDb(), String((active[0] as Record<string, unknown>).id));
    res.json(sessionResponse(user));
  } catch (e) { next(e); }
});

const GoogleSignupSchema = z.object({
  signup_token: z.string().min(16).max(4096),
  restaurant_name: z.string().trim().min(2).max(80),
  owner_name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().min(8).max(40),
  timezone: z.string().max(80).optional(),
});

// POST /api/auth/google/signup — a new Google user starts a trial restaurant on the top plan.
router.post('/google/signup', async (req, res, next) => {
  try {
    const data = GoogleSignupSchema.parse(req.body);

    let claims: GoogleSignupClaims;
    try {
      claims = jwt.verify(data.signup_token, JWT_SECRET) as GoogleSignupClaims;
    } catch {
      res.status(401).json({ error: 'That sign-up took too long. Please continue with Google again.' });
      return;
    }
    if (claims.purpose !== 'google_signup' || !claims.email) {
      res.status(401).json({ error: 'That sign-up took too long. Please continue with Google again.' });
      return;
    }

    const phone = normalizePhone(data.phone);
    if (!isValidPhoneE164(phone)) {
      res.status(400).json({ error: 'Enter your mobile number with the country code, e.g. +91 98765 43210' });
      return;
    }

    const db = getDb();
    const [emailTaken, phoneTaken] = await Promise.all([
      db.execute({ sql: 'SELECT id FROM users WHERE LOWER(email)=? LIMIT 1', args: [claims.email] }),
      db.execute({ sql: 'SELECT id FROM users WHERE phone=? LIMIT 1', args: [phone] }),
    ]);
    if (emailTaken.rows.length) {
      res.status(409).json({ error: 'Your restaurant is already set up. Continue with Google to sign in.', code: 'ACCOUNT_EXISTS' });
      return;
    }
    if (phoneTaken.rows.length) {
      res.status(409).json({ error: 'This mobile number is already registered. Sign in with it, or use a different number.', code: 'PHONE_EXISTS' });
      return;
    }

    const { ownerId } = await createTrialRestaurant({
      restaurantName: data.restaurant_name,
      ownerName: data.owner_name || claims.name || claims.email.split('@')[0]!,
      email: claims.email,
      phone,
      plan: TOP_PLAN,
      timezone: data.timezone,
    });
    const user = await issueLoginSession(db, ownerId);
    res.status(201).json(sessionResponse(user));
  } catch (e) { next(e); }
});

// POST /api/auth/google/select — finish sign-in after the user picks a restaurant.
router.post('/google/select', async (req, res, next) => {
  try {
    const { selection_token, restaurant_id } = z.object({
      selection_token: z.string().min(16).max(4096),
      restaurant_id: z.string().min(1).max(64),
    }).parse(req.body);

    let claims: GoogleSelectClaims;
    try {
      claims = jwt.verify(selection_token, JWT_SECRET) as GoogleSelectClaims;
    } catch {
      res.status(401).json({ error: 'That sign-in attempt expired. Please try again.' });
      return;
    }
    if (claims.purpose !== 'google_select' || !claims.email) {
      res.status(401).json({ error: 'That sign-in attempt expired. Please try again.' });
      return;
    }

    // Re-resolve from the signed email — never trust a client-supplied identity.
    const rows = await getDb().execute({
      sql: `SELECT u.id, u.status FROM users u
            WHERE LOWER(u.email)=? AND u.restaurant_id=? LIMIT 1`,
      args: [claims.email, restaurant_id],
    });
    const row = rows.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'That account is no longer available.' });
      return;
    }
    if (String(row.status) === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }

    const user = await issueLoginSession(getDb(), String(row.id));
    res.json(sessionResponse(user));
  } catch (e) { next(e); }
});

export default router;
