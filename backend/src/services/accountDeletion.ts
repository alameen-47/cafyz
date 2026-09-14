import { getDb } from '../db.js';
import { invalidateUserAuthCache } from '../middleware/auth.js';

/**
 * Account deletion runs on a grace period. A request only schedules it, signing in again
 * before the date cancels it (issueLoginSession), and this sweep removes what is due.
 * Owners take their whole restaurant with them; staff remove only their own login.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;

const CHECK_INTERVAL_MS = 60 * 60_000;

export function accountDeletionDate(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + ACCOUNT_DELETION_GRACE_DAYS);
  return d.toISOString();
}

export function formatDeletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Deletes every row belonging to a restaurant — explicit, so nothing relies on foreign-key cascades. */
async function deleteRestaurantData(restaurantId: string): Promise<void> {
  const rid = restaurantId;
  const orders = `SELECT id FROM orders WHERE restaurant_id=?`;
  const tickets = `SELECT id FROM kds_tickets WHERE restaurant_id=?`;
  const users = `SELECT id FROM users WHERE restaurant_id=?`;
  await getDb().batch([
    { sql: `DELETE FROM kitchen_print_jobs WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM kds_ticket_items WHERE ticket_id IN (${tickets})`, args: [rid] },
    { sql: `DELETE FROM kds_tickets WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM order_items WHERE order_id IN (${orders})`, args: [rid] },
    { sql: `DELETE FROM orders WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM reservations WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM inventory WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM restaurant_tables WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM menu_items WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM menu_categories WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM trial_reminder_logs WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM billing_orders WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM license_purchase_requests WHERE restaurant_id=?`, args: [rid] },
    // Keys stay on record for the founder, but can never be activated again.
    { sql: `UPDATE license_keys SET is_active=0, restaurant_id=NULL WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM push_device_tokens WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM notification_reads WHERE user_id IN (${users})`, args: [rid] },
    { sql: `DELETE FROM password_reset_tokens WHERE user_id IN (${users})`, args: [rid] },
    { sql: `DELETE FROM login_otp_codes WHERE user_id IN (${users})`, args: [rid] },
    { sql: `DELETE FROM users WHERE restaurant_id=?`, args: [rid] },
    { sql: `DELETE FROM restaurants WHERE id=?`, args: [rid] },
  ], 'write');
}

async function deleteStaffAccount(userId: string): Promise<void> {
  await getDb().batch([
    { sql: `UPDATE orders SET server_id=NULL WHERE server_id=?`, args: [userId] },
    { sql: `UPDATE restaurant_tables SET server_id=NULL WHERE server_id=?`, args: [userId] },
    { sql: `UPDATE license_purchase_requests SET requester_user_id=NULL WHERE requester_user_id=?`, args: [userId] },
    { sql: `DELETE FROM trial_reminder_logs WHERE user_id=?`, args: [userId] },
    { sql: `DELETE FROM notification_reads WHERE user_id=?`, args: [userId] },
    { sql: `DELETE FROM push_device_tokens WHERE user_id=?`, args: [userId] },
    { sql: `DELETE FROM password_reset_tokens WHERE user_id=?`, args: [userId] },
    { sql: `DELETE FROM login_otp_codes WHERE user_id=?`, args: [userId] },
    { sql: `DELETE FROM users WHERE id=?`, args: [userId] },
  ], 'write');
}

/** Removes accounts whose grace period has ended. Returns how many were removed. */
export async function processDueAccountDeletions(now = new Date()): Promise<number> {
  const due = await getDb().execute({
    sql: `SELECT id, role, restaurant_id FROM users
          WHERE deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= ? AND role != 'founder'`,
    args: [now.toISOString()],
  });
  for (const row of due.rows as Record<string, unknown>[]) {
    const userId = String(row.id);
    if (String(row.role) === 'owner') await deleteRestaurantData(String(row.restaurant_id));
    else await deleteStaffAccount(userId);
    invalidateUserAuthCache(userId);
  }
  return due.rows.length;
}

export function startAccountDeletionScheduler(): () => void {
  const tick = () => processDueAccountDeletions()
    .then(n => { if (n) console.log(`[AccountDeletion] Removed ${n} account(s) after the ${ACCOUNT_DELETION_GRACE_DAYS}-day grace period`); })
    .catch(e => console.error('[AccountDeletion] sweep failed', e));
  void tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
