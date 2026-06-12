import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { isValidPhoneE164, normalizePhone } from '../services/sms.js';
import { trialEndsAt, TRIAL_DAYS } from '../config/site.js';

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
  phone:           z.string().min(8),
  password:        z.string().min(8),
  plan:            z.enum(['basic','pro','premium']).optional(),
  timezone:        z.string().optional(),
});

const trimString = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : String(v ?? '').trim();

const optionalText = (max: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    const t = trimString(v);
    return t;
  }, z.string().max(max).optional());

const optionalEmail = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  const t = trimString(v);
  return t === '' ? '' : t.toLowerCase();
}, z.string().email().or(z.literal('')).optional());

const optionalUrl = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  const t = trimString(v);
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return `https://${t}`;
  return t;
}, z.string().url().or(z.literal('')).optional());

const optionalPercent = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const parsed = Number(t);
    return Number.isFinite(parsed) ? parsed : v;
  }
  return v;
}, z.number().min(0).max(100).nullable().optional());

const UpdateRestaurantSchema = z.object({
  name:          z.preprocess((v) => trimString(v), z.string().min(1)).optional(),
  timezone:      optionalText(80),
  logo_url:      LogoUrlSchema.optional(),
  contact_phone: optionalText(40),
  contact_email: optionalEmail,
  address_line1: optionalText(160),
  address_line2: optionalText(160),
  city:          optionalText(80),
  country:       optionalText(80),
  postal_code:   optionalText(24),
  tax_id:        optionalText(80),
  website_url:   optionalUrl,
  currency_code: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'PKR', 'BDT', 'NGN', 'ZAR']).optional(),
  language_code: z.enum(['en', 'ar', 'fr', 'es', 'de', 'hi', 'ur']).optional(),
  date_format:   z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  service_charge_pct: optionalPercent,
  tax_rate_pct:       optionalPercent,
  tax_type:           optionalText(40),
  tax_included: z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true') return true;
    if (v === 0 || v === '0' || v === 'false') return false;
    return v;
  }, z.boolean().optional()),
  receipt_footer:     optionalText(180),
  kitchen_printer: z.object({
    role: z.literal('kitchen').optional(),
    channel: z.enum(['bluetooth', 'usb']),
    name: z.preprocess((v) => trimString(v), z.string().min(1).max(140)),
  }).nullable().optional(),
  cashier_printer: z.object({
    role: z.literal('cashier').optional(),
    channel: z.enum(['bluetooth', 'usb']),
    name: z.preprocess((v) => trimString(v), z.string().min(1).max(140)),
  }).nullable().optional(),
});

function parsePrinter(raw: unknown, role: 'kitchen' | 'cashier') {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw)) as { channel?: string; name?: string; role?: string };
    if ((parsed.channel !== 'bluetooth' && parsed.channel !== 'usb') || !parsed.name) return null;
    return { role, channel: parsed.channel, name: parsed.name };
  } catch {
    return null;
  }
}

function normalizeRestaurantRow(row: Record<string, unknown>) {
  return {
    ...row,
    kitchen_printer: parsePrinter(row.kitchen_printer_json, 'kitchen'),
    cashier_printer: parsePrinter(row.cashier_printer_json, 'cashier'),
  };
}

