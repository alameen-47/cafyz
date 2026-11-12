import { createHash } from 'crypto';
import { getDb } from '../db.js';
import { cacheDelPrefix } from '../cache.js';

/**
 * Closed-test testers get a longer free trial than the public one.
 *
 * The list lives in the database (`tester_access`). The entries below are added to it on boot; one
 * already there is left as it is. A tester's longer trial is given once: to the trial restaurant
 * they already own, or to the one made when they first sign up, whichever way they sign in.
 *
 * This repository is public, so the list holds a SHA-256 of each email, not the address itself.
 */

export const TESTER_DAYS = 30;
const DAY = 86_400_000;

const TESTER_EMAIL_HASHES = [
  'c2c20191c7c8ae9367928fd5b8a92748214e105ce70c615ae7833b7a5a8286ed',
  '61ffef6509f2b5e9dc11e2aa5083f5a4e436c371a62d09a1bc2e12ba57840ab4',
  'baa11dd68c603365582225e42209bdaacc90f5c524146ecefdae73fda368c042',
  'fe58375972063dc97018e049664d1ff950407c879a3dd4ad68e387c984a69071',
  '6b4080e1f23bce0a2cfb8ec771e002480961e718a1392b8f5e72e0fbc02b64c9',
  '0bf58995cc009d4bf012e7b8970642ab961ddfb97de5329a3649f7ca53174bf9',
  '3b08b8c76ebebd4e1fbf687690e361960018a9d53b3fbf86bfedd43a48971119',
  '3517ed72dc4f6438a46ab49577981563e351097c72bbfa0e3e8e9675c1321475',
  'f1d3735c82b4d2bfbf52d4170f927ad50623df3379fea36a25c8025ba83aa9f2',
  '7d572f877cd49bf9d9306cafc1066172595d61593bedd508d1906e1498e00254',
  'ab1d105ad7ade86536638b49be39afec4d6c3ffa844da40f6db4b0064b7da51a',
  'e6b68e0d114430b22c84451ec2aa55841c112c31a8fb0dea4668c50b767a9534',
  'c1b4035b5a7a977e5550064f873fffe9823a78cb8fb51e3b2b63757280123e03',
  '72e5893fbac54eaa3bec0dd7edd8e9817c830952072d434264dcf928b243505e',
  'bdddaf4a811fcff334f3e9e78e98a5f8dbb38baa8419b66cf9e66d0f33b9804b',
  'a4ddad8fca0091d68d849f671e22a2fa84b9d2a3ad08da58b4fadf1515fe7988',
  'fe386556eb6e73a8fe651ce947e837feedf4825ade110160051d29a950b52ece',
  '34d42906cc4fefe91a693c484e617dc8b47b25c350b6e01b784ef3012e52cc69',
  '57883e4e8ebff690049f96aed43ab17ab4ec547ab6d11b037fbf0a229cb685f0',
];

export function testerHash(email: string): string {
  return createHash('sha256').update(`cafyz-tester:${String(email ?? '').trim().toLowerCase()}`).digest('hex');
}

/**
 * Gives a tester's restaurant its longer trial, once. Returns the new end (ISO), or null when the
 * email is not a tester, has already had it, or the restaurant has a paid licence still running.
 * Never shortens a licence.
 */
export async function applyTesterAccess(email: string, restaurantId: string, now = new Date()): Promise<string | null> {
  if (!email || !restaurantId) return null;
  const db = getDb();
  const hash = testerHash(email);

  // The licence the subscription guard reads: only a trial one is extended.
  const lic = await db.execute({
    sql: `SELECT id, key_code, note, expires_at FROM license_keys
          WHERE restaurant_id=? AND is_active=1
          ORDER BY activated_at DESC, created_at DESC
          LIMIT 1`,
    args: [restaurantId],
  });
  const row = lic.rows[0];
  if (!row) return null;
  const isTrial = String(row.key_code ?? '').startsWith('TRIAL-') || /trial/i.test(String(row.note ?? ''));
  const currentEnd = new Date(String(row.expires_at ?? ''));
  if (Number.isNaN(currentEnd.getTime())) return null;
  // A licence that is still running and is not a trial is a paid one: leave it alone. One that has
  // already run out locks the tester out whatever kind it was, so it is reopened.
  if (!isTrial && currentEnd > now) return null;

  const claim = await db.execute({
    sql: `UPDATE tester_access SET applied_at=?, restaurant_id=? WHERE email_hash=? AND applied_at IS NULL RETURNING days`,
    args: [now.toISOString(), restaurantId, hash],
  });
  if (!claim.rows.length) return null;

  const days = Number(claim.rows[0]!.days ?? TESTER_DAYS) || TESTER_DAYS;
  const wanted = new Date(now.getTime() + days * DAY);
  const expiresAt = (currentEnd > wanted ? currentEnd : wanted).toISOString();
  await db.batch([
    { sql: `UPDATE license_keys SET expires_at=?, note=? WHERE id=?`, args: [expiresAt, `Closed-test tester: ${days}-day trial`, String(row.id)] },
    { sql: `UPDATE tester_access SET expires_at=? WHERE email_hash=?`, args: [expiresAt, hash] },
  ], 'write');
  cacheDelPrefix(`sub:${restaurantId}`);
  return expiresAt;
}

/** On boot: put the testers on the list, then give the ones who already signed up their trial. */
export async function syncTesters(now = new Date()): Promise<void> {
  const db = getDb();
  await db.batch(
    TESTER_EMAIL_HASHES.map(h => ({ sql: `INSERT OR IGNORE INTO tester_access(email_hash, days) VALUES(?, ?)`, args: [h, TESTER_DAYS] })),
    'write',
  );

  const waiting = await db.execute(`SELECT email_hash FROM tester_access WHERE applied_at IS NULL`);
  if (!waiting.rows.length) return;
  const open = new Set(waiting.rows.map(r => String(r.email_hash)));
  // Hashes can't be matched in SQL, so each owner's email is hashed here.
  // Older restaurants (made from an approved trial request) are run by a manager, not an owner.
  const owners = await db.execute(`SELECT email, restaurant_id FROM users WHERE role IN ('owner','manager') AND email IS NOT NULL`);
  let given = 0;
  for (const o of owners.rows) {
    const email = String(o.email ?? '');
    if (!open.has(testerHash(email))) continue;
    if (await applyTesterAccess(email, String(o.restaurant_id), now)) given += 1;
  }
  if (given) console.log(`✓ Gave ${given} tester restaurant(s) a ${TESTER_DAYS}-day trial`);
}
