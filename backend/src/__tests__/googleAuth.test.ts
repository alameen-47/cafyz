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

  it('asks a new Google user for restaurant details before creating anything', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser('stranger@nowhere.io'));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signup_required');
    expect(res.body.signup_token).toBeTruthy();
    expect(res.body.token).toBeUndefined();
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

describe('POST /api/auth/google/signup', () => {
  async function signupToken(email: string): Promise<string> {
    verifyIdToken.mockResolvedValueOnce(googleUser(email));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.body.status).toBe('signup_required');
    return res.body.signup_token as string;
  }

  it('creates a restaurant on the top plan with a 3-day trial and signs the owner in', async () => {
    const token = await signupToken('newowner@gmail.test');
    const res = await request(app).post('/api/auth/google/signup')
      .send({ signup_token: token, restaurant_name: 'Masala House', phone: '+919876500001' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.restaurant_plan).toBe('premium');
    expect(res.body.user.role).toBe('owner');

    const sub = await request(app).get('/api/licenses/mine').set('Authorization', `Bearer ${res.body.token}`);
    expect(sub.body.on_trial).toBe(true);
    expect(sub.body.trial_expired).toBe(false);
    expect(sub.body.trial_days_left).toBe(3);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.password_login).toBe(0);
  });

  it('signs the same Google user straight in next time', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser('newowner@gmail.test'));
    const res = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.restaurant_name).toBe('Masala House');
  });

  it('lets a Google-only owner schedule deletion without a password', async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser('newowner@gmail.test'));
    const login = await request(app).post('/api/auth/google').send({ id_token: 'x'.repeat(32) });
    const res = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${login.body.token}`).send({ confirm: 'DELETE' });
    expect(res.status).toBe(200);
    expect(res.body.scheduled_for).toBeTruthy();
  });

  it('refuses a mobile number that is already registered', async () => {
    const token = await signupToken('second@gmail.test');
    const res = await request(app).post('/api/auth/google/signup')
      .send({ signup_token: token, restaurant_name: 'Second Place', phone: '+919876500001' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_EXISTS');
  });

  it('rejects a forged signup token', async () => {
    const forged = jwt.sign({ email: 'evil@gmail.test', purpose: 'google_signup' }, 'not-the-real-secret');
    const res = await request(app).post('/api/auth/google/signup')
      .send({ signup_token: forged, restaurant_name: 'Evil Eats', phone: '+919876500009' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('will not reuse a select token as a signup token', async () => {
    const wrongPurpose = jwt.sign({ email: 'sneaky@gmail.test', purpose: 'google_select' }, process.env.JWT_SECRET as string);
    const res = await request(app).post('/api/auth/google/signup')
      .send({ signup_token: wrongPurpose, restaurant_name: 'Sneaky Snacks', phone: '+919876500010' });
    expect(res.status).toBe(401);
  });
});