// POST /api/restaurants/onboarding — public, creates restaurant + owner user
router.post('/onboarding', async (req, res, next) => {
  try {
    const data = OnboardingSchema.parse(req.body);
    const db = getDb();
    const emailNorm = data.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(data.phone);
    if (!isValidPhoneE164(phoneNorm)) {
      res.status(400).json({ error: 'Phone must be in international format (e.g. +971500000000)' });
      return;
    }

    const existingAccount = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(email)=? LIMIT 1`,
      args: [emailNorm],
    });
    if (existingAccount.rows.length) {
      res.status(409).json({
        error: 'Account already exists for this email. Use forgot password to recover access.',
        code: 'ACCOUNT_EXISTS_USE_FORGOT_PASSWORD',
      });
      return;
    }
    const existingPhone = await db.execute({
      sql: `SELECT id FROM users WHERE phone=? LIMIT 1`,
      args: [phoneNorm],
    });
    if (existingPhone.rows.length) {
      res.status(409).json({
        error: 'An account already exists for this phone number.',
        code: 'ACCOUNT_EXISTS_USE_PHONE_LOGIN',
      });
      return;
    }

    const restId = uid();
    const slug = data.restaurant_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    // New sign-ups start on a full-featured trial plan (default premium).
    const trialPlan = (data.plan as 'basic' | 'pro' | 'premium') || 'premium';
    await db.execute({
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
      args: [restId, data.restaurant_name, `${slug}-${restId.slice(0,6)}`, trialPlan, data.timezone??'UTC'],
    });

    const ownerId = uid();
    const pwHash = await bcrypt.hash(data.password, 10);
    const initials = data.owner_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    await db.execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,phone,password_hash,role,status,start_time) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      args: [ownerId, restId, data.owner_name, initials, emailNorm, phoneNorm, pwHash, 'owner', 'active', '—'],
    });

    // Start a TRIAL_DAYS free trial: an activated, time-limited license. Once it
    // expires, requireActiveSubscription blocks gated routes until renewal.
    await db.execute({
      sql: `INSERT INTO license_keys(id,key_code,plan,restaurant_id,activated_at,expires_at,note) VALUES(?,?,?,?,?,?,?)`,
      args: [uid(), `TRIAL-${uid().replace(/-/g, '').slice(0, 12).toUpperCase()}`, trialPlan, restId, new Date().toISOString(), trialEndsAt(), `Auto ${TRIAL_DAYS}-day trial`],
    });

    const restaurant = await db.execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [restId] });
    const user = await db.execute({ sql: 'SELECT id,name,initials,email,role,status FROM users WHERE id=?', args: [ownerId] });

    const token = signToken({ id: ownerId, role: 'owner', email: emailNorm, restaurant_id: restId });

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
    res.json(normalizeRestaurantRow(row.rows[0] as Record<string, unknown>));
  } catch (e) { next(e); }
});

// PUT /api/restaurants/me — requireAuth, updates name/timezone
router.put('/me', requireAuth, requireRole('owner', 'manager', 'cashier', 'kitchen', 'waiter'), async (req: AuthRequest, res, next) => {
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
    if (data.currency_code !== undefined) { sets.push('currency_code=?'); args.push(data.currency_code); }
    if (data.language_code !== undefined) { sets.push('language_code=?'); args.push(data.language_code); }
    if (data.date_format   !== undefined) { sets.push('date_format=?');   args.push(data.date_format); }
    if (data.service_charge_pct !== undefined) { sets.push('service_charge_pct=?'); args.push(data.service_charge_pct); }
    if (data.tax_rate_pct       !== undefined) { sets.push('tax_rate_pct=?');       args.push(data.tax_rate_pct); }
    if (data.tax_type           !== undefined) { sets.push('tax_type=?');           args.push(data.tax_type); }
    if (data.tax_included       !== undefined) { sets.push('tax_included=?');       args.push(data.tax_included ? 1 : 0); }
    if (data.receipt_footer     !== undefined) { sets.push('receipt_footer=?');     args.push(data.receipt_footer || null); }
    if (data.kitchen_printer    !== undefined) { sets.push('kitchen_printer_json=?'); args.push(data.kitchen_printer ? JSON.stringify({ ...data.kitchen_printer, role: 'kitchen' }) : null); }
    if (data.cashier_printer    !== undefined) { sets.push('cashier_printer_json=?'); args.push(data.cashier_printer ? JSON.stringify({ ...data.cashier_printer, role: 'cashier' }) : null); }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    args.push(rid);
    await getDb().execute({ sql: `UPDATE restaurants SET ${sets.join(',')} WHERE id=?`, args });
    const row = await getDb().execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [rid] });
    res.json(normalizeRestaurantRow(row.rows[0] as Record<string, unknown>));
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
