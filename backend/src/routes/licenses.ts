import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { getDb } from '../db.js';
import { APP_URL } from '../config/site.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uid } from '../utils.js';
import { appPath, trialEndsAt, TRIAL_DAYS } from '../config/site.js';
import { ADMIN_EMAIL, sendMailReliable, smtpFrom, founderFrom, founderReplyTo } from '../services/email.js';
import {
  denyLicensePurchaseRequest,
  fulfillLicensePurchaseRequest,
  generateKeyCode,
  getPlanConfigSummary,
  sha256Token,
  verifyActionToken,
} from '../services/licensePurchaseFulfillment.js';
import { escHtml, requestActionHtml } from '../utils/requestActionHtml.js';

const router = Router();
const LOGIN_URL = appPath('/login');
const FOUNDER_URL = appPath('/founder');

function renewalBaseUrl(req: AuthRequest | { headers: Record<string, unknown> }): string {
  if (process.env.NODE_ENV === 'production' && APP_URL) return APP_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http');
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:4000');
  return `${proto}://${host}`;
}

// GET /api/licenses/renewal/action — founder approve/deny from email (mounted without auth in app.ts)
export async function licenseRenewalAction(req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) {
  try {
    const id = String(req.query.id ?? '');
    const token = String(req.query.token ?? '');
    const action = String(req.query.action ?? '');
    if (!id || !token || !['approve', 'deny'].includes(action)) {
      res.status(400).send(requestActionHtml('Invalid link', 'This renewal link is missing required parameters.'));
      return;
    }

    const rowRes = await getDb().execute({
      sql: `SELECT id, status, token_hash FROM license_purchase_requests WHERE id=? LIMIT 1`,
      args: [id],
    });
    const row = rowRes.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).send(requestActionHtml('Not found', 'This renewal request no longer exists.'));
      return;
    }
    if (!verifyActionToken(String(row.token_hash ?? ''), token)) {
      res.status(403).send(requestActionHtml('Invalid token', 'This confirmation token is not valid.'));
      return;
    }
    if (String(row.status) !== 'pending') {
      res.status(200).send(requestActionHtml('Already processed', `This request is already <strong>${escHtml(String(row.status))}</strong>.`));
      return;
    }

    if (action === 'approve') {
      try {
        const result = await fulfillLicensePurchaseRequest(id);
        res.status(200).send(requestActionHtml(
          'Renewal approved',
          `<p>Renewal for <strong>${escHtml(result.restaurantName)}</strong> is approved.</p>
           <p>Plan: <strong>${escHtml(result.plan.toUpperCase())}</strong><br/>
           Active until: <strong>${escHtml(new Date(result.expiresAt).toLocaleString())}</strong></p>
           <p>The owner (${escHtml(result.ownerEmail)}) has been emailed. License is active immediately.</p>`,
        ));
      } catch (err) {
        res.status(500).send(requestActionHtml('Approval failed', escHtml((err as Error).message)));
      }
      return;
    }

    await denyLicensePurchaseRequest(id);
    res.status(200).send(requestActionHtml('Renewal denied', 'The owner has been notified by email.'));
  } catch (e) { next(e); }
}

// POST /api/licenses — founder generates a key
router.post('/', requireAuth, requireRole('founder'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      plan:       z.enum(['basic','pro','premium']),
      expires_at: z.string().optional(),
      note:       z.string().optional(),
      quantity:   z.number().int().min(1).max(50).optional(),
      recipient_email: z.string().email().optional(),
      /** When true and no expires_at, defaults to the standard free-trial end date. */
      trial:      z.boolean().optional(),
    }).parse(req.body);

    const expiresAt = data.expires_at ?? (data.trial === true ? trialEndsAt() : null);

    const qty = data.quantity ?? 1;
    const created = [];
    for (let i = 0; i < qty; i++) {
      const id = uid();
      const keyCode = generateKeyCode(data.plan);
      await getDb().execute({
        sql: `INSERT INTO license_keys(id,key_code,plan,expires_at,note) VALUES(?,?,?,?,?)`,
        args: [id, keyCode, data.plan, expiresAt, data.note ?? null],
      });
      created.push({ id, key_code: keyCode, plan: data.plan, expires_at: expiresAt, note: data.note ?? null });
    }

    if (data.recipient_email) {
      const keysList = created.map(k => k.key_code).join('<br/>');
      await sendMailReliable({
        from: smtpFrom(true),
        to: data.recipient_email,
        replyTo: ADMIN_EMAIL,
        subject: `[Cafyz] Your ${data.plan.toUpperCase()} license key${created.length > 1 ? 's' : ''}`,
        html: `<p>Your Cafyz license key${created.length > 1 ? 's are' : ' is'} ready:</p>
               <p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;line-height:1.7">${keysList}</p>
               <p>Plan: <b>${data.plan.toUpperCase()}</b></p>
               <p>${data.trial ? `Free trial: <b>${TRIAL_DAYS} days</b>${expiresAt ? ` (ends ${new Date(expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' })})` : ''}` : 'License generated by founder.'}</p>
               <p>Login here: <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>
               <p>Need help? Contact <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>`,
      });
    }

    res.status(201).json(qty === 1 ? created[0] : created);
  } catch (e) { next(e); }
});

