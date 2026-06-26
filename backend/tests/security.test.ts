import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import {
  escapeLikePattern,
  escHtml,
  isPasswordTooLong,
  PASSWORD_MAX_LENGTH,
  safeRegexTest,
  redactSecretsFromObject,
} from '../src/utils/security.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

describe('security utilities', () => {
  it('rejects passwords over max length (long-password DoS guard)', () => {
    expect(isPasswordTooLong('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(false);
    expect(isPasswordTooLong('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(true);
  });

  it('escapes HTML for email/action pages (SSTI-safe string building)', () => {
    expect(escHtml('<script>{{7*7}}</script>')).toBe('&lt;script&gt;{{7*7}}&lt;/script&gt;');
    expect(escHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes SQL LIKE wildcards (pattern injection)', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash');
  });

  it('bounds regex input length (ReDoS mitigation)', () => {
    const evil = 'a'.repeat(5000);
    expect(safeRegexTest(/(a+)+$/, evil, 2000)).toBe(false);
    expect(safeRegexTest(/^\+[1-9]\d{7,14}$/, '+971500000000')).toBe(true);
  });

  it('redacts cloud storage and API secrets from objects (S3/Cloudinary exposure)', () => {
    const cleaned = redactSecretsFromObject({
      name: 'Cafyz',
      CLOUDINARY_API_SECRET: 'sekret',
      AWS_SECRET_ACCESS_KEY: 'aws-key',
      nested: { JWT_SECRET: 'jwt', plan: 'pro' },
    });
    expect(cleaned).toEqual({ name: 'Cafyz', nested: { plan: 'pro' } });
  });
});

describe('login replay protection', () => {
  it('invalidates previous JWT after a new login', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });
    expect(first.status).toBe(200);
    const oldToken = first.body.token as string;

    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });
    expect(second.status).toBe(200);

    const replay = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(replay.status).toBe(401);
  });

  it('rejects oversized login payloads (long-password DoS)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'x'.repeat(200) });
    expect(res.status).toBe(400);
  });
});
