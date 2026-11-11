/**
 * Email sign-in codes. No email provider is configured in tests, so the API hands
 * the code back as dev_otp (never in production) and everything else runs for real.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDb, OWNER_EMAIL, MANAGER_EMAIL, DEMO_REST } from './setup.js';
import { getDb } from '../db.js';
import { uid } from '../utils.js';
import { JWT_SECRET } from '../middleware/auth.js';

const { default: app } = await import('../app.js');

const SECOND_REST = 'TEST_REST_EMAIL_02';

beforeAll(async () => {
  for (const k of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k];
  await setupTestDb();
});

async function requestCode(email: string) {
  return request(app).post('/api/auth/email-otp/request').send({ email });
}

describe('POST /api/auth/email-otp/request', () => {
  it('answers the same way for an address with no account, and sends nothing', async () => {
    const known = await requestCode(OWNER_EMAIL);
    const unknown = await requestCode('nobody-here@example.test');
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
    expect(unknown.body.dev_otp).toBeUndefined();
  });

  it('refuses a second code within 30 seconds', async () => {
    const again = await requestCode(OWNER_EMAIL);
    expect(again.status).toBe(429);
  });

  it('rejects something that is not an email address', async () => {
    const res = await requestCode('not-an-email');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/email-otp/verify', () => {
  it('signs in with the emailed code, matching the address case-insensitively', async () => {
    await getDb().execute({ sql: 'DELETE FROM login_email_otp_codes WHERE email=?', args: [OWNER_EMAIL] });
    const sent = await requestCode(OWNER_EMAIL.toUpperCase());
    expect(sent.status).toBe(200);
    expect(sent.body.dev_otp).toMatch(/^\d{6}$/);

    const wrong = String((Number(sent.body.dev_otp) + 1) % 1_000_000).padStart(6, '0');
    const bad = await request(app).post('/api/auth/email-otp/verify').send({ email: OWNER_EMAIL, otp: wrong });
    expect(bad.status).toBe(401);
    expect(bad.body.token).toBeUndefined();

    const ok = await request(app).post('/api/auth/email-otp/verify').send({ email: OWNER_EMAIL, otp: sent.body.dev_otp });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.restaurant_id).toBe(DEMO_REST);
  });

  it('will not accept the same code twice', async () => {
    const res = await request(app).post('/api/auth/email-otp/verify').send({ email: OWNER_EMAIL, otp: '000000' });
    expect(res.status).toBe(400);
  });

  it('locks the code after five wrong tries', async () => {
    await getDb().execute({ sql: 'DELETE FROM login_email_otp_codes WHERE email=?', args: [OWNER_EMAIL] });
    const sent = await requestCode(OWNER_EMAIL);
    const wrong = String((Number(sent.body.dev_otp) + 1) % 1_000_000).padStart(6, '0');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/email-otp/verify').send({ email: OWNER_EMAIL, otp: wrong });
    }
    const right = await request(app).post('/api/auth/email-otp/verify').send({ email: OWNER_EMAIL, otp: sent.body.dev_otp });
    expect(right.status).toBe(429);
    expect(right.body.token).toBeUndefined();
  });
});

describe('an address used in two restaurants', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
      args: [SECOND_REST, 'Second Venue', 'second-venue-email', 'pro', 'UTC'],
    });
    await db.execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [uid(), SECOND_REST, 'Manager Two', 'MT', MANAGER_EMAIL, 'x', 'manager', 'active', '—'],
    });
  });

  it('asks which restaurant, then signs into the chosen one', async () => {
    const sent = await requestCode(MANAGER_EMAIL);
    const verified = await request(app).post('/api/auth/email-otp/verify').send({ email: MANAGER_EMAIL, otp: sent.body.dev_otp });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('choose_account');
    expect(verified.body.token).toBeUndefined();
    expect(verified.body.accounts).toHaveLength(2);

    const res = await request(app).post('/api/auth/email-otp/select')
      .send({ selection_token: verified.body.selection_token, restaurant_id: SECOND_REST });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.restaurant_id).toBe(SECOND_REST);
  });

  it('will not take a Google selection token', async () => {
    const google = jwt.sign({ email: MANAGER_EMAIL, purpose: 'google_select' }, JWT_SECRET, { expiresIn: 60 });
    const res = await request(app).post('/api/auth/email-otp/select')
      .send({ selection_token: google, restaurant_id: SECOND_REST });
    expect(res.status).toBe(401);
  });
});
