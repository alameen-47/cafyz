import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.js';
import { getDb } from '../db.js';
import { appPath } from '../config/site.js';
import { cacheGet, cacheSet } from '../cache.js';

const PURCHASE_URL = appPath('/license');

// Cache subscription status for 30 s — avoids a DB round trip on every request.
const SUB_TTL = 30_000;

type SubStatus = { ok: true } | { ok: false; expiresAt: string };

export async function requireActiveSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (req.user.role === 'founder') {
    next();
    return;
  }

  const cacheKey = `sub:${req.user.restaurant_id}`;
  const cached = cacheGet<SubStatus>(cacheKey);
  if (cached) {
    if (cached.ok) { next(); return; }
    res.status(402).json({
      error: 'Trial expired. Please purchase a subscription to continue.',
      code: 'TRIAL_EXPIRED',
      trial_expires_at: cached.expiresAt,
      purchase_url: PURCHASE_URL,
    });
    return;
  }

  try {
    const lic = await getDb().execute({
      sql: `SELECT expires_at FROM license_keys
            WHERE restaurant_id=? AND is_active=1
            ORDER BY activated_at DESC, created_at DESC
            LIMIT 1`,
      args: [req.user.restaurant_id],
    });
    const paused = await getDb().execute({
      sql: `SELECT access_paused FROM restaurants WHERE id=? LIMIT 1`,
      args: [req.user.restaurant_id],
    });
    if (Number(paused.rows[0]?.access_paused ?? 0) === 1) {
      cacheSet(cacheKey, { ok: false, expiresAt: '' }, SUB_TTL);
      res.status(402).json({
        error: 'Restaurant access is paused. Contact Cafyz support.',
        code: 'ACCESS_PAUSED',
        purchase_url: PURCHASE_URL,
      });
      return;
    }
    const expiresAt = String(lic.rows[0]?.expires_at ?? '');
    if (!expiresAt) {
      cacheSet(cacheKey, { ok: true }, SUB_TTL);
      next();
      return;
    }

    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() > Date.now()) {
      cacheSet(cacheKey, { ok: true }, SUB_TTL);
      next();
      return;
    }

    cacheSet(cacheKey, { ok: false, expiresAt }, SUB_TTL);
    res.status(402).json({
      error: 'Trial expired. Please purchase a subscription to continue.',
      code: 'TRIAL_EXPIRED',
      trial_expires_at: expiresAt,
      purchase_url: PURCHASE_URL,
    });
  } catch (e) {
    next(e);
  }
}
