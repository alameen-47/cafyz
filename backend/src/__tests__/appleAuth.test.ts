/**
 * Sign in with Apple tests.
 *
 * Unlike the Google tests, nothing cryptographic is mocked: a throwaway RSA key
 * pair stands in for Apple's signing key and only the JWKS fetch is stubbed, so
 * the real signature, issuer, audience and expiry checks all run. That is the
 * part worth testing — a mistake there is an authentication bypass.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import { setupTestDb, OWNER_EMAIL } from './setup.js';
import { __resetAppleJwksCache } from '../services/appleAuth.js';

const BUNDLE_ID = 'com.cafyz.app';
const KID = 'test-apple-key';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...(publicKey.export({ format: 'jwk' }) as JsonWebKey), kid: KID, alg: 'RS256' };

/** Apple's /auth/keys response, with whatever keys a test wants to publish. */
function jwksResponse(keys: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ keys }) } as Response;
}

const fetchMock = vi.fn(async () => jwksResponse([publicJwk]));
vi.stubGlobal('fetch', fetchMock);

interface TokenOverrides {
  email?: string;
  email_verified?: boolean | string;
  aud?: string;
  iss?: string;
  sub?: string;
  expiresIn?: string;
  kid?: string;
}

function appleToken(o: TokenOverrides = {}): string {
  // aud and iss are signing options, not payload claims — jsonwebtoken refuses
  // a payload that already carries them.
  const { expiresIn = '10m', kid = KID, aud = BUNDLE_ID, iss = 'https://appleid.apple.com', ...claims } = o;
  return jwt.sign(
    {
      email: OWNER_EMAIL,
      email_verified: true,
      sub: '000123.abc.456',
      ...claims,
    },
    privateKey,
    { algorithm: 'RS256', issuer: iss, audience: aud, expiresIn, keyid: kid },
  );
}

const { default: app } = await import('../app.js');

beforeAll(async () => {
  process.env.APPLE_CLIENT_ID_IOS = BUNDLE_ID;
  await setupTestDb();
});

afterEach(() => {
  __resetAppleJwksCache();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => jwksResponse([publicJwk]));
});

describe('GET /api/auth/apple/config', () => {
  it('advertises the bundle id so the client can show the button', async () => {
    const res = await request(app).get('/api/auth/apple/config');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.client_id).toBe(BUNDLE_ID);
  });
});

describe('POST /api/auth/apple', () => {
  it('signs in an existing user with a correctly signed token', async () => {
    const res = await request(app).post('/api/auth/apple').send({ id_token: appleToken() });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(OWNER_EMAIL);
  });

  it('offers a trial signup for an address with no account', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ email: 'nobody@example.com' }), name: 'New Owner' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signup_required');
    expect(res.body.signup_token).toBeTruthy();
    expect(res.body.name).toBe('New Owner');
  });

  it('rejects a token signed by someone else', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const forged = jwt.sign({ email: OWNER_EMAIL, email_verified: true, sub: 'x' }, other, {
      algorithm: 'RS256',
      issuer: 'https://appleid.apple.com',
      audience: BUNDLE_ID,
      expiresIn: '10m',
      keyid: KID,
    });
    const res = await request(app).post('/api/auth/apple').send({ id_token: forged });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects a token minted for a different app', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ aud: 'com.someone.else' }) });
    expect(res.status).toBe(401);
  });

  it('rejects a token from the wrong issuer', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ iss: 'https://evil.example.com' }) });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ expiresIn: '-1m' }) });
    expect(res.status).toBe(401);
  });

  it('rejects an unverified email, which anyone could have claimed', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ email_verified: false }) });
    expect(res.status).toBe(401);
  });

  it('accepts email_verified as the string Apple sometimes sends', async () => {
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ email_verified: 'true' }) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('refetches the JWKS when Apple rotates to a key it has not seen', async () => {
    // Warm the cache with the old key only.
    await request(app).post('/api/auth/apple').send({ id_token: appleToken() });
    const callsAfterWarm = fetchMock.mock.calls.length;

    // Apple now signs with a new kid, which is only in the refreshed JWKS.
    const rotated = { ...publicJwk, kid: 'rotated-key' };
    fetchMock.mockImplementation(async () => jwksResponse([rotated]));

    const res = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ kid: 'rotated-key' }) });

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterWarm);
  });

  it('does not accept an Apple signup token on the Google signup route', async () => {
    const start = await request(app)
      .post('/api/auth/apple')
      .send({ id_token: appleToken({ email: 'crossuse@example.com' }) });
    expect(start.body.status).toBe('signup_required');

    const res = await request(app).post('/api/auth/google/signup').send({
      signup_token: start.body.signup_token,
      restaurant_name: 'Cross Use Cafe',
      phone: '+919876500011',
    });
    expect(res.status).toBe(401);
  });
});
