import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Client } from '@libsql/client';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { appPath, trialEndsAt, trialEndsDateLabel, TRIAL_DAYS } from '../config/site.js';
import { ADMIN_EMAIL, isEmailConfigured, sendMailReliable, smtpFrom } from './email.js';

const LOGIN_URL = appPath('/login');
const MANAGER_URL = appPath('/');

export type InquiryRow = {
  id: string;
  name: string;
  restaurant_name: string;
  email: string;
  plan: string;
  restaurant_id?: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${base || 'restaurant'}-${randomBytes(3).toString('hex')}`;
}

function generatePassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

function generateKeyCode(plan: string): string {
  const prefix = plan.toUpperCase().slice(0, 3);
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `CAFYZ-${prefix}-${rand}`;
}

/** Trial accounts use Pro+ so the manager dashboard and role assignment are available. */
function trialPlan(requested: string): 'basic' | 'pro' | 'premium' {
  if (requested === 'premium') return 'premium';
  return 'pro';
}

export type ProvisionResult = {
  restaurantId: string;
  userId: string;
  email: string;
  password: string;
  plan: string;
  licenseKey: string;
  alreadyProvisioned: boolean;
  /** True when the credentials email was successfully delivered to the user. */
  emailSent: boolean;
};

export async function provisionTrialFromInquiry(
  inquiry: InquiryRow,
  db: Client = getDb(),
): Promise<ProvisionResult> {
  if (inquiry.restaurant_id) {
    const existing = await db.execute({
      sql: `SELECT u.id, u.email FROM users u WHERE u.restaurant_id=? AND u.role='manager' ORDER BY u.created_at ASC LIMIT 1`,
      args: [inquiry.restaurant_id],
    });
    const lic = await db.execute({
      sql: `SELECT key_code FROM license_keys WHERE restaurant_id=? AND is_active=1 ORDER BY activated_at DESC LIMIT 1`,
      args: [inquiry.restaurant_id],
    });
    return {
      restaurantId: String(inquiry.restaurant_id),
      userId: String(existing.rows[0]?.id ?? ''),
      email: String(existing.rows[0]?.email ?? inquiry.email),
      password: '(already provisioned — use password reset or contact founder)',
      plan: trialPlan(inquiry.plan),
      licenseKey: String(lic.rows[0]?.key_code ?? ''),
      alreadyProvisioned: true,
      emailSent: false,
    };
  }

  const plan = trialPlan(inquiry.plan);
  const expiresAt = trialEndsAt();
  const restId = uid();
  const slug = slugify(inquiry.restaurant_name);
  const userId = uid();
  const password = generatePassword();
  const pwHash = await bcrypt.hash(password, 10);
  const initials = inquiry.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MG';

  const licId = uid();
  const keyCode = generateKeyCode(plan);
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
    args: [restId, inquiry.restaurant_name, slug, plan, 'UTC'],
  });

  await db.execute({
    sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time) VALUES(?,?,?,?,?,?,?,?,?)`,
    args: [userId, restId, inquiry.name, initials, inquiry.email.toLowerCase(), pwHash, 'manager', 'active', '—'],
  });

  await db.execute({
    sql: `INSERT INTO license_keys(id,key_code,plan,restaurant_id,activated_at,expires_at,note) VALUES(?,?,?,?,?,?,?)`,
    args: [licId, keyCode, plan, restId, now, expiresAt, `${TRIAL_DAYS}-day trial (from inquiry ${inquiry.id})`],
  });

  await db.execute({
    sql: `UPDATE inquiries SET status='approved', approved_at=datetime('now'), restaurant_id=?, provisioned_user_id=? WHERE id=?`,
    args: [restId, userId, inquiry.id],
  });

  return {
    restaurantId: restId,
    userId,
    email: inquiry.email.toLowerCase(),
    password,
    plan,
    licenseKey: keyCode,
    alreadyProvisioned: false,
    emailSent: false, // filled in by approveInquiryById after sendTrialApprovalEmails
  };
}

