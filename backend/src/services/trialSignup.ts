import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { trialEndsAt, TRIAL_DAYS } from '../config/site.js';
import { BCRYPT_ROUNDS } from '../constants/security.js';
import { enableDemoDataForNewRestaurant } from './demoData.js';

export type TrialPlan = 'basic' | 'pro' | 'premium';

/** New self-serve restaurants trial the top plan, so every feature is open while they explore. */
export const TOP_PLAN: TrialPlan = 'premium';

export interface TrialRestaurantInput {
  restaurantName: string;
  ownerName: string;
  /** Normalised (lower-case) email. */
  email: string;
  /** E.164 mobile number. */
  phone: string;
  /** Omit for Google sign-ups: the owner signs in with Google until they set a password. */
  password?: string;
  plan?: TrialPlan;
  timezone?: string;
}

/**
 * Creates a restaurant, its owner and a TRIAL_DAYS trial licence, then loads demo data.
 * Callers make sure the email and phone are not already in use.
 */
export async function createTrialRestaurant(input: TrialRestaurantInput): Promise<{ restaurantId: string; ownerId: string }> {
  const restaurantId = uid();
  const ownerId = uid();
  const plan = input.plan ?? TOP_PLAN;
  const slugBase = input.restaurantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'restaurant';
  const passwordHash = await bcrypt.hash(input.password ?? randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  const initials = input.ownerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'OW';

  await getDb().batch([
    {
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone,currency_code) VALUES(?,?,?,?,?,'INR')`,
      args: [restaurantId, input.restaurantName, `${slugBase}-${restaurantId.slice(0, 6)}`, plan, input.timezone ?? 'UTC'],
    },
    {
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,phone,password_hash,role,status,start_time,password_login)
            VALUES(?,?,?,?,?,?,?,'owner','active','—',?)`,
      args: [ownerId, restaurantId, input.ownerName, initials, input.email, input.phone, passwordHash, input.password ? 1 : 0],
    },
    // The trial is an activated, time-limited licence. Once it lapses, requireActiveSubscription
    // blocks the app until the owner activates a licence key issued from the founder panel.
    {
      sql: `INSERT INTO license_keys(id,key_code,plan,restaurant_id,activated_at,expires_at,note) VALUES(?,?,?,?,?,?,?)`,
      args: [
        uid(), `TRIAL-${uid().replace(/-/g, '').slice(0, 12).toUpperCase()}`, plan, restaurantId,
        new Date().toISOString(), trialEndsAt(), `Auto ${TRIAL_DAYS}-day trial`,
      ],
    },
  ], 'write');

  await enableDemoDataForNewRestaurant(restaurantId);
  return { restaurantId, ownerId };
}
