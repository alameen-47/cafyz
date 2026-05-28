import { Router } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { TRIAL_DAYS, appPath, trialEndsDateLabel } from '../config/site.js';

const router = Router();
const onlyFounder = [requireAuth, requireRole('founder')] as const;
const ADMIN_EMAIL = 'ametronyxx@gmail.com';
const LOGIN_URL = appPath('/login');

function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });
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
    }).parse(req.body);

    const sets: string[] = ['updated_at=datetime(\'now\')'];
    const args: (string | number | null)[] = [];
    if (data.panels_json   !== undefined) { sets.push('panels_json=?');   args.push(data.panels_json); }
    if (data.label         !== undefined) { sets.push('label=?');         args.push(data.label); }
    if (data.description   !== undefined) { sets.push('description=?');   args.push(data.description); }
    if (data.price_monthly !== undefined) { sets.push('price_monthly=?'); args.push(data.price_monthly); }
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
    const [rests, keys, users] = await Promise.all([
      db.execute(`SELECT plan, COUNT(*) as count FROM restaurants WHERE id != 'CAFYZ_SYSTEM' GROUP BY plan`),
      db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN restaurant_id IS NOT NULL THEN 1 ELSE 0 END) as activated FROM license_keys WHERE is_active=1`),
      db.execute(`SELECT COUNT(*) as total FROM users WHERE role != 'founder'`),
    ]);
    res.json({
      restaurants_by_plan: rests.rows,
      license_keys:        keys.rows[0],
      total_users:         users.rows[0]?.total ?? 0,
    });
  } catch (e) { next(e); }
});

// GET /api/founder/inquiries — list trial requests
router.get('/inquiries', ...onlyFounder, async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT id,name,restaurant_name,email,plan,message,status,is_retry,retry_of_id,created_at,approved_at,denied_at
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
      sql: `SELECT id,status,name,restaurant_name,email,plan FROM inquiries WHERE id=?`,
      args: [id],
    });
    if (!row.rows.length) { res.status(404).json({ error: 'Inquiry not found' }); return; }
    const current = String(row.rows[0].status ?? '');
    if (current !== 'pending') { res.json({ id, status: current }); return; }
    await db.execute({
      sql: status === 'approved'
        ? `UPDATE inquiries SET status='approved', approved_at=datetime('now') WHERE id=?`
        : `UPDATE inquiries SET status='denied', denied_at=datetime('now') WHERE id=?`,
      args: [id],
    });

    const inquiry = row.rows[0] as Record<string, unknown>;
    const transporter = buildTransporter();
    if (transporter && status === 'approved') {
      const first = String(inquiry.name ?? 'there').split(' ')[0];
      const restaurant = String(inquiry.restaurant_name ?? 'your restaurant');
      const plan = String(inquiry.plan ?? 'basic').toUpperCase();
      const trialEnd = trialEndsDateLabel();
      await Promise.all([
        transporter.sendMail({
          from: `"Cafyz System" <${process.env.SMTP_USER}>`,
          to: ADMIN_EMAIL,
          subject: `[Cafyz] Trial confirmed — ${restaurant} (${plan})`,
          html: `<p>Founder confirmed a trial request.</p>
                 <p><b>Restaurant:</b> ${restaurant}<br/>
                 <b>Contact:</b> ${String(inquiry.name)} (${String(inquiry.email)})<br/>
                 <b>Plan:</b> ${plan}<br/>
                 <b>Trial:</b> ${TRIAL_DAYS} days (target end: ${trialEnd})</p>
                 <p>Login URL to share: <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>`,
        }),
        transporter.sendMail({
          from: `"Cafyz" <${process.env.SMTP_USER}>`,
          to: String(inquiry.email),
          replyTo: ADMIN_EMAIL,
          subject: `Approved: your ${TRIAL_DAYS}-day Cafyz trial for ${restaurant} ✓`,
          html: `<p>Hi ${first}, your trial request is approved.</p>
                 <p>You now have a <b>${TRIAL_DAYS}-day free trial</b> on the ${plan} plan.</p>
                 <p>Login link: <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>
                 <p>Our founder will send your credentials/license details shortly.</p>`,
        }),
      ]);
    }

    res.json({ id, status });
  } catch (e) { next(e); }
});

export default router;
