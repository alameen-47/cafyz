import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { APP_URL, TRIAL_DAYS, TRIAL_REQUEST_COOLDOWN_DAYS, appPath, trialEndsDateLabel } from '../config/site.js';

const router = Router();

const ADMIN_EMAIL = 'ametronyxx@gmail.com';
const FOUNDER_URL = appPath('/founder');
const LOGIN_URL   = appPath('/login');

const InquirySchema = z.object({
  name:           z.string().min(1).max(120),
  restaurant_name: z.string().min(1).max(200),
  email:          z.string().email(),
  plan:           z.enum(['basic', 'pro', 'premium']),
  message:        z.string().max(1000).optional(),
  device_id:      z.string().min(10).max(200),
});

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function baseUrl(req: any): string {
  // In production, enforce configured public URL (custom domain).
  // In dev/test, use the request host so local approval links work.
  if (process.env.NODE_ENV === 'production' && APP_URL) return APP_URL;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host  = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:4000';
  return `${proto}://${host}`;
}

function clientIp(req: any): string {
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return xff || req.ip || req.socket?.remoteAddress || 'unknown';
}

const PLAN_LABELS: Record<string, string> = {
  basic:   `Basic — $49/mo after ${TRIAL_DAYS}-day free trial`,
  pro:     `Pro — $99/mo after ${TRIAL_DAYS}-day free trial`,
  premium: `Premium — $199/mo after ${TRIAL_DAYS}-day free trial`,
};

function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth:   { user, pass },
  });
}

async function isTrialDeviceGuardEnabled(): Promise<boolean> {
  try {
    const row = await getDb().execute({
      sql: `SELECT value FROM app_settings WHERE key='trial_device_guard_enabled' LIMIT 1`,
    });
    return String(row.rows[0]?.value ?? '1') === '1';
  } catch {
    return true;
  }
}

