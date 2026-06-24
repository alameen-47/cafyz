import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { appPath } from '../config/site.js';
import { sendMailReliable, founderFrom, founderReplyTo } from './email.js';

const PURCHASE_URL = appPath('/license');
const CHECK_INTERVAL_MS = Number(process.env.TRIAL_REMINDER_CHECK_MS ?? 60_000);
const REMINDER_DAYS_BEFORE = 3;

export type ReminderSlot = '10:00' | '18:00';

export function localParts(timeZone: string, date = new Date()) {
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

/** Morning 10:00 or evening 18:00 in the restaurant timezone (once per hour window). */
export function pickReminderSlot(hour: number, minute: number): ReminderSlot | null {
  if (hour === 10 && minute < 45) return '10:00';
  if (hour === 18 && minute < 45) return '18:00';
  return null;
}

/** Calendar days from today until expiry date in the given timezone (0 = expiry day). */
export function calendarDaysUntilExpiry(expiresAt: string, timeZone: string, now = new Date()): number {
  const toDay = (d: Date) => localParts(timeZone, d).date;
  const end = toDay(new Date(expiresAt));
  const start = toDay(now);
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(end) - parse(start)) / 86_400_000);
}

/** Remind twice daily from 3 days before through the expiry date (inclusive). */
export function shouldSendReminder(daysUntil: number): boolean {
  return daysUntil >= 0 && daysUntil <= REMINDER_DAYS_BEFORE;
}

function formatExpiryLabel(expiresAt: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(expiresAt));
  } catch {
    return new Date(expiresAt).toUTCString();
  }
}

function isTrialLicense(plan: string, note: string, keyCode?: string): boolean {
  const n = note.toLowerCase();
  if (n.includes('trial')) return true;
  if (keyCode?.toUpperCase().startsWith('TRIAL-')) return true;
  return false;
}

