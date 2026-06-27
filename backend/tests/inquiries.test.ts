import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getDb } from '../src/db.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { approveInquiryById } from '../src/services/inquiryApproval.js';

beforeAll(setupTestDb);
afterAll(teardownTestDb);

describe('POST /api/inquiries', () => {
  it('requires a valid mobile number', async () => {
    const res = await request(app).post('/api/inquiries').send({
      name: 'Trial User',
      restaurant_name: 'New Cafe',
      email: 'trial@example.com',
      phone: 'invalid',
      plan: 'pro',
      device_id: 'test-device-inquiry-1',
    });
    expect(res.status).toBe(400);
  });

  it('stores trial request with phone', async () => {
    const res = await request(app).post('/api/inquiries').send({
      name: 'Trial User',
      restaurant_name: 'New Cafe',
      email: 'trial@example.com',
      phone: '+33600000999',
      plan: 'pro',
      device_id: 'test-device-inquiry-2',
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const row = await getDb().execute({
      sql: `SELECT phone FROM inquiries WHERE email=? ORDER BY created_at DESC LIMIT 1`,
      args: ['trial@example.com'],
    });
    expect(row.rows[0]?.phone).toBe('+33600000999');
  });
});

describe('trial approval provisioning', () => {
  it('creates valid login credentials for email and phone', async () => {
    const db = getDb();
    const inquiryId = `inq_test_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO inquiries(id,name,restaurant_name,email,phone,plan,status,is_retry,device_hash,ip_hash,ua_hash,token_hash)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        inquiryId,
        'Approved User',
        'Approved Cafe',
        'approved@example.com',
        '+33600000888',
        'pro',
        'pending',
        0,
        'devhash',
        'iphash',
        'uahash',
        '00'.repeat(32),
      ],
    });

    const provision = await approveInquiryById(inquiryId);

    expect(provision.password.length).toBeGreaterThanOrEqual(8);
    expect(provision.phone).toBe('+33600000888');

    const byEmail = await request(app).post('/api/auth/login').send({
      login: provision.email,
      password: provision.password,
    });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.user.role).toBe('manager');

    const byPhone = await request(app).post('/api/auth/login').send({
      login: provision.phone,
      password: provision.password,
    });
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.user.email).toBe(provision.email);
  });
});