function adminHtml(args: {
  name: string;
  restaurantName: string;
  email: string;
  plan: string;
  message?: string;
  approveUrl: string;
  denyUrl: string;
}) {
  const trialEnd = trialEndsDateLabel();
  const { name, restaurantName, email, plan, message, approveUrl, denyUrl } = args;
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(139,92,246,0.3);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#130F28 0%,#0E0B1C 100%);padding:32px">
    <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Cafyz · New Inquiry · ${esc(APP_URL.replace('https://', ''))}</div>
    <div style="font-family:Georgia,serif;font-size:28px;color:#F5F5F0;margin-bottom:4px">New Account Request</div>
    <div style="font-size:13px;color:#8A8A9A">Trial request is <strong style="color:#F5F5F0">pending</strong> until you confirm below</div>
  </div>
  <div style="padding:28px 32px;background:#0A0816">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px;width:40%">Contact Name</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0">${esc(name)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Restaurant</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0">${esc(restaurantName)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Email</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#8B5CF6"><a href="mailto:${esc(email)}" style="color:#8B5CF6;text-decoration:none">${esc(email)}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Plan Interest</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0"><span style="background:rgba(139,92,246,0.16);color:#8B5CF6;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;text-transform:uppercase">${plan.toUpperCase()}</span>  ${PLAN_LABELS[plan]}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Trial Policy</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#2ECC8A"><strong>${TRIAL_DAYS}-day free trial</strong> on all packages · billing starts after trial (target end: ${trialEnd})</td></tr>
      ${message ? `<tr><td colspan="2" style="padding:16px 0 0"><div style="font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Message</div><div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;font-size:14px;color:#B8B8C2;line-height:1.6">${esc(message)}</div></td></tr>` : ''}
    </table>

    <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
      <a href="${approveUrl}" style="flex:1;min-width:200px;text-align:center;display:inline-block;background:#2ECC8A;color:#04110A;font-size:14px;font-weight:800;text-decoration:none;padding:14px 18px;border-radius:10px;letter-spacing:0.3px">Approve ${TRIAL_DAYS}-Day Trial →</a>
      <a href="${denyUrl}" style="flex:1;min-width:200px;text-align:center;display:inline-block;background:#ef4444;color:#1b0505;font-size:14px;font-weight:800;text-decoration:none;padding:14px 18px;border-radius:10px;letter-spacing:0.3px">Deny Request</a>
    </div>
    <p style="font-size:12px;color:#5A5A6A;margin-top:12px;word-break:break-all">Approve link: ${approveUrl}</p>

    <div style="margin-top:24px;padding:16px;background:rgba(139,92,246,0.08);border:0.5px solid rgba(139,92,246,0.25);border-radius:10px">
      <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Founder checklist</div>
      <div style="font-size:13px;color:#B8B8C2;line-height:1.7">
        <ol style="margin:0;padding-left:18px">
          <li>Click <strong style="color:#F5F5F0">Approve Trial</strong> above to confirm this request.</li>
          <li>Open the <a href="${FOUNDER_URL}" style="color:#8B5CF6">Founder Panel</a> and generate a <strong style="color:#F5F5F0">${plan.toUpperCase()}</strong> license key with expiry set to <strong style="color:#F5F5F0">${trialEnd}</strong> (${TRIAL_DAYS}-day trial).</li>
          <li>Create their restaurant credentials.</li>
          <li>Reply to <a href="mailto:${esc(email)}" style="color:#8B5CF6">${esc(email)}</a> with login URL <a href="${LOGIN_URL}" style="color:#8B5CF6">${LOGIN_URL}</a>, credentials, and license key. Remind them: <strong style="color:#F5F5F0">no charge until the trial ends.</strong></li>
        </ol>
      </div>
    </div>
  </div>
  <div style="padding:16px 32px;background:#07060F;text-align:center;font-size:11px;color:#5A5A6A">Cafyz Hospitality OS · Inquiry received ${new Date().toUTCString()}</div>
</div>
</body>
</html>`;
}

function autoReplyHtml(name: string, restaurantName: string, plan: string) {
  const first = esc(name.split(' ')[0]);
  const trialEnd = trialEndsDateLabel();
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(139,92,246,0.3);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#130F28 0%,#0E0B1C 100%);padding:40px 32px 32px">
    <div style="width:52px;height:52px;background:#8B5CF6;border-radius:14px;line-height:52px;text-align:center;font-family:Georgia,serif;font-size:28px;color:#07060F;font-weight:700;margin-bottom:24px">C</div>
    <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Cafyz Hospitality OS</div>
    <div style="font-family:Georgia,serif;font-size:32px;color:#F5F5F0;line-height:1.2;margin-bottom:12px">We received<br>your request, <em style="color:#8B5CF6;font-style:italic">${first}.</em></div>
    <div style="font-size:14px;color:#8A8A9A;line-height:1.6">Thank you for your interest in Cafyz. Your request is now <strong style="color:#F5F5F0">pending founder approval</strong>. Once approved, you’ll receive a <strong style="color:#2ECC8A">${TRIAL_DAYS}-day free trial</strong> on any plan — no charge until the trial ends.</div>
  </div>
  <div style="padding:32px;background:#0A0816">
    <div style="background:rgba(46,204,138,0.08);border:0.5px solid rgba(46,204,138,0.3);border-radius:12px;padding:20px;margin-bottom:28px">
      <div style="font-size:13px;font-weight:600;color:#2ECC8A;margin-bottom:4px">Request received · awaiting approval</div>
      <div style="font-size:13px;color:#B8B8C2;line-height:1.6">Your request for the <strong style="color:#F5F5F0">${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</strong> for <strong style="color:#F5F5F0">${esc(restaurantName)}</strong> has been received. Once approved, our founder will email you within 24 hours with your login credentials and a trial license key. The trial is <strong style="color:#F5F5F0">${TRIAL_DAYS} days</strong> and billing starts only after it ends (target end: ${trialEnd}).</div>
    </div>
    <div style="font-size:13px;color:#8A8A9A;line-height:1.6;margin-bottom:24px">
      <strong style="color:#F5F5F0;display:block;margin-bottom:8px">What happens next?</strong>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:10px"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;text-align:center;line-height:22px;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">1</div><span>Founder approves your trial request</span></div>
        <div style="display:flex;gap:10px"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;text-align:center;line-height:22px;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">2</div><span>You receive your license key and login credentials — <strong style="color:#F5F5F0">no payment required during the ${TRIAL_DAYS}-day trial</strong></span></div>
        <div style="display:flex;gap:10px"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;text-align:center;line-height:22px;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">3</div><span>After approval, sign in at <a href="${LOGIN_URL}" style="color:#8B5CF6;text-decoration:none">${LOGIN_URL}</a> and activate your key. Billing begins only after the trial ends.</span></div>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:20px">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#8B5CF6;color:#07060F;font-size:13px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px">Go to Sign In →</a>
    </div>
    <div style="border-top:0.5px solid rgba(255,255,255,0.06);padding-top:20px;font-size:13px;color:#8A8A9A">Questions? Reply directly to this email or reach us at <a href="mailto:${ADMIN_EMAIL}" style="color:#8B5CF6;text-decoration:none">${ADMIN_EMAIL}</a></div>
  </div>
  <div style="padding:16px 32px;background:#07060F;text-align:center;font-size:11px;color:#5A5A6A">© Cafyz · ${APP_URL.replace('https://', '')} · All rights reserved</div>
</div>
</body>
</html>`;
}

function actionHtml(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title></head>
  <body style="margin:0;background:#07060F;color:#F5F5F0;font-family:Inter,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
    <div style="max-width:640px;width:100%;background:#0A0816;border:0.5px solid rgba(139,92,246,0.25);border-radius:16px;padding:28px">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8B5CF6">Cafyz Trial Confirmation</div>
      <h1 style="margin:10px 0 10px;font-family:Georgia,serif;font-size:28px">${esc(title)}</h1>
      <div style="color:#B8B8C2;line-height:1.7;font-size:14px">${body}</div>
      <div style="margin-top:16px;font-size:12px;color:#5A5A6A">Domain: ${esc(APP_URL)}</div>
    </div>
  </body></html>`;
}

// POST /api/inquiries
router.post('/', async (req, res, next) => {
  try {
    const body = InquirySchema.parse(req.body);
    const { name, restaurant_name, email, plan, message, device_id } = body;

    const ip = clientIp(req);
    const ua = String(req.headers['user-agent'] ?? '');
    const deviceHash = sha256Hex(`dev:${device_id}`);
    const ipHash     = sha256Hex(`ip:${ip}`);
    const uaHash     = sha256Hex(`ua:${ua}`);

    // Block multiple trial requests from the same system address (device/IP)
    let retryOfId: string | null = null;
    let isRetry = false;
    if (await isTrialDeviceGuardEnabled()) {
      const cooldownStart = new Date(Date.now() - TRIAL_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const existing = await getDb().execute({
        sql: `SELECT id,status,created_at,email FROM inquiries
              WHERE created_at >= ?
                AND (device_hash = ? OR ip_hash = ?)
                AND status IN ('pending','approved')
              ORDER BY created_at DESC
              LIMIT 1`,
        args: [cooldownStart, deviceHash, ipHash],
      });
      if ((existing.rows?.length ?? 0) > 0) {
        isRetry = true;
        retryOfId = String(existing.rows[0].id ?? '');
      }
    }

    const id = uid();
    const token = randomBytes(24).toString('hex');
    const tokenHash = sha256Hex(`tok:${token}`);

    await getDb().execute({
      sql: `INSERT INTO inquiries(id,name,restaurant_name,email,plan,message,status,is_retry,retry_of_id,device_hash,ip_hash,ua_hash,token_hash)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, name, restaurant_name, email, plan, message ?? null, 'pending', isRetry ? 1 : 0, retryOfId, deviceHash, ipHash, uaHash, tokenHash],
    });

    const approveUrl = `${baseUrl(req)}/api/inquiries/action?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&action=approve`;
    const denyUrl    = `${baseUrl(req)}/api/inquiries/action?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&action=deny`;

    const transporter = buildTransporter();
    if (transporter) {
      await Promise.all([
        transporter.sendMail({
          from:    `"Cafyz System" <${process.env.SMTP_USER}>`,
          to:      ADMIN_EMAIL,
          subject: `${isRetry ? '[Cafyz] Re-trial review needed' : '[Cafyz] Trial approval needed'} — ${plan.toUpperCase()} · ${restaurant_name}`,
          html:    adminHtml({ name, restaurantName: restaurant_name, email, plan, message, approveUrl, denyUrl }),
        }),
        transporter.sendMail({
          from:    `"Cafyz" <${process.env.SMTP_USER}>`,
          to:      email,
          replyTo: ADMIN_EMAIL,
          subject: `We received your request, ${name.split(' ')[0]} ✓ (pending approval)`,
          html:    autoReplyHtml(name, restaurant_name, plan),
        }),
      ]);
    }

    res.status(201).json({
      ok:      true,
      message: isRetry
        ? `Retry request submitted for founder review. Once approved, you'll receive trial access details.`
        : `Inquiry received. Your request is pending founder approval. Once approved, you'll receive a ${TRIAL_DAYS}-day free trial — no charge until the trial ends.`,
      trial_days: TRIAL_DAYS,
      app_url: APP_URL,
      retry_review: isRetry,
      ...(process.env.NODE_ENV !== 'production' ? { debug_approve_url: approveUrl } : {}),
    });
  } catch (e) {
    next(e);
  }
});

