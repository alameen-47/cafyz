import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { fulfillLicensePurchaseRequest, denyLicensePurchaseRequest } from '../services/licensePurchaseFulfillment.js';
import { appPath } from '../config/site.js';
import { approveInquiryById } from '../services/inquiryApproval.js';
import { ADMIN_EMAIL, sendMailReliable, smtpFrom } from '../services/email.js';

const router = Router();
const onlyFounder = [requireAuth, requireRole('founder')] as const;
const LOGIN_URL = appPath('/login');
const FOUNDER_URL = appPath('/founder');

function generateKeyCode(plan: string): string {
  const prefix = plan.toUpperCase().slice(0, 3);
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `CAFYZ-${prefix}-${rand}`;
}

// GET /api/founder/restaurants — all restaurants with stats
router.get('/restaurants', ...onlyFounder, async (_req: AuthRequest, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT r.*,
        (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id AND u.role != 'founder') as user_count,
        (SELECT key_code FROM license_keys lk WHERE lk.restaurant_id = r.id AND lk.is_active=1 ORDER BY lk.activated_at DESC LIMIT 1) as active_key
      FROM restaurants r
      WHERE r.id != 'CAFYZ_SYSTEM'
      ORDER BY r.created_at DESC
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// PATCH /api/founder/restaurants/:id/plan — override a restaurant's plan directly
router.patch('/restaurants/:id/plan', ...onlyFounder, async (req: AuthRequest, res, next) => {
  try {
    const { plan } = z.object({ plan: z.enum(['basic','pro','premium']) }).parse(req.body);
    const db = getDb();
    const rid = String(req.params.id);
    await db.execute({ sql: `UPDATE restaurants SET plan=? WHERE id=?`, args: [plan, rid] });
    const row = await db.execute({ sql: 'SELECT * FROM restaurants WHERE id=?', args: [rid] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/founder/restaurants/:id — hard-delete a restaurant tenant
router.delete('/restaurants/:id', ...onlyFounder, async (req: AuthRequest, res, next) => {
  try {
    const rid = String(req.params.id);
    if (!rid || rid === 'CAFYZ_SYSTEM') {
      res.status(400).json({ error: 'This restaurant cannot be deleted.' });
      return;
    }

    const db = getDb();
    const existing = await db.execute({
      sql: `SELECT id, name FROM restaurants WHERE id=? LIMIT 1`,
      args: [rid],
    });
    if (!existing.rows.length) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    await db.execute({
      sql: `DELETE FROM restaurants WHERE id=?`,
      args: [rid],
    });

    res.json({ ok: true, id: rid });
  } catch (e) { next(e); }
});

// GET /api/founder/plan-config — get plan feature configuration
router.get('/plan-config', ...onlyFounder, async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`SELECT * FROM plan_config ORDER BY price_monthly ASC`);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// PUT /api/founder/plan-config/:plan — update a plan's feature set
router.put('/plan-config/:plan', ...onlyFounder, async (req: AuthRequest, res, next) => {
  try {
    const planName = z.enum(['basic','pro','premium']).parse(req.params.plan);
    const data = z.object({
      panels_json:   z.string().min(2).optional(),
      label:         z.string().optional(),
      description:   z.string().optional(),
      price_monthly: z.number().optional(),
      currency_symbol: z.string().min(1).max(4).optional(),
      billing_interval_unit: z.enum(['month', 'year']).optional(),
      billing_interval_count: z.number().int().min(1).max(60).optional(),
    }).parse(req.body);

    const sets: string[] = ['updated_at=datetime(\'now\')'];
    const args: (string | number | null)[] = [];
    if (data.panels_json   !== undefined) { sets.push('panels_json=?');   args.push(data.panels_json); }
    if (data.label         !== undefined) { sets.push('label=?');         args.push(data.label); }
    if (data.description   !== undefined) { sets.push('description=?');   args.push(data.description); }
    if (data.price_monthly !== undefined) { sets.push('price_monthly=?'); args.push(data.price_monthly); }
    if (data.currency_symbol !== undefined) { sets.push('currency_symbol=?'); args.push(data.currency_symbol); }
    if (data.billing_interval_unit !== undefined) { sets.push('billing_interval_unit=?'); args.push(data.billing_interval_unit); }
    if (data.billing_interval_count !== undefined) { sets.push('billing_interval_count=?'); args.push(data.billing_interval_count); }
    args.push(planName);

    await getDb().execute({ sql: `UPDATE plan_config SET ${sets.join(',')} WHERE plan=?`, args });
    const row = await getDb().execute({ sql: 'SELECT * FROM plan_config WHERE plan=?', args: [planName] });
    res.json(row.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/founder/stats — system-wide stats
router.get('/stats', ...onlyFounder, async (_req, res, next) => {
  try {
    const db = getDb();
    const [rests, keys, users, pendingLic] = await Promise.all([
      db.execute(`SELECT plan, COUNT(*) as count FROM restaurants WHERE id != 'CAFYZ_SYSTEM' GROUP BY plan`),
      db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN restaurant_id IS NOT NULL THEN 1 ELSE 0 END) as activated FROM license_keys WHERE is_active=1`),
      db.execute(`SELECT COUNT(*) as total FROM users WHERE role != 'founder'`),
      db.execute(`SELECT COUNT(*) as pending FROM license_purchase_requests WHERE status='pending'`),
    ]);
    res.json({
      restaurants_by_plan: rests.rows,
      license_keys:        keys.rows[0],
      total_users:         users.rows[0]?.total ?? 0,
      pending_license_requests: pendingLic.rows[0]?.pending ?? 0,
    });
  } catch (e) { next(e); }
});

// GET /api/founder/inquiries — list trial requests
router.get('/inquiries', ...onlyFounder, async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT id,name,restaurant_name,email,plan,message,status,is_retry,retry_of_id,restaurant_id,created_at,approved_at,denied_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 300
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// PATCH /api/founder/inquiries/:id — approve/deny from founder panel
router.patch('/inquiries/:id', ...onlyFounder, async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['approved', 'denied']) }).parse(req.body);
    const id = String(req.params.id);
    const db = getDb();
    const row = await db.execute({
      sql: `SELECT id,status FROM inquiries WHERE id=?`,
      args: [id],
    });
    if (!row.rows.length) { res.status(404).json({ error: 'Inquiry not found' }); return; }
    const current = String(row.rows[0].status ?? '');
    if (current !== 'pending') { res.json({ id, status: current }); return; }

    if (status === 'approved') {
      const provision = await approveInquiryById(id);
      res.json({
        id,
        status: 'approved',
        provisioned: true,
        alreadyProvisioned: provision.alreadyProvisioned,
        emailSent: provision.emailSent,
        emailError: provision.emailError,
        // Credentials returned so founder can manually forward if email delivery failed.
        userEmail:    provision.email,
        userPassword: provision.alreadyProvisioned ? null : provision.password,
        licenseKey:   provision.licenseKey,
      });
      return;
    }

    await db.execute({
      sql: `UPDATE inquiries SET status='denied', denied_at=datetime('now') WHERE id=?`,
      args: [id],
    });
    res.json({ id, status: 'denied' });
  } catch (e) { next(e); }
});

// GET /api/founder/license-requests — pending license purchase requests
router.get('/license-requests', ...onlyFounder, async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT lpr.*, r.name as restaurant_name
      FROM license_purchase_requests lpr
      JOIN restaurants r ON r.id = lpr.restaurant_id
      ORDER BY lpr.created_at DESC
      LIMIT 200
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/founder/license-requests/:id/fulfill — approve renewal (auto-activate license)
router.post('/license-requests/:id/fulfill', ...onlyFounder, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const result = await fulfillLicensePurchaseRequest(id);
    res.json({ id, status: 'fulfilled', key_code: result.keyCode, license_id: result.licenseId, plan: result.plan });
  } catch (e) { next(e); }
});

// PATCH /api/founder/license-requests/:id — cancel/deny request
router.patch('/license-requests/:id', ...onlyFounder, async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['cancelled', 'denied']) }).parse(req.body);
    const id = String(req.params.id);
    if (body.status === 'denied') {
      await denyLicensePurchaseRequest(id);
      res.json({ id, status: 'cancelled' });
      return;
    }
    await getDb().execute({
      sql: `UPDATE license_purchase_requests SET status=? WHERE id=? AND status='pending'`,
      args: [body.status, id],
    });
    res.json({ id, status: body.status });
  } catch (e) { next(e); }
});

export default router;
