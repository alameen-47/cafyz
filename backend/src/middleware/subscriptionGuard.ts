import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.js';
import { getDb } from '../db.js';
import { appPath } from '../config/site.js';

const PURCHASE_URL = appPath('/license');

export async function requireActiveSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (req.user.role === 'founder') {
    next();
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
    const expiresAt = String(lic.rows[0]?.expires_at ?? '');
    if (!expiresAt) {
      next();
      return;
    }

    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() > Date.now()) {
      next();
      return;
    }

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