function reminderHtml(args: {
  name: string;
  restaurantName: string;
  expiresAt: string;
  timeZone: string;
  plan: string;
  daysUntil: number;
  slot: ReminderSlot;
  isTrial: boolean;
}) {
  const kind = args.isTrial ? 'free trial' : 'subscription';
  const when =
    args.daysUntil === 0
      ? `today (${formatExpiryLabel(args.expiresAt, args.timeZone)})`
      : args.daysUntil === 1
        ? `tomorrow (${formatExpiryLabel(args.expiresAt, args.timeZone)})`
        : `in ${args.daysUntil} days (${formatExpiryLabel(args.expiresAt, args.timeZone)})`;
  const slotLabel = args.slot === '10:00' ? 'morning' : 'evening';

  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:560px">
    <p>Hi ${args.name},</p>
    <p>Your Cafyz ${kind} for <strong>${args.restaurantName}</strong> ends <strong>${when}</strong>.</p>
    <p style="margin:16px 0;padding:14px 16px;background:#f1f5f9;border-radius:10px;font-size:14px;line-height:1.6">
      <b>Plan:</b> ${args.plan.toUpperCase()}<br/>
      <b>Renewal date:</b> ${formatExpiryLabel(args.expiresAt, args.timeZone)}<br/>
      <b>Reminder:</b> ${slotLabel} notice (${args.slot} local time)
    </p>
    <p>Renew before the expiry date to keep POS, kitchen, and staff access running without interruption.</p>
    <p style="margin:22px 0">
      <a href="${PURCHASE_URL}" style="background:#1e7fff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Renew or upgrade →</a>
    </p>
    <p style="color:#64748b;font-size:13px">Questions? Reply to this email — we're here to help.</p>
    <p>Thanks,<br/>Cafyz Team</p>
  </div>`;
}

function reminderSubject(args: {
  restaurantName: string;
  daysUntil: number;
  isTrial: boolean;
  slot: ReminderSlot;
}): string {
  const kind = args.isTrial ? 'Trial' : 'Subscription';
  const urgency =
    args.daysUntil === 0
      ? 'ends today'
      : args.daysUntil === 1
        ? 'ends tomorrow'
        : `ends in ${args.daysUntil} days`;
  const time = args.slot === '10:00' ? '10:00 AM' : '6:00 PM';
  return `[Cafyz] ${kind} ${urgency} — ${args.restaurantName} (${time} reminder)`;
}

async function alreadySent(restaurantId: string, userId: string, date: string, slot: ReminderSlot): Promise<boolean> {
  const row = await getDb().execute({
    sql: `SELECT id FROM trial_reminder_logs
          WHERE restaurant_id=? AND user_id=? AND reminder_date=? AND reminder_slot=?
          LIMIT 1`,
    args: [restaurantId, userId, date, slot],
  });
  return row.rows.length > 0;
}

async function markSent(restaurantId: string, userId: string, date: string, slot: ReminderSlot) {
  await getDb().execute({
    sql: `INSERT OR IGNORE INTO trial_reminder_logs(id,restaurant_id,user_id,reminder_date,reminder_slot)
          VALUES(?,?,?,?,?)`,
    args: [randomUUID(), restaurantId, userId, date, slot],
  });
}

async function runTick() {
  if (process.env.NODE_ENV === 'test') return;

  const db = getDb();
  const rows = await db.execute(`
    SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.timezone AS timezone,
      lk.expires_at AS expires_at,
      lk.plan AS plan,
      lk.note AS license_note,
      lk.key_code AS key_code
    FROM restaurants r
    JOIN license_keys lk ON lk.restaurant_id = r.id AND lk.is_active = 1
    WHERE lk.expires_at IS NOT NULL
  `);

  for (const row of rows.rows as Record<string, unknown>[]) {
    const expiresAt = String(row.expires_at ?? '');
    if (!expiresAt) continue;

    const tz = String(row.timezone || 'UTC');
    let nowLocal;
    try {
      nowLocal = localParts(tz);
    } catch {
      nowLocal = localParts('UTC');
    }

    const daysUntil = calendarDaysUntilExpiry(expiresAt, tz);
    if (!shouldSendReminder(daysUntil)) continue;

    const slot = pickReminderSlot(nowLocal.hour, nowLocal.minute);
    if (!slot) continue;

    const owner = await db.execute({
      sql: `SELECT id, name, email
            FROM users
            WHERE restaurant_id=?
              AND role='owner'
              AND status='active'
            ORDER BY created_at ASC
            LIMIT 1`,
      args: [String(row.restaurant_id)],
    });
    if (!owner.rows.length) continue;

    const u = owner.rows[0] as Record<string, unknown>;
    const email = String(u.email ?? '').trim();
    if (!email) continue;

    const restaurantId = String(row.restaurant_id);
    const userId = String(u.id);

    if (await alreadySent(restaurantId, userId, nowLocal.date, slot)) continue;

    const plan = String(row.plan ?? 'premium');
    const note = String(row.license_note ?? '');
    const keyCode = String(row.key_code ?? '');
    const isTrial = isTrialLicense(plan, note, keyCode);
    const restaurantName = String(row.restaurant_name ?? 'Restaurant');

    const result = await sendMailReliable({
      from: founderFrom(),
      replyTo: founderReplyTo(),
      to: email,
      subject: reminderSubject({
        restaurantName,
        daysUntil,
        isTrial,
        slot,
      }),
      html: reminderHtml({
        name: String(u.name ?? 'there'),
        restaurantName,
        expiresAt,
        timeZone: tz,
        plan,
        daysUntil,
        slot,
        isTrial,
      }),
    });

    if (result.ok) {
      await markSent(restaurantId, userId, nowLocal.date, slot);
      console.log(`[TrialReminder] Sent ${slot} ${isTrial ? 'trial' : 'renewal'} reminder to ${email} (${restaurantName}, ${daysUntil}d left)`);
    } else {
      console.error(`[TrialReminder] Failed sending to ${email}: ${result.error}`);
    }
  }
}

export function startTrialReminderScheduler() {
  if (process.env.TRIAL_REMINDER_ENABLED === 'false') {
    console.log('[TrialReminder] Scheduler disabled (TRIAL_REMINDER_ENABLED=false)');
    return () => {};
  }
  runTick().catch((e) => console.error('[TrialReminder] startup tick failed', e));
  const timer = setInterval(() => {
    runTick().catch((e) => console.error('[TrialReminder] tick failed', e));
  }, CHECK_INTERVAL_MS);
  console.log(`[TrialReminder] Scheduler started — ${REMINDER_DAYS_BEFORE} days before expiry, 10:00 & 18:00 local, owner only`);
  return () => clearInterval(timer);
}
