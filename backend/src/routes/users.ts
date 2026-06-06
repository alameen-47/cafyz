import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { sendMailReliable, smtpFrom } from '../services/email.js';
import { appPath } from '../config/site.js';
import { isValidPhoneE164, normalizePhone, sendOtpSms } from '../services/sms.js';
import {
  defaultAccessForRole,
  parseAccessJson,
  sanitizeAccessMap,
  serializeAccessMap,
} from '../services/sectionAccess.js';

const router = Router();
router.use(requireAuth);

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendUserPinEmail(data: {
  to: string;
  userName: string;
  role: string;
  restaurantName: string;
  pin: string;
  password: string;
}) {
  const subject = `Your Cafyz account credentials (${data.role})`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111827">
      <h2 style="margin:0 0 12px">Your role login is ready</h2>
      <p style="margin:0 0 10px">Hi ${data.userName},</p>
      <p style="margin:0 0 10px">
        You were added to <strong>${data.restaurantName}</strong> as <strong>${data.role}</strong>.
      </p>
      <p style="margin:0 0 8px">Use this 4-digit PIN to log in:</p>
      <div style="display:inline-block;font-size:28px;font-weight:700;letter-spacing:4px;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb">
        ${data.pin}
      </div>
      <p style="margin:14px 0 8px">Use this email/password for full sign-in and device registration:</p>
      <p style="margin:0 0 0;font-size:14px;line-height:1.6">
        Email: <strong>${data.to}</strong><br />
        Password: <strong>${data.password}</strong>
      </p>
      <p style="margin:14px 0 0;font-size:13px;color:#4b5563">
        Open: <a href="${appPath('/login')}" target="_blank" rel="noreferrer">${appPath('/login')}</a>
      </p>
    </div>
  `;

  return sendMailReliable({
    from: smtpFrom(false),
    to: data.to,
    subject,
    html,
  });
}

const UserSchema = z.object({
  name:       z.string().min(2),
  initials:   z.string().max(3).optional(),
  email:      z.string().email(),
  phone:      z.string().min(8).optional(),
  password:   z.string().min(6).optional(),
  role:       z.enum(['manager','cashier','waiter','kitchen']),
  status:     z.enum(['active','break','off']).optional(),
  start_time: z.string().optional(),
  pin:        z.string().length(4).optional(),
  access_json: z.union([
    z.string(),
    z.record(z.string(), z.enum(['none', 'view', 'edit'])),
  ]).optional(),
});

function resolveAccessJson(
  role: string,
  raw?: string | Record<string, 'none' | 'view' | 'edit'>,
  fallbackRaw?: unknown,
) {
  if (typeof raw === 'string') {
    const parsed = parseAccessJson(raw);
    return serializeAccessMap({ ...defaultAccessForRole(role), ...parsed });
  }
  if (raw && typeof raw === 'object') {
    return serializeAccessMap({ ...defaultAccessForRole(role), ...sanitizeAccessMap(raw) });
  }
  const fallbackParsed = parseAccessJson(fallbackRaw);
  return serializeAccessMap({
    ...defaultAccessForRole(role),
    ...fallbackParsed,
  });
}

// GET /api/users
router.get('/', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const rows = await getDb().execute({
      sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,start_time,created_at FROM users WHERE restaurant_id=? ORDER BY name',
      args: [rid],
    });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/users/:id
router.get('/:id', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const row = await getDb().execute({
      sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,start_time,created_at FROM users WHERE id=? AND restaurant_id=?',
      args: [(req.params.id as string), rid],
    });
    if (!row.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/users
router.post('/', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = UserSchema.parse(req.body);
    const id = uid();
    const plainPassword = data.password?.trim() || 'cafyz2026';
    const pw = await bcrypt.hash(plainPassword, 10);
    const generatedPin = generatePin();
    const pinToSave = data.pin ?? generatedPin;
    const ph = await bcrypt.hash(pinToSave, 10);
    const accessJson = resolveAccessJson(data.role, data.access_json);
    const initials = data.initials ?? data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    const emailNorm = data.email.trim().toLowerCase();
    const phoneNorm = data.phone ? normalizePhone(data.phone) : null;
    if (phoneNorm && !isValidPhoneE164(phoneNorm)) {
      res.status(400).json({ error: 'Phone must be in international format (e.g. +971500000000)' });
      return;
    }
    const emailExists = await getDb().execute({
      sql: 'SELECT id FROM users WHERE restaurant_id=? AND LOWER(email)=?',
      args: [rid, emailNorm],
    });
    if (emailExists.rows.length) {
      res.status(409).json({ error: 'A user with this email already exists in your restaurant' });
      return;
    }
    if (phoneNorm) {
      const phoneExists = await getDb().execute({
        sql: 'SELECT id FROM users WHERE phone=?',
        args: [phoneNorm],
      });
      if (phoneExists.rows.length) {
        res.status(409).json({ error: 'A user with this phone number already exists' });
        return;
      }
    }

    await getDb().execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,phone,password_hash,role,access_json,status,start_time,pin_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, rid, data.name, initials, emailNorm, phoneNorm, pw, data.role, accessJson, data.status??'active', data.start_time??'—', ph],
    });
    const restRow = await getDb().execute({ sql: 'SELECT name FROM restaurants WHERE id=?', args: [rid] });
    const restaurantName = String(restRow.rows[0]?.name ?? 'your restaurant');
    const smsResult = phoneNorm
      ? await sendOtpSms(phoneNorm, pinToSave, { context: 'staff_pin', ttlMinutes: 60 })
      : { ok: false as const, error: 'No phone provided' };
    const emailResult = await sendUserPinEmail({
      to: emailNorm,
      userName: data.name,
      role: data.role,
      restaurantName,
      pin: pinToSave,
      password: plainPassword,
    });

    const row = await getDb().execute({ sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,start_time FROM users WHERE id=?', args: [id] });
    const statusParts: string[] = [];
    if (smsResult.ok && phoneNorm) {
      statusParts.push(
        smsResult.details
          ? `PIN SMS sent to ${phoneNorm} (delivery id: ${smsResult.details})`
          : `PIN SMS sent to ${phoneNorm}`,
      );
    }
    else if (phoneNorm) statusParts.push(`PIN SMS failed: ${smsResult.ok ? 'Unknown error' : smsResult.error}`);
    else statusParts.push('PIN SMS skipped: no phone number');
    if (emailResult.ok) statusParts.push(`PIN email sent to ${emailNorm}`);
    else statusParts.push(`PIN email failed (optional): ${emailResult.error}`);

    res.status(201).json({
      ...row.rows[0],
      pin_delivery: {
        sent: smsResult.ok || emailResult.ok,
        sms_sent: phoneNorm ? smsResult.ok : false,
        email_sent: emailResult.ok,
        message: statusParts.join(' · '),
      },
    });
  } catch (e) { next(e); }
});

// PUT /api/users/:id
router.put('/:id', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const data = UserSchema.partial().parse(req.body);
    const db = getDb();
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!existing.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    const target = existing.rows[0] as Record<string, unknown>;
    if (req.user!.role === 'manager' && String(target.role) === 'owner') {
      res.status(403).json({ error: 'Only owner can modify owner accounts' });
      return;
    }

    const sets: string[] = [];
    const args: any[] = [];

    if (data.name)       { sets.push('name=?');       args.push(data.name); }
    if (data.email) {
      const emailNorm = data.email.trim().toLowerCase();
      const emailExists = await db.execute({
        sql: 'SELECT id FROM users WHERE restaurant_id=? AND LOWER(email)=? AND id!=?',
        args: [rid, emailNorm, (req.params.id as string)],
      });
      if (emailExists.rows.length) {
        res.status(409).json({ error: 'A user with this email already exists in your restaurant' });
        return;
      }
      sets.push('email=?');
      args.push(emailNorm);
    }
    if (data.phone) {
      const phoneNorm = normalizePhone(data.phone);
      if (!isValidPhoneE164(phoneNorm)) {
        res.status(400).json({ error: 'Phone must be in international format (e.g. +971500000000)' });
        return;
      }
      const phoneExists = await db.execute({
        sql: 'SELECT id FROM users WHERE phone=? AND id!=?',
        args: [phoneNorm, (req.params.id as string)],
      });
      if (phoneExists.rows.length) {
        res.status(409).json({ error: 'A user with this phone number already exists' });
        return;
      }
      sets.push('phone=?');
      args.push(phoneNorm);
    }
    if (data.role)       { sets.push('role=?');       args.push(data.role); }
    if (data.access_json !== undefined) {
      const nextRole = data.role ?? String(target.role);
      sets.push('access_json=?');
      args.push(resolveAccessJson(nextRole, data.access_json, target.access_json));
    } else if (data.role) {
      sets.push('access_json=?');
      args.push(resolveAccessJson(data.role, undefined, target.access_json));
    }
    if (data.status)     { sets.push('status=?');     args.push(data.status); }
    if (data.start_time) { sets.push('start_time=?'); args.push(data.start_time); }
    if (data.initials)   { sets.push('initials=?');   args.push(data.initials); }
    if (data.password)   { sets.push('password_hash=?'); args.push(await bcrypt.hash(data.password, 10)); }
    if (data.pin)        { sets.push('pin_hash=?');   args.push(await bcrypt.hash(data.pin, 10)); }

    if (!sets.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    args.push((req.params.id as string));
    args.push(rid);
    await db.execute({ sql: `UPDATE users SET ${sets.join(',')} WHERE id=? AND restaurant_id=?`, args });
    const row = await db.execute({ sql: 'SELECT id,restaurant_id,name,initials,email,phone,role,access_json,status,start_time FROM users WHERE id=?', args: [(req.params.id as string)] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const { status } = z.object({ status: z.enum(['active','break','off']) }).parse(req.body);
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id,role FROM users WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    const target = ex.rows[0] as Record<string, unknown>;
    if (req.user!.role === 'manager' && String(target.role) === 'owner') {
      res.status(403).json({ error: 'Only owner can modify owner accounts' });
      return;
    }
    await db.execute({ sql: 'UPDATE users SET status=? WHERE id=? AND restaurant_id=?', args: [status, (req.params.id as string), rid] });
    res.json({ id: (req.params.id as string), status });
  } catch (e) { next(e); }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('owner','manager'), async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const db = getDb();
    const ex = await db.execute({ sql: 'SELECT id,role FROM users WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    if (!ex.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    const target = ex.rows[0] as Record<string, unknown>;
    if (req.user!.role === 'manager' && String(target.role) === 'owner') {
      res.status(403).json({ error: 'Only owner can remove owner accounts' });
      return;
    }
    await db.execute({ sql: 'DELETE FROM users WHERE id=? AND restaurant_id=?', args: [(req.params.id as string), rid] });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