// Founder clicks approve/deny links from email.
router.get('/action', async (req, res, next) => {
  try {
    const id = String(req.query.id ?? '');
    const token = String(req.query.token ?? '');
    const action = String(req.query.action ?? '');
    if (!id || !token || !['approve', 'deny'].includes(action)) {
      res.status(400).send(actionHtml('Invalid link', 'This confirmation link is missing required parameters.'));
      return;
    }

    const rowRes = await getDb().execute({
      sql: `SELECT id, status, token_hash, name, restaurant_name, email, plan FROM inquiries WHERE id=? LIMIT 1`,
      args: [id],
    });
    const row: any = rowRes.rows?.[0];
    if (!row) {
      res.status(404).send(actionHtml('Not found', 'This request no longer exists.'));
      return;
    }

    const expected = Buffer.from(String(row.token_hash), 'hex');
    const actual = Buffer.from(sha256Hex(`tok:${token}`), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      res.status(403).send(actionHtml('Invalid token', 'This confirmation token is not valid.'));
      return;
    }

    if (String(row.status) !== 'pending') {
      res.status(200).send(actionHtml('Already processed', `This request is already <strong style="color:#F5F5F0">${esc(String(row.status))}</strong>.`));
      return;
    }

    const transporter = buildTransporter();
    const trialEnd = trialEndsDateLabel();

    if (action === 'approve') {
      await getDb().execute({
        sql: `UPDATE inquiries SET status='approved', approved_at=datetime('now') WHERE id=?`,
        args: [id],
      });

      if (transporter) {
        await transporter.sendMail({
          from: `"Cafyz" <${process.env.SMTP_USER}>`,
          to: String(row.email),
          replyTo: ADMIN_EMAIL,
          subject: `Approved: your ${TRIAL_DAYS}-day Cafyz trial for ${String(row.restaurant_name)} ✓`,
          html: `
<!doctype html><html><body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(46,204,138,0.35);border-radius:16px;overflow:hidden">
  <div style="padding:34px 32px;background:linear-gradient(135deg,#0d2a1f 0%,#0A0816 60%)">
    <div style="font-size:11px;color:#2ECC8A;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Trial approved</div>
    <div style="font-family:Georgia,serif;font-size:30px;margin-bottom:8px">Welcome to Cafyz, ${esc(String(row.name).split(' ')[0])}.</div>
    <div style="font-size:14px;color:#B8B8C2;line-height:1.7">Your request has been approved. You’ll receive a <strong style="color:#F5F5F0">${TRIAL_DAYS}-day free trial</strong> for the <strong style="color:#F5F5F0">${String(row.plan).toUpperCase()}</strong> plan. Billing begins only after your trial ends (target end: <strong style="color:#F5F5F0">${trialEnd}</strong>).</div>
  </div>
  <div style="padding:26px 32px;background:#0A0816">
    <p style="margin:0 0 14px;color:#B8B8C2;line-height:1.7;font-size:14px">Our founder will email you within 24 hours with your login credentials and a trial license key.</p>
    <div style="margin-top:16px">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#8B5CF6;color:#07060F;font-size:13px;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:10px">Open Sign In →</a>
      <div style="margin-top:10px;font-size:12px;color:#5A5A6A;word-break:break-all">${LOGIN_URL}</div>
    </div>
    <div style="margin-top:18px;font-size:13px;color:#8A8A9A">Questions? Reply to this email or contact <a href="mailto:${ADMIN_EMAIL}" style="color:#8B5CF6;text-decoration:none">${ADMIN_EMAIL}</a>.</div>
  </div>
</div>
</body></html>`,
        });
      }

      res.status(200).send(actionHtml('Trial approved', `This request is now <strong style="color:#2ECC8A">APPROVED</strong>.<br><br>The user has been notified. Next, generate a trial license key in the <a href="${FOUNDER_URL}" style="color:#8B5CF6;text-decoration:none">Founder Panel</a> and reply with credentials.`));
      return;
    }

    // deny
    await getDb().execute({
      sql: `UPDATE inquiries SET status='denied', denied_at=datetime('now') WHERE id=?`,
      args: [id],
    });
    res.status(200).send(actionHtml('Request denied', `This request is now <strong style="color:#ef4444">DENIED</strong>.`));
  } catch (e) { next(e); }
});

export default router;