/** Returns true if the credentials email reached the user successfully. */
export async function sendTrialApprovalEmails(inquiry: InquiryRow, provision: ProvisionResult): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.error('[Email] No provider configured — credentials NOT emailed. Set RESEND_API_KEY or SMTP_USER/SMTP_PASS.');
    return false;
  }

  const trialEnd = trialEndsDateLabel();
  const first = esc(inquiry.name.split(' ')[0]);
  const restaurant = esc(inquiry.restaurant_name);
  const planLabel = provision.plan.toUpperCase();

  const [founderResult, userResult] = await Promise.all([
    sendMailReliable({
      from: smtpFrom(true),
      to: ADMIN_EMAIL,
      subject: `[Cafyz] Trial provisioned — ${inquiry.restaurant_name}`,
      html: `<p>Trial approved and account created automatically.</p>
             <p><b>Restaurant:</b> ${restaurant}<br/>
             <b>Manager:</b> ${esc(inquiry.name)} (${esc(provision.email)})<br/>
             <b>Plan:</b> ${planLabel}<br/>
             <b>License:</b> <code>${esc(provision.licenseKey)}</code><br/>
             <b>Trial ends:</b> ${trialEnd}</p>
             <p>Manager panel: <a href="${MANAGER_URL}">${MANAGER_URL}</a></p>`,
    }),
    sendMailReliable({
      from: smtpFrom(false),
      to: provision.email,
      replyTo: ADMIN_EMAIL,
      subject: `Your Cafyz trial is ready — login credentials inside`,
      html: `<!doctype html><html><body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(46,204,138,0.35);border-radius:16px;overflow:hidden">
  <div style="padding:32px;background:linear-gradient(135deg,#0d2a1f 0%,#0A0816 60%)">
    <div style="font-size:11px;color:#2ECC8A;text-transform:uppercase;letter-spacing:2px">Trial approved</div>
    <div style="font-family:Georgia,serif;font-size:28px;margin:12px 0">Welcome, ${first}.</div>
    <p style="font-size:14px;color:#B8B8C2;line-height:1.7">Your <strong>${TRIAL_DAYS}-day free trial</strong> for <strong>${restaurant}</strong> is active on the <strong>${planLabel}</strong> plan (ends ${trialEnd}).</p>
  </div>
  <div style="padding:28px 32px;background:#0A0816">
    <p style="font-size:13px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Sign in credentials</p>
    <table style="width:100%;font-size:14px;color:#F5F5F0">
      <tr><td style="padding:8px 0;color:#8A8A9A">Email</td><td><strong>${esc(provision.email)}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#8A8A9A">Password</td><td><strong style="font-family:monospace">${esc(provision.password)}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#8A8A9A">License key</td><td><strong style="font-family:monospace">${esc(provision.licenseKey)}</strong></td></tr>
    </table>
    <p style="margin:20px 0 8px;font-size:13px;color:#B8B8C2">You will land in the <strong>Manager Panel</strong>. Use <strong>Role Management</strong> to add cashiers, waiters, and kitchen staff.</p>
    <a href="${LOGIN_URL}" style="display:inline-block;background:#8B5CF6;color:#07060F;font-size:13px;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:10px;margin-top:8px">Sign in to Manager Panel →</a>
    <div style="margin-top:12px;font-size:12px;color:#5A5A6A;word-break:break-all">${LOGIN_URL}</div>
  </div>
</div></body></html>`,
    }),
  ]);

  if (!founderResult.ok) {
    console.error(`[Email] Founder notification failed (${provision.email}): ${founderResult.error}`);
  }
  if (!userResult.ok) {
    console.error(`[Email] Credentials email to ${provision.email} FAILED: ${userResult.error}`);
  } else {
    console.log(`[Email] Credentials sent to ${provision.email} via ${userResult.provider}`);
  }

  return userResult.ok;
}

export async function approveInquiryById(inquiryId: string): Promise<ProvisionResult> {
  const db = getDb();
  const row = await db.execute({
    sql: `SELECT id,name,restaurant_name,email,plan,status,restaurant_id FROM inquiries WHERE id=? LIMIT 1`,
    args: [inquiryId],
  });
  const inquiry = row.rows[0] as unknown as (InquiryRow & { status?: string }) | undefined;
  if (!inquiry) throw new Error('Inquiry not found');
  if (String(inquiry.status ?? '') === 'denied') throw new Error('Inquiry was denied');

  const provision = await provisionTrialFromInquiry(inquiry, db);
  if (!provision.alreadyProvisioned) {
    provision.emailSent = await sendTrialApprovalEmails(inquiry, provision);
  }
  return provision;
}
