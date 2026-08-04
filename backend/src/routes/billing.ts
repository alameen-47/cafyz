import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { activateLicenseForRestaurant, getPlanConfigSummary } from '../services/licensePurchaseFulfillment.js';
import {
  createOrder,
  isRazorpayConfigured,
  planCurrencyCode,
  razorpayKeyId,
  toSubunit,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../services/razorpay.js';

const router = Router();

const PAID_PLANS = ['pro', 'premium'] as const;
type PaidPlan = (typeof PAID_PLANS)[number];

const orderSchema = z.object({
  plan: z.enum(PAID_PLANS),
});

// POST /api/billing/order — owner/manager creates a Razorpay order for a paid plan.
router.post('/order', requireAuth, requireRole('owner', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isRazorpayConfigured()) {
      res.status(503).json({ error: 'Online payments are not enabled yet. Please contact support to renew.', code: 'BILLING_DISABLED' });
      return;
    }
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'A valid paid plan (pro or premium) is required.' });
      return;
    }
    const plan: PaidPlan = parsed.data.plan;
    const rid = req.user!.restaurant_id;

    const cfg = await getPlanConfigSummary(plan);
    const priceMajor = Number(cfg?.price_monthly ?? 0);
    if (!cfg || !(priceMajor > 0)) {
      res.status(400).json({ error: 'This plan is not available for online purchase.' });
      return;
    }

    const restRow = await getDb().execute({
      sql: `SELECT name FROM restaurants WHERE id=? LIMIT 1`,
      args: [rid],
    });
    const restaurantName = String(restRow.rows[0]?.name ?? 'Cafyz');
    // Charge in the plan's pricing currency (founder's currency, e.g. INR → Canara),
    // not the restaurant's diner-facing operating currency.
    const currency = planCurrencyCode(cfg.currency_symbol as string | undefined);
    const amount = toSubunit(priceMajor, currency);

    const order = await createOrder({
      amount,
      currency,
      receipt: `cafyz_${rid}_${Date.now()}`,
      notes: { restaurant_id: rid, plan },
    });

    await getDb().execute({
      sql: `INSERT INTO billing_orders(order_id,restaurant_id,plan,amount,currency,status)
            VALUES(?,?,?,?,?, 'created')`,
      args: [order.id, rid, plan, amount, currency],
    });

    res.json({
      key_id: razorpayKeyId(),
      order_id: order.id,
      amount,
      currency,
      plan,
      name: restaurantName,
      description: `Cafyz ${plan.toUpperCase()} plan`,
      prefill: { email: req.user!.email ?? '' },
    });
  } catch (e) { next(e); }
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// POST /api/billing/verify — client posts the handler response; we verify server-side.
router.post('/verify', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing payment verification fields.' });
      return;
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    const rid = req.user!.restaurant_id;

    // The order must belong to this restaurant — never trust a client-supplied plan.
    const ordRow = await getDb().execute({
      sql: `SELECT plan, status FROM billing_orders WHERE order_id=? AND restaurant_id=? LIMIT 1`,
      args: [razorpay_order_id, rid],
    });
    const ord = ordRow.rows[0] as Record<string, unknown> | undefined;
    if (!ord) {
      res.status(404).json({ error: 'Order not found for this account.' });
      return;
    }

    const signatureOk = verifyPaymentSignature({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!signatureOk) {
      res.status(400).json({ error: 'Payment signature verification failed.', code: 'BAD_SIGNATURE' });
      return;
    }

    const plan = String(ord.plan);

    // Idempotent — a webhook may have already activated this order.
    if (String(ord.status) === 'paid') {
      const active = await currentExpiry(rid);
      res.json({ success: true, plan, expires_at: active, already: true });
      return;
    }

    const { licenseId, expiresAt } = await activateLicenseForRestaurant(
      rid,
      plan,
      `Razorpay payment · order ${razorpay_order_id}`,
    );
    await markOrderPaid(razorpay_order_id, razorpay_payment_id, licenseId);

    res.json({ success: true, plan, expires_at: expiresAt });
  } catch (e) { next(e); }
});

// ── Webhook (mounted with a raw body parser in app.ts, before express.json) ─────
// Razorpay POSTs payment.captured / order.paid; we activate idempotently.
export async function handleBillingWebhook(req: Request, res: Response) {
  try {
    const signature = String(req.headers['x-razorpay-signature'] ?? '');
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? (req.body as Buffer);
    const rawStr = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');

    if (!verifyWebhookSignature(rawStr, signature)) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = JSON.parse(rawStr) as {
      event?: string;
      payload?: {
        payment?: { entity?: { order_id?: string; id?: string } };
        order?: { entity?: { id?: string } };
      };
    };

    const orderId =
      event.payload?.payment?.entity?.order_id ??
      event.payload?.order?.entity?.id ??
      '';
    const paymentId = event.payload?.payment?.entity?.id ?? '';

    // Acknowledge everything (200) so Razorpay stops retrying; only act on relevant events.
    if (!orderId || !['payment.captured', 'order.paid'].includes(String(event.event))) {
      res.status(200).json({ received: true });
      return;
    }

    const ordRow = await getDb().execute({
      sql: `SELECT restaurant_id, plan, status FROM billing_orders WHERE order_id=? LIMIT 1`,
      args: [orderId],
    });
    const ord = ordRow.rows[0] as Record<string, unknown> | undefined;
    if (ord && String(ord.status) === 'created') {
      const { licenseId } = await activateLicenseForRestaurant(
        String(ord.restaurant_id),
        String(ord.plan),
        `Razorpay webhook · order ${orderId}`,
      );
      await markOrderPaid(orderId, paymentId, licenseId);
    }

    res.status(200).json({ received: true });
  } catch {
    // Never 500 a webhook on a parse hiccup — acknowledge so Razorpay stops retrying.
    res.status(200).json({ received: true });
  }
}

async function markOrderPaid(orderId: string, paymentId: string, licenseId: string): Promise<void> {
  await getDb().execute({
    sql: `UPDATE billing_orders
          SET status='paid', payment_id=?, license_key_id=?, paid_at=datetime('now')
          WHERE order_id=? AND status='created'`,
    args: [paymentId || null, licenseId, orderId],
  });
}

async function currentExpiry(rid: string): Promise<string> {
  const row = await getDb().execute({
    sql: `SELECT expires_at FROM license_keys WHERE restaurant_id=? AND is_active=1
          ORDER BY activated_at DESC LIMIT 1`,
    args: [rid],
  });
  return String(row.rows[0]?.expires_at ?? '');
}

export default router;
