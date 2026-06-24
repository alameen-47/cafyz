import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { appPath } from '../config/site.js';
import { ADMIN_EMAIL, founderFrom, founderReplyTo, sendMailReliable } from './email.js';

const LOGIN_URL = appPath('/login');

export function generateKeyCode(plan: string): string {
  const prefix = plan.toUpperCase().slice(0, 3);
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `CAFYZ-${prefix}-${rand}`;
}

export function sha256Token(token: string): string {
  return createHash('sha256').update(`tok:${token}`).digest('hex');
}

export function verifyActionToken(storedHash: string, token: string): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(sha256Token(token), 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function licenseExpiresAtForPlan(plan: string): Promise<string> {
  const row = await getDb().execute({
    sql: `SELECT billing_interval_unit, billing_interval_count, price_monthly, currency_symbol, label
          FROM plan_config WHERE plan=? LIMIT 1`,
    args: [plan],
  });
  const cfg = row.rows[0] as Record<string, unknown> | undefined;
  const count = Math.max(1, Number(cfg?.billing_interval_count ?? 1));
  const unit = String(cfg?.billing_interval_unit ?? 'month');
  const d = new Date();
  if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + count);
  else d.setUTCMonth(d.getUTCMonth() + count);
  return d.toISOString();
}

export async function getPlanConfigSummary(plan: string) {
  const row = await getDb().execute({
    sql: `SELECT plan, label, description, price_monthly, currency_symbol,
                 billing_interval_unit, billing_interval_count, panels_json
          FROM plan_config WHERE plan=? LIMIT 1`,
    args: [plan],
  });
  return (row.rows[0] ?? null) as Record<string, unknown> | null;
}

export type FulfillResult = {
  requestId: string;
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string;
  plan: string;
  keyCode: string;
  expiresAt: string;
  licenseId: string;
};

/** Approve renewal: issue + auto-activate license, update restaurant plan from founder config. */
export async function fulfillLicensePurchaseRequest(requestId: string): Promise<FulfillResult> {
  const db = getDb();
  const reqRow = await db.execute({
    sql: `SELECT lpr.*, r.name AS restaurant_name
          FROM license_purchase_requests lpr
          JOIN restaurants r ON r.id = lpr.restaurant_id
          WHERE lpr.id=? LIMIT 1`,
    args: [requestId],
  });
  if (!reqRow.rows.length) throw new Error('Renewal request not found');
  const purchase = reqRow.rows[0] as Record<string, unknown>;
  if (String(purchase.status) !== 'pending') {
    throw new Error(`Request already ${String(purchase.status)}`);
  }

  const plan = String(purchase.plan);
  const rid = String(purchase.restaurant_id);
  const email = String(purchase.email);
  const restaurantName = String(purchase.restaurant_name ?? 'Restaurant');
  const expiresAt = await licenseExpiresAtForPlan(plan);
  const licId = uid();
  const keyCode = generateKeyCode(plan);
  const now = new Date().toISOString();

  await db.batch([
    {
      sql: `UPDATE license_keys SET is_active=0 WHERE restaurant_id=? AND is_active=1`,
      args: [rid],
    },
    {
      sql: `INSERT INTO license_keys(id,key_code,plan,restaurant_id,activated_at,expires_at,is_active,note)
            VALUES(?,?,?,?,?,?,1,?)`,
      args: [licId, keyCode, plan, rid, now, expiresAt, `Renewal approved · request ${requestId}`],
    },
    {
      sql: `UPDATE restaurants SET plan=? WHERE id=?`,
      args: [plan, rid],
    },
    {
      sql: `UPDATE license_purchase_requests SET status='fulfilled', license_key_id=?, fulfilled_at=datetime('now') WHERE id=?`,
      args: [licId, requestId],
    },
  ]);

  const { cacheDel } = await import('../cache.js');
  cacheDel(`plan:${rid}`);
  cacheDel(`sub:${rid}`);

  const cfg = await getPlanConfigSummary(plan);
  const price = cfg ? `${cfg.currency_symbol ?? '$'}${cfg.price_monthly}` : '';

  await Promise.all([
    sendMailReliable({
      from: founderFrom(),
      replyTo: founderReplyTo(),
      to: email,
      subject: `[Cafyz] Renewal approved — ${restaurantName} (${plan.toUpperCase()})`,
      html: `<p>Your renewal for <b>${restaurantName}</b> has been <b style="color:#22c55e">approved</b>.</p>
             <p>Plan: <b>${plan.toUpperCase()}</b>${price ? ` · ${price}` : ''}<br/>
             Active until: <b>${new Date(expiresAt).toLocaleString()}</b></p>
             <p>Your license is already active — sign in to continue: <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>
             <p style="font-family:monospace;font-size:14px">Key (for your records): <b>${keyCode}</b></p>`,
    }),
    sendMailReliable({
      from: founderFrom(),
      to: ADMIN_EMAIL,
      subject: `[Cafyz] Renewal fulfilled — ${restaurantName}`,
      html: `<p>Renewal request <code>${requestId}</code> fulfilled for ${email}.</p>
             <p>Plan: ${plan.toUpperCase()} · Key: <code>${keyCode}</code></p>`,
    }),
  ]);

  return {
    requestId,
    restaurantId: rid,
    restaurantName,
    ownerEmail: email,
    plan,
    keyCode,
    expiresAt,
    licenseId: licId,
  };
}

export async function denyLicensePurchaseRequest(requestId: string): Promise<void> {
  const db = getDb();
  const reqRow = await db.execute({
    sql: `SELECT lpr.*, r.name AS restaurant_name FROM license_purchase_requests lpr
          JOIN restaurants r ON r.id = lpr.restaurant_id WHERE lpr.id=? LIMIT 1`,
    args: [requestId],
  });
  if (!reqRow.rows.length) throw new Error('Renewal request not found');
  const purchase = reqRow.rows[0] as Record<string, unknown>;
  if (String(purchase.status) !== 'pending') {
    throw new Error(`Request already ${String(purchase.status)}`);
  }

  await db.execute({
    sql: `UPDATE license_purchase_requests SET status='cancelled', fulfilled_at=datetime('now') WHERE id=?`,
    args: [requestId],
  });

  const email = String(purchase.email);
  const restaurantName = String(purchase.restaurant_name ?? 'Restaurant');

  await sendMailReliable({
    from: founderFrom(),
    replyTo: founderReplyTo(),
    to: email,
    subject: `[Cafyz] Renewal request update — ${restaurantName}`,
    html: `<p>Your renewal request for <b>${restaurantName}</b> was not approved at this time.</p>
           <p>Reply to this email or contact <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a> if you have questions.</p>
           <p>You can submit a new request from the License page in Cafyz.</p>`,
  });
}
