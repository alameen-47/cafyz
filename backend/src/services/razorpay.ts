import { createHmac, timingSafeEqual } from 'crypto';

// ── Razorpay Standard Checkout (Orders API) ─────────────────────────────────────
// We talk to Razorpay over plain REST (Basic auth) + verify signatures with the
// Node crypto module, so no extra SDK dependency is needed. Each paid order
// activates one license period via activateLicenseForRestaurant().

const API_BASE = 'https://api.razorpay.com/v1';

function keyId(): string     { return process.env.RAZORPAY_KEY_ID?.trim() ?? ''; }
function keySecret(): string { return process.env.RAZORPAY_KEY_SECRET?.trim() ?? ''; }
function webhookSecret(): string { return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? ''; }

export function razorpayKeyId(): string { return keyId(); }
export function isRazorpayConfigured(): boolean { return !!keyId() && !!keySecret(); }
export function isRazorpayWebhookConfigured(): boolean { return !!webhookSecret(); }

/**
 * Number of minor units in one major unit for a currency.
 * Razorpay expects the amount in the smallest subunit; most currencies are
 * 2-decimal (×100), JPY/KRW are 0-decimal (×1), KWD/BHD/OMR are 3-decimal (×1000).
 */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XOF', 'XAF']);
const THREE_DECIMAL = new Set(['KWD', 'BHD', 'OMR', 'IQD', 'JOD', 'LYD', 'TND']);

export function toSubunit(amountMajor: number, currency: string): number {
  const cur = currency.toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return Math.round(amountMajor);
  if (THREE_DECIMAL.has(cur)) {
    // Razorpay guideline: last decimal of a 3-decimal amount must be 0.
    return Math.round(amountMajor * 100) * 10;
  }
  return Math.round(amountMajor * 100);
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createOrder(opts: {
  amount: number;            // in minor units (subunit)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured (set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: opts.amount,
      currency: opts.currency,
      receipt: opts.receipt.slice(0, 40),
      notes: opts.notes ?? {},
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { description?: string } | undefined)?.description ?? res.statusText;
    throw new Error(`Razorpay order creation failed: ${err}`);
  }
  return data as unknown as RazorpayOrder;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify the checkout handler signature: HMAC_SHA256(order_id | payment_id, key_secret).
 * https://razorpay.com/docs — "Verify Payment Signature".
 */
export function verifyPaymentSignature(p: {
  order_id: string;
  payment_id: string;
  signature: string;
}): boolean {
  if (!keySecret()) return false;
  const expected = createHmac('sha256', keySecret())
    .update(`${p.order_id}|${p.payment_id}`)
    .digest('hex');
  return safeEqualHex(expected, p.signature);
}

/**
 * Verify a webhook payload signature: HMAC_SHA256(raw_body, webhook_secret),
 * compared against the X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  if (!webhookSecret() || !signature) return false;
  const expected = createHmac('sha256', webhookSecret())
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
}