// GET /api/licenses — founder lists all keys
router.get('/', requireAuth, requireRole('founder'), async (_req, res, next) => {
  try {
    const rows = await getDb().execute(`
      SELECT lk.*, r.name as restaurant_name
      FROM license_keys lk
      LEFT JOIN restaurants r ON r.id = lk.restaurant_id
      ORDER BY lk.created_at DESC
    `);
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/licenses/mine — current restaurant's active license
router.get('/mine', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const [restRow, licRow] = await Promise.all([
      getDb().execute({ sql: 'SELECT plan FROM restaurants WHERE id=?', args: [rid] }),
      getDb().execute({
        sql: `SELECT * FROM license_keys WHERE restaurant_id=? AND is_active=1 ORDER BY activated_at DESC LIMIT 1`,
        args: [rid],
      }),
    ]);
    const license = (licRow.rows[0] ?? null) as Record<string, unknown> | null;
    const expiresAt = String(license?.expires_at ?? '');
    const expiryTs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    const trialExpired = Number.isFinite(expiryTs) ? expiryTs <= Date.now() : false;
    const daysLeft = Number.isFinite(expiryTs) ? Math.max(0, Math.ceil((expiryTs - Date.now()) / 86_400_000)) : null;
    res.json({
      plan:    restRow.rows[0]?.plan ?? 'basic',
      license,
      trial_expires_at: expiresAt || null,
      trial_expired: trialExpired,
      trial_days_left: daysLeft,
      purchase_url: appPath('/license'),
      founder_email: ADMIN_EMAIL,
    });
  } catch (e) { next(e); }
});

// POST /api/licenses/activate — restaurant owner/manager activates a key
router.post('/activate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { key_code } = z.object({ key_code: z.string().min(1) }).parse(req.body);
    const rid = req.user!.restaurant_id;

    if (!['owner','manager'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only owners or managers can activate license keys.' });
      return;
    }

    const db = getDb();
    const row = await db.execute({
      sql: `SELECT * FROM license_keys WHERE key_code=? AND is_active=1 AND restaurant_id IS NULL`,
      args: [key_code.trim().toUpperCase()],
    });
    if (!row.rows.length) {
      res.status(400).json({ error: 'Invalid or already-used license key.' });
      return;
    }
    const key = row.rows[0] as Record<string, unknown>;

    // Check expiry
    if (key.expires_at && new Date(String(key.expires_at)) < new Date()) {
      res.status(400).json({ error: 'This license key has expired.' });
      return;
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE license_keys SET restaurant_id=?, activated_at=? WHERE id=?`,
      args: [rid, now, String(key.id)],
    });
    await db.execute({
      sql: `UPDATE restaurants SET plan=? WHERE id=?`,
      args: [String(key.plan), rid],
    });

    // Invalidate middleware caches so the new plan and subscription status
    // take effect immediately without waiting for TTL expiry.
    const { cacheDel } = await import('../cache.js');
    cacheDel(`plan:${rid}`);
    cacheDel(`sub:${rid}`);

    const updated = await db.execute({ sql: 'SELECT plan FROM restaurants WHERE id=?', args: [rid] });
    res.json({ success: true, plan: updated.rows[0]?.plan, activated_at: now });
  } catch (e) { next(e); }
});

// POST /api/licenses/purchase-request — owner requests renewal (emails founder with approve/deny)
router.post('/purchase-request', requireAuth, requireRole('owner'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      plan:  z.enum(['basic', 'pro', 'premium']),
      email: z.string().email().optional(),
      note:  z.string().max(500).optional(),
    }).parse(req.body);

    const rid = req.user!.restaurant_id;
    const db = getDb();
    const email = (data.email ?? req.user!.email).trim().toLowerCase();

    const pending = await db.execute({
      sql: `SELECT id FROM license_purchase_requests WHERE restaurant_id=? AND status='pending' LIMIT 1`,
      args: [rid],
    });
    if (pending.rows.length) {
      res.status(409).json({ error: 'You already have a pending renewal request.' });
      return;
    }

    const rest = await db.execute({ sql: 'SELECT name FROM restaurants WHERE id=?', args: [rid] });
    const restaurantName = String(rest.rows[0]?.name ?? 'Restaurant');
    const cfg = await getPlanConfigSummary(data.plan);
    const priceLabel = cfg
      ? `${cfg.currency_symbol ?? '$'}${cfg.price_monthly}/${cfg.billing_interval_count ?? 1} ${cfg.billing_interval_unit ?? 'month'}`
      : '';

    const id = uid();
    const token = randomBytes(24).toString('hex');
    const tokenHash = sha256Token(token);

    await db.execute({
      sql: `INSERT INTO license_purchase_requests(id,restaurant_id,requester_user_id,email,plan,note,token_hash) VALUES(?,?,?,?,?,?,?)`,
      args: [id, rid, req.user!.id, email, data.plan, data.note ?? null, tokenHash],
    });

    const base = renewalBaseUrl(req);
    const approveUrl = `${base}/api/licenses/renewal/action?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&action=approve`;
    const denyUrl = `${base}/api/licenses/renewal/action?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&action=deny`;

    await sendMailReliable({
      from: founderFrom(),
      replyTo: email,
      to: ADMIN_EMAIL,
      subject: `[Cafyz] Renewal request — ${restaurantName} (${data.plan.toUpperCase()})`,
      html: `<div style="font-family:system-ui,sans-serif;color:#0f172a;max-width:560px">
        <p><b>${escHtml(restaurantName)}</b> (owner: <a href="mailto:${escHtml(email)}">${escHtml(email)}</a>) requested renewal.</p>
        <p><b>Plan:</b> ${data.plan.toUpperCase()}${priceLabel ? ` · ${escHtml(String(priceLabel))}` : ''}<br/>
        ${cfg?.description ? `<b>Includes:</b> ${escHtml(String(cfg.description))}<br/>` : ''}
        ${data.note ? `<b>Note:</b> ${escHtml(data.note)}<br/>` : ''}</p>
        <p style="margin:22px 0;display:flex;gap:10px;flex-wrap:wrap">
          <a href="${approveUrl}" style="background:#22c55e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Approve renewal</a>
          <a href="${denyUrl}" style="background:#ef4444;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Deny</a>
        </p>
        <p style="font-size:12px;color:#64748b">Or fulfill in <a href="${FOUNDER_URL}">Founder Panel → License Requests</a>.</p>
      </div>`,
    });

    await sendMailReliable({
      from: founderFrom(),
      replyTo: founderReplyTo(),
      to: email,
      subject: `[Cafyz] Renewal request received — ${restaurantName}`,
      html: `<p>We received your renewal request for the <b>${data.plan.toUpperCase()}</b> plan.</p>
             <p>Cafyz will review it shortly. You'll receive another email once it's approved or if we need more information.</p>
             <p>Contact: <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a></p>`,
    });

    res.status(201).json({ id, status: 'pending', plan: data.plan, email, founder_email: ADMIN_EMAIL });
  } catch (e) { next(e); }
});

// GET /api/licenses/purchase-requests/mine — restaurant's license requests
router.get('/purchase-requests/mine', requireAuth, requireRole('owner', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const rows = await getDb().execute({
      sql: `SELECT id,plan,email,status,note,created_at,fulfilled_at FROM license_purchase_requests
            WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 20`,
      args: [req.user!.restaurant_id],
    });
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// DELETE /api/licenses/:id — founder revokes a key
router.delete('/:id', requireAuth, requireRole('founder'), async (req, res, next) => {
  try {
    await getDb().execute({
      sql: `UPDATE license_keys SET is_active=0 WHERE id=?`,
      args: [String(req.params.id)],
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
