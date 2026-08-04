/**
 * Razorpay billing tests — signature verification + tamper-proof license activation.
 * These exercise the security-critical paths without calling Razorpay's network:
 * orders are seeded directly and signatures are computed with the test key secret.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'crypto';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb, OWNER_EMAIL, OWNER_PASS, DEMO_REST } from './setup.js';
import { getDb } from '../db.js';
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  toSubunit,
} from '../services/razorpay.js';

const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'rzp_test_secret_abc123';
const WEBHOOK_SECRET = 'whsec_test_xyz';

let ownerToken = '';

function paymentSig(orderId: string, paymentId: string, secret = KEY_SECRET): string {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

async function seedOrder(orderId: string, plan = 'pro', rid = DEMO_REST) {
  await getDb().execute({
    sql: `INSERT INTO billing_orders(order_id,restaurant_id,plan,amount,currency,status)
          VALUES(?,?,?,?,?, 'created')`,
    args: [orderId, rid, plan, 9900, 'USD'],
  });
}

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  await setupTestDb();
  const res = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: OWNER_PASS });
  ownerToken = res.body.token;
});

describe('razorpay signature helpers', () => {
  it('accepts a correctly-signed payment', () => {
    const sig = paymentSig('order_A', 'pay_A');
    expect(verifyPaymentSignature({ order_id: 'order_A', payment_id: 'pay_A', signature: sig })).toBe(true);
  });

  it('rejects a tampered payment signature', () => {
    const sig = paymentSig('order_A', 'pay_A');
    expect(verifyPaymentSignature({ order_id: 'order_A', payment_id: 'pay_DIFFERENT', signature: sig })).toBe(false);
  });

  it('verifies a webhook body signature', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body, 'deadbeef')).toBe(false);
  });

  it('computes currency subunits correctly', () => {
    expect(toSubunit(99, 'USD')).toBe(9900);   // 2-decimal
    expect(toSubunit(99, 'INR')).toBe(9900);
    expect(toSubunit(500, 'JPY')).toBe(500);    // 0-decimal
    expect(toSubunit(10, 'KWD')).toBe(10000);   // 3-decimal, last digit 0
  });
});

describe('POST /api/billing/verify', () => {
  it('activates the license for a valid signature and matching order', async () => {
    await seedOrder('order_verify_ok', 'pro');
    const res = await request(app)
      .post('/api/billing/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        razorpay_order_id: 'order_verify_ok',
        razorpay_payment_id: 'pay_ok',
        razorpay_signature: paymentSig('order_verify_ok', 'pay_ok'),
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.plan).toBe('pro');
    expect(res.body.expires_at).toBeTruthy();

    // License is active + restaurant plan upgraded.
    const lic = await getDb().execute({
      sql: `SELECT plan,is_active FROM license_keys WHERE restaurant_id=? AND is_active=1`,
      args: [DEMO_REST],
    });
    expect(lic.rows[0]?.plan).toBe('pro');
    const rest = await getDb().execute({ sql: `SELECT plan FROM restaurants WHERE id=?`, args: [DEMO_REST] });
    expect(rest.rows[0]?.plan).toBe('pro');

    // Order marked paid.
    const ord = await getDb().execute({ sql: `SELECT status FROM billing_orders WHERE order_id=?`, args: ['order_verify_ok'] });
    expect(ord.rows[0]?.status).toBe('paid');
  });

  it('rejects a forged signature (does not activate)', async () => {
    await seedOrder('order_forged', 'premium');
    const res = await request(app)
      .post('/api/billing/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        razorpay_order_id: 'order_forged',
        razorpay_payment_id: 'pay_x',
        razorpay_signature: 'forged_signature_value',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_SIGNATURE');
    const ord = await getDb().execute({ sql: `SELECT status FROM billing_orders WHERE order_id=?`, args: ['order_forged'] });
    expect(ord.rows[0]?.status).toBe('created');
  });

  it('returns 404 for an order not owned by the caller', async () => {
    const res = await request(app)
      .post('/api/billing/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        razorpay_order_id: 'order_does_not_exist',
        razorpay_payment_id: 'pay_x',
        razorpay_signature: paymentSig('order_does_not_exist', 'pay_x'),
      });
    expect(res.status).toBe(404);
  });

  it('is idempotent — a second verify does not error', async () => {
    await seedOrder('order_idem', 'pro');
    const body = {
      razorpay_order_id: 'order_idem',
      razorpay_payment_id: 'pay_idem',
      razorpay_signature: paymentSig('order_idem', 'pay_idem'),
    };
    const first = await request(app).post('/api/billing/verify').set('Authorization', `Bearer ${ownerToken}`).send(body);
    const second = await request(app).post('/api/billing/verify').set('Authorization', `Bearer ${ownerToken}`).send(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.already).toBe(true);
  });
});

describe('POST /api/billing/webhook', () => {
  it('activates on payment.captured with a valid signature', async () => {
    await seedOrder('order_webhook', 'premium');
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh', order_id: 'order_webhook' } } },
    });
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sig)
      .send(payload);
    expect(res.status).toBe(200);

    const ord = await getDb().execute({ sql: `SELECT status FROM billing_orders WHERE order_id=?`, args: ['order_webhook'] });
    expect(ord.rows[0]?.status).toBe('paid');
  });

  it('rejects a webhook with an invalid signature', async () => {
    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'x' } } } });
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'bad')
      .send(payload);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/billing/order — config gate', () => {
  it('returns 503 when Razorpay is not configured', async () => {
    const savedId = process.env.RAZORPAY_KEY_ID;
    const savedSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    try {
      const res = await request(app)
        .post('/api/billing/order')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'pro' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_DISABLED');
    } finally {
      process.env.RAZORPAY_KEY_ID = savedId;
      process.env.RAZORPAY_KEY_SECRET = savedSecret;
    }
  });
});
