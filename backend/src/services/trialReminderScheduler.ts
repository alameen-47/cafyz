import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { appPath } from '../config/site.js';
import { sendMailReliable, smtpFrom } from './email.js';

const PURCHASE_URL = appPath('/license');
const CHECK_INTERVAL_MS = Number(process.env.TRIAL_REMINDER_CHECK_MS ?? 60_000);

type Slot = '10:00' | '18:00';

function localParts(timeZone: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function pickSlot(hour: number, minute: number): Slot | null {
  if (hour === 10 && minute < 10) return '10:00';
  if (hour === 18 && minute < 10) return '18:00';
  return null;
}

function daysLeft(expiresAt: string): number {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

function reminderHtml(args: {
  name: string;
  restaurantName: string;
  trialEndsAt: string;
  plan: string;
  daysLeft: number;
}) {
  const urgency = args.daysLeft <= 1
    ? 'Your Cafyz trial expires very soon.'
    : `Your Cafyz trial expires in ${args.daysLeft} days.`;
  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a">
    <p>Hi ${args.name},</p>
    <p>${urgency}</p>
    <p><b>Restaurant:</b> ${args.restaurantName}<br/>
       <b>Plan:</b> ${args.plan.toUpperCase()}<br/>
       <b>Trial ends:</b> ${new Date(args.trialEndsAt).toUTCString()}</p>
    <p>Keep your team running without interruption — renew your subscription:</p>
    <p style="margin:22px 0">
      <a href="${PURCHASE_URL}" style="background:#1e7fff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Renew subscription →</a>
    </p>
    <p style="color:#64748b;font-size:13px">Or open this link: <a href="${PURCHASE_URL}">${PURCHASE_URL}</a></p>
    <p>Thanks,<br/>Cafyz Team</p>
  </div>`;
}

async function alreadySent(restaurantId: string, userId: string, date: string, slot: Slot): Promise<boolean> {
  const row = await getDb().execute({
    sql: `SELECT id FROM trial_reminder_logs
          WHERE restaurant_id=? AND user_id=? AND reminder_date=? AND reminder_slot=?
          LIMIT 1`,
    args: [restaurantId, userId, date, slot],
  });
  return row.rows.length > 0;
}

async function markSent(restaurantId: string, userId: string, date: string, slot: Slot) {
  await getDb().execute({
    sql: `INSERT OR IGNORE INTO trial_reminder_logs(id,restaurant_id,user_id,reminder_date,reminder_slot)
          VALUES(?,?,?,?,?)`,
    args: [randomUUID(), restaurantId, userId, date, slot],
  });
}

async function runTick() {
  const db = getDb();
  const rows = await db.execute(`
    SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.timezone AS timezone,
      lk.expires_at AS expires_at,
      lk.plan AS plan
    FROM restaurants r
    JOIN license_keys lk ON lk.restaurant_id = r.id AND lk.is_active = 1
    WHERE lk.expires_at IS NOT NULL
  `);

  for (const row of rows.rows as any[]) {
    const expiresAt = String(row.expires_at ?? '');
    if (!expiresAt) continue;
    const left = daysLeft(expiresAt);
    if (left > 3 || left <= 0) continue; // remind from 3 days before expiry

    const tz = String(row.timezone || 'UTC');
    let nowLocal;
    try {
      nowLocal = localParts(tz);
    } catch {
      nowLocal = localParts('UTC');
    }
    const slot = pickSlot(nowLocal.hour, nowLocal.minute);
    if (!slot) continue;

    const recipients = await db.execute({
      sql: `SELECT id,name,email,role
            FROM users
            WHERE restaurant_id=?
              AND role IN ('owner','manager')
              AND status='active'
            ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, created_at ASC`,
      args: [String(row.restaurant_id)],
    });

    const selectedByRole = new Map<string, any>();
    for (const r of recipients.rows as any[]) {
      const role = String(r.role ?? '');
      if (!selectedByRole.has(role)) selectedByRole.set(role, r);
    }

    for (const u of selectedByRole.values()) {
      const email = String(u.email ?? '').trim();
      if (!email) continue;

      const sent = await alreadySent(String(row.restaurant_id), String(u.id), nowLocal.date, slot);
      if (sent) continue;

      const result = await sendMailReliable({
        from: smtpFrom(true),
        to: email,
        subject: `[Cafyz] Trial ending soon for ${String(row.restaurant_name)}`,
        html: reminderHtml({
          name: String(u.name ?? 'Team'),
          restaurantName: String(row.restaurant_name ?? 'Restaurant'),
          trialEndsAt: expiresAt,
          plan: String(row.plan ?? 'premium'),
          daysLeft: left,
        }),
      });

      if (result.ok) {
        await markSent(String(row.restaurant_id), String(u.id), nowLocal.date, slot);
      } else {
        console.error(`[TrialReminder] Failed sending to ${email}: ${result.error}`);
      }
    }
  }
}

export function startTrialReminderScheduler() {
  runTick().catch((e) => console.error('[TrialReminder] startup tick failed', e));
  const timer = setInterval(() => {
    runTick().catch((e) => console.error('[TrialReminder] tick failed', e));
  }, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
