/**
 * Google Sign-In tests — the security-critical parts, without calling Google.
 *
 * verifyIdToken is mocked because the real one fetches Google's JWKS over the
 * network; everything downstream of "this email is proven" is exercised for
 * real, including the multi-restaurant chooser and its selection token.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDb, OWNER_EMAIL, DEMO_REST } from './setup.js';
import { getDb } from '../db.js';
import { uid } from '../utils.js';

const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock('google-auth-library', () => ({
  OAuth2Client: class { verifyIdToken = verifyIdToken; },
}));

const { default: app } = await import('../app.js');

/** Shape a google-auth-library ticket for a given payload. */
function ticket(payload: Record<string, unknown>) {
  return { getPayload: () => payload };
}
function googleUser(email: string, verified = true) {
  return ticket({ email, email_verified: verified, name: 'Test User' });
}

const SECOND_REST = 'TEST_REST_02';

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  await setupTestDb();
});

describe('GET /api/auth/google/config', () => {
  it('advertises the web client id so clients need no rebuild', async () => {
    const res = await request(app).get('/api/auth/google/config');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.client_id).toBe('test-client.apps.googleusercontent.com');
  });
});

describe('when Google sign-in is not configured', () => {
  it('reports disabled and refuses sign-in, so clients hide the button', async () => {
    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      const cfg = await request(app).get('/api/auth/google/config');
      expect(cfg.body.enabled).toBe(false);

      const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('GOOGLE_DISABLED');
    } finally {
      process.env.GOOGLE_CLIENT_ID = saved;
    }
  });
});

describe('POST /api/auth/google', () => {
  it('signs in an existing user whose email Google verified', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser(OWNER_EMAIL));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(OWNER_EMAIL);
  });

  it('refuses an unverified Google email', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser(OWNER_EMAIL, false));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('refuses a token Google rejects, without leaking the reason', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('Wrong recipient, payload audience != requiredAudience'));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(401);
    expect(res.body.error).not.toMatch(/audience/i);
  });

  it('never creates an account for an unknown address', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser('stranger@nowhere.io'));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GOOGLE_NO_ACCOUNT');
    const rows = await getDb().execute({
      sql: 'SELECT COUNT(*) AS n FROM users WHERE LOWER(email)=?',
      args: ['stranger@nowhere.io'],
    });
    expect(Number((rows.rows[0] as Record<string, unknown>).n)).toBe(0);
  });
});

describe('multi-restaurant chooser', () => {
  beforeAll(async () => {
    // Same email, second restaurant — legal, since users are UNIQUE per restaurant.
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO restaurants(id,name,slug,plan,timezone) VALUES(?,?,?,?,?)`,
      args: [SECOND_REST, 'Second Venue', 'second-venue', 'pro', 'UTC'],
    });
    await db.execute({
      sql: `INSERT INTO users(id,restaurant_id,name,initials,email,password_hash,role,status,start_time)
            VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [uid(), SECOND_REST, 'Owner Two', 'OT', OWNER_EMAIL, 'x', 'manager', 'active', '—'],
    });
  });

  it('asks which restaurant instead of guessing', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser(OWNER_EMAIL));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('choose_account');
    expect(res.body.token).toBeUndefined();
    expect(res.body.accounts).toHaveLength(2);
    expect(res.body.selection_token).toBeTruthy();
  });

  it('completes sign-in for the chosen restaurant', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser(OWNER_EMAIL));
    const first = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    const res = await request(app).post('/api/auth/google/select')
      .send({ selection_token: first.body.selection_token, restaurant_id: SECOND_REST });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.restaurant_id).toBe(SECOND_REST);
  });

  it('rejects a forged selection token', async () => {
    const forged = jwt.sign({ email: OWNER_EMAIL, purpose: 'google_select' }, 'not-the-real-secret');
    const res = await request(app).post('/api/auth/google/select')
      .send({ selection_token: forged, restaurant_id: DEMO_REST });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects a token minted for a different purpose', async () => {
    const wrongPurpose = jwt.sign(
      { email: OWNER_EMAIL, purpose: 'password_reset' },
      process.env.JWT_SECRET as string,
    );
    const res = await request(app).post('/api/auth/google/select')
      .send({ selection_token: wrongPurpose, restaurant_id: DEMO_REST });
    expect(res.status).toBe(401);
  });

  it('will not sign into a restaurant the proven email has no account in', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser(OWNER_EMAIL));
    const first = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    const res = await request(app).post('/api/auth/google/select')
      .send({ selection_token: first.body.selection_token, restaurant_id: 'CAFYZ_SYSTEM' });
    expect(res.status).toBe(404);
    expect(res.body.token).toBeUndefined();
  });
});
